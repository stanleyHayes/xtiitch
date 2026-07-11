package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type OrderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) OrderRepository {
	return OrderRepository{pool: pool}
}

// FindCustomerIDByPhone resolves an existing, non-erased customer by phone so
// repeat guest orders link to one identity. Customers are platform-wide, so this
// matches across tenants; the oldest match wins.
func (repo OrderRepository) FindCustomerIDByPhone(ctx context.Context, phone string) (common.ID, bool, error) {
	trimmed := strings.TrimSpace(phone)
	if trimmed == "" {
		return "", false, nil
	}
	var id string
	err := repo.pool.QueryRow(ctx, `
		select customer_id::text
		from customers
		where phone = $1 and erased_at is null
		order by created_at asc
		limit 1
	`, trimmed).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	return common.ID(id), true, nil
}

// ResolveOrCreateCustomerByPhone atomically returns the existing customer for a
// phone or creates a minimal one with newID, serialized by an advisory lock on the
// phone. Without this, two concurrent first-time orders from the same new phone
// both resolve "not found" and mint different customer_ids — fragmenting that
// person's identity/history. The order transaction later enriches the row (name,
// email, whatsapp) via its on-conflict upsert. Returns (id, created).
func (repo OrderRepository) ResolveOrCreateCustomerByPhone(ctx context.Context, phone string, newID common.ID) (common.ID, bool, error) {
	trimmed := strings.TrimSpace(phone)
	if trimmed == "" {
		// No phone to dedupe on — a fresh anonymous identity.
		return newID, true, nil
	}
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext($1)::bigint)`, trimmed); err != nil {
		return "", false, err
	}
	var existing string
	err = tx.QueryRow(ctx, `
		select customer_id::text from customers
		where phone = $1 and erased_at is null
		order by created_at asc limit 1
	`, trimmed).Scan(&existing)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return "", false, err
		}
		return common.ID(existing), false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", false, err
	}
	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, phone) values ($1, $2)
	`, newID.String(), trimmed); err != nil {
		return "", false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", false, err
	}
	return newID, true, nil
}

