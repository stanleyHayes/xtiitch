package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type MeasurementRepository interface {
	ListFields(ctx context.Context, scope common.TenantScope) ([]BusinessMeasurementField, error)
	CreateField(ctx context.Context, scope common.TenantScope, input CreateMeasurementFieldInput) (BusinessMeasurementField, error)
	UpdateField(
		ctx context.Context,
		scope common.TenantScope,
		fieldID common.ID,
		input UpdateMeasurementFieldInput,
	) (BusinessMeasurementField, error)
	DeleteField(ctx context.Context, scope common.TenantScope, fieldID common.ID) error
	RecordOrderMeasurements(ctx context.Context, scope common.TenantScope, input RecordOrderMeasurementsInput) (OrderMeasurement, error)
}

type BusinessMeasurementField struct {
	FieldID   common.ID
	Label     string
	Unit      string
	Sequence  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

type CreateMeasurementFieldInput struct {
	FieldID    common.ID
	BusinessID common.ID
	Label      string
	Unit       string
	Sequence   int
}

type UpdateMeasurementFieldInput struct {
	Label    *string
	Unit     *string
	Sequence *int
}

type RecordOrderMeasurementsInput struct {
	MeasurementID common.ID
	BusinessID    common.ID
	OrderID       common.ID
	Source        string
	Values        map[string]string
}

type OrderMeasurement struct {
	MeasurementID common.ID
	OrderID       common.ID
	CustomerID    common.ID
	Source        string
	Values        map[string]string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
