package postgres

// Integration tests for the activation period anchor behind
// PrepareSubscriptionActivationCharge / RecordSubscriptionActivationPayment /
// ActivateFreePeriodBilling. The anchor is the current period's start while the
// period is live, or now() once it has lapsed — a resubscribe must buy a FRESH
// period (never collide with the stale period's paid invoice and collect
// nothing, never book a dead period that leaves next_billing_at in the past so
// the recurring sweep charges again within days). Run as xtiitch_app; skipped
// without XTIITCH_TEST_DATABASE_URL.

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itActBizLapsed   = "77777777-7777-7777-7777-777777777771"
	itActSubLapsed   = "77777777-7777-7777-7777-777777777772"
	itActBizLive     = "77777777-7777-7777-7777-777777777773"
	itActSubLive     = "77777777-7777-7777-7777-777777777774"
	itActBizFree     = "77777777-7777-7777-7777-777777777775"
	itActSubFree     = "77777777-7777-7777-7777-777777777776"
	itActInvoiceStal = "77777777-7777-7777-7777-777777777777"
)

// A lapsed, canceled subscription whose original activation invoice is paid
// must NOT short-circuit the next activation: the anchor moves to now(), the
// charge is due again, and booking it starts a fresh period that is not
// immediately past due.
func TestActivationChargeAnchorsAFreshPeriodAfterLapse(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedActivationFixtures(t, pool)
	defer cleanupActivationFixtures(t, pool)

	repo := NewBusinessIdentityRepository(pool)
	ctx := context.Background()

	activation, err := repo.PrepareSubscriptionActivationCharge(ctx, common.ID(itActBizLapsed))
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	if !activation.ShouldCharge {
		t.Fatalf("lapsed subscription must be charged again; the stale paid invoice must not short-circuit it")
	}
	if !activation.PeriodStart.After(time.Date(2026, 4, 15, 10, 0, 0, 0, time.UTC)) {
		t.Fatalf("anchor must leave the stale period start behind, got %s", activation.PeriodStart)
	}
	if since := time.Since(activation.PeriodStart); since > time.Minute {
		t.Fatalf("anchor for a lapsed period should be ~now(), got %s (%s ago)", activation.PeriodStart, since)
	}

	if err := repo.RecordSubscriptionActivationPayment(ctx, ports.RecordSubscriptionActivationPaymentInput{
		BusinessID:     common.ID(itActBizLapsed),
		AmountMinor:    29700,
		Currency:       "GHS",
		ChargeRef:      activation.Ref,
		PeriodStart:    activation.PeriodStart,
		BillingCadence: "quarterly",
	}); err != nil {
		t.Fatalf("record payment: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var status string
		var startMatches, endMatches, futureBilling, cancellationCleared bool
		if err := tx.QueryRow(ctx, `
			select status,
				current_period_start = $2::timestamptz,
				current_period_end = current_period_start + interval '3 months'
					and next_billing_at = current_period_end,
				next_billing_at > now(),
				canceled_at is null
			from business_subscriptions where business_id = $1
		`, itActBizLapsed, activation.PeriodStart).Scan(&status, &startMatches, &endMatches, &futureBilling, &cancellationCleared); err != nil {
			t.Fatalf("read subscription: %v", err)
		}
		if status != "active" {
			t.Fatalf("expected status active, got %s", status)
		}
		if !startMatches {
			t.Fatalf("current_period_start must advance to the booked anchor %s", activation.PeriodStart)
		}
		if !endMatches {
			t.Fatalf("period end / next_billing_at must be anchor + 3 months")
		}
		if !futureBilling {
			t.Fatalf("next_billing_at in the past would let the recurring sweep charge again at once")
		}
		if !cancellationCleared {
			t.Fatalf("a paid re-subscribe must clear canceled_at")
		}
	})

	// A retried verify re-derives the SAME ref and no-ops: the booked period is
	// anchored exactly where the ref says, so no duplicate paid invoice.
	again, err := repo.PrepareSubscriptionActivationCharge(ctx, common.ID(itActBizLapsed))
	if err != nil {
		t.Fatalf("re-prepare: %v", err)
	}
	if again.Ref != activation.Ref {
		t.Fatalf("retry must re-derive the same ref: %s vs %s", again.Ref, activation.Ref)
	}
	if again.ShouldCharge {
		t.Fatalf("the period just booked is paid; a retry must not charge again")
	}
}

