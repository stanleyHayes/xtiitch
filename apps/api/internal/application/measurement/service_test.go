package measurementapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestCreateFieldNormalizesAndAssignsID(t *testing.T) {
	t.Parallel()

	repo := &fakeMeasurementRepo{}
	service := NewService(Dependencies{Measurements: repo, IDs: &seqIDs{ids: []common.ID{"field-1"}}})

	field, err := service.CreateField(context.Background(), CreateFieldCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleOwner,
		Label:     "  Chest  ",
		Unit:      " IN ",
		Sequence:  3,
	})
	if err != nil {
		t.Fatalf("create field: %v", err)
	}
	if field.FieldID != "field-1" || repo.created.Label != "Chest" || repo.created.Unit != "in" || repo.created.Sequence != 3 {
		t.Fatalf("unexpected create input/result: input=%+v field=%+v", repo.created, field)
	}
	if repo.created.BusinessID != "b1" {
		t.Fatalf("expected scoped business id, got %q", repo.created.BusinessID)
	}
}

func TestCreateFieldRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	cases := []CreateFieldCommand{
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, Label: " ", Unit: "cm"},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, Label: "Chest", Unit: "yards"},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, Label: "Chest", Unit: "cm", Sequence: -1},
	}
	for _, cmd := range cases {
		svc := NewService(Dependencies{Measurements: &fakeMeasurementRepo{}, IDs: &seqIDs{ids: []common.ID{"field-1"}}})
		if _, err := svc.CreateField(context.Background(), cmd); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("expected invalid input for %+v, got %v", cmd, err)
		}
	}
}

func TestUpdateFieldNormalizesPartialPatch(t *testing.T) {
	t.Parallel()

	repo := &fakeMeasurementRepo{}
	service := NewService(Dependencies{Measurements: repo, IDs: &seqIDs{}})
	sequence := 4
	label := "  Waist  "
	unit := " CM "

	field, err := service.UpdateField(context.Background(), UpdateFieldCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleAdmin,
		FieldID:   "field-1",
		Label:     &label,
		Unit:      &unit,
		Sequence:  &sequence,
	})
	if err != nil {
		t.Fatalf("update field: %v", err)
	}
	if field.FieldID != "field-1" || *repo.updated.Label != "Waist" || *repo.updated.Unit != "cm" || *repo.updated.Sequence != 4 {
		t.Fatalf("unexpected update input/result: input=%+v field=%+v", repo.updated, field)
	}
}

func TestUpdateFieldRejectsEmptyOrInvalidPatch(t *testing.T) {
	t.Parallel()

	blank := " "
	badUnit := "mm"
	negative := -1
	cases := []UpdateFieldCommand{
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, FieldID: ""},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, FieldID: "field-1"},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, FieldID: "field-1", Label: &blank},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, FieldID: "field-1", Unit: &badUnit},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, FieldID: "field-1", Sequence: &negative},
	}
	for _, cmd := range cases {
		svc := NewService(Dependencies{Measurements: &fakeMeasurementRepo{}, IDs: &seqIDs{}})
		if _, err := svc.UpdateField(context.Background(), cmd); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("expected invalid input for %+v, got %v", cmd, err)
		}
	}
}

func TestMeasurementTemplateManagementRequiresOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{Measurements: &fakeMeasurementRepo{}, IDs: &seqIDs{ids: []common.ID{"field-1"}}})
	if _, err := service.CreateField(context.Background(), CreateFieldCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleStaff,
		Label:     "Chest",
		Unit:      "cm",
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff create to be forbidden, got %v", err)
	}

	label := "Chest"
	if _, err := service.UpdateField(context.Background(), UpdateFieldCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleStaff,
		FieldID:   "field-1",
		Label:     &label,
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff update to be forbidden, got %v", err)
	}

	if err := service.DeleteField(context.Background(), DeleteFieldCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleStaff,
		FieldID:   "field-1",
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff delete to be forbidden, got %v", err)
	}
}

