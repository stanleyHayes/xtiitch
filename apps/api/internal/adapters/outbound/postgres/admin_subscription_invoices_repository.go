package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) IssueAdminSubscriptionInvoice(
	ctx context.Context,
	input ports.IssueAdminSubscriptionInvoiceInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := ensureAdminSubscription(ctx, tx, input.BusinessID); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	var businessID common.ID
	var subscriptionID common.ID
	if err := tx.QueryRow(ctx, `
		with candidate as (
			select
				s.subscription_id,
				s.business_id,
				s.plan_id,
				s.billing_mode,
				s.current_period_end,
				p.monthly_fee_minor
			from business_subscriptions s
			join plans p on p.plan_id = s.plan_id
			where s.business_id = $2::uuid
				and s.status <> 'canceled'
				and p.monthly_fee_minor > 0
		),
		inserted as (
			insert into business_subscription_invoices (
				invoice_id,
				subscription_id,
				business_id,
				plan_id,
				invoice_ref,
				status,
				billing_mode,
				provider,
				provider_invoice_ref,
				payment_url,
				amount_minor,
				currency,
				period_start,
				period_end,
				due_at,
				issued_by_admin_user_id
			)
			select
				$1::uuid,
				c.subscription_id,
				c.business_id,
				c.plan_id,
				$3,
				'issued',
				c.billing_mode,
				case when c.billing_mode = 'manual' then 'manual' else 'paystack' end,
				$4,
				$5,
				case when $8::bigint > 0 then $8::bigint else c.monthly_fee_minor end,
				'GHS',
				greatest(c.current_period_end, now()),
				greatest(c.current_period_end, now())
					+ (case when $9::int > 0 then $9::int else 1 end) * interval '1 month',
				$6,
				$7::uuid
			from candidate c
			returning subscription_id, business_id, invoice_ref, provider
		),
		updated as (
			update business_subscriptions s
			set
				last_invoice_ref = i.invoice_ref,
				next_billing_at = $6,
				provider = i.provider,
				updated_at = now()
			from inserted i
			where s.subscription_id = i.subscription_id
			returning s.business_id, s.subscription_id
		)
		select business_id::text, subscription_id::text from updated
	`, input.InvoiceID.String(),
		input.BusinessID.String(),
		input.InvoiceRef,
		input.ProviderInvoiceRef,
		input.PaymentURL,
		input.DueAt,
		input.ActorAdminUser.String(),
		input.AmountMinor,
		input.PeriodMonths,
	).Scan(&businessID, &subscriptionID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ports.ErrSubscriptionBillingUnavailable
		}
		// Either an invoice is already open for this period, or this exact invoice_ref
		// was already booked (a replayed activation-verify) — both mean "already
		// booked; do not issue again."
		if subscriptionInvoiceOpen(err) || subscriptionInvoiceRefTaken(err) {
			return ports.AdminSubscriptionRecord{}, ports.ErrSubscriptionInvoiceOpen
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := insertAdminSubscriptionEvent(ctx, tx, subscriptionID, businessID, input.ActorAdminUser,
		"subscription.invoice_issued",
		input.Reason,
		map[string]string{
			"invoice_id":           input.InvoiceID.String(),
			"invoice_ref":          input.InvoiceRef,
			"provider_invoice_ref": input.ProviderInvoiceRef,
			"payment_url":          input.PaymentURL,
			"due_at":               input.DueAt.Format(time.RFC3339),
		},
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := getAdminSubscriptionRecordByBusiness(ctx, tx, businessID)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) MarkAdminSubscriptionInvoicePaid(
	ctx context.Context,
	input ports.MarkAdminSubscriptionInvoicePaidInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	var businessID common.ID
	var subscriptionID common.ID
	var invoiceRef string
	if err := tx.QueryRow(ctx, `
		with paid_invoice as (
			update business_subscription_invoices i
			set
				status = 'paid',
				paid_at = coalesce(i.paid_at, now()),
				failed_at = null,
				failure_reason = '',
				updated_at = now()
			where i.invoice_id = $1::uuid
				and i.status in ('issued', 'failed')
			returning i.*
		),
		updated as (
			update business_subscriptions s
			set
				status = 'active',
				failed_payment_count = 0,
				grace_ends_at = null,
				cancel_at_period_end = false,
				last_invoice_ref = i.invoice_ref,
				last_payment_at = now(),
				current_period_start = i.period_start,
				current_period_end = i.period_end,
				next_billing_at = i.period_end,
				billing_mode = i.billing_mode,
				provider = i.provider,
				updated_at = now()
			from paid_invoice i
			where s.subscription_id = i.subscription_id
			returning s.business_id, s.subscription_id, i.invoice_ref
		)
		select business_id::text, subscription_id::text, invoice_ref from updated
	`, input.InvoiceID.String()).Scan(&businessID, &subscriptionID, &invoiceRef); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ports.ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := insertAdminSubscriptionEvent(ctx, tx, subscriptionID, businessID, input.ActorAdminUser,
		"subscription.invoice_paid",
		input.Reason,
		map[string]string{
			"invoice_id":  input.InvoiceID.String(),
			"invoice_ref": invoiceRef,
		},
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := getAdminSubscriptionRecordByBusiness(ctx, tx, businessID)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) MarkAdminSubscriptionInvoiceFailed(
	ctx context.Context,
	input ports.MarkAdminSubscriptionInvoiceFailedInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	var businessID common.ID
	var subscriptionID common.ID
	var invoiceRef string
	if err := tx.QueryRow(ctx, `
		with failed_invoice as (
			update business_subscription_invoices i
			set
				status = 'failed',
				failed_at = coalesce(i.failed_at, now()),
				failure_reason = $2,
				updated_at = now()
			where i.invoice_id = $1::uuid
				and i.status = 'issued'
			returning i.*
		),
		updated as (
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
				last_invoice_ref = i.invoice_ref,
				next_billing_at = now() + interval '1 day',
				billing_mode = i.billing_mode,
				provider = i.provider,
				updated_at = now()
			from failed_invoice i
			where s.subscription_id = i.subscription_id
			returning s.business_id, s.subscription_id, i.invoice_ref
		)
		select business_id::text, subscription_id::text, invoice_ref from updated
	`, input.InvoiceID.String(), input.Reason).Scan(&businessID, &subscriptionID, &invoiceRef); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ports.ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := insertAdminSubscriptionEvent(ctx, tx, subscriptionID, businessID, input.ActorAdminUser,
		"subscription.invoice_failed",
		input.Reason,
		map[string]string{
			"invoice_id":  input.InvoiceID.String(),
			"invoice_ref": invoiceRef,
			"reason":      input.Reason,
		},
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := getAdminSubscriptionRecordByBusiness(ctx, tx, businessID)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func ensureAdminSubscription(ctx context.Context, tx pgx.Tx, businessID common.ID) error {
	_, err := tx.Exec(ctx, `
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
	`, businessID.String())
	return err
}

func subscriptionInvoiceOpen(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgUniqueViolation &&
		pgErr.ConstraintName == "business_subscription_invoices_one_open_idx"
}

// subscriptionInvoiceRefTaken reports a duplicate invoice_ref insert. The admin
// authorization-verify derives a DETERMINISTIC invoice_ref from the Paystack
// checkout reference, so a replayed callback (refresh / double-click / callback +
// manual verify) collides here and must be treated as already-booked rather than
// issuing a second invoice and advancing the period twice.
func subscriptionInvoiceRefTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgUniqueViolation &&
		pgErr.ConstraintName == "business_subscription_invoices_invoice_ref_key"
}
