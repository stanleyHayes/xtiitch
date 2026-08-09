package postgres

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// A first activation completed from the webhook alone.
//
// Modelled on the merchant this was written for: trialing on free, a growth
// upgrade parked, quarterly cadence, paid by mobile money — and no browser
// callback, because MoMo is paid on the phone. Run as xtiitch_app so the
// row-level policies are actually in force; skipped without
// XTIITCH_TEST_DATABASE_URL.

const (
	itWhBiz = "7a7a7a7a-0000-0000-0000-00000000a001"
	itWhSub = "7a7a7a7a-0000-0000-0000-00000000a002"
)

type activationFixture struct {
	freePlanID   string
	growthPlanID string
	periodStart  time.Time
	ref          string
}

func seedWebhookActivationFixture(t *testing.T, pool *pgxpool.Pool) activationFixture {
	t.Helper()
	cleanupWebhookActivationFixture(t, pool)

	ctx := context.Background()
	var fixture activationFixture
	if err := pool.QueryRow(ctx,
		`select plan_id from plans where monthly_fee_minor = 0 order by code limit 1`).
		Scan(&fixture.freePlanID); err != nil {
		t.Fatalf("probe free plan: %v", err)
	}
	if err := pool.QueryRow(ctx,
		`select plan_id from plans where monthly_fee_minor > 0 order by monthly_fee_minor limit 1`).
		Scan(&fixture.growthPlanID); err != nil {
		t.Fatalf("probe paid plan: %v", err)
	}
	var planCode string
	if err := pool.QueryRow(ctx,
		`select code from plans where plan_id = $1`, fixture.growthPlanID).Scan(&planCode); err != nil {
		t.Fatalf("probe paid plan code: %v", err)
	}

	// Mid-period, so the reference anchors on current_period_start exactly as
	// PrepareSubscriptionActivationCharge would.
	fixture.periodStart = time.Now().UTC().Add(-11 * 24 * time.Hour).Truncate(time.Second)

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Webhook Activation', 'it-webhook-activation', 'verified')
		`, itWhBiz, fixture.freePlanID)
		// The shape that broke: trialing, still on free, a paid plan parked as a
		// pending upgrade, billing_mode manual because nothing has confirmed yet.
		mustExec(t, tx, `
			insert into business_subscriptions (
				subscription_id, business_id, plan_id, status, billing_mode, provider,
				billing_cadence, current_period_start, current_period_end,
				pending_plan_id, pending_plan_effective_at
			)
			values ($1, $2, $3, 'trialing', 'manual', 'paystack', 'quarterly', $4, $5, $6, null)
		`, itWhSub, itWhBiz, fixture.freePlanID,
			fixture.periodStart, fixture.periodStart.AddDate(0, 1, 0), fixture.growthPlanID)
	})

	// The reference Paystack actually sends: the deterministic ref plus the
	// per-attempt nonce the checkout appends.
	fixture.ref = fmt.Sprintf("xtsub-act-%s-%s-quarterly-%d-%d",
		itWhSub, planCode, fixture.periodStart.Unix(), time.Now().UTC().Unix())
	return fixture
}

func cleanupWebhookActivationFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference like 'xtsub-act-'||$1||'%'`, itWhSub)
		mustExec(t, tx, `delete from business_subscription_invoices where business_id = $1`, itWhBiz)
		mustExec(t, tx, `delete from business_subscriptions where business_id = $1`, itWhBiz)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itWhBiz)
	})
}

type activationState struct {
	status, billingMode, channel, planCode, businessPlanCode string
	paidInvoices                                             int
	firstPurchaseConsumed                                    bool
	periodEnd                                                time.Time
}

