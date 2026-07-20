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

// Integration coverage for the §14 analytics/reports repositories against a
// real, migrated, RLS-enforcing database (xtiitch_app role). Skipped unless
// XTIITCH_TEST_DATABASE_URL is set — same opt-in as the payment integration
// tests. The seed builds a small two-business dataset and asserts every
// query's numbers AND tenant isolation.

const (
	itAnaBizA      = "66666666-0000-0000-0000-0000000000a1"
	itAnaBizB      = "66666666-0000-0000-0000-0000000000b1"
	itAnaCust1     = "66666666-0000-0000-0000-0000000000c1"
	itAnaCust2     = "66666666-0000-0000-0000-0000000000c2"
	itAnaCol       = "66666666-0000-0000-0000-0000000000d0"
	itAnaDesign1   = "66666666-0000-0000-0000-0000000000d1"
	itAnaDesign2   = "66666666-0000-0000-0000-0000000000d2"
	itAnaOrder1    = "66666666-0000-0000-0000-0000000000e1" // standard confirmed, 400d old
	itAnaOrder2    = "66666666-0000-0000-0000-0000000000e2" // standard confirmed, 5d old, staff-created
	itAnaOrder3    = "66666666-0000-0000-0000-0000000000e3" // bespoke confirmed, 3d old, outstanding
	itAnaOrder4    = "66666666-0000-0000-0000-0000000000e4" // draft (must vanish everywhere)
	itAnaOrder5    = "66666666-0000-0000-0000-0000000000e5" // cancelled, 4d old
	itAnaPay1      = "66666666-0000-0000-0000-0000000000f1"
	itAnaPay2      = "66666666-0000-0000-0000-0000000000f2"
	itAnaPay3      = "66666666-0000-0000-0000-0000000000f3"
	itAnaPayOld    = "66666666-0000-0000-0000-0000000000f4"
	itAnaPayFailed = "66666666-0000-0000-0000-0000000000f5"
	itAnaUser1     = "66666666-0000-0000-0000-000000000011"
	itAnaUser2     = "66666666-0000-0000-0000-000000000012"
	itAnaSched     = "66666666-0000-0000-0000-0000000000aa"
)

