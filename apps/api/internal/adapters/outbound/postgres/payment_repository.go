package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

type PaymentRepository struct {
	pool *pgxpool.Pool
}

func NewPaymentRepository(pool *pgxpool.Pool) PaymentRepository {
	return PaymentRepository{pool: pool}
}

func (repo PaymentRepository) Create(ctx context.Context, input ports.CreatePaymentInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	var method any
	if input.Method != "" {
		method = input.Method
	}

	if _, err := tx.Exec(ctx, `
		insert into payments (
			payment_id, business_id, order_id, booking_id, purpose, amount_minor, currency, method,
			provider_reference, status, through_platform, commission_minor
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'initiated', true, $10)
	`, input.PaymentID.String(), input.BusinessID.String(), nullableIDArg(input.OrderID), nullableIDArg(input.BookingID), input.Purpose, input.AmountMinor, input.Currency, method, input.ProviderReference, input.CommissionMinor); err != nil {
		// A second in-flight balance charge for the same order is rejected by the
		// partial unique index; surface it as the dedicated sentinel so callers
		// can refuse cleanly rather than double-charging the customer.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "payments_one_open_balance_idx" {
			return ports.ErrPaymentInFlight
		}
		return err
	}

	return tx.Commit(ctx)
}

// ConfirmFromProvider records the webhook event and advances the matching
// payment in a single transaction. The event's unique signature makes a
// re-delivered confirmation a no-op, and a payment only moves out of
// 'initiated' once.
func (repo PaymentRepository) ConfirmFromProvider(ctx context.Context, input ports.ConfirmPaymentInput) (ports.ConfirmPaymentResult, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	// A webhook arrives without a tenant context and finds the payment by its
	// provider reference, so the event-record and lookup run with the RLS bypass.
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	isNew, err := recordProviderEvent(ctx, tx, input)
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	if !isNew {
		return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{AlreadyProcessed: true})
	}

	payment, found, err := lookupPaymentByReference(ctx, tx, input.ProviderReference)
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	if !found {
		invoice, invoiceFound, err := reconcileSubscriptionInvoiceFromProvider(ctx, tx, input)
		if err != nil {
			return ports.ConfirmPaymentResult{}, err
		}
		return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{
			PaymentFound:             false,
			SubscriptionInvoiceFound: invoiceFound,
			BusinessID:               common.ID(invoice.businessID),
		})
	}

	if err := applyConfirmation(ctx, tx, input, payment); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{PaymentFound: true, BusinessID: common.ID(payment.businessID)})
}

// scopedPayment is the slice of the payment a webhook needs to settle it.
type scopedPayment struct {
	paymentID   string
	businessID  string
	orderID     sql.NullString
	bookingID   sql.NullString
	amountMinor int64
	purpose     string
}

type subscriptionInvoiceProviderMatch struct {
	invoiceID      string
	subscriptionID string
	businessID     string
	invoiceRef     string
	status         string
}

