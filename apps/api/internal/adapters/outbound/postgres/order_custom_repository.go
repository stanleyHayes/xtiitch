package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
		insert into customers (customer_id, display_name, phone, whatsapp_number, email)
		values ($1, $2, $3, $4, $5)
		on conflict (customer_id) do update
		set display_name = excluded.display_name,
			whatsapp_number = case when excluded.whatsapp_number <> '' then excluded.whatsapp_number else customers.whatsapp_number end,
			email = case when excluded.email <> '' then excluded.email else customers.email end,
			updated_at = now()
	`, input.CustomerID.String(), input.CustomerName, input.CustomerPhone, input.CustomerWhatsApp, input.CustomerEmail); err != nil {
		return err
	}

	// Draft custom order: no stage yet. Stand-alone bespoke orders keep
	// agreed_total_minor empty because the final price is negotiated later; mixed
	// cart bespoke deposit lines set agreed_total_minor to the paid deposit and
	// share the cart's checkout group so the cart webhook can settle them.
	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status,
			checkout_group_id, note
		)
		values ($1, $2, $3, $4, null, 'custom', $5, 'bespoke', 'online', $6, 0, 'draft', $7, $8)
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(),
		input.DesignID.String(), input.SizeMode, nullableInt64Arg(input.AgreedTotalMinor),
		nullableIDArg(input.CheckoutGroupID), input.Note); err != nil {
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
// values for the order (online self-measure route).
func insertOrderMeasurement(ctx context.Context, tx pgx.Tx, scope common.TenantScope, input ports.CreateCustomOrderInput) error {
	return insertOrderMeasurementRow(ctx, tx, scope, measurementRow{
		MeasurementID: input.MeasurementID,
		OrderID:       input.OrderID,
		BusinessID:    input.BusinessID,
		CustomerID:    input.CustomerID,
		Measurements:  input.Measurements,
		Source:        "self",
	})
}

// measurementRow is the tenant-scoped data needed to store a measurement set
// against an order, with its provenance (self/visit/shop — see 000008 CHECK).
type measurementRow struct {
	MeasurementID common.ID
	OrderID       common.ID
	BusinessID    common.ID
	CustomerID    common.ID
	Measurements  map[string]string
	Source        string
}

func insertOrderMeasurementRow(ctx context.Context, tx pgx.Tx, scope common.TenantScope, row measurementRow) error {
	known, err := businessMeasurementFields(ctx, tx, scope.BusinessID)
	if err != nil {
		return err
	}
	for field := range row.Measurements {
		if !known[field] {
			return ports.ErrUnknownMeasurementField
		}
	}

	values, err := json.Marshal(row.Measurements)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		insert into order_measurements (measurement_id, business_id, order_id, customer_id, source, values)
		values ($1, $2, $3, $4, $5, $6::jsonb)
	`, row.MeasurementID.String(), row.BusinessID.String(), row.OrderID.String(),
		row.CustomerID.String(), row.Source, string(values))
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

func (repo OrderRepository) CreateCustomOrderConfirmed(
	ctx context.Context,
	scope common.TenantScope,
	input ports.CreateCustomOrderConfirmedInput,
) error {
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
		insert into customers (customer_id, display_name, phone, whatsapp_number, email)
		values ($1, $2, $3, $4, $5)
		on conflict (customer_id) do update
		set display_name = excluded.display_name,
			whatsapp_number = case when excluded.whatsapp_number <> '' then excluded.whatsapp_number else customers.whatsapp_number end,
			email = case when excluded.email <> '' then excluded.email else customers.email end,
			updated_at = now()
	`, input.CustomerID.String(), input.CustomerName, input.CustomerPhone, input.CustomerWhatsApp, input.CustomerEmail); err != nil {
		return err
	}

	channel := input.Channel
	if channel == "" {
		channel = "online"
	}

	// Come-to-shop: nothing is paid online, so the order is confirmed at its
	// first bespoke stage immediately (mirrors the walk-in writer, bespoke flow).
	if _, err := tx.Exec(ctx, `
		insert into orders (
			order_id, business_id, customer_id, design_id, size_band_id,
			order_type, size_mode, flow, channel, agreed_total_minor, settled_minor,
			status, current_stage_id
		)
		values ($1, $2, $3, $4, null, 'custom', $5, 'bespoke', $6, null, 0, 'confirmed', $7)
	`, input.OrderID.String(), input.BusinessID.String(), input.CustomerID.String(),
		input.DesignID.String(), input.SizeMode, channel, stageID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into stage_events (event_id, business_id, order_id, stage_id)
		values (gen_random_uuid(), $1, $2, $3)
	`, input.BusinessID.String(), input.OrderID.String(), stageID); err != nil {
		return err
	}

	// Staff may have measured the customer at the counter; store it (source
	// 'shop'). Validated against the business's own measurement fields.
	if input.MeasurementID != "" && len(input.Measurements) > 0 {
		if err := insertOrderMeasurementRow(ctx, tx, scope, measurementRow{
			MeasurementID: input.MeasurementID,
			OrderID:       input.OrderID,
			BusinessID:    input.BusinessID,
			CustomerID:    input.CustomerID,
			Measurements:  input.Measurements,
			Source:        "shop",
		}); err != nil {
			return err
		}
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
	// Only a freshly-created customer (created for this very order) is removed on
	// rollback; a customer resolved from an earlier order is shared and is left
	// alone (the caller passes a zero id for that case).
	if customerID != "" {
		if _, err := tx.Exec(ctx, `
			delete from customers where customer_id = $1
		`, customerID.String()); err != nil {
			return err
		}
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
