package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// CRMRepository is the postgres adapter for §15 Customer CRM. The customer
// set is DERIVED per query — orders ∪ order_measurements for the tenant
// (§15.3 auto-populated; the order flow never writes the customer_businesses
// junction, so reading it would show an empty CRM). Every method opens a
// tenant-scoped transaction (RLS + an explicit business_id predicate, §6
// defense in depth); annotations (notes/tags, 000110/000111) are the only
// writes, and both refuse customers with no relationship to THIS store.
type CRMRepository struct {
	pool *pgxpool.Pool
}

func NewCRMRepository(pool *pgxpool.Pool) CRMRepository {
	return CRMRepository{pool: pool}
}

func (repo CRMRepository) beginScoped(ctx context.Context, scope common.TenantScope) (pgx.Tx, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if err := setTenantScope(ctx, tx, scope); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

// crmRelationshipExistsSQL is the shared §15.3 derivation predicate, reused by
// the annotation writes so a store can never annotate a stranger's customer.
// Erased customers (000043) drop out of the CRM entirely: an erased identity
// has no contact details by design, so there is nothing to list or annotate.
const crmRelationshipExistsSQL = `
	exists (
		select 1 from orders o
		where o.business_id = $1 and o.customer_id = $2
	) or exists (
		select 1 from order_measurements m
		where m.business_id = $1 and m.customer_id = $2
	)`

// listCustomersSQL derives the §15.1 list page. Draft orders are excluded
// from every figure (abandoned checkouts, not orders — the §14 rule). The
// money/count/tag filters sit on the order_stats aggregate; search matches
// name/phone case-insensitively. `$9 = 0` disables the LIMIT (export reads
// the whole list). count(*) over() carries the page-independent total.
const listCustomersSQL = `
	with rel as (
		select customer_id from orders where business_id = $1
		union
		select customer_id from order_measurements where business_id = $1
	),
	order_stats as (
		select
			customer_id,
			count(*)::int as orders_count,
			coalesce(sum(agreed_total_minor), 0)::bigint as total_spend_minor,
			max(created_at) as last_order_at,
			min(created_at) as first_order_at
		from orders
		where business_id = $1 and status <> 'draft'
		group by customer_id
	),
	first_order as (
		select distinct on (customer_id) customer_id, channel
		from orders
		where business_id = $1 and status <> 'draft'
		order by customer_id, created_at asc, order_id asc
	)
	select
		c.customer_id::text,
		coalesce(c.display_name, ''),
		coalesce(c.phone, ''),
		coalesce(c.whatsapp_number, ''),
		coalesce(fo.channel, ''),
		os.last_order_at,
		coalesce(os.orders_count, 0),
		coalesce(os.total_spend_minor, 0),
		count(*) over()::int as total_count
	from rel
	join customers c on c.customer_id = rel.customer_id and c.erased_at is null
	left join order_stats os on os.customer_id = rel.customer_id
	left join first_order fo on fo.customer_id = rel.customer_id
	where ($2 = '' or c.display_name ilike '%' || $2 || '%' or c.phone ilike '%' || $2 || '%')
		and ($3 = '' or exists (
			select 1 from business_customer_tags t
			where t.business_id = $1 and t.customer_id = rel.customer_id and t.tag = $3
		))
		and ($4 = '' or case $4
			when 'new' then os.first_order_at >= $8::timestamptz - interval '30 days'
			when 'returning' then os.orders_count > 1
			when 'lapsed' then os.last_order_at < $8::timestamptz - interval '90 days'
		end)
		and ($5::bigint is null or os.total_spend_minor >= $5)
		and ($6::timestamptz is null or os.last_order_at < $6)
		and ($7::timestamptz is null or os.last_order_at >= $7)
	order by os.last_order_at desc nulls last, c.customer_id asc
	limit nullif($9, 0) offset $10`

func (repo CRMRepository) ListCustomers(ctx context.Context, scope common.TenantScope, query ports.CRMCustomerQuery) (ports.CRMCustomerList, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return ports.CRMCustomerList{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	rows, err := tx.Query(ctx, listCustomersSQL,
		scope.BusinessID.String(),
		query.Q,
		query.Tag,
		query.Segment,
		minorPtrArg(query.MinSpendMinor),
		timePtrArg(query.LastOrderBefore),
		timePtrArg(query.LastOrderAfter),
		query.Now,
		query.Limit,
		query.Offset,
	)
	if err != nil {
		return ports.CRMCustomerList{}, err
	}
	defer rows.Close()

	list := ports.CRMCustomerList{Customers: []ports.CRMCustomerRow{}}
	customerIDs := make([]string, 0)
	for rows.Next() {
		var row ports.CRMCustomerRow
		if err := rows.Scan(
			&row.CustomerID, &row.DisplayName, &row.Phone, &row.WhatsAppNumber,
			&row.Source, &row.LastOrderAt, &row.OrdersCount, &row.TotalSpendMinor,
			&list.Total,
		); err != nil {
			return ports.CRMCustomerList{}, err
		}
		list.Customers = append(list.Customers, row)
		customerIDs = append(customerIDs, row.CustomerID.String())
	}
	if err := rows.Err(); err != nil {
		return ports.CRMCustomerList{}, err
	}
	rows.Close()

	tags, err := crmTagsForCustomers(ctx, tx, scope.BusinessID, customerIDs)
	if err != nil {
		return ports.CRMCustomerList{}, err
	}
	for i := range list.Customers {
		list.Customers[i].Tags = tags[list.Customers[i].CustomerID.String()]
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.CRMCustomerList{}, err
	}
	return list, nil
}

// crmTagsForCustomers loads the §15.1 tag sets for one page of customers in a
// single query (never N+1), keyed by customer id.
func crmTagsForCustomers(ctx context.Context, tx pgx.Tx, businessID common.ID, customerIDs []string) (map[string][]string, error) {
	tags := map[string][]string{}
	if len(customerIDs) == 0 {
		return tags, nil
	}
	rows, err := tx.Query(ctx, `
		select customer_id::text, tag
		from business_customer_tags
		where business_id = $1 and customer_id = any($2::uuid[])
		order by tag
	`, businessID.String(), customerIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var customerID, tag string
		if err := rows.Scan(&customerID, &tag); err != nil {
			return nil, err
		}
		tags[customerID] = append(tags[customerID], tag)
	}
	return tags, rows.Err()
}

func minorPtrArg(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}
