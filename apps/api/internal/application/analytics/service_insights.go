package analyticsapp

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// CustomersResult is shaped so the dashboard can render per tier (§14.1):
// standard gets the new-vs-returning mix only; full+ additionally gets the
// repeat rate, top customers and growth series (nil at standard).
type CustomersResult struct {
	Window       ports.AnalyticsWindow
	Level        int
	Mix          ports.CustomerMix
	RepeatRate   float64
	TopCustomers []ports.TopCustomer
	Growth       []ports.CustomerGrowthPoint
}

// Customers is the standard+ customer analytics (§14.1 "New vs returning
// customers": Starter basic, full+ the complete block).
func (s Service) Customers(ctx context.Context, cmd Command, limit int) (CustomersResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelStandard, "customers")
	if err != nil {
		return CustomersResult{}, err
	}
	window, err := s.resolveWindow(profile, cmd.From, cmd.To)
	if err != nil {
		return CustomersResult{}, err
	}
	mix, err := s.analytics.CustomerMix(ctx, cmd.Scope, window)
	if err != nil {
		return CustomersResult{}, err
	}
	result := CustomersResult{Window: window, Level: analyticsLevel(profile), Mix: mix}
	if result.Level < LevelFull {
		return result, nil
	}

	if mix.WithOrdersInWindow > 0 {
		result.RepeatRate = float64(mix.RepeatInWindow) / float64(mix.WithOrdersInWindow)
	}
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}
	result.TopCustomers, err = s.analytics.TopCustomers(ctx, cmd.Scope, window, limit)
	if err != nil {
		return CustomersResult{}, err
	}
	result.Growth, err = s.analytics.CustomerGrowth(ctx, cmd.Scope, window)
	if err != nil {
		return CustomersResult{}, err
	}
	return result, nil
}

// OutstandingBalances is the standard+ bespoke money-owed ladder (§14.1
// "Outstanding deposits & balances"). It is CURRENT state — what is owed now
// — so the lookback window does not apply (documented endpoint exception).
func (s Service) OutstandingBalances(ctx context.Context, cmd Command) ([]ports.OutstandingBalance, error) {
	if _, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelStandard, "outstanding_balances"); err != nil {
		return nil, err
	}
	return s.analytics.OutstandingBalances(ctx, cmd.Scope)
}

type RevenueBreakdownsResult struct {
	Window     ports.AnalyticsWindow
	Breakdowns ports.RevenueBreakdowns
}

// RevenueBreakdowns is the full+ §14.1 set: by design, by collection, by
// order type (standard/bespoke), by delivery vs pickup.
func (s Service) RevenueBreakdowns(ctx context.Context, cmd Command) (RevenueBreakdownsResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelFull, "revenue_breakdowns")
	if err != nil {
		return RevenueBreakdownsResult{}, err
	}
	window, err := s.resolveWindow(profile, cmd.From, cmd.To)
	if err != nil {
		return RevenueBreakdownsResult{}, err
	}
	breakdowns, err := s.analytics.RevenueBreakdowns(ctx, cmd.Scope, window)
	if err != nil {
		return RevenueBreakdownsResult{}, err
	}
	return RevenueBreakdownsResult{Window: window, Breakdowns: breakdowns}, nil
}

// DesignPerformance is the full+ §14.1 scoreboard: views (persisted counter),
// view→order conversion, waiting-list demand. All-time by nature — views are
// a cumulative counter and only full+ plans (full history) reach this.
func (s Service) DesignPerformance(ctx context.Context, cmd Command) ([]ports.DesignPerformance, error) {
	if _, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelFull, "design_performance"); err != nil {
		return nil, err
	}
	return s.analytics.DesignPerformance(ctx, cmd.Scope)
}

// Staff is the Studio-only §14.1 team analytics (performance & activity by
// staff member, via the 000109 attribution columns).
func (s Service) Staff(ctx context.Context, cmd Command) ([]ports.StaffActivity, error) {
	if _, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelAdvanced, "staff"); err != nil {
		return nil, err
	}
	return s.analytics.StaffActivity(ctx, cmd.Scope)
}
