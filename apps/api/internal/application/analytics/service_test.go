package analyticsapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// --- colocated fakes (house style: plain structs, no mock library) ---

type fakeAnalyticsRepo struct {
	summary      ports.AnalyticsSummary
	salesTrend   []ports.DailySalesPoint
	ordersTrend  []ports.DailyOrdersPoint
	topDesigns   []ports.TopDesign
	mix          ports.CustomerMix
	topCustomers []ports.TopCustomer
	growth       []ports.CustomerGrowthPoint
	balances     []ports.OutstandingBalance
	breakdowns   ports.RevenueBreakdowns
	performance  []ports.DesignPerformance
	staff        []ports.StaffActivity
	calls        []string
	lastWindow   ports.AnalyticsWindow
	lastLimit    int
}

func (f *fakeAnalyticsRepo) Summary(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow) (ports.AnalyticsSummary, error) {
	f.calls = append(f.calls, "summary")
	f.lastWindow = window
	return f.summary, nil
}

func (f *fakeAnalyticsRepo) SalesTrend(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow) ([]ports.DailySalesPoint, error) {
	f.calls = append(f.calls, "sales_trend")
	f.lastWindow = window
	return f.salesTrend, nil
}

func (f *fakeAnalyticsRepo) OrdersTrend(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow) ([]ports.DailyOrdersPoint, error) {
	f.calls = append(f.calls, "orders_trend")
	f.lastWindow = window
	return f.ordersTrend, nil
}

func (f *fakeAnalyticsRepo) TopDesigns(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow, limit int) ([]ports.TopDesign, error) {
	f.calls = append(f.calls, "top_designs")
	f.lastWindow = window
	f.lastLimit = limit
	return f.topDesigns, nil
}

func (f *fakeAnalyticsRepo) CustomerMix(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow) (ports.CustomerMix, error) {
	f.calls = append(f.calls, "customer_mix")
	f.lastWindow = window
	return f.mix, nil
}

func (f *fakeAnalyticsRepo) TopCustomers(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow, limit int) ([]ports.TopCustomer, error) {
	f.calls = append(f.calls, "top_customers")
	f.lastLimit = limit
	return f.topCustomers, nil
}

func (f *fakeAnalyticsRepo) CustomerGrowth(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow) ([]ports.CustomerGrowthPoint, error) {
	f.calls = append(f.calls, "customer_growth")
	return f.growth, nil
}

func (f *fakeAnalyticsRepo) OutstandingBalances(_ context.Context, _ common.TenantScope) ([]ports.OutstandingBalance, error) {
	f.calls = append(f.calls, "outstanding_balances")
	return f.balances, nil
}

func (f *fakeAnalyticsRepo) RevenueBreakdowns(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow) (ports.RevenueBreakdowns, error) {
	f.calls = append(f.calls, "revenue_breakdowns")
	f.lastWindow = window
	return f.breakdowns, nil
}

func (f *fakeAnalyticsRepo) DesignPerformance(_ context.Context, _ common.TenantScope) ([]ports.DesignPerformance, error) {
	f.calls = append(f.calls, "design_performance")
	return f.performance, nil
}

func (f *fakeAnalyticsRepo) StaffActivity(_ context.Context, _ common.TenantScope) ([]ports.StaffActivity, error) {
	f.calls = append(f.calls, "staff")
	return f.staff, nil
}

func (f *fakeAnalyticsRepo) called(name string) bool {
	for _, call := range f.calls {
		if call == name {
			return true
		}
	}
	return false
}

type fakeSettings struct {
	profile ports.StoreProfile
	err     error
}

func (f fakeSettings) Get(_ context.Context, _ common.TenantScope) (ports.StoreSettings, error) {
	return ports.StoreSettings{}, nil
}

func (f fakeSettings) Update(_ context.Context, _ common.TenantScope, _ ports.StoreSettings) error {
	return nil
}

func (f fakeSettings) GetProfile(_ context.Context, _ common.TenantScope) (ports.StoreProfile, error) {
	return f.profile, f.err
}

type fixedClock struct{ now time.Time }

func (c fixedClock) Now() time.Time { return c.now }

var testNow = time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)