func (repo OrderRepository) CreateWalkInOrder(ctx context.Context, scope common.TenantScope, input ports.CreateWalkInOrderInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, display_name, phone, whatsapp_number, email)
		values ($1, $2, $3, $4, $5)
		on conflict (customer_id) do update
		set display_name = excluded.display_name,
			whatsapp_number = case when excluded.whatsapp_number <> '' then excluded.whatsapp_number else customers.whatsapp_number end,
			email = case when excluded.email <> '' then excluded.email else customers.email end,
			updated_at = now()
	`, input.CustomerID.String(), input.CustomerName, input.CustomerPhone, input.CustomerWhatsApp, input.CustomerEmail); err != nil {
		return err
	}

	var stageID string
	if err := tx.QueryRow(ctx, `
		select stage_id from stage_templates
		where business_id = $1 and flow = 'ready_made'
		order by sequence limit 1
	`, scope.BusinessID.String()).Scan(&stageID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("no production stages configured for business")
		}
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor,
			status, current_stage_id
		)
		values ($1, $2, $3, $4, $5, 'standard', 'band', 'ready_made', 'walk_in', $6, 0, 'confirmed', $7)
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(), input.DesignID.String(),
		nullableIDArg(input.SizeBandID), nullableInt64Arg(input.AgreedTotalMinor), stageID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into stage_events (event_id, business_id, order_id, stage_id)
		values (gen_random_uuid(), $1, $2, $3)
	`, input.BusinessID.String(), input.OrderID.String(), stageID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) CreateOnlineOrder(ctx context.Context, scope common.TenantScope, input ports.CreateOnlineOrderInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, display_name, phone, whatsapp_number, email)
		values ($1, $2, $3, $4, $5)
		on conflict (customer_id) do update
		set display_name = excluded.display_name,
			whatsapp_number = case when excluded.whatsapp_number <> '' then excluded.whatsapp_number else customers.whatsapp_number end,
			email = case when excluded.email <> '' then excluded.email else customers.email end,
			updated_at = now()
	`, input.CustomerID.String(), input.CustomerName, input.CustomerPhone, input.CustomerWhatsApp, input.CustomerEmail); err != nil {
		return err
	}

	// Draft: no stage yet. The payment webhook confirms it at the first stage.
	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status,
			checkout_group_id, delivery_method, delivery_address, delivery_fee_minor, delivery_zone_id, note
		)
		values ($1, $2, $3, $4, $5, 'standard', 'band', 'ready_made', 'online', $6, 0, 'draft', $7, $8, $9, $10, $11, $12)
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(), input.DesignID.String(),
		nullableIDArg(input.SizeBandID), input.AgreedTotalMinor, nullableIDArg(input.CheckoutGroupID),
		nullableTextArg(input.DeliveryMethod), input.DeliveryAddress, input.DeliveryFeeMinor,
		nullableIDArg(input.DeliveryZoneID), input.Note); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// CreateOnlineOrderGroup inserts every order of a combined cart in one
// transaction. The customer is upserted once (all orders share one identity)
// and each order carries the shared checkout_group_id, so the combined payment
// webhook can confirm them together. All-or-nothing: any insert error rolls the
// whole group back, keeping the cart checkout atomic before the charge.
func (repo OrderRepository) CreateOnlineOrderGroup(
	ctx context.Context,
	scope common.TenantScope,
	inputs []ports.CreateOnlineOrderInput,
) error {
	if len(inputs) == 0 {
		return nil
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// One shared customer across the group: upsert from the first order.
	first := inputs[0]
	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, display_name, phone, whatsapp_number, email)
		values ($1, $2, $3, $4, $5)
		on conflict (customer_id) do update
		set display_name = excluded.display_name,
			whatsapp_number = case when excluded.whatsapp_number <> '' then excluded.whatsapp_number else customers.whatsapp_number end,
			email = case when excluded.email <> '' then excluded.email else customers.email end,
			updated_at = now()
	`, first.CustomerID.String(), first.CustomerName, first.CustomerPhone, first.CustomerWhatsApp, first.CustomerEmail); err != nil {
		return err
	}

	for _, input := range inputs {
		if _, err := tx.Exec(ctx, `
			insert into orders (
				order_id, business_id, customer_id, design_id, size_band_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status,
				checkout_group_id, delivery_method, delivery_address, delivery_fee_minor, delivery_zone_id, note
			)
			values ($1, $2, $3, $4, $5, 'standard', 'band', 'ready_made', 'online', $6, 0, 'draft', $7, $8, $9, $10, $11, $12)
		`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(), input.DesignID.String(),
			nullableIDArg(input.SizeBandID), input.AgreedTotalMinor, nullableIDArg(input.CheckoutGroupID),
			nullableTextArg(input.DeliveryMethod), input.DeliveryAddress, input.DeliveryFeeMinor,
			nullableIDArg(input.DeliveryZoneID), input.Note); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// DiscardDraftOrderGroup removes every still-draft order in a checkout group and
// the customer created for it, scoped to the tenant. It compensates a combined
// checkout whose payment could not be raised, so no un-payable drafts are left.
func (repo OrderRepository) DiscardDraftOrderGroup(ctx context.Context, scope common.TenantScope, groupID, customerID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Only ever remove still-draft orders of this tenant; a confirmed order (or
	// one in another tenant, walled off by RLS) is left untouched. Orders go
	// before the customer to satisfy the orders -> customers foreign key.
	if _, err := tx.Exec(ctx, `
		delete from orders where checkout_group_id = $1 and business_id = $2 and status = 'draft'
	`, groupID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	if customerID != "" {
		if _, err := tx.Exec(ctx, `
			delete from customers where customer_id = $1
		`, customerID.String()); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) DiscardDraftOrder(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Only ever remove a still-draft order of this tenant; a confirmed order (or
	// one in another tenant, walled off by RLS) is left untouched. The customer
	// row was created solely for this order, so it goes too — deleting the order
	// first satisfies the orders -> customers foreign key.
	if _, err := tx.Exec(ctx, `
		delete from orders where order_id = $1 and business_id = $2 and status = 'draft'
	`, orderID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	// Only a freshly-created customer (created for this very order) is removed on
	// rollback; a customer resolved from an earlier order is shared and is left
	// alone (the caller passes a zero id for that case).
	if customerID != "" {
		if _, err := tx.Exec(ctx, `
			delete from customers where customer_id = $1
		`, customerID.String()); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) SetDraftOrderAgreedTotal(
	ctx context.Context,
	scope common.TenantScope,
	orderID common.ID,
	agreedTotalMinor int64,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update orders
		set agreed_total_minor = $3, updated_at = now()
		where order_id = $1 and business_id = $2
			and order_type = 'standard' and status = 'draft'
	`, orderID.String(), scope.BusinessID.String(), agreedTotalMinor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrInvalidOrderState
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) GetOrderBilling(ctx context.Context, scope common.TenantScope, orderID common.ID) (ports.OrderBilling, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.OrderBilling{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.OrderBilling{}, err
	}

	var billing ports.OrderBilling
	var agreed sql.NullInt64
	if err := tx.QueryRow(ctx, `
		select o.order_type, o.status, o.agreed_total_minor, o.settled_minor, coalesce(c.email, ''),
			exists(
				select 1 from payments p
				where p.order_id = o.order_id and p.business_id = o.business_id
					and p.purpose = 'balance' and p.status = 'initiated'
			)
		from orders o
		left join customers c on c.customer_id = o.customer_id
		where o.order_id = $1 and o.business_id = $2
	`, orderID.String(), scope.BusinessID.String()).Scan(
		&billing.OrderType, &billing.Status, &agreed, &billing.SettledMinor, &billing.CustomerEmail, &billing.BalanceInFlight,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.OrderBilling{}, ErrNotFound
		}
		return ports.OrderBilling{}, err
	}
	if agreed.Valid {
		value := agreed.Int64
		billing.AgreedTotalMinor = &value
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.OrderBilling{}, err
	}
	return billing, nil
}

func (repo OrderRepository) ListOrders(ctx context.Context, scope common.TenantScope) ([]ports.OrderSummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select o.order_id, d.title, coalesce(c.display_name, ''),
			coalesce(c.phone, ''), coalesce(c.whatsapp_number, ''), coalesce(c.email, ''), o.status, o.order_type,
			o.size_mode, o.channel, coalesce(st.name, ''), coalesce(st.colour, 'red'),
			o.agreed_total_minor, o.settled_minor, coalesce(p.status, 'none'),
			coalesce(p.purpose, ''), p.amount_minor, o.created_at
		from orders o
		join designs d on d.design_id = o.design_id
		left join customers c on c.customer_id = o.customer_id
		left join stage_templates st on st.stage_id = o.current_stage_id
		left join lateral (
			select status, purpose, amount_minor
			from payments p
			where p.business_id = o.business_id and p.order_id = o.order_id
			order by p.created_at desc
			limit 1
		) p on true
		where o.business_id = $1
		order by o.created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []ports.OrderSummary
	for rows.Next() {
		var summary ports.OrderSummary
		var total, paymentAmount sql.NullInt64
		if err := rows.Scan(&summary.OrderID, &summary.DesignTitle, &summary.CustomerName,
			&summary.CustomerPhone, &summary.CustomerWhatsApp, &summary.CustomerEmail, &summary.Status, &summary.OrderType,
			&summary.SizeMode, &summary.Channel, &summary.StageName, &summary.Colour, &total,
			&summary.SettledMinor, &summary.PaymentStatus, &summary.PaymentPurpose, &paymentAmount,
			&summary.CreatedAt); err != nil {
			return nil, err
		}
		if total.Valid {
			value := total.Int64
			summary.AgreedTotalMinor = &value
		}
		if paymentAmount.Valid {
			value := paymentAmount.Int64
			summary.PaymentAmount = &value
		}
		summaries = append(summaries, summary)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return summaries, nil
}
