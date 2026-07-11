package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
		select payment_id::text, business_id::text, order_id::text, booking_id::text,
			amount_minor, coalesce(settle_amount_minor, amount_minor), purpose
		from payments where provider_reference = $1
	`, providerReference).Scan(&payment.paymentID, &payment.businessID, &payment.orderID, &payment.bookingID, &payment.amountMinor, &payment.settleAmountMinor, &payment.purpose)
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

	// Defense-in-depth amount reconciliation: a provider "success" that reports
	// collecting LESS than the payment's expected amount must NOT settle the order in
	// full. Standard checkout locks the amount server-side so this should never
	// happen, but an underpayment / provider-side discrepancy is treated as a failure
	// rather than trusted. A zero reported amount means "not reported" — skip.
	succeeded := input.Succeeded
	if succeeded && input.PaidAmountMinor > 0 && input.PaidAmountMinor < payment.amountMinor {
		succeeded = false
	}

	newStatus := "failed"
	if succeeded {
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
	if succeeded {
		return applyPaymentSuccess(ctx, tx, payment)
	}
	return applyPaymentFailure(ctx, tx, payment)
}

// reconcileMarketplaceChargeFromProvider settles a combined §4 marketplace split
// charge (one Paystack transaction across several shops). It runs from the RLS
// bypass (the tenant is unknown at lookup). The single status transition
// initiated -> (succeeded|failed) is the settle-once gate; on success it
// confirms every shop's checkout group under that shop's own tenant scope and
// records a per-shop money-tracker payment row. On failure the draft orders are
// left as-is (recoverable), matching the single-store cart failure. Returns
// found=false when no marketplace charge matches the reference, so the other
// non-order reconciles can try it.
func reconcileMarketplaceChargeFromProvider(ctx context.Context, tx pgx.Tx, input ports.ConfirmPaymentInput) (bool, error) {
	var chargeID string
	err := tx.QueryRow(ctx, `
		select charge_id::text from marketplace_charges where provider_reference = $1
	`, input.ProviderReference).Scan(&chargeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	newStatus := "failed"
	if input.Succeeded {
		newStatus = "succeeded"
	}
	tag, err := tx.Exec(ctx, `
		update marketplace_charges set status = $2, updated_at = now()
		where provider_reference = $1 and status = 'initiated'
	`, input.ProviderReference, newStatus)
	if err != nil {
		return true, err
	}
	// Only the event that actually transitions the charge settles it (idempotent);
	// a failure leaves the shops' drafts recoverable.
	if tag.RowsAffected() != 1 || !input.Succeeded {
		return true, nil
	}

	type member struct {
		businessID      string
		anchorOrderID   string
		netMinor        int64
		commissionMinor int64
	}
	rows, err := tx.Query(ctx, `
		select business_id::text, anchor_order_id::text, net_minor, commission_minor
		from marketplace_charge_members where charge_id = $1
	`, chargeID)
	if err != nil {
		return true, err
	}
	var members []member
	for rows.Next() {
		var m member
		if err := rows.Scan(&m.businessID, &m.anchorOrderID, &m.netMinor, &m.commissionMinor); err != nil {
			rows.Close()
			return true, err
		}
		members = append(members, m)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return true, err
	}

	for _, m := range members {
		// Narrow from the bypass to this shop for its tenant-scoped order/payment
		// writes, then restore the bypass after the loop for the caller's commit.
		if err := clearTenantBypass(ctx, tx); err != nil {
			return true, err
		}
		if err := setTenantScope(ctx, tx, common.TenantScope{BusinessID: common.ID(m.businessID)}); err != nil {
			return true, err
		}
		if err := confirmOrderGroupOnPayment(ctx, tx, m.businessID, m.anchorOrderID); err != nil {
			return true, err
		}
		if _, err := tx.Exec(ctx, `
			insert into payments (
				payment_id, business_id, order_id, purpose, amount_minor, currency, method,
				provider_reference, status, through_platform, commission_minor
			)
			values (gen_random_uuid(), $1, $2, 'marketplace_split', $3, 'GHS', 'momo', $4, 'succeeded', true, $5)
			on conflict (provider_reference) do nothing
		`, m.businessID, m.anchorOrderID, m.netMinor+m.commissionMinor,
			input.ProviderReference+"::"+m.businessID, m.commissionMinor); err != nil {
			return true, err
		}
	}
	if err := setTenantBypass(ctx, tx); err != nil {
		return true, err
	}
	return true, nil
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
		if err := voidPendingAffiliateAttributionForOrder(ctx, tx, payment.businessID, payment.orderID.String); err != nil {
			return err
		}
		return voidPendingReferralAttributionForOrder(ctx, tx, payment.businessID, payment.orderID.String)
	}
	return nil
}

// commitConfirm commits the confirmation transaction and yields its result.
func commitConfirm(ctx context.Context, tx pgx.Tx, result ports.ConfirmPaymentResult) (ports.ConfirmPaymentResult, error) {
	if err := tx.Commit(ctx); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	return result, nil
}
