// Package measurementapp manages a business's measurement template and the
// staff-entered values for custom orders that are measured during a visit or in
// the shop.
package measurementapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var (
	ErrInvalidInput             = errors.New("invalid measurement input")
	ErrInvalidMeasurementSource = errors.New("invalid measurement source")
)

const (
	SourceVisit = "visit"
	SourceShop  = "shop"
)

type Service struct {
	measurements ports.MeasurementRepository
	ids          ports.IDGenerator
}

type Dependencies struct {
	Measurements ports.MeasurementRepository
	IDs          ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{measurements: deps.Measurements, ids: deps.IDs}
}

func (s Service) ListFields(ctx context.Context, scope common.TenantScope) ([]ports.BusinessMeasurementField, error) {
	return s.measurements.ListFields(ctx, scope)
}

type CreateFieldCommand struct {
	Scope    common.TenantScope
	Label    string
	Unit     string
	Sequence int
}

func (s Service) CreateField(ctx context.Context, cmd CreateFieldCommand) (ports.BusinessMeasurementField, error) {
	label := strings.TrimSpace(cmd.Label)
	unit := normalizeUnit(cmd.Unit)
	if label == "" || !validUnit(unit) || cmd.Sequence < 0 {
		return ports.BusinessMeasurementField{}, ErrInvalidInput
	}

	return s.measurements.CreateField(ctx, cmd.Scope, ports.CreateMeasurementFieldInput{
		FieldID:    s.ids.NewID(),
		BusinessID: cmd.Scope.BusinessID,
		Label:      label,
		Unit:       unit,
		Sequence:   cmd.Sequence,
	})
}

type UpdateFieldCommand struct {
	Scope    common.TenantScope
	FieldID  common.ID
	Label    *string
	Unit     *string
	Sequence *int
}

func (s Service) UpdateField(ctx context.Context, cmd UpdateFieldCommand) (ports.BusinessMeasurementField, error) {
	if cmd.FieldID == "" || (cmd.Label == nil && cmd.Unit == nil && cmd.Sequence == nil) {
		return ports.BusinessMeasurementField{}, ErrInvalidInput
	}

	input := ports.UpdateMeasurementFieldInput{}
	if cmd.Label != nil {
		label := strings.TrimSpace(*cmd.Label)
		if label == "" {
			return ports.BusinessMeasurementField{}, ErrInvalidInput
		}
		input.Label = &label
	}
	if cmd.Unit != nil {
		unit := normalizeUnit(*cmd.Unit)
		if !validUnit(unit) {
			return ports.BusinessMeasurementField{}, ErrInvalidInput
		}
		input.Unit = &unit
	}
	if cmd.Sequence != nil {
		if *cmd.Sequence < 0 {
			return ports.BusinessMeasurementField{}, ErrInvalidInput
		}
		sequence := *cmd.Sequence
		input.Sequence = &sequence
	}

	return s.measurements.UpdateField(ctx, cmd.Scope, cmd.FieldID, input)
}

func (s Service) DeleteField(ctx context.Context, scope common.TenantScope, fieldID common.ID) error {
	if fieldID == "" {
		return ErrInvalidInput
	}
	return s.measurements.DeleteField(ctx, scope, fieldID)
}

type RecordOrderMeasurementsCommand struct {
	Scope   common.TenantScope
	OrderID common.ID
	Source  string
	Values  map[string]string
}

func (s Service) RecordOrderMeasurements(ctx context.Context, cmd RecordOrderMeasurementsCommand) (ports.OrderMeasurement, error) {
	source := strings.ToLower(strings.TrimSpace(cmd.Source))
	if cmd.OrderID == "" {
		return ports.OrderMeasurement{}, ErrInvalidInput
	}
	if !validStaffSource(source) {
		return ports.OrderMeasurement{}, ErrInvalidMeasurementSource
	}
	values, err := normalizeValues(cmd.Values)
	if err != nil {
		return ports.OrderMeasurement{}, err
	}

	return s.measurements.RecordOrderMeasurements(ctx, cmd.Scope, ports.RecordOrderMeasurementsInput{
		MeasurementID: s.ids.NewID(),
		BusinessID:    cmd.Scope.BusinessID,
		OrderID:       cmd.OrderID,
		Source:        source,
		Values:        values,
	})
}

func normalizeUnit(unit string) string {
	return strings.ToLower(strings.TrimSpace(unit))
}

func validUnit(unit string) bool {
	return unit == "cm" || unit == "in"
}

func validStaffSource(source string) bool {
	return source == SourceVisit || source == SourceShop
}

func normalizeValues(values map[string]string) (map[string]string, error) {
	if len(values) == 0 {
		return nil, ErrInvalidInput
	}
	out := make(map[string]string, len(values))
	for key, value := range values {
		fieldID := strings.TrimSpace(key)
		trimmed := strings.TrimSpace(value)
		if fieldID == "" || trimmed == "" {
			return nil, ErrInvalidInput
		}
		out[fieldID] = trimmed
	}
	return out, nil
}