// recordProviderEvent writes the idempotency row and reports whether this was a
// first delivery. A re-delivered event conflicts and affects no rows.
func recordProviderEvent(ctx context.Context, tx pgx.Tx, input ports.ConfirmPaymentInput) (bool, error) {
	tag, err := tx.Exec(ctx, `
		insert into payment_provider_events (event_id, provider, event_signature, event_type, provider_reference)
		values (gen_random_uuid(), 'paystack', $1, $2, $3)
		on conflict (provider, event_signature) do nothing
	`, input.EventSignature, input.EventType, input.ProviderReference)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// lookupPaymentByReference resolves the payment (and its tenant) by provider
// reference. It runs under the bypass because the tenant is not yet known.
func lookupPaymentByReference(ctx context.Context, tx pgx.Tx, providerReference string) (scopedPayment, bool, error) {
	var payment scopedPayment
	err := tx.QueryRow(ctx, `
		select payment_id::text, business_id::text, order_id::text, booking_id::text, amount_minor, purpose
		from payments where provider_reference = $1
	`, providerReference).Scan(&payment.paymentID, &payment.businessID, &payment.orderID, &payment.bookingID, &payment.amountMinor, &payment.purpose)
	if errors.Is(err, pgx.ErrNoRows) {
		return scopedPayment{}, false, nil
	}
	if err != nil {
		return scopedPayment{}, false, err
	}
	return payment, true, nil
}

// reconcileSubscriptionInvoiceFromProvider applies Paystack payment-link or
// recurring invoice webhooks that do not correspond to customer order payments.
// It starts from the RLS bypass lookup, then narrows back to the matched
// business before mutating invoice/subscription rows.
func reconcileSubscriptionInvoiceFromProvider(
	ctx context.Context,
	tx pgx.Tx,
	input ports.ConfirmPaymentInput,
) (subscriptionInvoiceProviderMatch, bool, error) {
	invoice, found, err := lookupSubscriptionInvoiceByProviderReference(ctx, tx, input.ProviderReference)
	if err != nil || !found {
		return subscriptionInvoiceProviderMatch{}, found, err
	}

	if err := clearTenantBypass(ctx, tx); err != nil {
		return subscriptionInvoiceProviderMatch{}, false, err
	}
	if err := setTenantScope(ctx, tx, common.TenantScope{BusinessID: common.ID(invoice.businessID)}); err != nil {
		return subscriptionInvoiceProviderMatch{}, false, err
	}

	if input.Succeeded {
		if invoice.status != "issued" && invoice.status != "failed" {
			return invoice, true, nil
		}
		return invoice, true, markSubscriptionInvoicePaidFromProvider(ctx, tx, invoice, input)
	}

	if invoice.status != "issued" {
		return invoice, true, nil
	}
	return invoice, true, markSubscriptionInvoiceFailedFromProvider(ctx, tx, invoice, input)
}

func lookupSubscriptionInvoiceByProviderReference(
	ctx context.Context,
	tx pgx.Tx,
	providerReference string,
) (subscriptionInvoiceProviderMatch, bool, error) {
	var invoice subscriptionInvoiceProviderMatch
	err := tx.QueryRow(ctx, `
		select invoice_id::text, subscription_id::text, business_id::text, invoice_ref, status
		from business_subscription_invoices
		where provider = 'paystack'
			and (provider_invoice_ref = $1 or invoice_ref = $1)
		order by created_at desc
		limit 1
	`, providerReference).Scan(
		&invoice.invoiceID,
		&invoice.subscriptionID,
		&invoice.businessID,
		&invoice.invoiceRef,
		&invoice.status,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return subscriptionInvoiceProviderMatch{}, false, nil
	}
	if err != nil {
		return subscriptionInvoiceProviderMatch{}, false, err
	}
	return invoice, true, nil
}

func markSubscriptionInvoicePaidFromProvider(
	ctx context.Context,
	tx pgx.Tx,
	invoice subscriptionInvoiceProviderMatch,
	input ports.ConfirmPaymentInput,
) error {
	tag, err := tx.Exec(ctx, `
		with paid_invoice as (
			update business_subscription_invoices i
			set
				status = 'paid',
				paid_at = coalesce(i.paid_at, now()),
				failed_at = null,
				failure_reason = '',
				updated_at = now()
			where i.invoice_id = $1::uuid
				and i.business_id = $2::uuid
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
				and s.business_id = i.business_id
			returning 1
		)
		select 1 from updated
	`, invoice.invoiceID, invoice.businessID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	_, err = tx.Exec(ctx, `
		insert into business_subscription_events (
			subscription_id,
			business_id,
			event_type,
			summary,
			metadata
		)
		values (
			$1::uuid,
			$2::uuid,
			'subscription.invoice_paid',
			'Paystack webhook confirmed subscription invoice payment.',
			jsonb_build_object(
				'invoice_id', $3::text,
				'invoice_ref', $4::text,
				'provider_reference', $5::text,
				'event_type', $6::text,
				'source', 'paystack_webhook'
			)
		)
	`, invoice.subscriptionID, invoice.businessID, invoice.invoiceID, invoice.invoiceRef, input.ProviderReference, input.EventType)
	return err
}

func markSubscriptionInvoiceFailedFromProvider(
	ctx context.Context,
	tx pgx.Tx,
	invoice subscriptionInvoiceProviderMatch,
	input ports.ConfirmPaymentInput,
) error {
	reason := subscriptionWebhookFailureReason(input)
	tag, err := tx.Exec(ctx, `
		with failed_invoice as (
			update business_subscription_invoices i
			set
				status = 'failed',
				failed_at = coalesce(i.failed_at, now()),
				failure_reason = $3,
				updated_at = now()
			where i.invoice_id = $1::uuid
				and i.business_id = $2::uuid
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
				and s.business_id = i.business_id
			returning 1
		)
		select 1 from updated
	`, invoice.invoiceID, invoice.businessID, reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	_, err = tx.Exec(ctx, `
		insert into business_subscription_events (
			subscription_id,
			business_id,
			event_type,
			summary,
			metadata
		)
		values (
			$1::uuid,
			$2::uuid,
			'subscription.invoice_failed',
			$3,
			jsonb_build_object(
				'invoice_id', $4::text,
				'invoice_ref', $5::text,
				'provider_reference', $6::text,
				'event_type', $7::text,
				'source', 'paystack_webhook',
				'reason', $3::text
			)
		)
	`, invoice.subscriptionID, invoice.businessID, reason, invoice.invoiceID, invoice.invoiceRef, input.ProviderReference, input.EventType)
	return err
}

func subscriptionWebhookFailureReason(input ports.ConfirmPaymentInput) string {
	if input.EventType == "" {
		return "Paystack webhook reported subscription invoice payment failure."
	}
	return "Paystack webhook reported " + input.EventType + "."
}

// applyConfirmation advances the payment and, on a genuine success transition,
// confirms its order. The tenant is known now, so it drops the cross-tenant
// bypass and scopes to that business: every write here runs under real
// row-level security, forced to this one tenant.
func applyConfirmation(ctx context.Context, tx pgx.Tx, input ports.ConfirmPaymentInput, payment scopedPayment) error {
	if err := clearTenantBypass(ctx, tx); err != nil {
		return err
	}
	if err := setTenantScope(ctx, tx, common.TenantScope{BusinessID: common.ID(payment.businessID)}); err != nil {
		return err
	}

	newStatus := "failed"
	if input.Succeeded {
		newStatus = "succeeded"
	}
	tag, err := tx.Exec(ctx, `
		update payments
		set status = $2, updated_at = now()
		where provider_reference = $1 and status = 'initiated'
	`, input.ProviderReference, newStatus)
	if err != nil {
		return err
	}

	// The payment row is the single source of truth for settlement: act only when
	// this very event moved the payment initiated -> (succeeded|failed)
	// (RowsAffected == 1). Gating on the inbound flag instead would let a
	// charge.success that arrives after a charge.failed settle the order while
	// the payment stays failed.
	if tag.RowsAffected() != 1 || !payment.orderID.Valid {
		return nil
	}
	if input.Succeeded {
		return applyPaymentSuccess(ctx, tx, payment)
	}
	return applyPaymentFailure(ctx, tx, payment)
}

// applyPaymentSuccess routes a genuine payment success to the right settlement
// by purpose: a booking deposit confirms the visit + its order, a balance credits
// the confirmed order, and everything else confirms a draft order at its first stage.
func applyPaymentSuccess(ctx context.Context, tx pgx.Tx, payment scopedPayment) error {
	switch payment.purpose {
	case "booking_deposit":
		return confirmBookingOnPayment(ctx, tx, payment)
	case "balance":
		return creditOrderBalance(ctx, tx, payment.businessID, payment.orderID.String, payment.paymentID, payment.amountMinor)
	default:
		return confirmOrderOnPayment(ctx, tx, payment.businessID, payment.orderID.String, payment.amountMinor)
	}
}

// applyPaymentFailure releases a held home-visit slot when its booking deposit
// fails, so the slot returns to availability. Other purposes leave the order as
// is (a draft stays recoverable; a confirmed order keeps its balance owed).
func applyPaymentFailure(ctx context.Context, tx pgx.Tx, payment scopedPayment) error {
	if payment.purpose == "booking_deposit" && payment.bookingID.Valid {
		if err := releaseBooking(ctx, tx, payment.businessID, payment.bookingID.String, payment.orderID.String); err != nil {
			return err
		}
	}
	if payment.orderID.Valid {
		if err := voidPendingPromotionRedemptionsForOrder(ctx, tx, payment.businessID, payment.orderID.String); err != nil {
			return err
		}
		return voidPendingAffiliateAttributionForOrder(ctx, tx, payment.businessID, payment.orderID.String)
	}
	return nil
}

// confirmBookingOnPayment moves a held home-visit slot to booked (recording the
// deposit payment) and confirms its draft order at the first bespoke stage. The
// held-only guard makes a re-delivered event a no-op.
func confirmBookingOnPayment(ctx context.Context, tx pgx.Tx, payment scopedPayment) error {
	if !payment.bookingID.Valid {
		return nil
	}
	tag, err := tx.Exec(ctx, `
		update bookings set status = 'booked', deposit_payment_id = $3, updated_at = now()
		where booking_id = $1 and business_id = $2 and status = 'held'
	`, payment.bookingID.String, payment.businessID, payment.paymentID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	if err := confirmOrderOnPayment(ctx, tx, payment.businessID, payment.orderID.String, payment.amountMinor); err != nil {
		return err
	}
	return enqueueBookingNotification(ctx, tx, payment.businessID, payment.bookingID.String, notification.KindBookingConfirmed)
}

// releaseBooking cancels a held booking and its draft order, freeing the slot.
// The held/draft guards keep it idempotent and prevent touching a confirmed visit.
func releaseBooking(ctx context.Context, tx pgx.Tx, businessID, bookingID, orderID string) error {
	tag, err := tx.Exec(ctx, `
		update bookings set status = 'cancelled', updated_at = now()
		where booking_id = $1 and business_id = $2 and status = 'held'
	`, bookingID, businessID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	_, err = tx.Exec(ctx, `
		update orders set status = 'cancelled', updated_at = now()
		where order_id = $1 and business_id = $2 and status = 'draft'
	`, orderID, businessID)
	return err
}

// creditOrderBalance applies a balance payment to an already-confirmed order:
// it credits the settled amount without touching the production stage. Every
// statement is scoped to the payment's own business, so a stray cross-tenant
// order_id credits nothing. settled_minor is capped at the agreed total, so even
// a duplicated balance charge can never settle more than is owed.
func creditOrderBalance(ctx context.Context, tx pgx.Tx, businessID, orderID, paymentID string, amountMinor int64) error {
	tag, err := tx.Exec(ctx, `
		update orders
		set settled_minor = least(settled_minor + $3, agreed_total_minor), updated_at = now()
		where order_id = $1 and business_id = $2
			and status in ('confirmed', 'fulfilled') and agreed_total_minor is not null
	`, orderID, businessID, amountMinor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	return enqueueBalancePaymentNotification(ctx, tx, businessID, orderID, paymentID, amountMinor)
}

// commitConfirm commits the confirmation transaction and yields its result.
func commitConfirm(ctx context.Context, tx pgx.Tx, result ports.ConfirmPaymentResult) (ports.ConfirmPaymentResult, error) {
	if err := tx.Commit(ctx); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	return result, nil
}

// confirmOrderOnPayment moves the order from draft to confirmed at its first
// stage and credits the settled amount. Every statement is constrained to the
// payment's own business, so a stray cross-tenant order_id finds no row and
// settles nothing — defence in depth alongside the now-restored RLS.
func confirmOrderOnPayment(ctx context.Context, tx pgx.Tx, businessID, orderID string, amountMinor int64) error {
	var stageID string
	err := tx.QueryRow(ctx, `
		select st.stage_id
		from orders o
		join stage_templates st on st.business_id = o.business_id and st.flow = o.flow
		where o.order_id = $1 and o.business_id = $2
		order by st.sequence
		limit 1
	`, orderID, businessID).Scan(&stageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update orders
		set status = 'confirmed', current_stage_id = $2,
			settled_minor = settled_minor + $3, updated_at = now()
		where order_id = $1 and business_id = $4 and status = 'draft'
	`, orderID, stageID, amountMinor, businessID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	if _, err = tx.Exec(ctx, `
		insert into stage_events (event_id, business_id, order_id, stage_id)
		select gen_random_uuid(), o.business_id, o.order_id, $2
		from orders o where o.order_id = $1 and o.business_id = $3
	`, orderID, stageID, businessID); err != nil {
		return err
	}

	if err := applyPendingPromotionRedemptionsForOrder(ctx, tx, businessID, orderID); err != nil {
		return err
	}
	if err := applyPendingAffiliateAttributionForOrder(ctx, tx, businessID, orderID); err != nil {
		return err
	}

	// The order is now confirmed; in the same transaction, record the intent to
	// tell the customer. The dedup key makes a redelivered webhook a no-op.
	return enqueueOrderNotification(ctx, tx, businessID, orderID, notification.KindOrderConfirmed)
}

func applyPendingPromotionRedemptionsForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update promotion_redemptions
		set status = 'applied', redeemed_at = now(), updated_at = now()
		where business_id = $1 and order_id = $2 and status = 'pending'
	`, businessID, orderID)
	return err
}

func voidPendingPromotionRedemptionsForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update promotion_redemptions
		set status = 'void', updated_at = now()
		where business_id = $1 and order_id = $2 and status = 'pending'
	`, businessID, orderID)
	return err
}

func applyPendingAffiliateAttributionForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		with reservation as (
			update affiliate_attribution_reservations
			set status = 'converted', updated_at = now()
			where business_id = $1
				and order_id = $2
				and status = 'pending'
			returning *
		)
		insert into affiliate_conversions (
			affiliate_id,
			affiliate_click_id,
			business_id,
			order_id,
			gross_minor,
			commission_minor,
			commission_model,
			commission_rate,
			attribution_model,
			status,
			hold_until,
			metadata
		)
		select
			affiliate_id,
			affiliate_click_id,
			business_id,
			order_id,
			gross_minor,
			commission_minor,
			commission_model,
			commission_rate,
			attribution_model,
			'pending',
			now() + interval '14 days',
			metadata || jsonb_build_object(
				'reservation_id', reservation_id::text,
				'source', 'payment_success'
			)
		from reservation
		on conflict (order_id) do nothing
	`, businessID, orderID)
	return err
}

func voidPendingAffiliateAttributionForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update affiliate_attribution_reservations
		set status = 'void', updated_at = now()
		where business_id = $1
			and order_id = $2
			and status = 'pending'
	`, businessID, orderID)
	return err
}

func (repo PaymentRepository) ListByBusiness(ctx context.Context, scope common.TenantScope) ([]ports.PaymentRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, scope.BusinessID.String()); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select payment_id, business_id, purpose, amount_minor, currency,
			coalesce(method, ''), provider_reference, status, commission_minor
		from payments
		where business_id = $1
		order by created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}

	var records []ports.PaymentRecord
	for rows.Next() {
		var record ports.PaymentRecord
		if err := rows.Scan(
			&record.PaymentID,
			&record.BusinessID,
			&record.Purpose,
			&record.AmountMinor,
			&record.Currency,
			&record.Method,
			&record.ProviderReference,
			&record.Status,
			&record.CommissionMinor,
		); err != nil {
			rows.Close()
			return nil, err
		}
		records = append(records, record)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo PaymentRepository) RecordManualTaking(ctx context.Context, scope common.TenantScope, input ports.ManualTakingInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Off-platform money: no commission, no through_platform — Xtiitch never
	// touches it, it is only recorded so the business sees its full income.
	if _, err := tx.Exec(ctx, `
		insert into manual_takings (taking_id, business_id, order_id, amount_minor, method, what_for)
		values ($1, $2, $3, $4, $5, $6)
	`, input.TakingID.String(), input.BusinessID.String(), nullableIDArg(input.OrderID),
		input.AmountMinor, input.Method, input.WhatFor); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo PaymentRepository) ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ports.ManualTakingRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select taking_id, amount_minor, method, what_for, taken_at
		from manual_takings where business_id = $1
		order by taken_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}

	var records []ports.ManualTakingRecord
	for rows.Next() {
		var record ports.ManualTakingRecord
		if err := rows.Scan(&record.TakingID, &record.AmountMinor, &record.Method, &record.WhatFor, &record.TakenAt); err != nil {
			rows.Close()
			return nil, err
		}
		records = append(records, record)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

func (repo PaymentRepository) MoneySummary(ctx context.Context, scope common.TenantScope) (ports.MoneySummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.MoneySummary{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.MoneySummary{}, err
	}

	var summary ports.MoneySummary
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0), coalesce(sum(commission_minor), 0)
		from payments
		where business_id = $1 and status = 'succeeded' and through_platform = true
	`, scope.BusinessID.String()).Scan(&summary.ThroughPlatformMinor, &summary.CommissionMinor); err != nil {
		return ports.MoneySummary{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0) from manual_takings where business_id = $1
	`, scope.BusinessID.String()).Scan(&summary.ManualTakingsMinor); err != nil {
		return ports.MoneySummary{}, err
	}
	summary.NetIncomeMinor = summary.ThroughPlatformMinor - summary.CommissionMinor + summary.ManualTakingsMinor

	if err := tx.Commit(ctx); err != nil {
		return ports.MoneySummary{}, err
	}
	return summary, nil
}

func rollbackPaymentUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
