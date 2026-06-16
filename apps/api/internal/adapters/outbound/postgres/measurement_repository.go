package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

type MeasurementRepository struct {
	pool *pgxpool.Pool
}

func NewMeasurementRepository(pool *pgxpool.Pool) MeasurementRepository {
	return MeasurementRepository{pool: pool}
}

func (repo MeasurementRepository) ListFields(ctx context.Context, scope common.TenantScope) ([]ports.BusinessMeasurementField, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select field_id::text, label, unit, sequence, created_at, updated_at
		from measurement_fields
		where business_id = $1
		order by sequence, label
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fields []ports.BusinessMeasurementField
	for rows.Next() {
		var field ports.BusinessMeasurementField
		if err := rows.Scan(&field.FieldID, &field.Label, &field.Unit, &field.Sequence, &field.CreatedAt, &field.UpdatedAt); err != nil {
			return nil, err
		}
		fields = append(fields, field)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return fields, nil
}

func (repo MeasurementRepository) CreateField(ctx context.Context, scope common.TenantScope, input ports.CreateMeasurementFieldInput) (ports.BusinessMeasurementField, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessMeasurementField{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessMeasurementField{}, err
	}

	field, err := scanMeasurementField(tx.QueryRow(ctx, `
		insert into measurement_fields (field_id, business_id, label, unit, sequence)
		values ($1, $2, $3, $4, $5)
		returning field_id::text, label, unit, sequence, created_at, updated_at
	`, input.FieldID.String(), input.BusinessID.String(), input.Label, input.Unit, input.Sequence))
	if err != nil {
		if measurementSequenceTaken(err) {
			return ports.BusinessMeasurementField{}, ports.ErrMeasurementSequenceTaken
		}
		return ports.BusinessMeasurementField{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessMeasurementField{}, err
	}
	return field, nil
}

func (repo MeasurementRepository) UpdateField(ctx context.Context, scope common.TenantScope, fieldID common.ID, input ports.UpdateMeasurementFieldInput) (ports.BusinessMeasurementField, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessMeasurementField{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessMeasurementField{}, err
	}

	field, err := scanMeasurementField(tx.QueryRow(ctx, `
		update measurement_fields
		set label = coalesce($3, label),
			unit = coalesce($4, unit),
			sequence = coalesce($5, sequence),
			updated_at = now()
		where field_id = $1 and business_id = $2
		returning field_id::text, label, unit, sequence, created_at, updated_at
	`, fieldID.String(), scope.BusinessID.String(), nullableStringArg(input.Label), nullableStringArg(input.Unit), nullableIntArg(input.Sequence)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessMeasurementField{}, ports.ErrNotFound
		}
		if measurementSequenceTaken(err) {
			return ports.BusinessMeasurementField{}, ports.ErrMeasurementSequenceTaken
		}
		return ports.BusinessMeasurementField{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessMeasurementField{}, err
	}
	return field, nil
}

func (repo MeasurementRepository) DeleteField(ctx context.Context, scope common.TenantScope, fieldID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		delete from measurement_fields where field_id = $1 and business_id = $2
	`, fieldID.String(), scope.BusinessID.String())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrNotFound
	}

	return tx.Commit(ctx)
}

func (repo MeasurementRepository) RecordOrderMeasurements(ctx context.Context, scope common.TenantScope, input ports.RecordOrderMeasurementsInput) (ports.OrderMeasurement, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.OrderMeasurement{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.OrderMeasurement{}, err
	}

	customerID, err := assertMeasurementRoute(ctx, tx, scope, input.OrderID, input.Source)
	if err != nil {
		return ports.OrderMeasurement{}, err
	}
	if err := assertKnownMeasurementFields(ctx, tx, scope.BusinessID, input.Values); err != nil {
		return ports.OrderMeasurement{}, err
	}

	values, err := json.Marshal(input.Values)
	if err != nil {
		return ports.OrderMeasurement{}, err
	}

	measurement, err := scanOrderMeasurement(tx.QueryRow(ctx, `
		insert into order_measurements (measurement_id, business_id, order_id, customer_id, source, values)
		values ($1, $2, $3, $4, $5, $6::jsonb)
		on conflict (order_id) do update
		set customer_id = excluded.customer_id,
			source = excluded.source,
			values = excluded.values,
			updated_at = now()
		where order_measurements.business_id = excluded.business_id
		returning measurement_id::text, order_id::text, customer_id::text, source, values, created_at, updated_at
	`, input.MeasurementID.String(), input.BusinessID.String(), input.OrderID.String(), customerID.String(), input.Source, string(values)))
	if err != nil {
		return ports.OrderMeasurement{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.OrderMeasurement{}, err
	}
	return measurement, nil
}

func scanMeasurementField(row pgx.Row) (ports.BusinessMeasurementField, error) {
	var field ports.BusinessMeasurementField
	err := row.Scan(&field.FieldID, &field.Label, &field.Unit, &field.Sequence, &field.CreatedAt, &field.UpdatedAt)
	return field, err
}

func scanOrderMeasurement(row pgx.Row) (ports.OrderMeasurement, error) {
	var measurement ports.OrderMeasurement
	var rawValues []byte
	if err := row.Scan(
		&measurement.MeasurementID,
		&measurement.OrderID,
		&measurement.CustomerID,
		&measurement.Source,
		&rawValues,
		&measurement.CreatedAt,
		&measurement.UpdatedAt,
	); err != nil {
		return ports.OrderMeasurement{}, err
	}
	if err := json.Unmarshal(rawValues, &measurement.Values); err != nil {
		return ports.OrderMeasurement{}, err
	}
	return measurement, nil
}

func assertMeasurementRoute(ctx context.Context, tx pgx.Tx, scope common.TenantScope, orderID common.ID, source string) (common.ID, error) {
	var customerID common.ID
	var orderType, sizeMode, status string
	if err := tx.QueryRow(ctx, `
		select customer_id::text, order_type, size_mode, status
		from orders
		where order_id = $1 and business_id = $2
	`, orderID.String(), scope.BusinessID.String()).Scan(&customerID, &orderType, &sizeMode, &status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ports.ErrNotFound
		}
		return "", err
	}
	if orderType != string(order.TypeCustom) || status != string(order.StatusConfirmed) {
		return "", ports.ErrInvalidOrderState
	}
	if source == "visit" && sizeMode != "home_visit" {
		return "", ports.ErrInvalidOrderState
	}
	if source == "shop" && sizeMode != "come_to_shop" {
		return "", ports.ErrInvalidOrderState
	}
	return customerID, nil
}

func assertKnownMeasurementFields(ctx context.Context, tx pgx.Tx, businessID common.ID, values map[string]string) error {
	known, err := businessMeasurementFields(ctx, tx, businessID)
	if err != nil {
		return err
	}
	for fieldID := range values {
		if !known[fieldID] {
			return ports.ErrUnknownMeasurementField
		}
	}
	return nil
}

func measurementSequenceTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "measurement_fields_business_seq_idx"
}

func nullableStringArg(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableIntArg(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}
