package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// These tests run against a real Postgres (skipped unless
// XTIITCH_TEST_DATABASE_URL is set — see payment_repository_integration_test.go).
// They prove the §3.1/§3.2 Money Desk math end to end: figures come from
// PERSISTED provider-derived columns, and net income (amount due) drops by
// exactly the payout amount once a settlement sync lands (§3.3).

const (
	itSettleBiz       = "66666666-1111-1111-1111-111111111111"
	itSettleBizOther  = "66666666-2222-2222-2222-222222222222"
	itSettlePayFee    = "66666666-0000-0000-0000-0000000000a1"
	itSettlePayLegacy = "66666666-0000-0000-0000-0000000000a2"
	itSettlePayOpen   = "66666666-0000-0000-0000-0000000000a3"
	itSettleRefFee    = "xt_it_settle_fee"
	itSettleRefLegacy = "xt_it_settle_legacy"
	itSettleRefOpen   = "xt_it_settle_open"
	itSettleRef1      = "paystack_settlement:it_1"
	itSettleRef2      = "paystack_settlement:it_2"
)

func seedSettlementFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupSettlementFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, settlement_provider_subaccount)
			values ($1, $2, 'IT Settle Shop', 'it-settle-shop', 'verified', 'ACCT_IT_SETTLE'),
				($3, $2, 'IT Other Shop', 'it-other-shop', 'verified', null)
		`, itSettleBiz, planID, itSettleBizOther)
		// A succeeded charge with every provider-derived figure persisted
		// (fee+tax commission 720 = 600 fee + 120 tax; Paystack fee 390).
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, purpose, amount_minor, currency,
				provider_reference, status, through_platform, commission_minor, xtiitch_tax_minor,
				provider_fee_minor, provider_fee_captured_at)
			values ($1, $2, 'standard_full', 20000, 'GHS', $3, 'succeeded', true, 720, 120, 390, now())
		`, itSettlePayFee, itSettleBiz, itSettleRefFee)
		// A legacy succeeded row from before the fee columns: no tax, no
		// provider fee — reads must coalesce them to 0, never recompute.
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, purpose, amount_minor, currency,
				provider_reference, status, through_platform, commission_minor)
			values ($1, $2, 'standard_full', 10000, 'GHS', $3, 'succeeded', true, 0)
		`, itSettlePayLegacy, itSettleBiz, itSettleRefLegacy)
		// An initiated payment is excluded from every aggregate.
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, purpose, amount_minor, currency,
				provider_reference, status, through_platform, commission_minor)
			values ($1, $2, 'standard_full', 99999, 'GHS', $3, 'initiated', true, 0)
		`, itSettlePayOpen, itSettleBiz, itSettleRefOpen)
		// Off-platform records stay in net/all-time income as before.
		mustExec(t, tx, `
			insert into manual_takings (taking_id, business_id, amount_minor, method, what_for,
				commission_bps, commission_minor, commission_status)
			values (gen_random_uuid(), $1, 5000, 'cash', 'it cash sale', 1000, 500, 'due')
		`, itSettleBiz)
	})
}

func cleanupSettlementFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference in ($1, $2)`,
			itSettleRefOpen, "TRF_it_1")
		// Businesses cascade to payments, manual_takings and paystack_settlements.
		mustExec(t, tx, `delete from businesses where business_id = any($1)`,
			[]string{itSettleBiz, itSettleBizOther})
	})
}

// §3.2: a confirm persists the provider-REPORTED fee (and its capture time)
// with the status transition; a fee-less event leaves the column alone.
func TestConfirmFromProviderPersistsReportedFee(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedSettlementFixtures(t, pool)
	defer cleanupSettlementFixtures(t, pool)

	repo := NewPaymentRepository(pool)
	if _, err := repo.ConfirmFromProvider(context.Background(), ports.ConfirmPaymentInput{
		EventSignature:    "it_settle_open_evt",
		EventType:         "charge.success",
		ProviderReference: itSettleRefOpen,
		Succeeded:         true,
		PaidAmountMinor:   99999,
		ProviderFeeMinor:  1950,
	}); err != nil {
		t.Fatalf("confirm with provider fee: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var status string
		var feeMinor *int64
		var capturedAt *time.Time
		if err := tx.QueryRow(context.Background(), `
			select status, provider_fee_minor, provider_fee_captured_at
			from payments where provider_reference = $1
		`, itSettleRefOpen).Scan(&status, &feeMinor, &capturedAt); err != nil {
			t.Fatalf("read confirmed payment: %v", err)
		}
		if status != "succeeded" {
			t.Fatalf("expected the payment succeeded, got %q", status)
		}
		if feeMinor == nil || *feeMinor != 1950 {
			t.Fatalf("expected the provider-reported fee 1950 persisted, got %+v", feeMinor)
		}
		if capturedAt == nil {
			t.Fatal("expected provider_fee_captured_at stamped with the fee")
		}
	})
}

// §3.3: settlement upserts are idempotent on the provider reference — a repeat
// sync updates in place instead of duplicating the payout.
func TestUpsertProviderSettlementsIsIdempotent(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedSettlementFixtures(t, pool)
	defer cleanupSettlementFixtures(t, pool)

	repo := NewPaymentRepository(pool)
	ctx := context.Background()
	settledAt := time.Date(2026, 7, 18, 9, 30, 0, 0, time.UTC)
	row := ports.ProviderSettlementInput{
		ProviderReference: itSettleRef1,
		SubaccountCode:    "ACCT_IT_SETTLE",
		AmountMinor:       10000,
		Status:            "success",
		SettledAt:         &settledAt,
		RawPayload:        []byte(`{"id":"it_1"}`),
	}

	if _, err := repo.UpsertProviderSettlements(ctx, common.ID(itSettleBiz), []ports.ProviderSettlementInput{row}); err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	// A re-sync of the same settlement with an updated status UPDATES the row.
	row.Status = "pending"
	if _, err := repo.UpsertProviderSettlements(ctx, common.ID(itSettleBiz), []ports.ProviderSettlementInput{row}); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var count int
		var status string
		if err := tx.QueryRow(context.Background(), `
			select count(*), max(status) from paystack_settlements where provider_reference = $1
		`, itSettleRef1).Scan(&count, &status); err != nil {
			t.Fatalf("read settlements: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected the upsert to stay idempotent (1 row), got %d", count)
		}
		if status != "pending" {
			t.Fatalf("expected the re-sync to update the status in place, got %q", status)
		}
	})

	// And the rows are tenant-scoped: another business's scope sees nothing.
	records, err := repo.ListProviderSettlements(ctx, common.TenantScope{BusinessID: common.ID(itSettleBizOther)}, ports.MoneyPeriod{}, 50, 0)
	if err != nil {
		t.Fatalf("list other business settlements: %v", err)
	}
	if len(records) != 0 {
		t.Fatalf("expected tenant isolation on settlements, got %+v", records)
	}
}

// §3.1/§3.3: the Money Desk figures reconcile from persisted columns, and net
// income — the amount due for payout — decreases by exactly the payout amount
// when a settlement sync lands, while all-time income never moves.
//
//nolint:funlen // one end-to-end money-math scenario; splitting would obscure it
func TestMoneySummaryReflectsPersistedFiguresAndPayouts(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedSettlementFixtures(t, pool)
	defer cleanupSettlementFixtures(t, pool)

	repo := NewPaymentRepository(pool)
	ctx := context.Background()
	scope := common.TenantScope{BusinessID: common.ID(itSettleBiz)}

	summary, err := repo.MoneySummary(ctx, scope, ports.MoneyPeriod{})
	if err != nil {
		t.Fatalf("money summary: %v", err)
	}

	// Persisted sums: gross 20000+10000; commission 720; tax 120; Paystack fee
	// 390 (the legacy row contributes 0, never a recomputed figure).
	if summary.ThroughPlatformMinor != 30000 {
		t.Fatalf("through platform: expected 30000, got %d", summary.ThroughPlatformMinor)
	}
	if summary.PaystackFeeMinor != 390 {
		t.Fatalf("paystack fee: expected 390, got %d", summary.PaystackFeeMinor)
	}
	if summary.XtiitchTaxMinor != 120 || summary.XtiitchFeeMinor != 600 {
		t.Fatalf("xtiitch fee/tax: expected 600/120, got %d/%d", summary.XtiitchFeeMinor, summary.XtiitchTaxMinor)
	}
	// Store share = Σ(amount − commission − provider fee) = (20000−720−390) + (10000−0−0) = 28890.
	// All-time = share + takings 5000 − offline commission 500 = 33390.
	if summary.AllTimeIncomeMinor != 33390 {
		t.Fatalf("all-time income: expected 33390, got %d", summary.AllTimeIncomeMinor)
	}
	if summary.SettledPayoutsMinor != 0 || summary.NetIncomeMinor != 33390 {
		t.Fatalf("no payouts yet: expected net = all-time (33390), got net %d settled %d",
			summary.NetIncomeMinor, summary.SettledPayoutsMinor)
	}

	// A GHS 100.00 payout lands (a sync mirrors it): net income drops by
	// exactly that amount; all-time income is untouched.
	settledAt := time.Date(2026, 7, 18, 9, 30, 0, 0, time.UTC)
	if _, err := repo.UpsertProviderSettlements(ctx, common.ID(itSettleBiz), []ports.ProviderSettlementInput{{
		ProviderReference: itSettleRef1, SubaccountCode: "ACCT_IT_SETTLE",
		AmountMinor: 10000, Status: "success", SettledAt: &settledAt,
	}}); err != nil {
		t.Fatalf("upsert settlement: %v", err)
	}
	// A pending settlement does NOT count as paid out.
	if _, err := repo.UpsertProviderSettlements(ctx, common.ID(itSettleBiz), []ports.ProviderSettlementInput{{
		ProviderReference: itSettleRef2, SubaccountCode: "ACCT_IT_SETTLE",
		AmountMinor: 5000, Status: "pending",
	}}); err != nil {
		t.Fatalf("upsert pending settlement: %v", err)
	}

	summary, err = repo.MoneySummary(ctx, scope, ports.MoneyPeriod{})
	if err != nil {
		t.Fatalf("money summary after payout: %v", err)
	}
	if summary.SettledPayoutsMinor != 10000 {
		t.Fatalf("settled payouts: expected 10000 (success only), got %d", summary.SettledPayoutsMinor)
	}
	if summary.NetIncomeMinor != 23390 {
		t.Fatalf("net income must drop by the payout amount: expected 33390−10000 = 23390, got %d", summary.NetIncomeMinor)
	}
	if summary.AllTimeIncomeMinor != 33390 {
		t.Fatalf("all-time income must never be reduced by payouts: expected 33390, got %d", summary.AllTimeIncomeMinor)
	}

	// The payout history endpoint's read pages the mirrored rows, newest first.
	records, err := repo.ListProviderSettlements(ctx, scope, ports.MoneyPeriod{}, 1, 0)
	if err != nil {
		t.Fatalf("list settlements page 1: %v", err)
	}
	if len(records) != 1 || records[0].ProviderReference != itSettleRef2 {
		t.Fatalf("expected the newest settlement paged first, got %+v", records)
	}
	rest, err := repo.ListProviderSettlements(ctx, scope, ports.MoneyPeriod{}, 1, 1)
	if err != nil {
		t.Fatalf("list settlements page 2: %v", err)
	}
	if len(rest) != 1 || rest[0].ProviderReference != itSettleRef1 {
		t.Fatalf("expected the second page to hold the older settlement, got %+v", rest)
	}
}

// The transfer-webhook plumbing: the idempotency ledger dedupes, the
// subaccount resolves to its business, and the sync watermark stamps.
func TestSettlementWebhookPlumbing(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedSettlementFixtures(t, pool)
	defer cleanupSettlementFixtures(t, pool)

	repo := NewPaymentRepository(pool)
	ctx := context.Background()

	isNew, err := repo.RecordProviderEvent(ctx, ports.RecordProviderEventInput{
		EventSignature: "paystack:transfer.success:TRF_it_1", EventType: "transfer.success", ProviderReference: "TRF_it_1",
	})
	if err != nil || !isNew {
		t.Fatalf("first delivery must be new, got %v / %v", isNew, err)
	}
	isNew, err = repo.RecordProviderEvent(ctx, ports.RecordProviderEventInput{
		EventSignature: "paystack:transfer.success:TRF_it_1", EventType: "transfer.success", ProviderReference: "TRF_it_1",
	})
	if err != nil || isNew {
		t.Fatalf("redelivery must be a no-op, got %v / %v", isNew, err)
	}

	businessID, found, err := repo.FindBusinessBySubaccount(ctx, "ACCT_IT_SETTLE")
	if err != nil || !found || businessID != common.ID(itSettleBiz) {
		t.Fatalf("expected the subaccount resolved to its business, got %q / %v / %v", businessID, found, err)
	}
	if _, found, err := repo.FindBusinessBySubaccount(ctx, "ACCT_NOPE"); err != nil || found {
		t.Fatalf("expected an unknown subaccount to miss, got %v / %v", found, err)
	}

	if err := repo.MarkSettlementsSynced(ctx, common.ID(itSettleBiz)); err != nil {
		t.Fatalf("mark synced: %v", err)
	}
	inBypass(t, pool, func(tx pgx.Tx) {
		var syncedAt *time.Time
		if err := tx.QueryRow(context.Background(),
			`select settlement_synced_at from businesses where business_id = $1`, itSettleBiz).Scan(&syncedAt); err != nil {
			t.Fatalf("read watermark: %v", err)
		}
		if syncedAt == nil {
			t.Fatal("expected the sync watermark stamped")
		}
	})
}
