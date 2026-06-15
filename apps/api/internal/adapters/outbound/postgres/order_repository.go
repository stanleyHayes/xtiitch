package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

type OrderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) OrderRepository {
	return OrderRepository{pool: pool}
}

func (repo OrderRepository) CreateWalkInOrder(ctx context.Context, scope common.TenantScope, input ports.CreateWalkInOrderInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, display_name, phone, email)
		values ($1, $2, $3, $4)
	`, input.CustomerID.String(), input.CustomerName, input.CustomerPhone, input.CustomerEmail); err != nil {
		return err
	}

	var stageID string
	if err := tx.QueryRow(ctx, `
		select stage_id from stage_templates
		where business_id = $1 and flow = 'ready_made'
		order by sequence limit 1
	`, scope.BusinessID.String()).Scan(&stageID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("no production stages configured for business")
		}
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor,
			status, current_stage_id
		)
		values ($1, $2, $3, $4, $5, 'standard', 'band', 'ready_made', 'walk_in', $6, 0, 'confirmed', $7)
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(), input.DesignID.String(),
		nullableIDArg(input.SizeBandID), nullableInt64Arg(input.AgreedTotalMinor), stageID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into stage_events (event_id, business_id, order_id, stage_id)
		values (gen_random_uuid(), $1, $2, $3)
	`, input.BusinessID.String(), input.OrderID.String(), stageID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) ListOrders(ctx context.Context, scope common.TenantScope) ([]ports.OrderSummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select o.order_id, d.title, coalesce(c.display_name, ''), o.status,
			coalesce(st.name, ''), coalesce(st.colour, 'red'), o.agreed_total_minor
		from orders o
		join designs d on d.design_id = o.design_id
		left join customers c on c.customer_id = o.customer_id
		left join stage_templates st on st.stage_id = o.current_stage_id
		where o.business_id = $1
		order by o.created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []ports.OrderSummary
	for rows.Next() {
		var summary ports.OrderSummary
		var total sql.NullInt64
		if err := rows.Scan(&summary.OrderID, &summary.DesignTitle, &summary.CustomerName,
			&summary.Status, &summary.StageName, &summary.Colour, &total); err != nil {
			return nil, err
		}
		if total.Valid {
			value := total.Int64
			summary.AgreedTotalMinor = &value
		}
		summaries = append(summaries, summary)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return summaries, nil
}

func (repo OrderRepository) AdvanceStage(ctx context.Context, scope common.TenantScope, orderID common.ID) (order.Tracking, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return order.Tracking{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return order.Tracking{}, err
	}

	var businessID, flow string
	var currentSeq sql.NullInt32
	if err := tx.QueryRow(ctx, `
		select o.business_id, o.flow, st.sequence
		from orders o
		left join stage_templates st on st.stage_id = o.current_stage_id
		where o.order_id = $1
	`, orderID.String()).Scan(&businessID, &flow, &currentSeq); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return order.Tracking{}, ErrNotFound
		}
		return order.Tracking{}, err
	}

	// Find the next stage in this flow; if there is none, the order is at its
	// final (green) stage and becomes fulfilled.
	var nextStageID string
	nextErr := tx.QueryRow(ctx, `
		select stage_id from stage_templates
		where business_id = $1 and flow = $2 and sequence > $3
		order by sequence limit 1
	`, businessID, flow, currentSeq.Int32).Scan(&nextStageID)

	switch {
	case nextErr == nil:
		if _, err := tx.Exec(ctx, `
			update orders set current_stage_id = $2, updated_at = now() where order_id = $1
		`, orderID.String(), nextStageID); err != nil {
			return order.Tracking{}, err
		}
		if _, err := tx.Exec(ctx, `
			insert into stage_events (event_id, business_id, order_id, stage_id)
			values (gen_random_uuid(), $1, $2, $3)
		`, businessID, orderID.String(), nextStageID); err != nil {
			return order.Tracking{}, err
		}
	case errors.Is(nextErr, pgx.ErrNoRows):
		if _, err := tx.Exec(ctx, `
			update orders set status = 'fulfilled', updated_at = now() where order_id = $1
		`, orderID.String()); err != nil {
			return order.Tracking{}, err
		}
	default:
		return order.Tracking{}, nextErr
	}

	tracking, err := loadTracking(ctx, tx, orderID)
	if err != nil {
		return order.Tracking{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return order.Tracking{}, err
	}
	return tracking, nil
}

func (repo OrderRepository) GetTracking(ctx context.Context, orderID common.ID) (order.Tracking, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return order.Tracking{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return order.Tracking{}, err
	}

	tracking, err := loadTracking(ctx, tx, orderID)
	if err != nil {
		return order.Tracking{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return order.Tracking{}, err
	}
	return tracking, nil
}

func loadTracking(ctx context.Context, tx pgx.Tx, orderID common.ID) (order.Tracking, error) {
	var tracking order.Tracking
	var businessID, flow, status, stageName, colour string
	var currentSeq sql.NullInt32
	if err := tx.QueryRow(ctx, `
		select o.order_id, o.business_id, o.flow, o.status, d.title, b.name,
			coalesce(st.name, ''), coalesce(st.colour, 'red'), st.sequence
		from orders o
		join designs d on d.design_id = o.design_id
		join businesses b on b.business_id = o.business_id
		left join stage_templates st on st.stage_id = o.current_stage_id
		where o.order_id = $1
	`, orderID.String()).Scan(
		&tracking.OrderID, &businessID, &flow, &status, &tracking.DesignTitle, &tracking.StoreName,
		&stageName, &colour, &currentSeq,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return order.Tracking{}, ErrNotFound
		}
		return order.Tracking{}, err
	}
	tracking.Status = order.Status(status)
	tracking.StageName = stageName
	tracking.Colour = order.Colour(colour)

	rows, err := tx.Query(ctx, `
		select name, colour, sequence from stage_templates
		where business_id = $1 and flow = $2 order by sequence
	`, businessID, flow)
	if err != nil {
		return order.Tracking{}, err
	}
	defer rows.Close()

	fulfilled := tracking.Status == order.StatusFulfilled
	for rows.Next() {
		var stage order.Stage
		var stageColour string
		if err := rows.Scan(&stage.Name, &stageColour, &stage.Sequence); err != nil {
			return order.Tracking{}, err
		}
		stage.Colour = order.Colour(stageColour)
		stage.Flow = order.Flow(flow)
		if currentSeq.Valid {
			stage.IsCurrent = !fulfilled && stage.Sequence == int(currentSeq.Int32)
			stage.IsComplete = fulfilled || stage.Sequence < int(currentSeq.Int32)
		}
		tracking.Stages = append(tracking.Stages, stage)
	}
	if err := rows.Err(); err != nil {
		return order.Tracking{}, err
	}
	return tracking, nil
}
