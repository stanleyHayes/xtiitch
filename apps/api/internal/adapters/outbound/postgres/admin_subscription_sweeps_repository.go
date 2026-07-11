package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) RunAdminSubscriptionBillingSweep(
	ctx context.Context,
	input ports.RunAdminSubscriptionBillingSweepInput,
) (ports.AdminSubscriptionBillingSweepRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	var record ports.AdminSubscriptionBillingSweepRecord
	if err := tx.QueryRow(ctx, `
		with free_plan as (
			select plan_id
			from plans
			where code = 'free' and is_active = true
			order by created_at
			limit 1
		),
		failed_invoices as (
			update business_subscription_invoices i
			set
				status = 'failed',
				failed_at = coalesce(i.failed_at, now()),
				failure_reason = $2,
				updated_at = now()
			where i.status = 'issued'
				and i.due_at <= now()
			returning i.invoice_id, i.subscription_id, i.business_id, i.invoice_ref
		),
		failed_subscriptions as (
			update business_subscriptions s
			set
				status = case
					when s.failed_payment_count + 1 >= 2 then 'grace_period'
					else 'past_due'
				end,
				failed_payment_count = s.failed_payment_count + 1,
				grace_ends_at = case
					when s.failed_payment_count + 1 >= 2 then coalesce(s.grace_ends_at, now() + interval '7 days')
					else null
				end,
				last_invoice_ref = f.invoice_ref,
				next_billing_at = case
					when s.failed_payment_count + 1 >= 2 then coalesce(s.grace_ends_at, now() + interval '7 days')
					else now() + interval '1 day'
				end,
				updated_at = now()
			from failed_invoices f
			where s.subscription_id = f.subscription_id
			returning
				s.subscription_id,
				s.business_id,
				f.invoice_id,
				f.invoice_ref,
				s.status
		),
		failed_events as (
			insert into business_subscription_events (
				subscription_id,
				business_id,
				actor_admin_user_id,
				event_type,
				summary,
				metadata
			)
			select
				f.subscription_id,
				f.business_id,
				$1::uuid,
				'subscription.invoice_overdue',
				$2,
				jsonb_build_object(
					'invoice_id', f.invoice_id::text,
					'invoice_ref', f.invoice_ref,
					'status', f.status,
					'reason', $2::text
				)
			from failed_subscriptions f
			returning 1
		),
		canceled_subscriptions as (
			update business_subscriptions s
			set
				plan_id = coalesce((select plan_id from free_plan), s.plan_id),
				status = 'canceled',
				canceled_at = coalesce(s.canceled_at, now()),
				cancel_at_period_end = false,
				next_billing_at = null,
				updated_at = now()
			where s.status = 'grace_period'
				and s.grace_ends_at is not null
				and s.grace_ends_at <= now()
			returning s.subscription_id, s.business_id, s.plan_id
		),
		downgraded_businesses as (
			update businesses b
			set plan_id = c.plan_id, updated_at = now()
			from canceled_subscriptions c
			where b.business_id = c.business_id
			returning 1
		),
		canceled_events as (
			insert into business_subscription_events (
				subscription_id,
				business_id,
				actor_admin_user_id,
				event_type,
				summary,
				metadata
			)
			select
				c.subscription_id,
				c.business_id,
				$1::uuid,
				'subscription.grace_expired',
				$2,
				jsonb_build_object(
					'status', 'canceled',
					'reason', $2::text
				)
			from canceled_subscriptions c
			returning 1
		),
		touched as (
			select business_id from failed_subscriptions
			union
			select business_id from canceled_subscriptions
		)
		select
			(select count(*)::int from failed_invoices),
			(select count(*)::int from canceled_subscriptions),
			(select count(*)::int from touched),
			now()
	`, input.ActorAdminUser.String(), input.Reason).Scan(
		&record.OverdueInvoicesFailed,
		&record.SubscriptionsCanceled,
		&record.BusinessesTouched,
		&record.RanAt,
	); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) EnqueueSubscriptionRenewalReminder(
	ctx context.Context,
	input ports.EnqueueSubscriptionRenewalReminderInput,
) (ports.SubscriptionRenewalReminderResult, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.SubscriptionRenewalReminderResult{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.SubscriptionRenewalReminderResult{}, err
	}

	var messageID string
	err = tx.QueryRow(ctx, `
		with logged as (
			insert into subscription_reminders (subscription_id, business_id, kind, period_key)
			values ($1::uuid, $2::uuid, $3, $4)
			on conflict (subscription_id, kind, period_key) do nothing
			returning subscription_id
		)
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select
			gen_random_uuid(),
			$2::uuid,
			$5,
			$3,
			$6,
			jsonb_build_object(
				'subscription_id', $1::text,
				'plan', $7,
				'currency', 'GHS',
				'renewal_amount_minor', $8::bigint,
				'renewal_at', $9::timestamptz,
				'grace_ends_at', $10::timestamptz,
				'repay_url', $11
			),
			$12
		from logged
		on conflict (business_id, dedup_key) do nothing
		returning message_id::text
	`,
		input.SubscriptionID.String(),
		input.BusinessID.String(),
		input.Kind,
		input.PeriodKey,
		input.Channel,
		input.Recipient,
		input.PlanName,
		input.RenewalAmountMinor,
		input.RenewalAt,
		input.GraceEndsAt,
		input.RepayURL,
		input.DedupKey,
	).Scan(&messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Either the reminder was already logged for this (subscription, period,
		// kind) or the outbox row already exists: an idempotent no-op.
		if err := tx.Commit(ctx); err != nil {
			return ports.SubscriptionRenewalReminderResult{}, err
		}
		return ports.SubscriptionRenewalReminderResult{Enqueued: false}, nil
	}
	if err != nil {
		return ports.SubscriptionRenewalReminderResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.SubscriptionRenewalReminderResult{}, err
	}

	return ports.SubscriptionRenewalReminderResult{Enqueued: true}, nil
}
