package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// AnalyticsRepository is the read-only postgres adapter for §14 analytics.
// Every method opens a tenant-scoped transaction (RLS + an explicit
// business_id predicate, defense in depth per §6) over data other modules
// persist; this adapter never writes and never derives a fee (§3.2/§14.5).
type AnalyticsRepository struct {
	pool *pgxpool.Pool
}

func NewAnalyticsRepository(pool *pgxpool.Pool) AnalyticsRepository {
	return AnalyticsRepository{pool: pool}
}

func rollbackAnalyticsUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}

func (repo AnalyticsRepository) beginScoped(ctx context.Context, scope common.TenantScope) (pgx.Tx, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if err := setTenantScope(ctx, tx, scope); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

// windowLowerArg binds the window's optional lower bound for the shared
// "($N::timestamptz is null or created_at >= $N)" predicate.
func windowLowerArg(window ports.AnalyticsWindow) any {
	if window.From == nil {
		return nil
	}
	return *window.From
}

func (repo AnalyticsRepository) Summary(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) (ports.AnalyticsSummary, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return ports.AnalyticsSummary{}, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	var summary ports.AnalyticsSummary
	// Sales total: gross succeeded through-platform payments in the window —
	// the same persisted figure the Money Desk's platform card sums (§3.2).
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0)
		from payments
		where business_id = $1 and status = 'succeeded' and through_platform = true
			and ($2::timestamptz is null or created_at >= $2) and created_at < $3
	`, scope.BusinessID.String(), windowLowerArg(window), window.To).Scan(&summary.SalesTotalMinor); err != nil {
		return ports.AnalyticsSummary{}, err
	}

	// Orders: every non-draft order (drafts are abandoned checkouts, not sales).
	rows, err := tx.Query(ctx, `
		select status, count(*)
		from orders
		where business_id = $1 and status <> 'draft'
			and ($2::timestamptz is null or created_at >= $2) and created_at < $3
		group by status order by status
	`, scope.BusinessID.String(), windowLowerArg(window), window.To)
	if err != nil {
		return ports.AnalyticsSummary{}, err
	}
	for rows.Next() {
		var bucket ports.OrderStatusCount
		if err := rows.Scan(&bucket.Status, &bucket.Count); err != nil {
			rows.Close()
			return ports.AnalyticsSummary{}, err
		}
		summary.OrdersByStatus = append(summary.OrdersByStatus, bucket)
		summary.OrdersCount += bucket.Count
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.AnalyticsSummary{}, err
	}

	// Customers/designs are current-state entity counts (not events), so the
	// lookback window does not apply to them (documented in ports).
	if err := tx.QueryRow(ctx, `
		select count(*) from customer_businesses where business_id = $1
	`, scope.BusinessID.String()).Scan(&summary.CustomersCount); err != nil {
		return ports.AnalyticsSummary{}, err
	}
	if err := tx.QueryRow(ctx, `
		select count(*) from designs where business_id = $1 and status = 'active'
	`, scope.BusinessID.String()).Scan(&summary.DesignsCount); err != nil {
		return ports.AnalyticsSummary{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AnalyticsSummary{}, err
	}
	return summary, nil
}

// trendBounds resolves the series start for generate_series: the window's
// lower bound, or — for full-history plans — the business's first qualifying
// row, so the chart starts at the first sale instead of epoch.
const trendBoundsCTE = `
	with bounds as (
		select coalesce($2::timestamptz, (%s), $3::timestamptz) as from_ts,
			$3::timestamptz as to_ts
	),
	days as (
		select generate_series(date_trunc('day', b.from_ts), date_trunc('day', b.to_ts), interval '1 day') as day
		from bounds b
	)`

func (repo AnalyticsRepository) SalesTrend(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) ([]ports.DailySalesPoint, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	firstSale := `select min(p.created_at) from payments p
		where p.business_id = $1 and p.status = 'succeeded' and p.through_platform`
	rows, err := tx.Query(ctx, `
`+fmt.Sprintf(trendBoundsCTE, firstSale)+`,
	sales as (
		select date_trunc('day', p.created_at) as day, sum(p.amount_minor) as minor
		from payments p, bounds b
		where p.business_id = $1 and p.status = 'succeeded' and p.through_platform
			and p.created_at >= b.from_ts and p.created_at < b.to_ts + interval '1 day'
		group by 1
	),
	takings as (
		select date_trunc('day', t.taken_at) as day, sum(t.amount_minor) as minor
		from manual_takings t, bounds b
		where t.business_id = $1
			and t.taken_at >= b.from_ts and t.taken_at < b.to_ts + interval '1 day'
		group by 1
	)
	select d.day, coalesce(s.minor, 0), coalesce(t.minor, 0)
	from days d
	left join sales s on s.day = d.day
	left join takings t on t.day = d.day
	order by d.day
	`, scope.BusinessID.String(), windowLowerArg(window), window.To)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []ports.DailySalesPoint
	for rows.Next() {
		var point ports.DailySalesPoint
		if err := rows.Scan(&point.Day, &point.SalesMinor, &point.ManualTakingsMinor); err != nil {
			return nil, err
		}
		points = append(points, point)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return points, nil
}

func (repo AnalyticsRepository) OrdersTrend(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) ([]ports.DailyOrdersPoint, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	firstOrder := `select min(o.created_at) from orders o
		where o.business_id = $1 and o.status <> 'draft'`
	rows, err := tx.Query(ctx, `
`+fmt.Sprintf(trendBoundsCTE, firstOrder)+`,
	daily as (
		select date_trunc('day', o.created_at) as day,
			count(*) as orders,
			count(*) filter (where o.flow = 'ready_made') as standard,
			count(*) filter (where o.flow = 'bespoke') as bespoke
		from orders o, bounds b
		where o.business_id = $1 and o.status <> 'draft'
			and o.created_at >= b.from_ts and o.created_at < b.to_ts + interval '1 day'
		group by 1
	)
	select d.day, coalesce(l.orders, 0), coalesce(l.standard, 0), coalesce(l.bespoke, 0)
	from days d
	left join daily l on l.day = d.day
	order by d.day
	`, scope.BusinessID.String(), windowLowerArg(window), window.To)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []ports.DailyOrdersPoint
	for rows.Next() {
		var point ports.DailyOrdersPoint
		if err := rows.Scan(&point.Day, &point.Orders, &point.Standard, &point.Bespoke); err != nil {
			return nil, err
		}
		points = append(points, point)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return points, nil
}

func (repo AnalyticsRepository) TopDesigns(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow, limit int) ([]ports.TopDesign, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// "Top-selling" = paid orders (confirmed/fulfilled), ranked by units with
	// the gross succeeded-payment total as tie-breaker. An order may carry
	// several succeeded payments (deposit + balance), hence count(distinct).
	rows, err := tx.Query(ctx, `
		select d.design_id, d.title,
			count(distinct o.order_id) as orders,
			coalesce(sum(p.amount_minor), 0) as revenue
		from orders o
		join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		left join payments p on p.order_id = o.order_id and p.business_id = o.business_id
			and p.status = 'succeeded' and p.through_platform
		where o.business_id = $1 and o.status in ('confirmed', 'fulfilled')
			and ($2::timestamptz is null or o.created_at >= $2) and o.created_at < $3
		group by d.design_id, d.title
		order by orders desc, revenue desc, d.title
		limit $4
	`, scope.BusinessID.String(), windowLowerArg(window), window.To, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var designs []ports.TopDesign
	for rows.Next() {
		var design ports.TopDesign
		if err := rows.Scan(&design.DesignID, &design.Title, &design.Orders, &design.RevenueMinor); err != nil {
			return nil, err
		}
		designs = append(designs, design)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return designs, nil
}
