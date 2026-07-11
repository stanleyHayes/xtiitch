package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

func (repo OrderRepository) AdvanceStage(ctx context.Context, scope common.TenantScope, orderID common.ID) (order.Tracking, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return order.Tracking{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return order.Tracking{}, err
	}

	var businessID, flow, status string
	var currentSeq sql.NullInt32
	if err := tx.QueryRow(ctx, `
		select o.business_id, o.flow, o.status, st.sequence
		from orders o
		left join stage_templates st on st.stage_id = o.current_stage_id
		where o.order_id = $1
		for update of o
	`, orderID.String()).Scan(&businessID, &flow, &status, &currentSeq); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return order.Tracking{}, ErrNotFound
		}
		return order.Tracking{}, err
	}
	if status != string(order.StatusConfirmed) || !currentSeq.Valid {
		return order.Tracking{}, ports.ErrInvalidOrderState
	}

	if err := advanceOrFulfil(ctx, tx, businessID, flow, orderID, currentSeq.Int32); err != nil {
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

// advanceOrFulfil moves a confirmed order to the next stage in its flow, or — if
// it is already at the final stage — marks it fulfilled and records the intent
// to tell the customer it is ready. It runs inside the AdvanceStage transaction.
func advanceOrFulfil(ctx context.Context, tx pgx.Tx, businessID, flow string, orderID common.ID, currentSeq int32) error {
	var nextStageID string
	nextErr := tx.QueryRow(ctx, `
		select stage_id from stage_templates
		where business_id = $1 and flow = $2 and sequence > $3
		order by sequence limit 1
	`, businessID, flow, currentSeq).Scan(&nextStageID)

	switch {
	case nextErr == nil:
		if _, err := tx.Exec(ctx, `
			update orders set current_stage_id = $2, updated_at = now() where order_id = $1
		`, orderID.String(), nextStageID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			insert into stage_events (event_id, business_id, order_id, stage_id)
			values (gen_random_uuid(), $1, $2, $3)
		`, businessID, orderID.String(), nextStageID); err != nil {
			return err
		}
		// Tell the customer the order reached this stage (per-stage wording,
		// deduped per stage so re-advancing to the same stage is a no-op).
		return enqueueStageAdvanceNotification(ctx, tx, businessID, orderID.String(), nextStageID)
	case errors.Is(nextErr, pgx.ErrNoRows):
		if _, err := tx.Exec(ctx, `
			update orders set status = 'fulfilled', updated_at = now() where order_id = $1
		`, orderID.String()); err != nil {
			return err
		}
		if err := enqueueOrderNotification(ctx, tx, businessID, orderID.String(), notification.KindOrderFulfilled); err != nil {
			return err
		}
		return autoArrangeHandoverOnFulfilment(ctx, tx, businessID, orderID)
	default:
		return nextErr
	}
}

// autoArrangeHandoverOnFulfilment queues the last fulfilment leg for an online
// order the moment it is fulfilled, so the dispatch desk doesn't have to create
// it by hand. It segments by the order's delivery snapshot: an order that chose
// delivery at checkout becomes a 'delivery' handover to its address, everything
// else a 'pickup'. Walk-in/in-person orders are handed over at the counter, so
// they are skipped. It is a no-op when the order already has an open handover
// (e.g. one was arranged manually), so it never collides with that flow.
func autoArrangeHandoverOnFulfilment(ctx context.Context, tx pgx.Tx, businessID string, orderID common.ID) error {
	_, err := tx.Exec(ctx, `
		insert into handovers (
			handover_id, business_id, order_id, method, status,
			recipient_name, recipient_phone, address
		)
		select
			gen_random_uuid(), o.business_id, o.order_id,
			case when o.delivery_method = 'delivery' then 'delivery' else 'pickup' end,
			'pending',
			coalesce(c.display_name, ''),
			coalesce(c.phone, ''),
			case when o.delivery_method = 'delivery' then o.delivery_address else '' end
		from orders o
		left join customers c on c.customer_id = o.customer_id
		where o.order_id = $1 and o.business_id = $2 and o.channel = 'online'
			and not exists (
				select 1 from handovers h
				where h.order_id = o.order_id and h.status in ('pending', 'dispatched')
			)
	`, orderID.String(), businessID)
	return err
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

	tracking, err := loadTrackingByPublicKey(ctx, tx, orderID.String())
	if err != nil {
		return order.Tracking{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return order.Tracking{}, err
	}
	return tracking, nil
}

func loadTrackingByPublicKey(ctx context.Context, tx pgx.Tx, rawKey string) (order.Tracking, error) {
	trackingKey := strings.TrimSpace(rawKey)
	if trackingKey == "" {
		return order.Tracking{}, ErrNotFound
	}

	if isLikelyUUID(trackingKey) {
		tracking, err := loadTracking(ctx, tx, common.ID(trackingKey))
		if err == nil || !errors.Is(err, ErrNotFound) {
			return tracking, err
		}
	}

	orderID, err := lookupOrderIDByProviderReference(ctx, tx, trackingKey)
	if err != nil {
		return order.Tracking{}, err
	}
	return loadTracking(ctx, tx, orderID)
}

func lookupOrderIDByProviderReference(ctx context.Context, tx pgx.Tx, providerReference string) (common.ID, error) {
	var orderID string
	if err := tx.QueryRow(ctx, `
		select order_id::text from payments
		where provider_reference = $1 and order_id is not null
		order by created_at desc
		limit 1
	`, providerReference).Scan(&orderID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return common.ID(orderID), nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
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

	var handover order.HandoverTracking
	if err := tx.QueryRow(ctx, `
		select method, status, recipient_name, recipient_phone, address, courier, note, updated_at
		from handovers
		where order_id = $1
		order by (status in ('pending', 'dispatched')) desc, updated_at desc, created_at desc
		limit 1
	`, orderID.String()).Scan(
		&handover.Method, &handover.Status, &handover.RecipientName, &handover.RecipientPhone,
		&handover.Address, &handover.Courier, &handover.Note, &handover.UpdatedAt,
	); err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return order.Tracking{}, err
		}
	} else {
		tracking.Handover = &handover
	}
	return tracking, nil
}

func isLikelyUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, char := range value {
		switch index {
		case 8, 13, 18, 23:
			if char != '-' {
				return false
			}
		default:
			if (char < '0' || char > '9') &&
				(char < 'a' || char > 'f') &&
				(char < 'A' || char > 'F') {
				return false
			}
		}
	}
	return true
}
