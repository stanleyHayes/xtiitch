package analyticsapp

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// The §14.1 endpoint methods. Every one: authorize (role + live level check)
// → resolveWindow (lookback clamp + Studio-only custom ranges) → repo read.

// SummaryResult is the §14.1 "Totals" row plus the window it was computed
// over, echoed so the dashboard can label the figures.
type SummaryResult struct {
	Window ports.AnalyticsWindow
	Totals ports.AnalyticsSummary
}

// Summary is the ALL-plans totals endpoint (§14.1: sales, orders,
// order-status counts, customers, designs). Money Desk figures stay on
// /v1/money/* — this is the analytical totals layer, not the desk.
func (s Service) Summary(ctx context.Context, cmd Command) (SummaryResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelBasic, "summary")
	if err != nil {
		return SummaryResult{}, err
	}
	window, err := s.resolveWindow(profile, cmd.From, cmd.To)
	if err != nil {
		return SummaryResult{}, err
	}
	totals, err := s.analytics.Summary(ctx, cmd.Scope, window)
	if err != nil {
		return SummaryResult{}, err
	}
	return SummaryResult{Window: window, Totals: totals}, nil
}

type SalesTrendResult struct {
	Window ports.AnalyticsWindow
	Points []ports.DailySalesPoint
}

// SalesTrend is the standard+ sales-over-time series (§14.1).
func (s Service) SalesTrend(ctx context.Context, cmd Command) (SalesTrendResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelStandard, "sales_trend")
	if err != nil {
		return SalesTrendResult{}, err
	}
	window, err := s.resolveWindow(profile, cmd.From, cmd.To)
	if err != nil {
		return SalesTrendResult{}, err
	}
	points, err := s.analytics.SalesTrend(ctx, cmd.Scope, window)
	if err != nil {
		return SalesTrendResult{}, err
	}
	return SalesTrendResult{Window: window, Points: points}, nil
}

type OrdersTrendResult struct {
	Window ports.AnalyticsWindow
	Points []ports.DailyOrdersPoint
}

// OrdersTrend is the standard+ orders-over-time series with the standard vs
// bespoke split (§14.1 "Orders over time + standard vs custom split").
func (s Service) OrdersTrend(ctx context.Context, cmd Command) (OrdersTrendResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelStandard, "orders_trend")
	if err != nil {
		return OrdersTrendResult{}, err
	}
	window, err := s.resolveWindow(profile, cmd.From, cmd.To)
	if err != nil {
		return OrdersTrendResult{}, err
	}
	points, err := s.analytics.OrdersTrend(ctx, cmd.Scope, window)
	if err != nil {
		return OrdersTrendResult{}, err
	}
	return OrdersTrendResult{Window: window, Points: points}, nil
}

// starterTopDesignsCap is §14.1's "Top-selling designs: Starter Top 5".
const starterTopDesignsCap = 5

const (
	defaultListLimit = 10
	maxListLimit     = 100
)

type TopDesignsResult struct {
	Window  ports.AnalyticsWindow
	Designs []ports.TopDesign
	// LimitApplied is the cap actually used (Starter is pinned to 5 regardless
	// of the requested limit, §14.1).
	LimitApplied int
}

// TopDesigns is the standard+ top-selling ladder (§14.1): Starter capped at
// top 5, full+ honors the requested limit (default 10, max 100).
func (s Service) TopDesigns(ctx context.Context, cmd Command, limit int) (TopDesignsResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelStandard, "top_designs")
	if err != nil {
		return TopDesignsResult{}, err
	}
	if limit <= 0 {
		limit = defaultListLimit
	}
	if analyticsLevel(profile) == LevelStandard {
		limit = starterTopDesignsCap
	} else if limit > maxListLimit {
		limit = maxListLimit
	}
	window, err := s.resolveWindow(profile, cmd.From, cmd.To)
	if err != nil {
		return TopDesignsResult{}, err
	}
	designs, err := s.analytics.TopDesigns(ctx, cmd.Scope, window, limit)
	if err != nil {
		return TopDesignsResult{}, err
	}
	return TopDesignsResult{Window: window, Designs: designs, LimitApplied: limit}, nil
}