func profileAtLevel(level int, lookback int) ports.StoreProfile {
	return ports.StoreProfile{
		EntitlementLimits: map[string]int{
			business.LimitAnalyticsLevel:        level,
			business.LimitAnalyticsLookbackDays: lookback,
		},
	}
}

func newTestService(repo *fakeAnalyticsRepo, profile ports.StoreProfile) Service {
	return NewService(Dependencies{
		Analytics: repo,
		Settings:  fakeSettings{profile: profile},
		Clock:     fixedClock{now: testNow},
	})
}

func ownerCommand() Command {
	return Command{
		Scope:     common.TenantScope{BusinessID: "biz-1"},
		ActorRole: business.UserRoleOwner,
	}
}

// --- gating ---

func TestSummary_AllPlansAllowed_WindowClamped(t *testing.T) {
	repo := &fakeAnalyticsRepo{summary: ports.AnalyticsSummary{SalesTotalMinor: 5000, OrdersCount: 3}}
	service := newTestService(repo, profileAtLevel(LevelBasic, 30))

	result, err := service.Summary(context.Background(), ownerCommand())
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if result.Totals.SalesTotalMinor != 5000 || result.Totals.OrdersCount != 3 {
		t.Fatalf("unexpected totals: %+v", result.Totals)
	}
	wantFrom := testNow.AddDate(0, 0, -30)
	if result.Window.From == nil || !result.Window.From.Equal(wantFrom) {
		t.Fatalf("Free lookback must clamp to 30d: got %v want %v", result.Window.From, wantFrom)
	}
	if !repo.called("summary") {
		t.Fatal("repository was not called")
	}
}

func TestSummary_FullHistoryPlan_HasNoLowerBound(t *testing.T) {
	repo := &fakeAnalyticsRepo{}
	service := newTestService(repo, profileAtLevel(LevelFull, -1))

	result, err := service.Summary(context.Background(), ownerCommand())
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if result.Window.From != nil {
		t.Fatalf("full-history plan must have no lower bound, got %v", result.Window.From)
	}
}

func TestSummary_AbsentLimits_DefaultsToFreeWindow(t *testing.T) {
	repo := &fakeAnalyticsRepo{}
	// A plan whose matrix rows are disabled resolves with no limit keys:
	// conservative defaults (basic level, 30d), never an invented grant.
	service := newTestService(repo, ports.StoreProfile{})

	result, err := service.Summary(context.Background(), ownerCommand())
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if result.Window.From == nil || !result.Window.From.Equal(testNow.AddDate(0, 0, -defaultLookbackDays)) {
		t.Fatalf("absent limits must default to %dd window", defaultLookbackDays)
	}
}

// TestGating_PerEndpointPerLevel walks the §14.1 ladder: each endpoint must
// refuse below its level with ErrAnalyticsNotEntitled and pass at/above it.
func TestGating_PerEndpointPerLevel(t *testing.T) {
	calls := map[string]struct {
		required int
		invoke   func(Service) error
	}{
		"summary":              {LevelBasic, func(s Service) error { _, e := s.Summary(context.Background(), ownerCommand()); return e }},
		"sales_trend":          {LevelStandard, func(s Service) error { _, e := s.SalesTrend(context.Background(), ownerCommand()); return e }},
		"orders_trend":         {LevelStandard, func(s Service) error { _, e := s.OrdersTrend(context.Background(), ownerCommand()); return e }},
		"top_designs":          {LevelStandard, func(s Service) error { _, e := s.TopDesigns(context.Background(), ownerCommand(), 0); return e }},
		"customers":            {LevelStandard, func(s Service) error { _, e := s.Customers(context.Background(), ownerCommand(), 0); return e }},
		"outstanding_balances": {LevelStandard, func(s Service) error { _, e := s.OutstandingBalances(context.Background(), ownerCommand()); return e }},
		"revenue_breakdowns":   {LevelFull, func(s Service) error { _, e := s.RevenueBreakdowns(context.Background(), ownerCommand()); return e }},
		"design_performance":   {LevelFull, func(s Service) error { _, e := s.DesignPerformance(context.Background(), ownerCommand()); return e }},
		"staff":                {LevelAdvanced, func(s Service) error { _, e := s.Staff(context.Background(), ownerCommand()); return e }},
	}

	for name, tc := range calls {
		for level := LevelBasic; level <= LevelAdvanced; level++ {
			repo := &fakeAnalyticsRepo{}
			service := newTestService(repo, profileAtLevel(level, -1))
			err := tc.invoke(service)
			if level < tc.required {
				if !errors.Is(err, ErrAnalyticsNotEntitled) {
					t.Fatalf("%s at level %d: want ErrAnalyticsNotEntitled, got %v", name, level, err)
				}
				if len(repo.calls) != 0 {
					t.Fatalf("%s at level %d: repository must not be called when gated", name, level)
				}
			} else if err != nil {
				t.Fatalf("%s at level %d: want pass, got %v", name, level, err)
			}
		}
	}
}

