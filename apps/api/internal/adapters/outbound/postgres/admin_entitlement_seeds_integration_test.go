package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itSeedsBizStarter = "34343434-2222-2222-2222-222222222201"
	itSeedsBizGrowth  = "34343434-2222-2222-2222-222222222202"
)

// §11.1 / §13.4: the launch matrix holds no order or customer cap, on any tier.
func TestEntitlementMatrixHasNoOrderOrCustomerCaps(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()

	var count int
	if err := pool.QueryRow(context.Background(), `
		select count(*) from plan_entitlement_features
		where feature_key in ('orders_per_month', 'customer_records')
	`).Scan(&count); err != nil {
		t.Fatalf("count forbidden keys: %v", err)
	}
	if count != 0 {
		t.Fatalf("the matrix must hold no order/customer cap, found %d forbidden key(s)", count)
	}
}

// §13.4 / §14.1 / §15.1: the launch defaults, per plan, for every matrix key
// this release added or corrected.
func TestEntitlementMatrixLaunchSeeds(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	ctx := context.Background()

	type expectation struct {
		feature string
		plan    string
		enabled bool
		limit   *int
	}
	intPtr := func(v int) *int { return &v }
	expectations := []expectation{
		// Promotions: PARKED (000119) — no per-plan rows while the feature is
		// unavailable to everyone. Asserted absent below, not seeded here.
		// Analytics level (§14.1): basic / standard / full / advanced as 0..3.
		{"analytics_level", "free", true, intPtr(0)},
		{"analytics_level", "starter", true, intPtr(1)},
		{"analytics_level", "growth", true, intPtr(2)},
		{"analytics_level", "studio", true, intPtr(3)},
		// Lookback (§14.1): 30 days / 12 months / full / full (NULL = full).
		{"analytics_lookback_days", "free", true, intPtr(30)},
		{"analytics_lookback_days", "starter", true, intPtr(365)},
		{"analytics_lookback_days", "growth", true, nil},
		{"analytics_lookback_days", "studio", true, nil},
		// CRM level (§15.1).
		{"crm_level", "free", true, intPtr(0)},
		{"crm_level", "starter", true, intPtr(1)},
		{"crm_level", "growth", true, intPtr(2)},
		{"crm_level", "studio", true, intPtr(3)},
		// Export formats (§14.4): Free none; Starter CSV; Growth CSV+PDF; Studio all.
		{"export_csv", "free", false, nil},
		{"export_csv", "starter", true, nil},
		{"export_csv", "growth", true, nil},
		{"export_csv", "studio", true, nil},
		{"export_pdf", "free", false, nil},
		{"export_pdf", "starter", false, nil},
		{"export_pdf", "growth", true, nil},
		{"export_pdf", "studio", true, nil},
		{"export_docx", "studio", true, nil},
		{"export_xlsx", "studio", true, nil},
		// Scheduled reports (§14.1): Growth monthly, Studio any cadence.
		{"scheduled_reports", "free", true, intPtr(0)},
		{"scheduled_reports", "starter", true, intPtr(0)},
		{"scheduled_reports", "growth", true, intPtr(1)},
		{"scheduled_reports", "studio", true, intPtr(2)},
		// §13.4 tier figures the earlier seeds got wrong or needed verifying.
		{"staff_accounts", "free", true, intPtr(1)},
		{"staff_accounts", "starter", true, intPtr(2)},
		{"staff_accounts", "growth", true, intPtr(5)},
		{"staff_accounts", "studio", true, intPtr(10)},
		{"variations_per_design", "free", true, intPtr(2)},
		{"variations_per_design", "starter", true, intPtr(3)},
		{"variations_per_design", "growth", true, intPtr(5)},
		{"variations_per_design", "studio", true, intPtr(10)},
		{"designs", "free", true, intPtr(10)},
		{"designs", "starter", true, intPtr(50)},
		{"designs", "growth", true, nil},
		{"designs", "studio", true, nil},
	}

	for _, want := range expectations {
		var enabled bool
		var limit *int
		err := pool.QueryRow(ctx, `
			select v.enabled, v.limit_value
			from plan_entitlement_values v
			join plans p on p.plan_id = v.plan_id
			where p.code = $1 and v.feature_key = $2
		`, want.plan, want.feature).Scan(&enabled, &limit)
		if err != nil {
			t.Fatalf("seed row %s/%s: %v", want.feature, want.plan, err)
		}
		if enabled != want.enabled {
			t.Fatalf("%s/%s: expected enabled=%v, got %v", want.feature, want.plan, want.enabled, enabled)
		}
		if (limit == nil) != (want.limit == nil) || (limit != nil && want.limit != nil && *limit != *want.limit) {
			t.Fatalf("%s/%s: expected limit=%v, got %v", want.feature, want.plan, want.limit, limit)
		}
	}

	// Promotions is PARKED (000119): no entitlement values and no matrix feature
	// row for any plan, so no plan can be granted it.
	var promotionsRows int
	if err := pool.QueryRow(ctx, `
		select count(*) from plan_entitlement_values where feature_key = 'promotions'
	`).Scan(&promotionsRows); err != nil {
		t.Fatalf("count promotions values: %v", err)
	}
	if promotionsRows != 0 {
		t.Fatalf("promotions is parked: expected no entitlement values, found %d", promotionsRows)
	}
	var promotionsFeature int
	if err := pool.QueryRow(ctx, `
		select count(*) from plan_entitlement_features where feature_key = 'promotions'
	`).Scan(&promotionsFeature); err != nil {
		t.Fatalf("count promotions feature rows: %v", err)
	}
	if promotionsFeature != 0 {
		t.Fatalf("promotions is parked: expected no matrix feature row, found %d", promotionsFeature)
	}

	// None of the remaining new keys is code-enforced (promotions was the only
	// one, and it is parked) — the honest enforced flag convention from 000088.
	var enforcedCount int
	if err := pool.QueryRow(ctx, `
		select count(*) from plan_entitlement_features
		where enforced and feature_key in (
			'promotions', 'analytics_level', 'analytics_lookback_days', 'crm_level',
			'export_csv', 'export_pdf', 'export_docx', 'export_xlsx', 'scheduled_reports'
		)
	`).Scan(&enforcedCount); err != nil {
		t.Fatalf("count enforced new keys: %v", err)
	}
	if enforcedCount != 0 {
		t.Fatalf("no new key is enforced while promotions is parked, found %d enforced", enforcedCount)
	}
}

