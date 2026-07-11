package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) ListAdminSubscriptions(ctx context.Context) ([]ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		with order_stats as (
			select
				business_id,
				count(*)::int as orders_count,
				max(updated_at) as last_order_at
			from orders
			group by business_id
		),
		design_stats as (
			select
				business_id,
				count(*)::int as design_count
			from designs
			where status = 'active'
			group by business_id
		),
		money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as gmv_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				max(updated_at) filter (where status = 'succeeded') as last_payment_at
			from payments
			group by business_id
		)
		select
			coalesce(s.subscription_id::text, '') as subscription_id,
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.display_name, ''),
			coalesce(owner.whatsapp_number, ''),
			coalesce(owner.email, ''),
			coalesce(owner.whatsapp_number, ''),
			coalesce(sp.code, p.code),
			coalesce(sp.name, p.name),
			coalesce(sp.monthly_fee_minor, p.monthly_fee_minor)::bigint,
			coalesce(sp.commission_bps, p.commission_bps)::int,
			coalesce(sp.design_limit, p.design_limit),
			coalesce(
				s.status,
				case when p.monthly_fee_minor = 0 then 'active' else 'trialing' end
			),
			coalesce(s.billing_mode, 'manual'),
			coalesce(s.provider, 'manual'),
			coalesce(s.provider_customer_ref, ''),
			coalesce(s.provider_subscription_ref, ''),
			coalesce(s.current_period_start, b.created_at),
			coalesce(
				s.current_period_end,
				greatest(b.created_at + interval '1 month', now() + interval '1 day')
			),
			s.trial_ends_at,
			s.grace_ends_at,
			coalesce(s.cancel_at_period_end, false),
			s.canceled_at,
			coalesce(s.failed_payment_count, 0),
			coalesce(s.last_invoice_ref, ''),
			s.last_payment_at,
			s.next_billing_at,
			b.created_at,
			coalesce(
				s.next_billing_at,
				s.current_period_end,
				greatest(b.created_at + interval '1 month', now() + interval '1 day')
			),
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
			coalesce(s.updated_at, b.updated_at)
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join business_subscriptions s on s.business_id = b.business_id
		left join plans sp on sp.plan_id = s.plan_id
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
		order by
			case
				when coalesce(s.status, '') in ('past_due', 'grace_period') then 1
				when coalesce(s.status, '') = 'cancel_at_period_end' then 2
				when p.monthly_fee_minor > 0 then 3
				else 4
			end,
			coalesce(s.updated_at, b.updated_at) desc,
			b.created_at desc
		limit 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminSubscriptionRecord{}
	for rows.Next() {
		record, err := scanAdminSubscriptionRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	eventsByBusiness, err := listAdminSubscriptionEvents(ctx, tx)
	if err != nil {
		return nil, err
	}
	invoicesByBusiness, err := listAdminSubscriptionInvoices(ctx, tx)
	if err != nil {
		return nil, err
	}
	cadencesByBusiness, err := listAdminSubscriptionCadences(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].Events = eventsByBusiness[records[index].BusinessID]
		records[index].Invoices = invoicesByBusiness[records[index].BusinessID]
		if cadence, ok := cadencesByBusiness[records[index].BusinessID]; ok {
			records[index].BillingCadence = cadence.billingCadence
			records[index].QuarterlyRenewalMinor = cadence.quarterlyRenewalMinor
			records[index].YearlyRenewalMinor = cadence.yearlyRenewalMinor
			records[index].ProviderChannel = cadence.providerChannel
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) UpdateAdminSubscription(
	ctx context.Context,
	input ports.UpdateAdminSubscriptionInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_subscriptions (
			business_id,
			plan_id,
			status,
			billing_mode,
			provider,
			current_period_start,
			current_period_end,
			trial_ends_at,
			next_billing_at
		)
		select
			b.business_id,
			b.plan_id,
			case when p.monthly_fee_minor = 0 then 'active' else 'trialing' end,
			'manual',
			'manual',
			now(),
			now() + interval '1 month',
			case when p.monthly_fee_minor > 0 then now() + interval '14 days' end,
			case when p.monthly_fee_minor > 0 then now() + interval '14 days' end
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1::uuid
		on conflict (business_id) do nothing
	`, input.BusinessID.String()); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := scanAdminSubscriptionRecord(tx.QueryRow(ctx, `
		with free_plan as (
			select plan_id
			from plans
			where code = 'free' and is_active = true
			order by created_at
			limit 1
		),
		updated as (
			update business_subscriptions s
			set
				plan_id = case
					when $2 = 'canceled' then coalesce((select plan_id from free_plan), s.plan_id)
					else s.plan_id
				end,
				status = $2,
				billing_mode = $3,
				provider = case when $3 = 'manual' then 'manual' else 'paystack' end,
				provider_customer_ref = $4,
				provider_subscription_ref = $5,
				provider_channel = case when $6 <> '' then $6 else s.provider_channel end,
				grace_ends_at = case
					when $2 = 'grace_period' then coalesce(s.grace_ends_at, now() + interval '7 days')
					else null
				end,
				cancel_at_period_end = ($2 = 'cancel_at_period_end'),
				canceled_at = case
					when $2 = 'canceled' then coalesce(s.canceled_at, now())
					else null
				end,
				failed_payment_count = case
					when $2 in ('past_due', 'grace_period') then greatest(s.failed_payment_count, 1)
					when $2 in ('active', 'trialing') then 0
					else s.failed_payment_count
				end,
				next_billing_at = case
					when $2 = 'canceled' then null
					when p.monthly_fee_minor = 0 then null
					else coalesce(s.next_billing_at, s.current_period_end)
				end,
				updated_at = now()
			from plans p
			where s.business_id = $1::uuid
				and p.plan_id = s.plan_id
			returning s.*
		),
		downgraded_business as (
			update businesses b
			set plan_id = s.plan_id, updated_at = now()
			from updated s
			where $2 = 'canceled'
				and b.business_id = s.business_id
			returning 1
		),
		order_stats as (
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
		from updated s
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
	`, input.BusinessID.String(),
		input.Status,
		input.BillingMode,
		input.ProviderCustomerRef,
		input.ProviderSubscriptionRef,
		input.ProviderChannel,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_subscription_events (
			subscription_id,
			business_id,
			actor_admin_user_id,
			event_type,
			summary,
			metadata
		)
		values (
			$1::uuid,
			$2::uuid,
			$3::uuid,
			$4,
			$5,
			jsonb_build_object(
				'status', $6::text,
				'billing_mode', $7::text,
				'provider_customer_ref', $8::text,
				'provider_subscription_ref', $9::text,
				'reason', $10::text
			)
		)
	`, record.SubscriptionID.String(),
		record.BusinessID.String(),
		input.ActorAdminUser.String(),
		"subscription."+input.Status,
		input.Reason,
		input.Status,
		input.BillingMode,
		input.ProviderCustomerRef,
		input.ProviderSubscriptionRef,
		input.Reason,
	); err != nil {
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

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func scanAdminSubscriptionRecord(row pgx.Row) (ports.AdminSubscriptionRecord, error) {
	var record ports.AdminSubscriptionRecord
	var designLimit pgtype.Int4
	var trialEndsAt pgtype.Timestamptz
	var graceEndsAt pgtype.Timestamptz
	var canceledAt pgtype.Timestamptz
	var lastPaymentAt pgtype.Timestamptz
	var nextBillingAt pgtype.Timestamptz
	var renewalAt pgtype.Timestamptz
	if err := row.Scan(
		&record.SubscriptionID,
		&record.BusinessID,
		&record.BusinessName,
		&record.Handle,
		&record.OwnerName,
		&record.OwnerPhone,
		&record.OwnerEmail,
		&record.OwnerWhatsApp,
		&record.PlanCode,
		&record.PlanName,
		&record.MonthlyFeeMinor,
		&record.CommissionBPS,
		&designLimit,
		&record.Status,
		&record.BillingMode,
		&record.Provider,
		&record.ProviderCustomerRef,
		&record.ProviderSubscriptionRef,
		&record.CurrentPeriodStart,
		&record.CurrentPeriodEnd,
		&trialEndsAt,
		&graceEndsAt,
		&record.CancelAtPeriodEnd,
		&canceledAt,
		&record.FailedPaymentCount,
		&record.LastInvoiceRef,
		&lastPaymentAt,
		&nextBillingAt,
		&record.SignupAt,
		&renewalAt,
		&record.StoreLink,
		&record.DiscountCode,
		&record.DiscountInstitution,
		&record.LastActiveAt,
		&record.DesignCount,
		&record.OrdersCount,
		&record.GMVMinor,
		&record.CommissionMinor,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	record.DesignLimit = int4Ptr(designLimit)
	record.TrialEndsAt = timestamptzPtr(trialEndsAt)
	record.GraceEndsAt = timestamptzPtr(graceEndsAt)
	record.CanceledAt = timestamptzPtr(canceledAt)
	record.LastPaymentAt = timestamptzPtr(lastPaymentAt)
	record.NextBillingAt = timestamptzPtr(nextBillingAt)
	record.RenewalAt = timestamptzPtr(renewalAt)
	record.Events = []ports.AdminSubscriptionEventRecord{}
	record.Invoices = []ports.AdminSubscriptionInvoiceRecord{}

	return record, nil
}

// adminSubscriptionCadence carries the cadence-driven billing figures the
// recurring sweep needs to decide the charge amount and period length, keyed by
// business id and merged into AdminSubscriptionRecord after the main list scan.
type adminSubscriptionCadence struct {
	billingCadence        string
	quarterlyRenewalMinor int64
	yearlyRenewalMinor    int64
	providerChannel       string
}

func listAdminSubscriptionCadences(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID]adminSubscriptionCadence, error) {
	rows, err := tx.Query(ctx, `
		select
			s.business_id::text,
			s.billing_cadence,
			coalesce(p.quarterly_renewal_minor, 0)::bigint,
			coalesce(p.yearly_renewal_minor, 0)::bigint,
			s.provider_channel
		from business_subscriptions s
		join plans p on p.plan_id = s.plan_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cadences := map[common.ID]adminSubscriptionCadence{}
	for rows.Next() {
		var businessID common.ID
		var cadence adminSubscriptionCadence
		if err := rows.Scan(
			&businessID,
			&cadence.billingCadence,
			&cadence.quarterlyRenewalMinor,
			&cadence.yearlyRenewalMinor,
			&cadence.providerChannel,
		); err != nil {
			return nil, err
		}
		cadences[businessID] = cadence
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return cadences, nil
}

func insertAdminSubscriptionEvent(
	ctx context.Context,
	tx pgx.Tx,
	subscriptionID common.ID,
	businessID common.ID,
	actorAdminUserID common.ID,
	eventType string,
	summary string,
	metadata map[string]string,
) error {
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		insert into business_subscription_events (
			subscription_id,
			business_id,
			actor_admin_user_id,
			event_type,
			summary,
			metadata
		)
		values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb)
	`, subscriptionID.String(), businessID.String(), actorAdminUserID.String(), eventType, summary, string(metadataJSON))
	return err
}
