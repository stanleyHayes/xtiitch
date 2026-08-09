package postgres

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Activating a first subscription from the Paystack webhook.
//
// Until this existed, a first activation could ONLY be completed by the browser
// returning from Paystack and calling VerifySubscriptionAuthorization. The
// webhook could not do it: a subscription checkout writes no `payments` row, and
// the invoice the invoice-reconciler looks for is created BY that same callback —
// so a charge.success for an activation matched nothing, was marked processed,
// and did nothing at all.
//
// That is not an edge case. Mobile money is paid on the phone, and the customer
// has no reason to return to a browser tab afterwards. It cost a real merchant a
// paid quarter: GHS 242.73 collected on 9 August, subscription left `trialing`,
// designs still locked, and no record anywhere that she had paid.
//
// The webhook is the only signal the provider guarantees, so it now completes the
// activation itself. Both paths book the same deterministic invoice_ref, so
// whichever arrives second no-ops.

// activationRefPrefix marks a first-period subscription charge.
const activationRefPrefix = "xtsub-act-"

type subscriptionActivationMatch struct {
	businessID string
	activated  bool
}

// reconcileSubscriptionActivationFromProvider completes a first activation whose
// browser callback never ran.
//
// It does NOT parse the reference into fields. The checkout reference is the
// deterministic ref plus a per-attempt nonce ("Paystack rejects a reused
// reference"), so it carries two trailing epochs and splitting it is guesswork.
// Instead the subscription is loaded by its id and the expected ref is REBUILT
// exactly as PrepareSubscriptionActivationCharge builds it; the incoming
// reference then only has to start with it. A reference that does not is not
// this period's charge and is left alone.
func reconcileSubscriptionActivationFromProvider(
	ctx context.Context,
	tx pgx.Tx,
	input ports.ConfirmPaymentInput,
) (subscriptionActivationMatch, bool, error) {
	subscriptionID, ok := activationSubscriptionID(input.ProviderReference)
	if !ok {
		return subscriptionActivationMatch{}, false, nil
	}

	var (
		businessID, cadence, chargePlanID, chargePlanCode, pendingPlanID string
		anchor                                                           time.Time
	)
	err := tx.QueryRow(ctx, `
		select s.business_id::text,
			coalesce(s.billing_cadence, ''),
			charge_plan.plan_id::text,
			charge_plan.code,
			case when s.current_period_end > now() then s.current_period_start else now() end,
			case
				when s.pending_plan_id is not null and s.pending_plan_effective_at is null
					then s.pending_plan_id::text
				else ''
			end
		from business_subscriptions s
		join plans charge_plan on charge_plan.plan_id = case
			when s.pending_plan_id is not null and s.pending_plan_effective_at is null
				then s.pending_plan_id
			else s.plan_id
		end
		where s.subscription_id = $1
	`, subscriptionID).Scan(
		&businessID, &cadence, &chargePlanID, &chargePlanCode, &anchor, &pendingPlanID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return subscriptionActivationMatch{}, false, nil
	}
	if err != nil {
		return subscriptionActivationMatch{}, false, err
	}

	// Rebuilt to match PrepareSubscriptionActivationCharge character for
	// character. If the two ever drift, this stops matching and the webhook goes
	// back to doing nothing — it never books the wrong period.
	expected := activationRefPrefix + subscriptionID + "-" + chargePlanCode + "-" + cadence + "-" +
		strconv.FormatInt(anchor.Unix(), 10)
	if !strings.HasPrefix(input.ProviderReference, expected) {
		return subscriptionActivationMatch{}, false, nil
	}

	// A failed charge needs no repair: the subscription is already unactivated,
	// and the customer retries from the dashboard.
	if !input.Succeeded {
		return subscriptionActivationMatch{businessID: businessID}, true, nil
	}

	periodEnd, ok := activationPeriodEnd(anchor, cadence)
	if !ok {
		// An unknown cadence cannot be turned into a paid period, and guessing one
		// would either shorten what she paid for or bill her early.
		return subscriptionActivationMatch{businessID: businessID}, true, nil
	}

	// Narrow out of the webhook's bypass now the tenant is known, so every write
	// below is checked by the same row-level policies the callback runs under.
	if err := clearTenantBypass(ctx, tx); err != nil {
		return subscriptionActivationMatch{}, false, err
	}
	if err := setTenantScope(ctx, tx, common.TenantScope{BusinessID: common.ID(businessID)}); err != nil {
		return subscriptionActivationMatch{}, false, err
	}

	activated, err := bookActivationFromProvider(ctx, tx, activationBooking{
		businessID:     businessID,
		subscriptionID: subscriptionID,
		chargePlanID:   chargePlanID,
		pendingPlanID:  pendingPlanID,
		invoiceRef:     expected,
		providerRef:    input.ProviderReference,
		amountMinor:    input.PaidAmountMinor,
		cadence:        cadence,
		periodStart:    anchor,
		periodEnd:      periodEnd,
	})
	if err != nil {
		return subscriptionActivationMatch{}, false, err
	}
	return subscriptionActivationMatch{businessID: businessID, activated: activated}, true, nil
}