func TestRecordOrderMeasurementsNormalizesValuesAndAssignsID(t *testing.T) {
	t.Parallel()

	repo := &fakeMeasurementRepo{}
	service := NewService(Dependencies{Measurements: repo, IDs: &seqIDs{ids: []common.ID{"measurement-1"}}})

	measurement, err := service.RecordOrderMeasurements(context.Background(), RecordOrderMeasurementsCommand{
		Scope:   common.TenantScope{BusinessID: "b1"},
		OrderID: "order-1",
		Source:  " VISIT ",
		Values:  map[string]string{" field-1 ": " 41 "},
	})
	if err != nil {
		t.Fatalf("record measurements: %v", err)
	}
	if measurement.MeasurementID != "measurement-1" || repo.recorded.BusinessID != "b1" || repo.recorded.OrderID != "order-1" {
		t.Fatalf("unexpected record input/result: input=%+v measurement=%+v", repo.recorded, measurement)
	}
	if repo.recorded.Source != SourceVisit {
		t.Fatalf("expected normalized source, got %q", repo.recorded.Source)
	}
	if repo.recorded.Values["field-1"] != "41" {
		t.Fatalf("expected trimmed values, got %+v", repo.recorded.Values)
	}
}

func TestRecordOrderMeasurementsRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	cases := []struct {
		cmd  RecordOrderMeasurementsCommand
		want error
	}{
		{
			RecordOrderMeasurementsCommand{
				Scope: common.TenantScope{BusinessID: "b1"}, OrderID: "", Source: SourceVisit,
				Values: map[string]string{"field-1": "41"},
			}, ErrInvalidInput,
		},
		{
			RecordOrderMeasurementsCommand{
				Scope: common.TenantScope{BusinessID: "b1"}, OrderID: "order-1", Source: "self",
				Values: map[string]string{"field-1": "41"},
			}, ErrInvalidMeasurementSource,
		},
		{
			RecordOrderMeasurementsCommand{
				Scope: common.TenantScope{BusinessID: "b1"}, OrderID: "order-1", Source: SourceShop,
				Values: map[string]string{},
			}, ErrInvalidInput,
		},
		{
			RecordOrderMeasurementsCommand{
				Scope: common.TenantScope{BusinessID: "b1"}, OrderID: "order-1", Source: SourceShop,
				Values: map[string]string{" ": "41"},
			}, ErrInvalidInput,
		},
		{
			RecordOrderMeasurementsCommand{
				Scope: common.TenantScope{BusinessID: "b1"}, OrderID: "order-1", Source: SourceShop,
				Values: map[string]string{"field-1": " "},
			}, ErrInvalidInput,
		},
	}
	for _, tc := range cases {
		svc := NewService(Dependencies{
			Measurements: &fakeMeasurementRepo{},
			IDs:          &seqIDs{ids: []common.ID{"measurement-1"}},
		})
		if _, err := svc.RecordOrderMeasurements(context.Background(), tc.cmd); !errors.Is(err, tc.want) {
			t.Fatalf("expected %v for %+v, got %v", tc.want, tc.cmd, err)
		}
	}
}

type fakeMeasurementRepo struct {
	created  ports.CreateMeasurementFieldInput
	updated  ports.UpdateMeasurementFieldInput
	recorded ports.RecordOrderMeasurementsInput
}

func (f *fakeMeasurementRepo) ListFields(_ context.Context, _ common.TenantScope) ([]ports.BusinessMeasurementField, error) {
	return nil, nil
}

func (f *fakeMeasurementRepo) CreateField(
	_ context.Context,
	_ common.TenantScope,
	input ports.CreateMeasurementFieldInput,
) (ports.BusinessMeasurementField, error) {
	f.created = input
	return ports.BusinessMeasurementField{FieldID: input.FieldID, Label: input.Label, Unit: input.Unit, Sequence: input.Sequence}, nil
}

func (f *fakeMeasurementRepo) UpdateField(
	_ context.Context,
	_ common.TenantScope,
	fieldID common.ID,
	input ports.UpdateMeasurementFieldInput,
) (ports.BusinessMeasurementField, error) {
	f.updated = input
	return ports.BusinessMeasurementField{FieldID: fieldID, Label: *input.Label, Unit: *input.Unit, Sequence: *input.Sequence}, nil
}

func (f *fakeMeasurementRepo) DeleteField(_ context.Context, _ common.TenantScope, _ common.ID) error {
	return nil
}

func (f *fakeMeasurementRepo) RecordOrderMeasurements(
	_ context.Context,
	_ common.TenantScope,
	input ports.RecordOrderMeasurementsInput,
) (ports.OrderMeasurement, error) {
	f.recorded = input
	return ports.OrderMeasurement{MeasurementID: input.MeasurementID, OrderID: input.OrderID, Source: input.Source, Values: input.Values}, nil
}

type seqIDs struct {
	ids []common.ID
}

func (s *seqIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
