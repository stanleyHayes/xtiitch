package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

type DeliveryRepository struct {
	pool *pgxpool.Pool
}

func NewDeliveryRepository(pool *pgxpool.Pool) DeliveryRepository {
	return DeliveryRepository{pool: pool}
}

func (repo DeliveryRepository) ArrangeHandover(ctx context.Context, scope common.TenantScope, input ports.ArrangeHandoverInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// A handover is only arranged once production is done. Read the order under
	// the tenant scope: not visible (or absent) is a clean not-found; visible but
	// not yet fulfilled is an invalid state.
	var status string
	if err := tx.QueryRow(ctx, `
		select status from orders where order_id = $1 and business_id = $2
	`, input.OrderID.String(), scope.BusinessID.String()).Scan(&status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.ErrNotFound
		}
		return err
	}
	if status != string(order.StatusFulfilled) {
		return ports.ErrInvalidOrderState
	}

	// The partial unique index over pending/dispatched rows makes a second open
	// handover for the same order impossible.
	if _, err := tx.Exec(ctx, `
		insert into handovers (handover_id, business_id, order_id, method, status,
			recipient_name, recipient_phone, address, courier, note)
		values ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
	`, input.HandoverID.String(), scope.BusinessID.String(), input.OrderID.String(), string(input.Method),
		input.RecipientName, input.RecipientPhone, input.Address, input.Courier, input.Note); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "handovers_one_open_idx" {
			return ports.ErrHandoverInProgress
		}
		return err
	}

	return tx.Commit(ctx)
}

func (repo DeliveryRepository) ListHandovers(ctx context.Context, scope common.TenantScope) ([]ports.HandoverSummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	// Open handovers (pending/dispatched) first, then most-recently arranged. The
	// customer and design come from the handover's order.
	rows, err := tx.Query(ctx, `
		select h.handover_id, h.order_id, coalesce(c.display_name, ''), coalesce(c.phone, ''),
			coalesce(d.title, ''), h.method, h.status, h.recipient_name, h.recipient_phone,
			h.address, h.courier, h.note, h.created_at
		from handovers h
		left join orders o on o.order_id = h.order_id
		left join customers c on c.customer_id = o.customer_id
		left join designs d on d.design_id = o.design_id
		where h.business_id = $1
		order by (h.status in ('pending', 'dispatched')) desc, h.created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []ports.HandoverSummary
	for rows.Next() {
		var s ports.HandoverSummary
		if err := rows.Scan(&s.HandoverID, &s.OrderID, &s.CustomerName, &s.CustomerPhone, &s.DesignTitle,
			&s.Method, &s.Status, &s.RecipientName, &s.RecipientPhone, &s.Address, &s.Courier, &s.Note, &s.CreatedAt); err != nil {
			return nil, err
		}
		summaries = append(summaries, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return summaries, nil
}

func (repo DeliveryRepository) GetHandover(ctx context.Context, scope common.TenantScope, handoverID common.ID) (ports.HandoverState, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.HandoverState{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.HandoverState{}, err
	}

	var method, status string
	if err := tx.QueryRow(ctx, `
		select method, status from handovers where handover_id = $1 and business_id = $2
	`, handoverID.String(), scope.BusinessID.String()).Scan(&method, &status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.HandoverState{}, ports.ErrNotFound
		}
		return ports.HandoverState{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.HandoverState{}, err
	}
	return ports.HandoverState{Method: delivery.Method(method), Status: delivery.Status(status)}, nil
}

func (repo DeliveryRepository) SetHandoverStatus(ctx context.Context, scope common.TenantScope, input ports.SetHandoverStatusInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Guard on the current status: a concurrent change leaves the row untouched
	// (0 rows), which surfaces as not-found — the expected from-state is gone. An
	// empty courier/note leaves the stored value unchanged.
	tag, err := tx.Exec(ctx, `
		update handovers
		set status = $3, updated_at = now(),
			courier = case when $4 = '' then courier else $4 end,
			note = case when $5 = '' then note else $5 end
		where handover_id = $1 and business_id = $2 and status = $6
	`, input.HandoverID.String(), scope.BusinessID.String(), string(input.To),
		input.Courier, input.Note, string(input.From))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrNotFound
	}

	return tx.Commit(ctx)
}