func TestGating_ErrorCarriesCurrentAndRequiredLevels(t *testing.T) {
	service := newTestService(&fakeAnalyticsRepo{}, profileAtLevel(LevelStandard, -1))

	_, err := service.RevenueBreakdowns(context.Background(), ownerCommand())
	var notEntitled NotEntitledError
	if !errors.As(err, &notEntitled) {
		t.Fatalf("want NotEntitledError, got %v", err)
	}
	if notEntitled.CurrentLevel != LevelStandard || notEntitled.RequiredLevel != LevelFull {
		t.Fatalf("levels: got current=%d required=%d", notEntitled.CurrentLevel, notEntitled.RequiredLevel)
	}
}

func TestGating_StaffRoleForbidden_EvenOnStudio(t *testing.T) {
	service := newTestService(&fakeAnalyticsRepo{}, profileAtLevel(LevelAdvanced, -1))
	cmd := ownerCommand()
	cmd.ActorRole = business.UserRoleStaff

	if _, err := service.Summary(context.Background(), cmd); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("staff must be refused like the Money Desk, got %v", err)
	}
}

func TestGating_ZeroScopeInvalid(t *testing.T) {
	service := newTestService(&fakeAnalyticsRepo{}, profileAtLevel(LevelAdvanced, -1))
	if _, err := service.Summary(context.Background(), Command{ActorRole: business.UserRoleOwner}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("want ErrInvalidInput, got %v", err)
	}
}

// --- custom date ranges (§14.1 Studio-only) ---

func TestCustomRange_LowerTierRefused(t *testing.T) {
	service := newTestService(&fakeAnalyticsRepo{}, profileAtLevel(LevelFull, -1))
	cmd := ownerCommand()
	cmd.From = "2026-01-01"

	_, err := service.Summary(context.Background(), cmd)
	var notEntitled NotEntitledError
	if !errors.As(err, &notEntitled) || notEntitled.Feature != "custom_date_ranges" {
		t.Fatalf("Growth custom range must 403 with custom_date_ranges, got %v", err)
	}
}

func TestCustomRange_StudioAllowed_AndClampedToNow(t *testing.T) {
	repo := &fakeAnalyticsRepo{}
	service := newTestService(repo, profileAtLevel(LevelAdvanced, -1))
	cmd := ownerCommand()
	cmd.From = "2026-01-01"
	cmd.To = "2026-01-31"

	result, err := service.Summary(context.Background(), cmd)
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	wantFrom := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	wantTo := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC) // date-only end is inclusive
	if result.Window.From == nil || !result.Window.From.Equal(wantFrom) {
		t.Fatalf("from: got %v want %v", result.Window.From, wantFrom)
	}
	if !result.Window.To.Equal(wantTo) {
		t.Fatalf("to: got %v want %v", result.Window.To, wantTo)
	}
}

func TestCustomRange_InvalidRejected(t *testing.T) {
	service := newTestService(&fakeAnalyticsRepo{}, profileAtLevel(LevelAdvanced, -1))

	for _, pair := range [][2]string{{"not-a-date", ""}, {"2026-02-01", "2026-01-01"}} {
		cmd := ownerCommand()
		cmd.From, cmd.To = pair[0], pair[1]
		if _, err := service.Summary(context.Background(), cmd); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("range %q→%q: want ErrInvalidInput, got %v", pair[0], pair[1], err)
		}
	}
}