// activationSubscriptionID pulls the subscription id out of an activation
// reference. The id is a uuid of fixed length immediately after the prefix, so
// no splitting on "-" is involved — the uuid contains hyphens itself.
func activationSubscriptionID(reference string) (string, bool) {
	if !strings.HasPrefix(reference, activationRefPrefix) {
		return "", false
	}
	rest := strings.TrimPrefix(reference, activationRefPrefix)
	const uuidLength = 36
	if len(rest) <= uuidLength || rest[uuidLength] != '-' {
		return "", false
	}
	return rest[:uuidLength], true
}

// activationPeriodEnd advances the paid period by the chosen cadence, matching
// RecordSubscriptionActivationPayment.
func activationPeriodEnd(start time.Time, cadence string) (time.Time, bool) {
	switch cadence {
	case "quarterly":
		return start.AddDate(0, 3, 0), true
	case "yearly":
		return start.AddDate(0, 12, 0), true
	default:
		return time.Time{}, false
	}
}

type activationBooking struct {
	businessID     string
	subscriptionID string
	chargePlanID   string
	pendingPlanID  string
	invoiceRef     string
	providerRef    string
	amountMinor    int64
	cadence        string
	periodStart    time.Time
	periodEnd      time.Time
}

// bookActivationFromProvider performs the same three state changes the browser
// callback makes — apply the parked upgrade, switch to recurring billing, book
// the paid first period — and reports whether it was this call that did it.
func bookActivationFromProvider(ctx context.Context, tx pgx.Tx, b activationBooking) (bool, error) {
	// The invoice insert is the gate. Keyed on the deterministic ref, so if the
	// callback already ran this no-ops and nothing below happens twice.
	//
	// provider_invoice_ref stores the ACTUAL provider reference, nonce included,
	// rather than the deterministic one. The callback stores the deterministic ref
	// in both columns, which is why a replayed webhook could never find the
	// invoice it had already paid for.
	tag, err := tx.Exec(ctx, `
		insert into business_subscription_invoices (
			invoice_id, subscription_id, business_id, plan_id,
			invoice_ref, provider_invoice_ref, status, billing_mode, provider,
			amount_minor, currency, period_start, period_end, due_at, paid_at
		)
		values (
			gen_random_uuid(), $1, $2, $3,
			$4, $5, 'paid', 'recurring', 'paystack',
			$6, 'GHS', $7, $8, now(), now()
		)
		on conflict (invoice_ref) do nothing
	`, b.subscriptionID, b.businessID, b.chargePlanID,
		b.invoiceRef, b.providerRef, b.amountMinor, b.periodStart, b.periodEnd)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}

	// A parked upgrade is applied only now the money is confirmed — the same rule
	// the callback follows, so a paid plan's features never unlock on an
	// unverified payment.
	if b.pendingPlanID != "" {
		if _, err := tx.Exec(ctx, `
			update business_subscriptions
			set plan_id = $2, pending_plan_id = null, pending_plan_effective_at = null, updated_at = now()
			where business_id = $1
		`, b.businessID, b.pendingPlanID); err != nil {
			return false, err
		}
		if _, err := tx.Exec(ctx, `
			update businesses set plan_id = $2, updated_at = now() where business_id = $1
		`, b.businessID, b.pendingPlanID); err != nil {
			return false, err
		}
	}

	// provider_channel is set to mobile money because the webhook does not carry
	// the channel and this is the safe reading of an unknown one: the renewal
	// sweep sends a re-pay reminder instead of auto-charging an authorization we
	// do not have, which would be a guaranteed failed charge. A later callback
	// from the same customer overwrites it with the real channel.
	if _, err := tx.Exec(ctx, `
		update business_subscriptions
		set billing_mode = 'recurring',
			provider = 'paystack',
			provider_channel = case when coalesce(provider_channel, '') = '' then 'mobile_money' else provider_channel end,
			status = 'active',
			failed_payment_count = 0,
			grace_ends_at = null,
			cancel_at_period_end = false,
			canceled_at = null,
			billing_cadence = $4,
			first_purchase_consumed = true,
			last_invoice_ref = $2,
			last_payment_at = now(),
			current_period_start = $5,
			current_period_end = $3,
			next_billing_at = $3,
			updated_at = now()
		where business_id = $1
	`, b.businessID, b.invoiceRef, b.periodEnd, b.cadence, b.periodStart); err != nil {
		return false, err
	}
	return true, nil
}
