package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func scanAdminSubscriptionInvoiceRecord(row pgx.Row) (ports.AdminSubscriptionInvoiceRecord, error) {
	var record ports.AdminSubscriptionInvoiceRecord
	var paidAt pgtype.Timestamptz
	var failedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.BusinessID,
		&record.InvoiceID,
		&record.SubscriptionID,
		&record.InvoiceRef,
		&record.Status,
		&record.BillingMode,
		&record.Provider,
		&record.ProviderInvoiceRef,
		&record.PaymentURL,
		&record.AmountMinor,
		&record.Currency,
		&record.PeriodStart,
		&record.PeriodEnd,
		&record.DueAt,
		&paidAt,
		&failedAt,
		&record.FailureReason,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminSubscriptionInvoiceRecord{}, err
	}
	record.PaidAt = timestamptzPtr(paidAt)
	record.FailedAt = timestamptzPtr(failedAt)

	return record, nil
}

func listAdminSubscriptionEvents(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminSubscriptionEventRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			e.business_id::text,
			e.subscription_event_id::text,
			e.event_type,
			e.summary,
			coalesce(u.email, ''),
			e.created_at
		from business_subscription_events e
		left join admin_users u on u.admin_user_id = e.actor_admin_user_id
		order by e.created_at desc
		limit 250
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := map[common.ID][]ports.AdminSubscriptionEventRecord{}
	for rows.Next() {
		var record ports.AdminSubscriptionEventRecord
		if err := rows.Scan(
			&record.BusinessID,
			&record.SubscriptionEventID,
			&record.EventType,
			&record.Summary,
			&record.ActorEmail,
			&record.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(events[record.BusinessID]) < 5 {
			events[record.BusinessID] = append(events[record.BusinessID], record)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

func listAdminSubscriptionInvoices(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminSubscriptionInvoiceRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			i.business_id::text,
			i.invoice_id::text,
			i.subscription_id::text,
			i.invoice_ref,
			i.status,
			i.billing_mode,
			i.provider,
			i.provider_invoice_ref,
			i.payment_url,
			i.amount_minor,
			i.currency,
			i.period_start,
			i.period_end,
			i.due_at,
			i.paid_at,
			i.failed_at,
			i.failure_reason,
			i.created_at,
			i.updated_at
		from business_subscription_invoices i
		order by
			case i.status
				when 'issued' then 1
				when 'failed' then 2
				when 'paid' then 3
				else 4
			end,
			i.created_at desc
		limit 300
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invoices := map[common.ID][]ports.AdminSubscriptionInvoiceRecord{}
	for rows.Next() {
		record, err := scanAdminSubscriptionInvoiceRecord(rows)
		if err != nil {
			return nil, err
		}
		if len(invoices[record.BusinessID]) < 5 {
			invoices[record.BusinessID] = append(invoices[record.BusinessID], record)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return invoices, nil
}

// adminSubscriptionCadence carries the cadence-driven billing figures the
// recurring sweep needs to decide the charge amount and period length, keyed by
// business id and merged into AdminSubscriptionRecord after the main list scan.
func getAdminSubscriptionRecordByBusiness(
	ctx context.Context,
	tx pgx.Tx,
	businessID common.ID,
) (ports.AdminSubscriptionRecord, error) {
	record, err := scanAdminSubscriptionRecord(tx.QueryRow(ctx, `
		with order_stats as (
			select
				business_id,
				count(*)::int as orders_count,
				max(updated_at) as last_order_at
			from orders
			where business_id = $1::uuid
			group by business_id
		),
		design_stats as (
			select
				business_id,
				count(*)::int as design_count
			from designs
			where business_id = $1::uuid and status = 'active'
			group by business_id
		),
		money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as gmv_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				max(updated_at) filter (where status = 'succeeded') as last_payment_at
			from payments
			where business_id = $1::uuid
			group by business_id
		)
		select
			s.subscription_id::text,
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.display_name, ''),
			coalesce(owner.whatsapp_number, ''),
			coalesce(owner.email, ''),
			coalesce(owner.whatsapp_number, ''),
			p.code,
			p.name,
			p.monthly_fee_minor::bigint,
			p.commission_bps::int,
			p.design_limit,
			s.status,
			s.billing_mode,
			s.provider,
			s.provider_customer_ref,
			s.provider_subscription_ref,
			s.current_period_start,
			s.current_period_end,
			s.trial_ends_at,
			s.grace_ends_at,
			s.cancel_at_period_end,
			s.canceled_at,
			s.failed_payment_count,
			s.last_invoice_ref,
			s.last_payment_at,
			s.next_billing_at,
			b.created_at,
			coalesce(s.next_billing_at, s.current_period_end),
			case when b.handle <> '' then 'https://' || b.handle || '.xtiitch.com' else '' end,
			coalesce(discount.code, ''),
			coalesce(nullif(discount.owner_name, ''), discount.batch_label, ''),
			greatest(
				b.updated_at,
				coalesce(os.last_order_at, b.updated_at),
				coalesce(ms.last_payment_at, b.updated_at)
			),
			coalesce(ds.design_count, 0),
			coalesce(os.orders_count, 0),
			coalesce(ms.gmv_minor, 0),
			coalesce(ms.commission_minor, 0),
			s.updated_at
		from business_subscriptions s
		join businesses b on b.business_id = s.business_id
		join plans p on p.plan_id = s.plan_id
		left join design_stats ds on ds.business_id = b.business_id
		left join order_stats os on os.business_id = b.business_id
		left join money_stats ms on ms.business_id = b.business_id
		left join lateral (
			select u.display_name, u.email, u.whatsapp_number
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		left join lateral (
			select c.code, c.owner_name, c.batch_label
			from subscription_discount_redemptions r
			join subscription_discount_codes c on c.discount_code_id = r.discount_code_id
			where r.business_id = b.business_id
			  and r.status in ('pending', 'applied')
			order by coalesce(r.applied_at, r.created_at) desc, r.created_at desc
			limit 1
		) discount on true
		where s.business_id = $1::uuid
	`, businessID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	eventsByBusiness, err := listAdminSubscriptionEvents(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	invoicesByBusiness, err := listAdminSubscriptionInvoices(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	record.Events = eventsByBusiness[record.BusinessID]
	record.Invoices = invoicesByBusiness[record.BusinessID]

	return record, nil
}
