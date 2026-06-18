package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
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

func (repo OrderRepository) CreateOnlineOrder(ctx context.Context, scope common.TenantScope, input ports.CreateOnlineOrderInput) error {
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

	// Draft: no stage yet. The payment webhook confirms it at the first stage.
	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status
		)
		values ($1, $2, $3, $4, $5, 'standard', 'band', 'ready_made', 'online', $6, 0, 'draft')
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(), input.DesignID.String(),
		nullableIDArg(input.SizeBandID), input.AgreedTotalMinor); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) DiscardDraftOrder(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Only ever remove a still-draft order of this tenant; a confirmed order (or
	// one in another tenant, walled off by RLS) is left untouched. The customer
	// row was created solely for this order, so it goes too — deleting the order
	// first satisfies the orders -> customers foreign key.
	if _, err := tx.Exec(ctx, `
		delete from orders where order_id = $1 and business_id = $2 and status = 'draft'
	`, orderID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		delete from customers where customer_id = $1
	`, customerID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) SetDraftOrderAgreedTotal(
	ctx context.Context,
	scope common.TenantScope,
	orderID common.ID,
	agreedTotalMinor int64,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update orders
		set agreed_total_minor = $3, updated_at = now()
		where order_id = $1 and business_id = $2
			and order_type = 'standard' and status = 'draft'
	`, orderID.String(), scope.BusinessID.String(), agreedTotalMinor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrInvalidOrderState
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) CreateCustomOrder(ctx context.Context, scope common.TenantScope, input ports.CreateCustomOrderInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Fail fast if the business has no bespoke stages: otherwise the deposit
	// could succeed while the webhook is unable to confirm the order (it would
	// find no first stage), stranding paid money against a stuck draft.
	if err := assertBespokeStageExists(ctx, tx, scope.BusinessID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, display_name, phone, email)
		values ($1, $2, $3, $4)
	`, input.CustomerID.String(), input.CustomerName, input.CustomerPhone, input.CustomerEmail); err != nil {
		return err
	}

	// Draft custom order: no stage yet, no agreed total yet (bespoke pricing is
	// settled later). The deposit webhook confirms it at the first bespoke stage.
	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status
		)
		values ($1, $2, $3, $4, null, 'custom', $5, 'bespoke', 'online', null, 0, 'draft')
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(),
		input.DesignID.String(), input.SizeMode); err != nil {
		return err
	}

	if input.MeasurementID != "" {
		if err := insertOrderMeasurement(ctx, tx, scope, input); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// insertOrderMeasurement validates the submitted keys against the business's own
// measurement fields (fail closed on any stray key) and records the self-measure
// values for the order.
func insertOrderMeasurement(ctx context.Context, tx pgx.Tx, scope common.TenantScope, input ports.CreateCustomOrderInput) error {
	known, err := businessMeasurementFields(ctx, tx, scope.BusinessID)
	if err != nil {
		return err
	}
	for field := range input.Measurements {
		if !known[field] {
			return ports.ErrUnknownMeasurementField
		}
	}

	values, err := json.Marshal(input.Measurements)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		insert into order_measurements (measurement_id, business_id, order_id, customer_id, source, values)
		values ($1, $2, $3, $4, 'self', $5::jsonb)
	`, input.MeasurementID.String(), input.BusinessID.String(), input.OrderID.String(),
		input.CustomerID.String(), string(values))
	return err
}

func businessMeasurementFields(ctx context.Context, tx pgx.Tx, businessID common.ID) (map[string]bool, error) {
	rows, err := tx.Query(ctx, `select field_id::text from measurement_fields where business_id = $1`, businessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	known := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		known[id] = true
	}
	return known, rows.Err()
}

func assertBespokeStageExists(ctx context.Context, tx pgx.Tx, businessID common.ID) error {
	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists(select 1 from stage_templates where business_id = $1 and flow = 'bespoke')
	`, businessID.String()).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errors.New("no bespoke stages configured for business")
	}
	return nil
}

func (repo OrderRepository) CreateCustomOrderConfirmed(ctx context.Context, scope common.TenantScope, input ports.CreateCustomOrderConfirmedInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	var stageID string
	if err := tx.QueryRow(ctx, `
		select stage_id from stage_templates
		where business_id = $1 and flow = 'bespoke'
		order by sequence limit 1
	`, scope.BusinessID.String()).Scan(&stageID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("no bespoke stages configured for business")
		}
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, display_name, phone, email)
		values ($1, $2, $3, $4)
	`, input.CustomerID.String(), input.CustomerName, input.CustomerPhone, input.CustomerEmail); err != nil {
		return err
	}

	// Come-to-shop: nothing is paid online, so the order is confirmed at its
	// first bespoke stage immediately (mirrors the walk-in writer, bespoke flow).
	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor,
			status, current_stage_id
		)
		values ($1, $2, $3, $4, null, 'custom', $5, 'bespoke', 'online', null, 0, 'confirmed', $6)
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(),
		input.DesignID.String(), input.SizeMode, stageID); err != nil {
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

func (repo OrderRepository) DiscardCustomDraftOrder(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Remove the measurement first (it references the order), then the still-draft
	// order, then the customer created with it. All tenant-scoped; a confirmed
	// order is never touched.
	if _, err := tx.Exec(ctx, `
		delete from order_measurements where order_id = $1 and business_id = $2
	`, orderID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		delete from orders where order_id = $1 and business_id = $2 and status = 'draft'
	`, orderID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		delete from customers where customer_id = $1
	`, customerID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) SetAgreedTotal(ctx context.Context, scope common.TenantScope, orderID common.ID, agreedTotalMinor int64) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Only a confirmed custom order can have its negotiated total set, and never
	// below what the customer has already settled (which would imply a refund).
	// Refuse to re-price while a balance charge is in flight: the in-flight
	// charge was snapshotted against the current agreed total, so changing it now
	// would let the cap swallow (or inflate) the customer's payment.
	tag, err := tx.Exec(ctx, `
		update orders
		set agreed_total_minor = $3, updated_at = now()
		where order_id = $1 and business_id = $2
			and order_type = 'custom' and status = 'confirmed'
			and $3 >= settled_minor
			and not exists(
				select 1 from payments p
				where p.order_id = orders.order_id and p.business_id = orders.business_id
					and p.purpose = 'balance' and p.status = 'initiated'
			)
	`, orderID.String(), scope.BusinessID.String(), agreedTotalMinor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrInvalidOrderState
	}

	return tx.Commit(ctx)
}

func (repo OrderRepository) GetOrderBilling(ctx context.Context, scope common.TenantScope, orderID common.ID) (ports.OrderBilling, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.OrderBilling{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.OrderBilling{}, err
	}

	var billing ports.OrderBilling
	var agreed sql.NullInt64
	if err := tx.QueryRow(ctx, `
		select o.order_type, o.status, o.agreed_total_minor, o.settled_minor, coalesce(c.email, ''),
			exists(
				select 1 from payments p
				where p.order_id = o.order_id and p.business_id = o.business_id
					and p.purpose = 'balance' and p.status = 'initiated'
			)
		from orders o
		left join customers c on c.customer_id = o.customer_id
		where o.order_id = $1 and o.business_id = $2
	`, orderID.String(), scope.BusinessID.String()).Scan(
		&billing.OrderType, &billing.Status, &agreed, &billing.SettledMinor, &billing.CustomerEmail, &billing.BalanceInFlight,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.OrderBilling{}, ErrNotFound
		}
		return ports.OrderBilling{}, err
	}
	if agreed.Valid {
		value := agreed.Int64
		billing.AgreedTotalMinor = &value
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.OrderBilling{}, err
	}
	return billing, nil
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
		select o.order_id, d.title, coalesce(c.display_name, ''),
			coalesce(c.phone, ''), coalesce(c.email, ''), o.status, o.order_type,
			o.size_mode, o.channel, coalesce(st.name, ''), coalesce(st.colour, 'red'),
			o.agreed_total_minor, o.settled_minor, coalesce(p.status, 'none'),
			coalesce(p.purpose, ''), p.amount_minor, o.created_at
		from orders o
		join designs d on d.design_id = o.design_id
		left join customers c on c.customer_id = o.customer_id
		left join stage_templates st on st.stage_id = o.current_stage_id
		left join lateral (
			select status, purpose, amount_minor
			from payments p
			where p.business_id = o.business_id and p.order_id = o.order_id
			order by p.created_at desc
			limit 1
		) p on true
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
		var total, paymentAmount sql.NullInt64
		if err := rows.Scan(&summary.OrderID, &summary.DesignTitle, &summary.CustomerName,
			&summary.CustomerPhone, &summary.CustomerEmail, &summary.Status, &summary.OrderType,
			&summary.SizeMode, &summary.Channel, &summary.StageName, &summary.Colour, &total,
			&summary.SettledMinor, &summary.PaymentStatus, &summary.PaymentPurpose, &paymentAmount,
			&summary.CreatedAt); err != nil {
			return nil, err
		}
		if total.Valid {
			value := total.Int64
			summary.AgreedTotalMinor = &value
		}
		if paymentAmount.Valid {
			value := paymentAmount.Int64
			summary.PaymentAmount = &value
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

	var businessID, flow, status string
	var currentSeq sql.NullInt32
	if err := tx.QueryRow(ctx, `
		select o.business_id, o.flow, o.status, st.sequence
		from orders o
		left join stage_templates st on st.stage_id = o.current_stage_id
		where o.order_id = $1
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
		_, err := tx.Exec(ctx, `
			insert into stage_events (event_id, business_id, order_id, stage_id)
			values (gen_random_uuid(), $1, $2, $3)
		`, businessID, orderID.String(), nextStageID)
		return err
	case errors.Is(nextErr, pgx.ErrNoRows):
		if _, err := tx.Exec(ctx, `
			update orders set status = 'fulfilled', updated_at = now() where order_id = $1
		`, orderID.String()); err != nil {
			return err
		}
		return enqueueOrderNotification(ctx, tx, businessID, orderID.String(), notification.KindOrderFulfilled)
	default:
		return nextErr
	}
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
			if !((char >= '0' && char <= '9') ||
				(char >= 'a' && char <= 'f') ||
				(char >= 'A' && char <= 'F')) {
				return false
			}
		}
	}
	return true
}