func readActivationState(t *testing.T, pool *pgxpool.Pool) activationState {
	t.Helper()
	var state activationState
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select s.status, s.billing_mode, coalesce(s.provider_channel,''),
				p.code, bp.code, s.first_purchase_consumed, s.current_period_end,
				(select count(*) from business_subscription_invoices i
				   where i.subscription_id = s.subscription_id and i.status = 'paid')
			from business_subscriptions s
			join plans p on p.plan_id = s.plan_id
			join businesses b on b.business_id = s.business_id
			join plans bp on bp.plan_id = b.plan_id
			where s.subscription_id = $1
		`, itWhSub).Scan(&state.status, &state.billingMode, &state.channel,
			&state.planCode, &state.businessPlanCode, &state.firstPurchaseConsumed,
			&state.periodEnd, &state.paidInvoices); err != nil {
			t.Fatalf("read activation state: %v", err)
		}
	})
	return state
}

// The merchant paid and never came back to the browser. Before this, the webhook
// recorded the event and did nothing; she stayed locked out of what she bought.
func TestWebhookActivatesAFirstSubscriptionWithoutTheBrowserCallback(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	fixture := seedWebhookActivationFixture(t, pool)
	defer cleanupWebhookActivationFixture(t, pool)

	before := readActivationState(t, pool)
	if before.status != "trialing" || before.paidInvoices != 0 {
		t.Fatalf("fixture should start unactivated, got %+v", before)
	}

	result, err := NewPaymentRepository(pool).ConfirmFromProvider(context.Background(),
		ports.ConfirmPaymentInput{
			EventSignature: "wh_act_1", EventType: "charge.success",
			ProviderReference: fixture.ref, Succeeded: true, PaidAmountMinor: 24273,
		})
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if !result.SubscriptionActivated {
		t.Fatal("the webhook must report that it completed the activation")
	}

	after := readActivationState(t, pool)
	if after.status != "active" {
		t.Fatalf("subscription must be active, got %q", after.status)
	}
	if after.paidInvoices != 1 {
		t.Fatalf("expected exactly one paid invoice, got %d", after.paidInvoices)
	}
	// The parked upgrade applies only once money is confirmed — and it must reach
	// the businesses row too, because that is what gates entitlements.
	if after.planCode != after.businessPlanCode {
		t.Fatalf("subscription and business plans disagree: %q vs %q",
			after.planCode, after.businessPlanCode)
	}
	if after.planCode == before.planCode {
		t.Fatalf("the parked upgrade should have been applied, still on %q", after.planCode)
	}
	if !after.firstPurchaseConsumed {
		t.Fatal("the one-time intro must be consumed by a paid first period")
	}
	if after.billingMode != "recurring" {
		t.Fatalf("billing must flip to recurring so the renewal sweep sees it, got %q", after.billingMode)
	}
	// Unknown channel is read as mobile money so renewals prompt rather than
	// auto-charging an authorization that does not exist.
	if after.channel != "mobile_money" {
		t.Fatalf("expected the safe mobile_money default, got %q", after.channel)
	}
	// A quarterly purchase must buy three months from the anchor the ref names.
	wantEnd := fixture.periodStart.AddDate(0, 3, 0)
	if after.periodEnd.Sub(wantEnd).Abs() > time.Minute {
		t.Fatalf("paid period must end %v, got %v", wantEnd, after.periodEnd)
	}
}

// Paystack redelivers webhooks as a matter of course, and the browser callback
// may still arrive later. Neither may book a second period.
func TestWebhookActivationIsIdempotent(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	fixture := seedWebhookActivationFixture(t, pool)
	defer cleanupWebhookActivationFixture(t, pool)

	repo := NewPaymentRepository(pool)
	for attempt, signature := range []string{"wh_act_a", "wh_act_b", "wh_act_c"} {
		result, err := repo.ConfirmFromProvider(context.Background(), ports.ConfirmPaymentInput{
			EventSignature: signature, EventType: "charge.success",
			ProviderReference: fixture.ref, Succeeded: true, PaidAmountMinor: 24273,
		})
		if err != nil {
			t.Fatalf("attempt %d: %v", attempt, err)
		}
		// Only the first delivery does the work; the rest find the invoice booked.
		if attempt == 0 && !result.SubscriptionActivated {
			t.Fatal("the first delivery must activate")
		}
		if attempt > 0 && result.SubscriptionActivated {
			t.Fatalf("delivery %d activated again — the booking is not idempotent", attempt)
		}
	}

	if state := readActivationState(t, pool); state.paidInvoices != 1 {
		t.Fatalf("three deliveries must leave exactly one paid invoice, got %d", state.paidInvoices)
	}
}

// The reference is rebuilt from the subscription and matched by prefix, so a
// charge for some other period or plan must not be mistaken for this one.
func TestWebhookIgnoresAReferenceThatIsNotThisPeriodsCharge(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	fixture := seedWebhookActivationFixture(t, pool)
	defer cleanupWebhookActivationFixture(t, pool)

	repo := NewPaymentRepository(pool)
	for name, reference := range map[string]string{
		"wrong period": fmt.Sprintf("xtsub-act-%s-growth-quarterly-1-2", itWhSub),
		"unknown subscription": fmt.Sprintf(
			"xtsub-act-11111111-2222-3333-4444-555555555555-growth-quarterly-%d-9",
			fixture.periodStart.Unix()),
		"not an activation at all": "xt_some_order_reference",
	} {
		result, err := repo.ConfirmFromProvider(context.Background(), ports.ConfirmPaymentInput{
			EventSignature: "wh_neg_" + name, EventType: "charge.success",
			ProviderReference: reference, Succeeded: true, PaidAmountMinor: 24273,
		})
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if result.SubscriptionActivated {
			t.Fatalf("%s: must not activate anything", name)
		}
	}

	if state := readActivationState(t, pool); state.status != "trialing" || state.paidInvoices != 0 {
		t.Fatalf("no unrelated reference may activate: %+v", state)
	}
}

// A failed charge must leave her exactly as she was, so the dashboard still
// offers the retry.
func TestWebhookDoesNotActivateOnAFailedCharge(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	fixture := seedWebhookActivationFixture(t, pool)
	defer cleanupWebhookActivationFixture(t, pool)

	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(context.Background(),
		ports.ConfirmPaymentInput{
			EventSignature: "wh_act_failed", EventType: "charge.failed",
			ProviderReference: fixture.ref, Succeeded: false,
		}); err != nil {
		t.Fatalf("confirm: %v", err)
	}

	state := readActivationState(t, pool)
	if state.status != "trialing" || state.paidInvoices != 0 {
		t.Fatalf("a failed charge must change nothing, got %+v", state)
	}
}
