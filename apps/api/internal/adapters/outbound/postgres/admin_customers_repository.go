package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminCustomers(ctx context.Context) ([]ports.AdminCustomerRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		with relationship_stats as (
			select
				customer_id,
				count(distinct business_id)::int as tenant_count,
				max(greatest(first_seen_at, updated_at)) as last_relationship_at
			from customer_businesses
			group by customer_id
		),
		order_stats as (
			select
				customer_id,
				count(*)::int as order_count,
				count(*) filter (where order_type = 'custom')::int as custom_order_count,
				max(updated_at) as last_order_at
			from orders
			group by customer_id
		),
		payment_stats as (
			select
				o.customer_id,
				coalesce(sum(p.amount_minor) filter (where p.status = 'succeeded'), 0)::bigint as gmv_minor,
				max(p.updated_at) filter (where p.status = 'succeeded') as last_payment_at
			from payments p
			join orders o
				on o.order_id = p.order_id
				and o.business_id = p.business_id
			group by o.customer_id
		),
		recent_order as (
			select distinct on (o.customer_id)
				o.customer_id,
				b.name as business_name,
				b.handle as business_handle
			from orders o
			join businesses b on b.business_id = o.business_id
			order by o.customer_id, o.updated_at desc
		),
		recent_relationship as (
			select distinct on (cb.customer_id)
				cb.customer_id,
				b.name as business_name,
				b.handle as business_handle
			from customer_businesses cb
			join businesses b on b.business_id = cb.business_id
			order by cb.customer_id, cb.updated_at desc
		)
		select
			c.customer_id::text,
			coalesce(c.email, ''),
			coalesce(c.phone, ''),
			coalesce(c.display_name, ''),
			coalesce(rs.tenant_count, 0),
			coalesce(os.order_count, 0),
			coalesce(os.custom_order_count, 0),
			coalesce(ps.gmv_minor, 0),
			coalesce(ro.business_name, rr.business_name, ''),
			coalesce(ro.business_handle, rr.business_handle, ''),
			greatest(
				c.updated_at,
				coalesce(rs.last_relationship_at, c.updated_at),
				coalesce(os.last_order_at, c.updated_at),
				coalesce(ps.last_payment_at, c.updated_at)
			) as last_active_at,
			c.created_at,
			c.updated_at
		from customers c
		left join relationship_stats rs on rs.customer_id = c.customer_id
		left join order_stats os on os.customer_id = c.customer_id
		left join payment_stats ps on ps.customer_id = c.customer_id
		left join recent_order ro on ro.customer_id = c.customer_id
		left join recent_relationship rr on rr.customer_id = c.customer_id
		order by last_active_at desc, c.created_at desc
		limit 250
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminCustomerRecord{}
	for rows.Next() {
		record, err := scanAdminCustomerRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) ExportAdminCustomer(ctx context.Context, customerID common.ID) (ports.AdminCustomerExportRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// A subject-access request spans every tenant the customer touched, so it
	// runs with the cross-tenant bypass (the customer identity is global).
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}

	export := ports.AdminCustomerExportRecord{CustomerID: customerID}
	if err := tx.QueryRow(ctx, `
		select coalesce(email, ''), coalesce(phone, ''), coalesce(display_name, ''), created_at, updated_at
		from customers
		where customer_id = $1
	`, customerID.String()).Scan(
		&export.Email, &export.Phone, &export.DisplayName, &export.CreatedAt, &export.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminCustomerExportRecord{}, ports.ErrNotFound
		}
		return ports.AdminCustomerExportRecord{}, err
	}

	bizRows, err := tx.Query(ctx, `
		select b.name, b.handle, cb.first_seen_at
		from customer_businesses cb
		join businesses b on b.business_id = cb.business_id
		where cb.customer_id = $1
		order by cb.first_seen_at
	`, customerID.String())
	if err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}
	for bizRows.Next() {
		var b ports.AdminCustomerExportBusiness
		if err := bizRows.Scan(&b.BusinessName, &b.BusinessHandle, &b.FirstSeenAt); err != nil {
			bizRows.Close()
			return ports.AdminCustomerExportRecord{}, err
		}
		export.Businesses = append(export.Businesses, b)
	}
	bizRows.Close()
	if err := bizRows.Err(); err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}

	orderRows, err := tx.Query(ctx, `
		select o.order_id::text, b.name, coalesce(d.title, ''), o.order_type, o.status,
			coalesce(o.agreed_total_minor, 0), o.created_at
		from orders o
		join businesses b on b.business_id = o.business_id
		left join designs d on d.design_id = o.design_id
		where o.customer_id = $1
		order by o.created_at desc
	`, customerID.String())
	if err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}
	for orderRows.Next() {
		var o ports.AdminCustomerExportOrder
		if err := orderRows.Scan(&o.OrderID, &o.BusinessName, &o.DesignTitle, &o.OrderType, &o.Status, &o.AgreedTotalMinor, &o.CreatedAt); err != nil {
			orderRows.Close()
			return ports.AdminCustomerExportRecord{}, err
		}
		export.Orders = append(export.Orders, o)
	}
	orderRows.Close()
	if err := orderRows.Err(); err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}

	measureRows, err := tx.Query(ctx, `
		select order_id::text, source, values::text, created_at
		from order_measurements
		where customer_id = $1
		order by created_at desc
	`, customerID.String())
	if err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}
	for measureRows.Next() {
		var m ports.AdminCustomerExportMeasurement
		if err := measureRows.Scan(&m.OrderID, &m.Source, &m.Values, &m.CreatedAt); err != nil {
			measureRows.Close()
			return ports.AdminCustomerExportRecord{}, err
		}
		export.Measurements = append(export.Measurements, m)
	}
	measureRows.Close()
	if err := measureRows.Err(); err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}

	return export, nil
}

