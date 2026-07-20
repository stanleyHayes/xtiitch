package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §14 Analytics & Reports — tenant-scoped read models. Every type here is a
// projection over data the platform already persists (orders, payments,
// settlements, manual takings, designs, waitlist, team); the analytics layer
// never writes and never derives fee figures (§3.2/§14.5).

// AnalyticsWindow is the half-open [From, To) time filter applied to every
// time-series/totals query. From is nil for plans with FULL history
// (analytics_lookback_days NULL in the matrix, §14.1); To is the resolution
// instant (the service's clock). The application resolves the window from the
// plan entitlement; repositories just apply it.
type AnalyticsWindow struct {
	From *time.Time
	To   time.Time
}

// AnalyticsSummary is the §14.1 "Totals" row: window-clamped sales/orders plus
// current-state entity counts (customers and designs are not events, so their
// totals are current-state by definition and not windowed).
type AnalyticsSummary struct {
	SalesTotalMinor int64
	OrdersCount     int
	OrdersByStatus  []OrderStatusCount
	CustomersCount  int
	DesignsCount    int
}

type OrderStatusCount struct {
	Status string
	Count  int
}

// DailySalesPoint is one day of the sales-trend series (§14.1, standard+):
// gross succeeded through-platform payments plus off-platform manual takings.
type DailySalesPoint struct {
	Day                time.Time
	SalesMinor         int64
	ManualTakingsMinor int64
}

// DailyOrdersPoint is one day of the orders-trend series with the §14.1
// "standard vs custom" split (orders.flow: ready_made vs bespoke).
type DailyOrdersPoint struct {
	Day      time.Time
	Orders   int
	Standard int
	Bespoke  int
}

// TopDesign is one row of the top-selling-designs ladder (§14.1, standard+;
// Starter capped at 5). Ranked by paid-order count, revenue tie-broken.
type TopDesign struct {
	DesignID     common.ID
	Title        string
	Orders       int
	RevenueMinor int64
}

// CustomerMix is the new-vs-returning split (§14.1, standard) plus the raw
// counts the repeat-rate (full+) is computed from. "New" placed its first-ever
// order inside the window; "returning" ordered in the window and had ordered
// before it.
type CustomerMix struct {
	NewInWindow        int
	ReturningInWindow  int
	WithOrdersInWindow int
	RepeatInWindow     int
}

// TopCustomer is one row of the full+ customer analytics ladder.
type TopCustomer struct {
	CustomerID  common.ID
	DisplayName string
	Phone       string
	Orders      int
	SpendMinor  int64
	LastOrderAt time.Time
}

// CustomerGrowthPoint is one month of new-customer acquisition (full+).
type CustomerGrowthPoint struct {
	Month        time.Time
	NewCustomers int
}

// OutstandingBalance is one bespoke order with money still owed (§14.1,
// standard+): agreed total minus what has settled. This is CURRENT state —
// it answers "what is owed now", so no lookback window applies.
type OutstandingBalance struct {
	OrderID          common.ID
	CustomerName     string
	DesignTitle      string
	Status           string
	AgreedTotalMinor int64
	SettledMinor     int64
	OutstandingMinor int64
	CreatedAt        time.Time
}

type DesignRevenue struct {
	DesignID     common.ID
	Title        string
	Orders       int
	RevenueMinor int64
}

// CollectionRevenue groups revenue by collection; CollectionID is nil for the
// "no collection" bucket.
type CollectionRevenue struct {
	CollectionID *common.ID
	Name         string
	Orders       int
	RevenueMinor int64
}

// FlowRevenue is revenue by order type (orders.flow: ready_made/bespoke).
type FlowRevenue struct {
	Flow         string
	Orders       int
	RevenueMinor int64
}

// FulfilmentRevenue is revenue by delivery vs pickup (orders.delivery_method;
// "" = not specified, e.g. walk-in orders).
type FulfilmentRevenue struct {
	Method       string
	Orders       int
	RevenueMinor int64
}

// RevenueBreakdowns is the full+ §14.1 breakdown set. "Revenue" is gross
// succeeded through-platform payment amounts joined payment → order → design
// (manual takings excluded: they carry no design linkage guarantee).
type RevenueBreakdowns struct {
	ByDesign     []DesignRevenue
	ByCollection []CollectionRevenue
	ByFlow       []FlowRevenue
	ByFulfilment []FulfilmentRevenue
}

// DesignPerformance is the full+ §14.1 per-design scoreboard. Views is the
// persisted cumulative counter (000107); Orders counts paid orders all-time;
// ConversionRate = Orders/Views (0 when no views); WaitingList is the current
// demand (entries still 'waiting').
type DesignPerformance struct {
	DesignID       common.ID
	Title          string
	Views          int64
	Orders         int
	ConversionRate float64
	WaitingList    int
}

// StaffActivity is the Studio-only §14.1 team scoreboard: one row per team
// member (business_users), with activity counted through the staff-attribution
// columns added in 000109. Pre-000109 rows are unattributed by design.
type StaffActivity struct {
	UserID        common.ID
	DisplayName   string
	Role          string
	IsActive      bool
	OrdersCreated int
	TakingsLogged int
	TakingsMinor  int64
}

// AnalyticsRepository serves the §14 analytics reads. Every method runs under
// the caller's tenant scope (RLS + explicit business_id), so no metric can
// ever include another store's data (§6/§14.5).
type AnalyticsRepository interface {
	Summary(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) (AnalyticsSummary, error)
	SalesTrend(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) ([]DailySalesPoint, error)
	OrdersTrend(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) ([]DailyOrdersPoint, error)
	TopDesigns(ctx context.Context, scope common.TenantScope, window AnalyticsWindow, limit int) ([]TopDesign, error)
	CustomerMix(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) (CustomerMix, error)
	TopCustomers(ctx context.Context, scope common.TenantScope, window AnalyticsWindow, limit int) ([]TopCustomer, error)
	CustomerGrowth(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) ([]CustomerGrowthPoint, error)
	// OutstandingBalances is current state (what is owed NOW), so it takes no
	// window — the endpoint documents this exception to the lookback clamp.
	OutstandingBalances(ctx context.Context, scope common.TenantScope) ([]OutstandingBalance, error)
	RevenueBreakdowns(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) (RevenueBreakdowns, error)
	// DesignPerformance reads cumulative counters + current waitlist demand,
	// so it is all-time by nature and takes no window (only full+ plans, which
	// have full history, may call it — the clamp would be a no-op).
	DesignPerformance(ctx context.Context, scope common.TenantScope) ([]DesignPerformance, error)
	// StaffActivity is all-time per-member activity (same all-time rationale
	// as DesignPerformance; Studio-only).
	StaffActivity(ctx context.Context, scope common.TenantScope) ([]StaffActivity, error)
}

// DesignViewRecorder bumps the §14.1 design view counter. It is a separate
// port from StorefrontRepository so the public read can treat it as
// best-effort (a counter hiccup must never fail a storefront page) without
// widening the storefront contract every consumer fakes.
type DesignViewRecorder interface {
	RecordDesignView(ctx context.Context, scope common.TenantScope, designID common.ID) error
}