// The runtime read path: plans.features carries the mirrored boolean keys, and
// the owner dashboard profile resolves the numeric ones live from the matrix.
func TestStoreProfileExposesEntitlementLimits(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedProfileFixture(t, pool)
	defer cleanupProfileFixture(t, pool)

	repo := NewStoreSettingsRepository(pool)
	ctx := context.Background()

	starter, err := repo.GetProfile(ctx, common.TenantScope{BusinessID: common.ID(itSeedsBizStarter)})
	if err != nil {
		t.Fatalf("get starter profile: %v", err)
	}
	// Promotions is PARKED: even a paid plan must NOT resolve the entitlement
	// (no matrix rows, and SanitizeFeatures drops the key while it is parked).
	if business.Entitlements(starter.Entitlements).Has(business.FeaturePromotions) {
		t.Fatalf("a Starter store must not resolve the parked promotions entitlement, got %v", starter.Entitlements)
	}
	if starter.EntitlementLimits["analytics_level"] != 1 ||
		starter.EntitlementLimits["analytics_lookback_days"] != 365 ||
		starter.EntitlementLimits["crm_level"] != 1 ||
		starter.EntitlementLimits["scheduled_reports"] != 0 {
		t.Fatalf("unexpected Starter entitlement limits: %v", starter.EntitlementLimits)
	}

	growth, err := repo.GetProfile(ctx, common.TenantScope{BusinessID: common.ID(itSeedsBizGrowth)})
	if err != nil {
		t.Fatalf("get growth profile: %v", err)
	}
	// NULL lookback (full history) surfaces as -1, never as a 30-day-style cap.
	if growth.EntitlementLimits["analytics_lookback_days"] != -1 ||
		growth.EntitlementLimits["analytics_level"] != 2 {
		t.Fatalf("unexpected Growth entitlement limits: %v", growth.EntitlementLimits)
	}
}

func seedProfileFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupProfileFixture(t, pool)

	var starterPlanID, growthPlanID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter'`).Scan(&starterPlanID); err != nil {
		t.Fatalf("probe starter plan: %v", err)
	}
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'growth'`).Scan(&growthPlanID); err != nil {
		t.Fatalf("probe growth plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values ($1, $2, 'IT Seeds Starter', 'it-seeds-starter', 'verified', 'active')
		`, itSeedsBizStarter, starterPlanID)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values ($1, $2, 'IT Seeds Growth', 'it-seeds-growth', 'verified', 'active')
		`, itSeedsBizGrowth, growthPlanID)
	})
}

func cleanupProfileFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`,
			[]string{itSeedsBizStarter, itSeedsBizGrowth})
	})
}