func (repo AdminAuthRepository) EraseAdminCustomer(ctx context.Context, customerID common.ID) (ports.AdminCustomerErasureRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// Erasure is platform-wide (the customer identity is global), so it runs with
	// the cross-tenant bypass.
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}

	// Anonymise the identity itself. Keep the row so retained orders still
	// reference a (now contentless) customer.
	tag, err := tx.Exec(ctx, `
		update customers
		set email = null,
			phone = null,
			display_name = 'Erased customer',
			identity_ref = null,
			erased_at = now(),
			updated_at = now()
		where customer_id = $1
	`, customerID.String())
	if err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}
	if tag.RowsAffected() == 0 {
		return ports.AdminCustomerErasureRecord{}, ports.ErrNotFound
	}

	record := ports.AdminCustomerErasureRecord{CustomerID: customerID}

	if err := tx.QueryRow(ctx, `
		select count(*) from orders where customer_id = $1
	`, customerID.String()).Scan(&record.OrdersRetained); err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}

	// Body measurements are personal data — clear the values, keep the row.
	measureTag, err := tx.Exec(ctx, `
		update order_measurements
		set values = '{}'::jsonb, updated_at = now()
		where customer_id = $1
	`, customerID.String())
	if err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}
	record.MeasurementsCleared = int(measureTag.RowsAffected())

	// Home-visit addresses are personal data — clear them.
	bookingTag, err := tx.Exec(ctx, `
		update bookings
		set address = '', updated_at = now()
		where customer_id = $1 and address <> ''
	`, customerID.String())
	if err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}
	record.BookingAddresses = int(bookingTag.RowsAffected())

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}

	return record, nil
}

func scanAdminCustomerRecord(row pgx.Row) (ports.AdminCustomerRecord, error) {
	var record ports.AdminCustomerRecord
	if err := row.Scan(
		&record.CustomerID,
		&record.Email,
		&record.Phone,
		&record.DisplayName,
		&record.TenantCount,
		&record.OrderCount,
		&record.CustomOrderCount,
		&record.GMVMinor,
		&record.LastBusinessName,
		&record.LastBusinessHandle,
		&record.LastActiveAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminCustomerRecord{}, err
	}

	return record, nil
}
