package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// GetCustomerProfile assembles the §15.1 profile for ONE customer of the
// tenant: identity + contact (powers the call/WhatsApp buttons), the full
// non-draft order history with THIS store, saved measurements (the same
// order_measurements rows the measurement module writes, §15.3), and the
// tenant-owned note/tags. A customer with no relationship to this store — or
// an erased identity — is ports.ErrNotFound (cross-tenant reads fail closed
// as an ordinary 404, §6).
//
//nolint:funlen,gocognit,gocyclo // builds one customer profile snapshot from optional identity, order, note, and measurement rows
func (repo CRMRepository) GetCustomerProfile(ctx context.Context, scope common.TenantScope, customerID common.ID) (ports.CRMCustomerProfile, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return ports.CRMCustomerProfile{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	profile := ports.CRMCustomerProfile{
		Orders:       []ports.CRMOrderSummary{},
		Measurements: []ports.CRMMeasurement{},
		Tags:         []string{},
	}
	err = tx.QueryRow(ctx, `
		select c.customer_id::text, coalesce(c.display_name, ''), coalesce(c.phone, ''),
			coalesce(c.whatsapp_number, ''), coalesce(c.email, '')
		from customers c
		where c.customer_id = $2 and c.erased_at is null and (`+crmRelationshipExistsSQL+`)
	`, scope.BusinessID.String(), customerID.String()).Scan(
		&profile.CustomerID, &profile.DisplayName, &profile.Phone,
		&profile.WhatsAppNumber, &profile.Email,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.CRMCustomerProfile{}, ports.ErrNotFound
		}
		return ports.CRMCustomerProfile{}, err
	}

	orderRows, err := tx.Query(ctx, `
		select order_id::text, status, agreed_total_minor, settled_minor, created_at
		from orders
		where business_id = $1 and customer_id = $2 and status <> 'draft'
		order by created_at desc, order_id desc
	`, scope.BusinessID.String(), customerID.String())
	if err != nil {
		return ports.CRMCustomerProfile{}, err
	}
	for orderRows.Next() {
		var order ports.CRMOrderSummary
		if err := orderRows.Scan(&order.OrderID, &order.Status, &order.AgreedTotalMinor, &order.SettledMinor, &order.CreatedAt); err != nil {
			orderRows.Close()
			return ports.CRMCustomerProfile{}, err
		}
		profile.Orders = append(profile.Orders, order)
		profile.OrdersCount++
		if order.AgreedTotalMinor != nil {
			profile.TotalSpendMinor += *order.AgreedTotalMinor
		}
	}
	orderRows.Close()
	if err := orderRows.Err(); err != nil {
		return ports.CRMCustomerProfile{}, err
	}
	// History is newest-first: the head is the last order, the tail the first;
	// the first order's channel is the customer's §15.1 "source".
	if len(profile.Orders) > 0 {
		last := profile.Orders[0].CreatedAt
		first := profile.Orders[len(profile.Orders)-1].CreatedAt
		profile.LastOrderAt = &last
		profile.FirstOrderAt = &first
	}

	measurementRows, err := tx.Query(ctx, `
		select measurement_id::text, order_id::text, source, values, created_at
		from order_measurements
		where business_id = $1 and customer_id = $2
		order by created_at desc
	`, scope.BusinessID.String(), customerID.String())
	if err != nil {
		return ports.CRMCustomerProfile{}, err
	}
	for measurementRows.Next() {
		var measurement ports.CRMMeasurement
		var rawValues []byte
		if err := measurementRows.Scan(
			&measurement.MeasurementID, &measurement.OrderID, &measurement.Source, &rawValues, &measurement.CreatedAt,
		); err != nil {
			measurementRows.Close()
			return ports.CRMCustomerProfile{}, err
		}
		if err := json.Unmarshal(rawValues, &measurement.Values); err != nil {
			measurementRows.Close()
			return ports.CRMCustomerProfile{}, err
		}
		profile.Measurements = append(profile.Measurements, measurement)
	}
	measurementRows.Close()
	if err := measurementRows.Err(); err != nil {
		return ports.CRMCustomerProfile{}, err
	}

	// The tenant-owned annotations (000110/000111). Absent rows are ordinary
	// empty values, not errors.
	_ = tx.QueryRow(ctx, `
		select note, updated_at from business_customer_notes
		where business_id = $1 and customer_id = $2
	`, scope.BusinessID.String(), customerID.String()).Scan(&profile.Note, &profile.NoteUpdatedAt)

	tagRows, err := tx.Query(ctx, `
		select tag from business_customer_tags
		where business_id = $1 and customer_id = $2
		order by tag
	`, scope.BusinessID.String(), customerID.String())
	if err != nil {
		return ports.CRMCustomerProfile{}, err
	}
	for tagRows.Next() {
		var tag string
		if err := tagRows.Scan(&tag); err != nil {
			tagRows.Close()
			return ports.CRMCustomerProfile{}, err
		}
		profile.Tags = append(profile.Tags, tag)
	}
	tagRows.Close()
	if err := tagRows.Err(); err != nil {
		return ports.CRMCustomerProfile{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.CRMCustomerProfile{}, err
	}
	return profile, nil
}

// UpsertNote saves the owner's §15.1 note. The INSERT ... WHERE relationship
// guard makes a relationship-less customer insert zero rows, which RETURNING
// surfaces as ErrNoRows → ports.ErrNotFound: a store cannot annotate a
// stranger's customer (§6). On conflict the note text + updated_at rotate.
func (repo CRMRepository) UpsertNote(ctx context.Context, scope common.TenantScope, customerID common.ID, note string) (ports.CRMCustomerNote, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return ports.CRMCustomerNote{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	var saved ports.CRMCustomerNote
	err = tx.QueryRow(ctx, `
		insert into business_customer_notes (business_id, customer_id, note)
		select $1, $2, $3
		where exists (
			select 1 from customers c
			where c.customer_id = $2 and c.erased_at is null and (`+crmRelationshipExistsSQL+`)
		)
		on conflict (business_id, customer_id) do update
		set note = excluded.note, updated_at = now()
		returning note, updated_at
	`, scope.BusinessID.String(), customerID.String(), note).Scan(&saved.Note, &saved.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.CRMCustomerNote{}, ports.ErrNotFound
		}
		return ports.CRMCustomerNote{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.CRMCustomerNote{}, err
	}
	return saved, nil
}

// ReplaceTags swaps the customer's whole §15.1 tag set in one transaction
// (delete-and-insert), so the stored set always equals the requested set even
// under concurrent edits — last writer wins wholesale, never a merge.
func (repo CRMRepository) ReplaceTags(ctx context.Context, scope common.TenantScope, customerID common.ID, tags []string) error {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	var related bool
	if err := tx.QueryRow(ctx, `
		select exists (
			select 1 from customers c
			where c.customer_id = $2 and c.erased_at is null and (`+crmRelationshipExistsSQL+`)
		)
	`, scope.BusinessID.String(), customerID.String()).Scan(&related); err != nil {
		return err
	}
	if !related {
		return ports.ErrNotFound
	}

	if _, err := tx.Exec(ctx, `
		delete from business_customer_tags where business_id = $1 and customer_id = $2
	`, scope.BusinessID.String(), customerID.String()); err != nil {
		return err
	}
	for _, tag := range tags {
		if _, err := tx.Exec(ctx, `
			insert into business_customer_tags (business_id, customer_id, tag) values ($1, $2, $3)
		`, scope.BusinessID.String(), customerID.String(), tag); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// Insights computes the §15.1 Growth figures from the order_stats aggregate:
// new = first order with this store within the 30 days before `now`;
// returning = more than one order; lapsed = no order in the 90 days before
// `now` (longest-absent first). Erased identities are excluded, like the list.
func (repo CRMRepository) Insights(ctx context.Context, scope common.TenantScope, now time.Time) (ports.CRMInsights, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return ports.CRMInsights{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	const orderStatsCTE = `
		with order_stats as (
			select
				customer_id,
				count(*)::int as orders_count,
				max(created_at) as last_order_at,
				min(created_at) as first_order_at
			from orders
			where business_id = $1 and status <> 'draft'
			group by customer_id
		)`

	insights := ports.CRMInsights{LapsedCustomers: []ports.CRMLapsedCustomer{}}
	if err := tx.QueryRow(ctx, orderStatsCTE+`
		select
			count(*) filter (where os.first_order_at >= $2::timestamptz - interval '30 days')::int,
			count(*) filter (where os.orders_count > 1)::int
		from order_stats os
		join customers c on c.customer_id = os.customer_id and c.erased_at is null
	`, scope.BusinessID.String(), now).Scan(&insights.NewCustomers30d, &insights.ReturningCustomers); err != nil {
		return ports.CRMInsights{}, err
	}

	rows, err := tx.Query(ctx, orderStatsCTE+`
		select c.customer_id::text, coalesce(c.display_name, ''), coalesce(c.phone, ''), os.last_order_at
		from order_stats os
		join customers c on c.customer_id = os.customer_id and c.erased_at is null
		where os.last_order_at < $2::timestamptz - interval '90 days'
		order by os.last_order_at asc, c.customer_id asc
	`, scope.BusinessID.String(), now)
	if err != nil {
		return ports.CRMInsights{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var lapsed ports.CRMLapsedCustomer
		if err := rows.Scan(&lapsed.CustomerID, &lapsed.DisplayName, &lapsed.Phone, &lapsed.LastOrderAt); err != nil {
			return ports.CRMInsights{}, err
		}
		insights.LapsedCustomers = append(insights.LapsedCustomers, lapsed)
	}
	if err := rows.Err(); err != nil {
		return ports.CRMInsights{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.CRMInsights{}, err
	}
	return insights, nil
}

func timePtrArg(value *time.Time) any {
	if value == nil {
		return nil
	}
	return *value
}
