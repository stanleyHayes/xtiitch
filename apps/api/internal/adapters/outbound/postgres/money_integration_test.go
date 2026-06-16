package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Real-Postgres coverage for the money tracker (manual takings + income summary),
// run as the non-superuser xtiitch_app role. Skipped without XTIITCH_TEST_DATABASE_URL.

const (
	mtBiz      = "88888888-8888-8888-8888-888888888888"
	mtBizOther = "99999999-9999-9999-9999-999999999999"
)

func mtScope() common.TenantScope { return common.TenantScope{BusinessID: common.ID(mtBiz)} }

func seedMoneyFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupMoneyFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []string{mtBiz, mtBizOther} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Money', $3, 'verified')
			`, biz, planID, "it-money-"+biz[:8])
		}
		// mtBiz: two succeeded through-platform payments (count), one initiated and
		// one failed (must NOT count).
		insertPaymentRow(t, tx, mtBiz, "xt_mt_1", 50000, 500, "succeeded")
		insertPaymentRow(t, tx, mtBiz, "xt_mt_2", 30000, 300, "succeeded")
		insertPaymentRow(t, tx, mtBiz, "xt_mt_3", 10000, 100, "initiated")
		insertPaymentRow(t, tx, mtBiz, "xt_mt_4", 20000, 200, "failed")
		// mtBiz: two off-platform manual takings (no commission).
		insertTakingRow(t, tx, mtBiz, 5000, "cash")
		insertTakingRow(t, tx, mtBiz, 3000, "momo")
		// Another business's money must never leak into mtBiz's summary.
		insertPaymentRow(t, tx, mtBizOther, "xt_mt_other", 99999, 999, "succeeded")
		insertTakingRow(t, tx, mtBizOther, 88888, "cash")
	})
}

func cleanupMoneyFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference like 'xt_mt_%'`)
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{mtBiz, mtBizOther})
	})
}

func insertPaymentRow(t *testing.T, tx pgx.Tx, businessID, reference string, amount, commission int64, status string) {
	t.Helper()
	mustExec(t, tx, `
		insert into payments (payment_id, business_id, purpose, amount_minor, currency,
			provider_reference, status, through_platform, commission_minor)
		values (gen_random_uuid(), $1, 'standard_full', $2, 'GHS', $3, $4, true, $5)
	`, businessID, amount, reference, status, commission)
}

func insertTakingRow(t *testing.T, tx pgx.Tx, businessID string, amount int64, method string) {
	t.Helper()
	mustExec(t, tx, `
		insert into manual_takings (taking_id, business_id, amount_minor, method, what_for)
		values (gen_random_uuid(), $1, $2, $3, 'it')
	`, businessID, amount, method)
}

// TestMoneySummaryAggregatesTenantIncome: only the business's own succeeded
// through-platform payments and manual takings count; net = through - commission
// + manual takings; another tenant's money never leaks.
func TestMoneySummaryAggregatesTenantIncome(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedMoneyFixtures(t, pool)
	defer cleanupMoneyFixtures(t, pool)

	summary, err := NewPaymentRepository(pool).MoneySummary(context.Background(), mtScope())
	if err != nil {
		t.Fatalf("money summary: %v", err)
	}
	if summary.ThroughPlatformMinor != 80000 {
		t.Fatalf("through-platform should sum only succeeded payments (80000), got %d", summary.ThroughPlatformMinor)
	}
	if summary.CommissionMinor != 800 {
		t.Fatalf("commission should sum only succeeded payments (800), got %d", summary.CommissionMinor)
	}
	if summary.ManualTakingsMinor != 8000 {
		t.Fatalf("manual takings should be 8000, got %d", summary.ManualTakingsMinor)
	}
	if summary.NetIncomeMinor != 87200 { // 80000 - 800 + 8000
		t.Fatalf("net income should be 87200, got %d", summary.NetIncomeMinor)
	}
}

// TestRecordAndListManualTakings: a logged taking is tenant-scoped, carries no
// commission, and shows up in the list and the summary.
func TestRecordAndListManualTakings(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedMoneyFixtures(t, pool)
	defer cleanupMoneyFixtures(t, pool)

	ctx := context.Background()
	repo := NewPaymentRepository(pool)
	if err := repo.RecordManualTaking(ctx, mtScope(), ports.ManualTakingInput{
		TakingID: common.ID("00000000-0000-0000-0000-0000000000aa"), BusinessID: common.ID(mtBiz),
		AmountMinor: 1000, Method: "other", WhatFor: "deposit top-up",
	}); err != nil {
		t.Fatalf("record taking: %v", err)
	}

	takings, err := repo.ListManualTakings(ctx, mtScope())
	if err != nil {
		t.Fatalf("list takings: %v", err)
	}
	if len(takings) != 3 { // 2 seeded + 1 recorded
		t.Fatalf("expected 3 takings for this business, got %d", len(takings))
	}

	summary, err := repo.MoneySummary(ctx, mtScope())
	if err != nil {
		t.Fatalf("summary: %v", err)
	}
	if summary.ManualTakingsMinor != 9000 || summary.NetIncomeMinor != 88200 {
		t.Fatalf("expected manual=9000 net=88200 after the new taking, got manual=%d net=%d", summary.ManualTakingsMinor, summary.NetIncomeMinor)
	}
}