func seedAnalyticsFixtures(t *testing.T, pool *pgxpool.Pool) time.Time {
	t.Helper()
	now := time.Now()

	inBypass(t, pool, func(tx pgx.Tx) {
		// Cleanup is business-scoped (FK cascade sweeps the rest).
		for _, biz := range []string{itAnaBizA, itAnaBizB, itAnaSched} {
			mustExec(t, tx, `delete from businesses where business_id = $1`, biz)
		}
		mustExec(t, tx, `delete from customers where customer_id in ($1, $2)`, itAnaCust1, itAnaCust2)

		var planID string
		if err := tx.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
			t.Fatalf("probe plan: %v", err)
		}
		for _, biz := range []string{itAnaBizA, itAnaBizB, itAnaSched} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Analytics', $3, 'verified')
			`, biz, planID, "it-ana-"+biz[len(biz)-2:])
		}
		mustExec(t, tx, `
			insert into customers (customer_id, display_name, phone)
			values ($1, 'IT Returning', '0244000001'), ($2, 'IT New', '0244000002')
		`, itAnaCust1, itAnaCust2)
		mustExec(t, tx, `
			insert into customer_businesses (business_id, customer_id) values ($1, $2), ($1, $3)
		`, itAnaBizA, itAnaCust1, itAnaCust2)
		mustExec(t, tx, `
			insert into collections (collection_id, business_id, name, handle)
			values ($1, $2, 'IT Collection', 'it-ana-col')
		`, itAnaCol, itAnaBizA)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, collection_id, title, handle, status, view_count)
			values ($1, $3, $4, 'IT Design One', 'it-ana-d1', 'active', 7),
				($2, $3, null, 'IT Design Two', 'it-ana-d2', 'active', 3)
		`, itAnaDesign1, itAnaDesign2, itAnaBizA, itAnaCol)
		mustExec(t, tx, `
			insert into business_users (business_user_id, business_id, email, display_name, password_hash, role)
			values ($1, $3, 'it-ana-staff@example.com', 'IT Staff', 'x', 'staff'),
				($2, $3, 'it-ana-owner@example.com', 'IT Owner', 'x', 'owner')
		`, itAnaUser1, itAnaUser2, itAnaBizA)

		// Orders. o1 is 400 days old (outside any clamped window); o4 draft and
		// o5 cancelled prove the status filters.
		mustExec(t, tx, `
			insert into orders (order_id, business_id, customer_id, design_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status, created_at)
			values
				($1, $6, $7, $9, 'standard', 'band', 'ready_made', 'online', 20000, 20000, 'confirmed', $11),
				($2, $6, $7, $9, 'standard', 'band', 'ready_made', 'walk_in', 30000, 30000, 'confirmed', $12),
				($3, $6, $8, $10, 'custom', 'come_to_shop', 'bespoke', 'walk_in', 50000, 20000, 'confirmed', $13),
				($4, $6, $8, $10, 'custom', 'come_to_shop', 'bespoke', 'online', 70000, 0, 'draft', $14),
				($5, $6, $7, $9, 'standard', 'band', 'ready_made', 'online', 90000, 0, 'cancelled', $15)
		`, itAnaOrder1, itAnaOrder2, itAnaOrder3, itAnaOrder4, itAnaOrder5,
			itAnaBizA, itAnaCust1, itAnaCust2, itAnaDesign1, itAnaDesign2,
			now.AddDate(0, 0, -400), now.AddDate(0, 0, -5), now.AddDate(0, 0, -3),
			now.AddDate(0, 0, -2), now.AddDate(0, 0, -4))
		// Staff attribution (000109): o2 was logged by the staff member.
		mustExec(t, tx, `
			update orders set created_by_business_user_id = $2 where order_id = $1
		`, itAnaOrder2, itAnaUser1)

		// Payments with PERSISTED provider figures (§3.2 — verbatim or nothing).
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, order_id, purpose, amount_minor,
				currency, provider_reference, status, through_platform, commission_minor,
				xtiitch_tax_minor, provider_fee_minor, created_at)
			values
				($1, $6, $7, 'standard_full', 20000, 'GHS', 'it_ana_ref_1', 'succeeded', true, 400, 80, 390, $8),
				($2, $6, $9, 'standard_full', 30000, 'GHS', 'it_ana_ref_2', 'succeeded', true, 600, 120, 585, $10),
				($3, $6, $11, 'deposit', 20000, 'GHS', 'it_ana_ref_3', 'succeeded', true, 300, 60, 390, $12),
				($4, $6, $7, 'standard_full', 99900, 'GHS', 'it_ana_ref_old', 'succeeded', true, 1000, 200, 1900, $13),
				($5, $6, $9, 'standard_full', 88888, 'GHS', 'it_ana_ref_failed', 'failed', true, 0, 0, 0, $14)
		`, itAnaPay1, itAnaPay2, itAnaPay3, itAnaPayOld, itAnaPayFailed,
			itAnaBizA, itAnaOrder1, now.AddDate(0, 0, -400),
			itAnaOrder2, now.AddDate(0, 0, -5), itAnaOrder3, now.AddDate(0, 0, -3),
			now.AddDate(0, 0, -400), now.AddDate(0, 0, -1))

		mustExec(t, tx, `
			insert into manual_takings (taking_id, business_id, amount_minor, method, what_for, taken_at, logged_by_business_user_id)
			values
				(gen_random_uuid(), $1, 15000, 'cash', 'walk-in sale', $3, $4),
				(gen_random_uuid(), $1, 6000, 'momo', 'deposit', $5, null),
				(gen_random_uuid(), $2, 77700, 'cash', 'other shop money', $3, null)
		`, itAnaBizA, itAnaBizB, now.AddDate(0, 0, -2), itAnaUser1, now.AddDate(0, 0, -10))

		mustExec(t, tx, `
			insert into paystack_settlements (business_id, provider_reference, subaccount_code, amount_minor, status, settled_at, created_at)
			values
				($1, 'it_ana_settle_1', 'SUB_it', 40000, 'success', $2, $2),
				($1, 'it_ana_settle_2', 'SUB_it', 10000, 'pending', null, $3)
		`, itAnaBizA, now.AddDate(0, 0, -6), now.AddDate(0, 0, -1))

		mustExec(t, tx, `
			insert into design_waitlist_entries (entry_id, business_id, design_id, customer_name, customer_contact, status)
			values
				(gen_random_uuid(), $1, $2, 'W1', 'w1@example.com', 'waiting'),
				(gen_random_uuid(), $1, $2, 'W2', 'w2@example.com', 'waiting'),
				(gen_random_uuid(), $1, $2, 'W3', 'w3@example.com', 'notified')
		`, itAnaBizA, itAnaDesign1)
	})
	return now
}

func TestAnalyticsReportsIntegration(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	now := seedAnalyticsFixtures(t, pool)

	ctx := context.Background()
	scopeA := common.TenantScope{BusinessID: itAnaBizA}
	scopeB := common.TenantScope{BusinessID: itAnaBizB}
	from30 := now.AddDate(0, 0, -30)
	window30 := ports.AnalyticsWindow{From: &from30, To: now.Add(time.Minute)}
	windowFull := ports.AnalyticsWindow{To: now.Add(time.Minute)}

	analytics := NewAnalyticsRepository(pool)
	reports := NewReportsRepository(pool)

	t.Run("Summary", func(t *testing.T) {
		summary, err := analytics.Summary(ctx, scopeA, window30)
		if err != nil {
			t.Fatalf("Summary: %v", err)
		}
		if summary.SalesTotalMinor != 50000 { // 30000 + 20000 (400d payments clamped out)
			t.Fatalf("sales total: got %d want 50000", summary.SalesTotalMinor)
		}
		if summary.OrdersCount != 3 { // o2, o3, o5 — draft excluded
			t.Fatalf("orders count: got %d want 3", summary.OrdersCount)
		}
		byStatus := map[string]int{}
		for _, bucket := range summary.OrdersByStatus {
			byStatus[bucket.Status] = bucket.Count
		}
		if byStatus["confirmed"] != 2 || byStatus["cancelled"] != 1 {
			t.Fatalf("status counts: %v", byStatus)
		}
		if summary.CustomersCount != 2 || summary.DesignsCount != 2 {
			t.Fatalf("entity counts: %+v", summary)
		}
	})

	t.Run("SalesTrend", func(t *testing.T) {
		points, err := analytics.SalesTrend(ctx, scopeA, window30)
		if err != nil {
			t.Fatalf("SalesTrend: %v", err)
		}
		if len(points) != 31 {
			t.Fatalf("30d window must yield 31 daily buckets, got %d", len(points))
		}
		byDay := map[string]ports.DailySalesPoint{}
		for _, point := range points {
			byDay[point.Day.Format("2006-01-02")] = point
		}
		if got := byDay[now.AddDate(0, 0, -5).Format("2006-01-02")].SalesMinor; got != 30000 {
			t.Fatalf("day -5 sales: got %d want 30000", got)
		}
		if got := byDay[now.AddDate(0, 0, -3).Format("2006-01-02")].SalesMinor; got != 20000 {
			t.Fatalf("day -3 sales: got %d want 20000", got)
		}
		if got := byDay[now.AddDate(0, 0, -2).Format("2006-01-02")].ManualTakingsMinor; got != 15000 {
			t.Fatalf("day -2 takings: got %d want 15000", got)
		}
	})

	t.Run("OrdersTrend", func(t *testing.T) {
		points, err := analytics.OrdersTrend(ctx, scopeA, window30)
		if err != nil {
			t.Fatalf("OrdersTrend: %v", err)
		}
		var standard, bespoke int
		for _, point := range points {
			standard += point.Standard
			bespoke += point.Bespoke
		}
		if standard != 2 || bespoke != 1 { // o2 + o5 standard; o3 bespoke
			t.Fatalf("split: standard=%d bespoke=%d", standard, bespoke)
		}
	})

	t.Run("TopDesigns", func(t *testing.T) {
		designs, err := analytics.TopDesigns(ctx, scopeA, window30, 5)
		if err != nil {
			t.Fatalf("TopDesigns: %v", err)
		}
		if len(designs) != 2 {
			t.Fatalf("designs: %+v", designs)
		}
		if designs[0].DesignID != common.ID(itAnaDesign1) || designs[0].Orders != 1 || designs[0].RevenueMinor != 30000 {
			t.Fatalf("top design: %+v", designs[0])
		}
	})

	t.Run("CustomerMix", func(t *testing.T) {
		mix, err := analytics.CustomerMix(ctx, scopeA, window30)
		if err != nil {
			t.Fatalf("CustomerMix: %v", err)
		}
		if mix.NewInWindow != 1 || mix.ReturningInWindow != 1 || mix.WithOrdersInWindow != 2 || mix.RepeatInWindow != 1 {
			t.Fatalf("mix: %+v", mix)
		}
	})

	t.Run("OutstandingBalances", func(t *testing.T) {
		balances, err := analytics.OutstandingBalances(ctx, scopeA)
		if err != nil {
			t.Fatalf("OutstandingBalances: %v", err)
		}
		if len(balances) != 1 || balances[0].OrderID != common.ID(itAnaOrder3) || balances[0].OutstandingMinor != 30000 {
			t.Fatalf("balances: %+v", balances)
		}
	})

	t.Run("RevenueBreakdowns", func(t *testing.T) {
		breakdowns, err := analytics.RevenueBreakdowns(ctx, scopeA, window30)
		if err != nil {
			t.Fatalf("RevenueBreakdowns: %v", err)
		}
		if len(breakdowns.ByDesign) != 2 || breakdowns.ByDesign[0].RevenueMinor != 30000 {
			t.Fatalf("by design: %+v", breakdowns.ByDesign)
		}
		if len(breakdowns.ByCollection) != 2 {
			t.Fatalf("by collection: %+v", breakdowns.ByCollection)
		}
		flows := map[string]int64{}
		for _, row := range breakdowns.ByFlow {
			flows[row.Flow] = row.RevenueMinor
		}
		if flows["ready_made"] != 30000 || flows["bespoke"] != 20000 {
			t.Fatalf("by flow: %v", flows)
		}
		if len(breakdowns.ByFulfilment) != 1 || breakdowns.ByFulfilment[0].RevenueMinor != 50000 {
			t.Fatalf("by fulfilment: %+v", breakdowns.ByFulfilment)
		}
	})

	t.Run("DesignPerformance", func(t *testing.T) {
		performance, err := analytics.DesignPerformance(ctx, scopeA)
		if err != nil {
			t.Fatalf("DesignPerformance: %v", err)
		}
		if len(performance) != 2 {
			t.Fatalf("performance: %+v", performance)
		}
		first := performance[0] // ordered by views desc → design1 (7 views)
		if first.DesignID != common.ID(itAnaDesign1) || first.Views != 7 || first.Orders != 2 || first.WaitingList != 2 {
			t.Fatalf("design1: %+v", first)
		}
		if first.ConversionRate != float64(2)/float64(7) {
			t.Fatalf("conversion: %v", first.ConversionRate)
		}
	})

	t.Run("StaffActivity", func(t *testing.T) {
		staff, err := analytics.StaffActivity(ctx, scopeA)
		if err != nil {
			t.Fatalf("StaffActivity: %v", err)
		}
		byUser := map[common.ID]ports.StaffActivity{}
		for _, member := range staff {
			byUser[member.UserID] = member
		}
		staffer := byUser[common.ID(itAnaUser1)]
		if staffer.OrdersCreated != 1 || staffer.TakingsLogged != 1 || staffer.TakingsMinor != 15000 {
			t.Fatalf("staff member: %+v", staffer)
		}
		owner := byUser[common.ID(itAnaUser2)]
		if owner.OrdersCreated != 0 || owner.TakingsLogged != 0 {
			t.Fatalf("owner must be zero: %+v", owner)
		}
	})

	t.Run("FinancialReport", func(t *testing.T) {
		data, err := reports.FinancialReport(ctx, scopeA, window30)
		if err != nil {
			t.Fatalf("FinancialReport: %v", err)
		}
		totals := data.Totals
		if totals.ThroughPlatformMinor != 50000 || totals.CommissionMinor != 900 ||
			totals.XtiitchTaxMinor != 180 || totals.PaystackFeeMinor != 975 ||
			totals.StoreShareMinor != 48125 {
			t.Fatalf("totals: %+v", totals)
		}
		if totals.SettledPayoutsMinor != 40000 || totals.ManualTakingsMinor != 21000 {
			t.Fatalf("payouts/takings: %+v", totals)
		}
		if len(data.Payments) != 2 {
			t.Fatalf("payments in window: %+v", data.Payments)
		}
		// §3.2: the persisted provider fee surfaces VERBATIM.
		var p2 *ports.FinancialPaymentRow
		for i := range data.Payments {
			if data.Payments[i].ProviderReference == "it_ana_ref_2" {
				p2 = &data.Payments[i]
			}
		}
		if p2 == nil || p2.ProviderFeeMinor != 585 || p2.StoreShareMinor != 28815 {
			t.Fatalf("verbatim provider figures: %+v", p2)
		}
		if len(data.Settlements) != 2 || len(data.Takings) != 2 {
			t.Fatalf("settlements/takings rows: %d/%d", len(data.Settlements), len(data.Takings))
		}

		full, err := reports.FinancialReport(ctx, scopeA, windowFull)
		if err != nil {
			t.Fatalf("FinancialReport full: %v", err)
		}
		if full.Totals.ThroughPlatformMinor != 169900 { // + the two 400d payments
			t.Fatalf("full window total: %d", full.Totals.ThroughPlatformMinor)
		}
	})

	t.Run("SalesReport", func(t *testing.T) {
		data, err := reports.SalesReport(ctx, scopeA, window30)
		if err != nil {
			t.Fatalf("SalesReport: %v", err)
		}
		if len(data.Orders) != 3 { // o2, o3, o5 — never the draft
			t.Fatalf("orders: %+v", data.Orders)
		}
		for _, row := range data.Orders {
			if row.Status == "draft" {
				t.Fatal("draft leaked into sales report")
			}
		}
	})

	t.Run("TenantIsolation", func(t *testing.T) {
		// §6/§14.5: business B must see NONE of A's insight (B has only a
		// 77700 taking of its own, which never touches these assertions).
		summary, err := analytics.Summary(ctx, scopeB, window30)
		if err != nil {
			t.Fatalf("Summary B: %v", err)
		}
		if summary.SalesTotalMinor != 0 || summary.OrdersCount != 0 || summary.CustomersCount != 0 {
			t.Fatalf("tenant leak: %+v", summary)
		}
		financial, err := reports.FinancialReport(ctx, scopeB, window30)
		if err != nil {
			t.Fatalf("FinancialReport B: %v", err)
		}
		if financial.Totals.ThroughPlatformMinor != 0 || len(financial.Payments) != 0 {
			t.Fatalf("tenant leak in financials: %+v", financial.Totals)
		}
	})

	t.Run("RecordDesignView", func(t *testing.T) {
		storefront := NewStorefrontRepository(pool)
		if err := storefront.RecordDesignView(ctx, scopeA, common.ID(itAnaDesign1)); err != nil {
			t.Fatalf("RecordDesignView: %v", err)
		}
		var views int64
		inBypass(t, pool, func(tx pgx.Tx) {
			if err := tx.QueryRow(ctx, `select view_count from designs where design_id = $1`, itAnaDesign1).Scan(&views); err != nil {
				t.Fatalf("read views: %v", err)
			}
		})
		if views != 8 {
			t.Fatalf("views: got %d want 8", views)
		}
	})

	t.Run("ScheduleLifecycle", func(t *testing.T) {
		scopeS := common.TenantScope{BusinessID: itAnaSched}
		schedule := ports.ReportSchedule{
			BusinessID: itAnaSched,
			ReportKind: "financial",
			Format:     "csv",
			Cadence:    "monthly",
			Email:      "it-ana@example.com",
			Enabled:    true,
		}
		if err := reports.UpsertSchedule(ctx, scopeS, schedule); err != nil {
			t.Fatalf("UpsertSchedule: %v", err)
		}
		got, err := reports.GetSchedule(ctx, scopeS)
		if err != nil {
			t.Fatalf("GetSchedule: %v", err)
		}
		if got.ReportKind != "financial" || got.Cadence != "monthly" || !got.Enabled {
			t.Fatalf("schedule: %+v", got)
		}

		due, err := reports.DueSchedules(ctx, now)
		if err != nil {
			t.Fatalf("DueSchedules: %v", err)
		}
		var found bool
		for _, item := range due {
			if item.BusinessID == common.ID(itAnaSched) {
				found = true
			}
		}
		if !found {
			t.Fatal("never-sent schedule must be due")
		}

		if err := reports.MarkScheduleSent(ctx, common.ID(itAnaSched), now); err != nil {
			t.Fatalf("MarkScheduleSent: %v", err)
		}
		due, err = reports.DueSchedules(ctx, now)
		if err != nil {
			t.Fatalf("DueSchedules after mark: %v", err)
		}
		for _, item := range due {
			if item.BusinessID == common.ID(itAnaSched) {
				t.Fatal("monthly schedule marked just now must not be due again")
			}
		}
	})
}