// --- top designs ladder (§14.1 Starter top 5) ---

func TestTopDesigns_StarterCappedAtFive(t *testing.T) {
	repo := &fakeAnalyticsRepo{}
	service := newTestService(repo, profileAtLevel(LevelStandard, 365))

	result, err := service.TopDesigns(context.Background(), ownerCommand(), 50)
	if err != nil {
		t.Fatalf("TopDesigns: %v", err)
	}
	if repo.lastLimit != starterTopDesignsCap || result.LimitApplied != starterTopDesignsCap {
		t.Fatalf("Starter must be pinned to top %d, got %d", starterTopDesignsCap, repo.lastLimit)
	}
}

func TestTopDesigns_FullHonorsLimitWithCeiling(t *testing.T) {
	repo := &fakeAnalyticsRepo{}
	service := newTestService(repo, profileAtLevel(LevelFull, -1))

	if _, err := service.TopDesigns(context.Background(), ownerCommand(), 0); err != nil {
		t.Fatalf("TopDesigns: %v", err)
	}
	if repo.lastLimit != defaultListLimit {
		t.Fatalf("default limit: got %d want %d", repo.lastLimit, defaultListLimit)
	}
	if _, err := service.TopDesigns(context.Background(), ownerCommand(), 5000); err != nil {
		t.Fatalf("TopDesigns: %v", err)
	}
	if repo.lastLimit != maxListLimit {
		t.Fatalf("max limit: got %d want %d", repo.lastLimit, maxListLimit)
	}
}

// --- customers per tier (§14.1) ---

func TestCustomers_StandardGetsMixOnly(t *testing.T) {
	repo := &fakeAnalyticsRepo{
		mix:          ports.CustomerMix{NewInWindow: 4, ReturningInWindow: 2, WithOrdersInWindow: 6, RepeatInWindow: 3},
		topCustomers: []ports.TopCustomer{{DisplayName: "should not surface"}},
	}
	service := newTestService(repo, profileAtLevel(LevelStandard, 365))

	result, err := service.Customers(context.Background(), ownerCommand(), 10)
	if err != nil {
		t.Fatalf("Customers: %v", err)
	}
	if result.Mix.NewInWindow != 4 || result.Mix.ReturningInWindow != 2 {
		t.Fatalf("mix: %+v", result.Mix)
	}
	if repo.called("top_customers") || repo.called("customer_growth") {
		t.Fatal("standard tier must not fetch full+ datasets")
	}
	if result.TopCustomers != nil || result.Growth != nil {
		t.Fatal("standard tier must not receive full+ blocks")
	}
}

func TestCustomers_FullGetsRepeatRateTopAndGrowth(t *testing.T) {
	repo := &fakeAnalyticsRepo{
		mix:          ports.CustomerMix{NewInWindow: 4, ReturningInWindow: 2, WithOrdersInWindow: 6, RepeatInWindow: 3},
		topCustomers: []ports.TopCustomer{{DisplayName: "Ama"}},
		growth:       []ports.CustomerGrowthPoint{{NewCustomers: 2}},
	}
	service := newTestService(repo, profileAtLevel(LevelFull, -1))

	result, err := service.Customers(context.Background(), ownerCommand(), 10)
	if err != nil {
		t.Fatalf("Customers: %v", err)
	}
	if result.RepeatRate != 0.5 {
		t.Fatalf("repeat rate: got %v want 0.5", result.RepeatRate)
	}
	if len(result.TopCustomers) != 1 || len(result.Growth) != 1 {
		t.Fatalf("full+ blocks missing: %+v", result)
	}
}

func TestCustomers_ZeroBaseRepeatRate(t *testing.T) {
	repo := &fakeAnalyticsRepo{mix: ports.CustomerMix{}}
	service := newTestService(repo, profileAtLevel(LevelFull, -1))

	result, err := service.Customers(context.Background(), ownerCommand(), 10)
	if err != nil {
		t.Fatalf("Customers: %v", err)
	}
	if result.RepeatRate != 0 {
		t.Fatalf("repeat rate with no customers must be 0, got %v", result.RepeatRate)
	}
}