// While the period is still live the anchor is the period's own start, so a
// first activation (or a retry of it) stays on the one deterministic ref.
func TestActivationChargeKeepsTheLivePeriodAnchor(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedActivationFixtures(t, pool)
	defer cleanupActivationFixtures(t, pool)

	repo := NewBusinessIdentityRepository(pool)
	ctx := context.Background()

	var storedStart time.Time
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(ctx, `
			select current_period_start from business_subscriptions where business_id = $1
		`, itActBizLive).Scan(&storedStart); err != nil {
			t.Fatalf("read period start: %v", err)
		}
	})

	activation, err := repo.PrepareSubscriptionActivationCharge(ctx, common.ID(itActBizLive))
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	if !activation.PeriodStart.Equal(storedStart) {
		t.Fatalf("live period must keep its own start as anchor: stored %s, got %s", storedStart, activation.PeriodStart)
	}
	if !activation.ShouldCharge {
		t.Fatalf("no activation invoice exists yet for the live sub; a charge is still due")
	}
}

// A free-period activation on a lapsed subscription anchors the window at
// now(), books the zero receipt, and stays idempotent on its ref.
func TestFreePeriodActivationAnchorsTheWindowAndStaysIdempotent(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedActivationFixtures(t, pool)
	defer cleanupActivationFixtures(t, pool)

	discounts := NewSubscriptionDiscountRepository(pool)
	repo := NewBusinessIdentityRepository(pool)
	ctx := context.Background()
	scope := common.TenantScope{BusinessID: common.ID(itActBizFree)}

	// Compose Prepare -> Activate exactly as the service does: the ref and the
	// window's start both come from one preparation, so they can never disagree.
	activation, err := repo.PrepareSubscriptionActivationCharge(ctx, common.ID(itActBizFree))
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	if !activation.ShouldCharge {
		t.Fatalf("a lapsed subscription has no live window; activation must be due")
	}
	input := ports.ActivateFreePeriodInput{
		BusinessID:  common.ID(itActBizFree),
		ChargeRef:   activation.Ref,
		PeriodStart: activation.PeriodStart,
		Currency:    "GHS",
		FreeMonths:  3,
	}
	if err := discounts.ActivateFreePeriodBilling(ctx, scope, input); err != nil {
		t.Fatalf("activate free period: %v", err)
	}
	// A repeat of the same activation ref must no-op, leaving ONE zero invoice.
	if err := discounts.ActivateFreePeriodBilling(ctx, scope, input); err != nil {
		t.Fatalf("repeat activation must no-op: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var zeroInvoices int
		if err := tx.QueryRow(ctx, `
			select count(*) from business_subscription_invoices
			where business_id = $1 and invoice_ref = $2 and amount_minor = 0 and status = 'paid'
		`, itActBizFree, activation.Ref).Scan(&zeroInvoices); err != nil {
			t.Fatalf("count zero invoices: %v", err)
		}
		if zeroInvoices != 1 {
			t.Fatalf("expected exactly one zero receipt, got %d", zeroInvoices)
		}

		var start time.Time
		var startMatches, endMatches, futureBilling bool
		if err := tx.QueryRow(ctx, `
			select current_period_start,
				current_period_start = $2::timestamptz,
				current_period_end = current_period_start + interval '3 months'
					and next_billing_at = current_period_end,
				next_billing_at > now()
			from business_subscriptions where business_id = $1
		`, itActBizFree, activation.PeriodStart).Scan(&start, &startMatches, &endMatches, &futureBilling); err != nil {
			t.Fatalf("read subscription: %v", err)
		}
		if !startMatches {
			t.Fatalf("the window's start must be the ref's anchor %s verbatim, got %s", activation.PeriodStart, start)
		}
		if since := time.Since(start); since > time.Minute {
			t.Fatalf("a free window on a lapsed subscription must start ~now(), got %s (%s ago)", start, since)
		}
		if !endMatches || !futureBilling {
			t.Fatalf("free window must span 3 months into the future")
		}
	})

	// During the window a re-entry re-derives the SAME ref and sees it paid, so
	// the free period is never granted twice and no checkout opens.
	again, err := repo.PrepareSubscriptionActivationCharge(ctx, common.ID(itActBizFree))
	if err != nil {
		t.Fatalf("re-prepare during window: %v", err)
	}
	if again.Ref != activation.Ref {
		t.Fatalf("re-entry during the window must re-derive the same ref: %s vs %s", again.Ref, activation.Ref)
	}
	if again.ShouldCharge {
		t.Fatalf("the window's zero receipt is paid; a re-entry must not activate again")
	}
}

func seedActivationFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupActivationFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe starter plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []struct {
			id     string
			handle string
		}{
			{itActBizLapsed, "it-act-lapsed"},
			{itActBizLive, "it-act-live"},
			{itActBizFree, "it-act-free"},
		} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Activation Shop', $3, 'verified')
			`, biz.id, planID, biz.handle)
		}

		// Lapsed + canceled after a quarterly activation that was never renewed:
		// the shape behind cancel+resubscribe (Pricing Book §7 dunning).
		mustExec(t, tx, `
			insert into business_subscriptions (
				subscription_id, business_id, plan_id, status, billing_mode, provider,
				billing_cadence, current_period_start, current_period_end, canceled_at
			)
			values (
				$1, $2, $3, 'canceled', 'recurring', 'paystack',
				'quarterly',
				'2026-01-15 10:00:00+00',
				'2026-04-15 10:00:00+00',
				'2026-04-20 10:00:00+00'
			)
		`, itActSubLapsed, itActBizLapsed, planID)

		// The stale paid activation invoice: its ref is what used to swallow the
		// resubscribe ("already paid") because nothing advanced the period start.
		staleRef := "xtsub_act_" + itActSubLapsed + "_quarterly_" +
			strconv.FormatInt(time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC).Unix(), 10)
		mustExec(t, tx, `
			insert into business_subscription_invoices (
				invoice_id, subscription_id, business_id, plan_id,
				invoice_ref, provider_invoice_ref, status, billing_mode, provider,
				amount_minor, currency, period_start, period_end, due_at, paid_at
			)
			values (
				$1, $2, $3, $4,
				$5,
				'ps_it_act_stale', 'paid', 'recurring', 'paystack',
				29700, 'GHS',
				'2026-01-15 10:00:00+00', '2026-04-15 10:00:00+00',
				'2026-01-15 10:00:00+00', '2026-01-15 10:00:00+00'
			)
		`, itActInvoiceStal, itActSubLapsed, itActBizLapsed, planID, staleRef)

		// Mid-period live subscription: the anchor must stay the period's start.
		mustExec(t, tx, `
			insert into business_subscriptions (
				subscription_id, business_id, plan_id, status, billing_mode, provider,
				billing_cadence, current_period_start, current_period_end, next_billing_at
			)
			values (
				$1, $2, $3, 'active', 'recurring', 'paystack',
				'quarterly',
				now() - interval '10 days',
				now() + interval '80 days',
				now() + interval '80 days'
			)
		`, itActSubLive, itActBizLive, planID)

		// Lapsed + canceled with no prior invoice: the free-period redemption shape.
		mustExec(t, tx, `
			insert into business_subscriptions (
				subscription_id, business_id, plan_id, status, billing_mode, provider,
				billing_cadence, current_period_start, current_period_end, canceled_at
			)
			values (
				$1, $2, $3, 'canceled', 'recurring', 'paystack',
				'quarterly',
				'2026-01-15 10:00:00+00',
				'2026-04-15 10:00:00+00',
				'2026-04-20 10:00:00+00'
			)
		`, itActSubFree, itActBizFree, planID)
	})
}

func cleanupActivationFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from business_subscription_invoices where business_id = any($1)`,
			[]string{itActBizLapsed, itActBizLive, itActBizFree})
		mustExec(t, tx, `delete from business_subscriptions where business_id = any($1)`,
			[]string{itActBizLapsed, itActBizLive, itActBizFree})
		mustExec(t, tx, `delete from businesses where business_id = any($1)`,
			[]string{itActBizLapsed, itActBizLive, itActBizFree})
	})
}
