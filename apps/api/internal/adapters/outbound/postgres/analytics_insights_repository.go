package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §14 analytics — the deeper insight reads (standard+/full+/Studio ladders).
// Same read-only, tenant-scoped shape as analytics_repository.go.

func (repo AnalyticsRepository) CustomerMix(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) (ports.CustomerMix, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return ports.CustomerMix{}, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// "New" = first-ever non-draft order lands inside the window; "returning"
	// = ordered in the window with a first order before it. -infinity keeps the
	// predicates true for full-history plans (nil lower bound).
	var mix ports.CustomerMix
	if err := tx.QueryRow(ctx, `
		with wo as (
			select o.customer_id
			from orders o
			where o.business_id = $1 and o.status <> 'draft'
				and ($2::timestamptz is null or o.created_at >= $2) and o.created_at < $3
		),
		agg as (
			select customer_id, count(*) as n from wo group by 1
		),
		firsts as (
			select o.customer_id, min(o.created_at) as first_at
			from orders o
			where o.business_id = $1 and o.status <> 'draft'
			group by 1
		)
		select
			count(*) filter (where f.first_at >= coalesce($2::timestamptz, '-infinity'::timestamptz)),
			count(*) filter (where f.first_at < coalesce($2::timestamptz, '-infinity'::timestamptz)),
			count(*),
			count(*) filter (where a.n > 1)
		from agg a
		join firsts f on f.customer_id = a.customer_id
	`, scope.BusinessID.String(), windowLowerArg(window), window.To).Scan(
		&mix.NewInWindow, &mix.ReturningInWindow, &mix.WithOrdersInWindow, &mix.RepeatInWindow,
	); err != nil {
		return ports.CustomerMix{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.CustomerMix{}, err
	}
	return mix, nil
}

func (repo AnalyticsRepository) TopCustomers(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow, limit int) ([]ports.TopCustomer, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// Spend = gross succeeded through-platform payments on the customer's paid
	// orders in the window; count(distinct) keeps multi-payment orders single.
	rows, err := tx.Query(ctx, `
		select c.customer_id, coalesce(c.display_name, ''), coalesce(c.phone, ''),
			count(distinct o.order_id) as orders,
			coalesce(sum(p.amount_minor), 0) as spend,
			max(o.created_at) as last_order_at
		from orders o
		join customers c on c.customer_id = o.customer_id
		left join payments p on p.order_id = o.order_id and p.business_id = o.business_id
			and p.status = 'succeeded' and p.through_platform
		where o.business_id = $1 and o.status in ('confirmed', 'fulfilled')
			and ($2::timestamptz is null or o.created_at >= $2) and o.created_at < $3
		group by c.customer_id, c.display_name, c.phone
		order by spend desc, orders desc, last_order_at desc
		limit $4
	`, scope.BusinessID.String(), windowLowerArg(window), window.To, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var customers []ports.TopCustomer
	for rows.Next() {
		var customer ports.TopCustomer
		if err := rows.Scan(
			&customer.CustomerID, &customer.DisplayName, &customer.Phone,
			&customer.Orders, &customer.SpendMinor, &customer.LastOrderAt,
		); err != nil {
			return nil, err
		}
		customers = append(customers, customer)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return customers, nil
}

func (repo AnalyticsRepository) CustomerGrowth(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) ([]ports.CustomerGrowthPoint, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// Monthly acquisition: customers bucketed by their FIRST-ever order month.
	rows, err := tx.Query(ctx, `
		with firsts as (
			select o.customer_id, min(o.created_at) as first_at
			from orders o
			where o.business_id = $1 and o.status <> 'draft'
			group by 1
		)
		select date_trunc('month', f.first_at) as month, count(*)
		from firsts f
		where f.first_at >= coalesce($2::timestamptz, '-infinity'::timestamptz)
			and f.first_at < $3
		group by 1 order by 1
	`, scope.BusinessID.String(), windowLowerArg(window), window.To)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []ports.CustomerGrowthPoint
	for rows.Next() {
		var point ports.CustomerGrowthPoint
		if err := rows.Scan(&point.Month, &point.NewCustomers); err != nil {
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

func (repo AnalyticsRepository) OutstandingBalances(ctx context.Context, scope common.TenantScope) ([]ports.OutstandingBalance, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// Bespoke money still owed: agreed total minus what has settled, over the
	// live orders (cancelled orders owe nothing). agreed_total is NULL until
	// negotiated (orderapp.SetAgreedTotal), so those rows drop out naturally.
	rows, err := tx.Query(ctx, `
		select o.order_id, coalesce(c.display_name, ''), d.title, o.status,
			o.agreed_total_minor, o.settled_minor,
			o.agreed_total_minor - o.settled_minor as outstanding,
			o.created_at
		from orders o
		join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		left join customers c on c.customer_id = o.customer_id
		where o.business_id = $1 and o.flow = 'bespoke'
			and o.status in ('awaiting_deposit', 'confirmed', 'fulfilled')
			and o.agreed_total_minor is not null
			and o.agreed_total_minor > o.settled_minor
		order by outstanding desc, o.created_at
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []ports.OutstandingBalance
	for rows.Next() {
		var balance ports.OutstandingBalance
		if err := rows.Scan(
			&balance.OrderID, &balance.CustomerName, &balance.DesignTitle, &balance.Status,
			&balance.AgreedTotalMinor, &balance.SettledMinor, &balance.OutstandingMinor,
			&balance.CreatedAt,
		); err != nil {
			return nil, err
		}
		balances = append(balances, balance)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return balances, nil
}

// revenueBreakdownCTE is the shared base for the §14.1 full+ breakdowns: every
// succeeded through-platform payment joined to its order, design and
// collection. "Revenue" is the gross persisted payment amount (§3.2 figures).
const revenueBreakdownCTE = `
	with rev as (
		select o.design_id, d.title as design_title, d.collection_id,
			coalesce(col.name, '') as collection_name, o.flow,
			coalesce(o.delivery_method, '') as method,
			o.order_id, p.amount_minor
		from payments p
		join orders o on o.order_id = p.order_id and o.business_id = p.business_id
		join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		left join collections col on col.collection_id = d.collection_id and col.business_id = o.business_id
		where p.business_id = $1 and p.status = 'succeeded' and p.through_platform
			and ($2::timestamptz is null or p.created_at >= $2) and p.created_at < $3
	)`

//nolint:funlen,gocognit,gocyclo // all breakdown dimensions share one tenant-scoped snapshot and identical row/error handling
func (repo AnalyticsRepository) RevenueBreakdowns(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) (ports.RevenueBreakdowns, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return ports.RevenueBreakdowns{}, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	args := []any{scope.BusinessID.String(), windowLowerArg(window), window.To}
	var out ports.RevenueBreakdowns

	rows, err := tx.Query(ctx, revenueBreakdownCTE+`
		select design_id, design_title, count(distinct order_id) as orders, sum(amount_minor) as revenue
		from rev group by 1, 2 order by revenue desc, design_title
	`, args...)
	if err != nil {
		return ports.RevenueBreakdowns{}, err
	}
	for rows.Next() {
		var row ports.DesignRevenue
		if err := rows.Scan(&row.DesignID, &row.Title, &row.Orders, &row.RevenueMinor); err != nil {
			rows.Close()
			return ports.RevenueBreakdowns{}, err
		}
		out.ByDesign = append(out.ByDesign, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.RevenueBreakdowns{}, err
	}

	rows, err = tx.Query(ctx, revenueBreakdownCTE+`
		select collection_id, collection_name, count(distinct order_id) as orders, sum(amount_minor) as revenue
		from rev group by 1, 2 order by revenue desc, collection_name
	`, args...)
	if err != nil {
		return ports.RevenueBreakdowns{}, err
	}
	for rows.Next() {
		var row ports.CollectionRevenue
		var collectionID *string
		if err := rows.Scan(&collectionID, &row.Name, &row.Orders, &row.RevenueMinor); err != nil {
			rows.Close()
			return ports.RevenueBreakdowns{}, err
		}
		if collectionID != nil {
			id := common.ID(*collectionID)
			row.CollectionID = &id
		}
		out.ByCollection = append(out.ByCollection, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.RevenueBreakdowns{}, err
	}

	rows, err = tx.Query(ctx, revenueBreakdownCTE+`
		select flow, count(distinct order_id) as orders, sum(amount_minor) as revenue
		from rev group by 1 order by revenue desc
	`, args...)
	if err != nil {
		return ports.RevenueBreakdowns{}, err
	}
	for rows.Next() {
		var row ports.FlowRevenue
		if err := rows.Scan(&row.Flow, &row.Orders, &row.RevenueMinor); err != nil {
			rows.Close()
			return ports.RevenueBreakdowns{}, err
		}
		out.ByFlow = append(out.ByFlow, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.RevenueBreakdowns{}, err
	}

	rows, err = tx.Query(ctx, revenueBreakdownCTE+`
		select method, count(distinct order_id) as orders, sum(amount_minor) as revenue
		from rev group by 1 order by revenue desc
	`, args...)
	if err != nil {
		return ports.RevenueBreakdowns{}, err
	}
	for rows.Next() {
		var row ports.FulfilmentRevenue
		if err := rows.Scan(&row.Method, &row.Orders, &row.RevenueMinor); err != nil {
			rows.Close()
			return ports.RevenueBreakdowns{}, err
		}
		out.ByFulfilment = append(out.ByFulfilment, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.RevenueBreakdowns{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.RevenueBreakdowns{}, err
	}
	return out, nil
}

func (repo AnalyticsRepository) DesignPerformance(ctx context.Context, scope common.TenantScope) ([]ports.DesignPerformance, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// Views is the persisted cumulative counter (000107) — read verbatim, never
	// derived. Orders counts paid orders all-time; waitlist demand is current.
	rows, err := tx.Query(ctx, `
		select d.design_id, d.title, d.view_count,
			count(distinct o.order_id) filter (where o.status in ('confirmed', 'fulfilled')) as orders,
			(select count(*) from design_waitlist_entries w
				where w.business_id = d.business_id and w.design_id = d.design_id
					and w.status = 'waiting') as waiting
		from designs d
		left join orders o on o.design_id = d.design_id and o.business_id = d.business_id
		where d.business_id = $1 and d.status = 'active'
		group by d.design_id, d.title, d.view_count
		order by d.view_count desc, orders desc, d.title
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var designs []ports.DesignPerformance
	for rows.Next() {
		var design ports.DesignPerformance
		if err := rows.Scan(&design.DesignID, &design.Title, &design.Views, &design.Orders, &design.WaitingList); err != nil {
			return nil, err
		}
		if design.Views > 0 {
			design.ConversionRate = float64(design.Orders) / float64(design.Views)
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

func (repo AnalyticsRepository) StaffActivity(ctx context.Context, scope common.TenantScope) ([]ports.StaffActivity, error) {
	tx, err := repo.beginScoped(ctx, scope)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// One row per team member; activity rides the §14.1 attribution columns
	// (000109). Pre-000109 rows carry no attribution and appear under nobody.
	rows, err := tx.Query(ctx, `
		select u.business_user_id, u.display_name, u.role, u.is_active,
			(select count(*) from orders o
				where o.business_id = u.business_id
					and o.created_by_business_user_id = u.business_user_id) as orders_created,
			(select count(*) from manual_takings t
				where t.business_id = u.business_id
					and t.logged_by_business_user_id = u.business_user_id) as takings_logged,
			(select coalesce(sum(t.amount_minor), 0) from manual_takings t
				where t.business_id = u.business_id
					and t.logged_by_business_user_id = u.business_user_id) as takings_minor
		from business_users u
		where u.business_id = $1
		order by u.display_name
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var staff []ports.StaffActivity
	for rows.Next() {
		var member ports.StaffActivity
		if err := rows.Scan(
			&member.UserID, &member.DisplayName, &member.Role, &member.IsActive,
			&member.OrdersCreated, &member.TakingsLogged, &member.TakingsMinor,
		); err != nil {
			return nil, err
		}
		staff = append(staff, member)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return staff, nil
}
