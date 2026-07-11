package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestMeasurementFieldManagementIsTenantScoped(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	ctx := context.Background()
	measurements := NewMeasurementRepository(pool)

	fields, err := measurements.ListFields(ctx, coScope())
	if err != nil {
		t.Fatalf("list fields: %v", err)
	}
	if len(fields) != 2 || fields[0].FieldID != common.ID(coField1) || fields[1].FieldID != common.ID(coField2) {
		t.Fatalf("expected seeded fields in sequence order, got %+v", fields)
	}

	otherFields, err := measurements.ListFields(ctx, common.TenantScope{BusinessID: common.ID(coBizB)})
	if err != nil {
		t.Fatalf("list other tenant fields: %v", err)
	}
	if len(otherFields) != 0 {
		t.Fatalf("tenant B must not see tenant A fields, got %+v", otherFields)
	}

	created, err := measurements.CreateField(ctx, coScope(), ports.CreateMeasurementFieldInput{
		FieldID: common.ID("ffffffff-0000-0000-0000-000000000003"), BusinessID: coScopeBusiness,
		Label: "Sleeve", Unit: "cm", Sequence: 3,
	})
	if err != nil {
		t.Fatalf("create field: %v", err)
	}
	if created.Label != "Sleeve" || created.Unit != "cm" || created.Sequence != 3 {
		t.Fatalf("unexpected created field: %+v", created)
	}

	if _, err := measurements.CreateField(ctx, coScope(), ports.CreateMeasurementFieldInput{
		FieldID: common.ID("ffffffff-0000-0000-0000-000000000004"), BusinessID: coScopeBusiness,
		Label: "Duplicate", Unit: "cm", Sequence: 1,
	}); !errors.Is(err, ports.ErrMeasurementSequenceTaken) {
		t.Fatalf("expected duplicate sequence conflict, got %v", err)
	}

	label := "Sleeve length"
	unit := "in"
	sequence := 4
	updated, err := measurements.UpdateField(ctx, coScope(), created.FieldID, ports.UpdateMeasurementFieldInput{
		Label: &label, Unit: &unit, Sequence: &sequence,
	})
	if err != nil {
		t.Fatalf("update field: %v", err)
	}
	if updated.Label != "Sleeve length" || updated.Unit != "in" || updated.Sequence != 4 {
		t.Fatalf("unexpected updated field: %+v", updated)
	}

	scopeB := common.TenantScope{BusinessID: common.ID(coBizB)}
	if _, err := measurements.UpdateField(ctx, scopeB, created.FieldID, ports.UpdateMeasurementFieldInput{
		Label: &label,
	}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected cross-tenant update to be not found, got %v", err)
	}

	if err := measurements.DeleteField(ctx, coScope(), created.FieldID); err != nil {
		t.Fatalf("delete field: %v", err)
	}
	if err := measurements.DeleteField(ctx, coScope(), created.FieldID); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected missing delete to be not found, got %v", err)
	}
}

func TestRecordVisitMeasurementsForConfirmedHomeVisitOrder(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	ctx := context.Background()
	orderID := common.ID("00000000-0000-0000-0000-0000000000d2")
	customerID := common.ID("00000000-0000-0000-0000-0000000000e2")
	if err := NewOrderRepository(pool).CreateCustomOrderConfirmed(ctx, coScope(), ports.CreateCustomOrderConfirmedInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "home_visit", CustomerName: "IT Bespoke Customer", CustomerEmail: "visit@example.com",
	}); err != nil {
		t.Fatalf("create confirmed home-visit order: %v", err)
	}

	measurements := NewMeasurementRepository(pool)
	first, err := measurements.RecordOrderMeasurements(ctx, coScope(), ports.RecordOrderMeasurementsInput{
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f4"),
		BusinessID:    coScopeBusiness,
		OrderID:       orderID,
		Source:        "visit",
		Values:        map[string]string{coField1: "42"},
	})
	if err != nil {
		t.Fatalf("record visit measurements: %v", err)
	}
	if first.CustomerID != customerID || first.Source != "visit" || first.Values[coField1] != "42" {
		t.Fatalf("unexpected first measurement: %+v", first)
	}

	second, err := measurements.RecordOrderMeasurements(ctx, coScope(), ports.RecordOrderMeasurementsInput{
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f5"),
		BusinessID:    coScopeBusiness,
		OrderID:       orderID,
		Source:        "visit",
		Values:        map[string]string{coField1: "43", coField2: "35"},
	})
	if err != nil {
		t.Fatalf("upsert visit measurements: %v", err)
	}
	if second.MeasurementID != first.MeasurementID || measurementCount(t, pool, orderID) != 1 {
		t.Fatalf(
			"expected upsert to preserve one measurement row, first=%+v second=%+v count=%d",
			first, second, measurementCount(t, pool, orderID),
		)
	}
	if chest := readMeasurement(t, pool, orderID, coField1); chest != "43" {
		t.Fatalf("expected updated chest measurement 43, got %q", chest)
	}

	if _, err := measurements.RecordOrderMeasurements(ctx, coScope(), ports.RecordOrderMeasurementsInput{
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f6"),
		BusinessID:    coScopeBusiness,
		OrderID:       orderID,
		Source:        "shop",
		Values:        map[string]string{coField1: "44"},
	}); !errors.Is(err, ports.ErrInvalidOrderState) {
		t.Fatalf("expected shop source to be invalid for a home-visit order, got %v", err)
	}

	if _, err := measurements.RecordOrderMeasurements(ctx, coScope(), ports.RecordOrderMeasurementsInput{
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f7"),
		BusinessID:    coScopeBusiness,
		OrderID:       orderID,
		Source:        "visit",
		Values:        map[string]string{"not-a-field": "44"},
	}); !errors.Is(err, ports.ErrUnknownMeasurementField) {
		t.Fatalf("expected unknown field rejection, got %v", err)
	}

	crossScope := common.TenantScope{BusinessID: common.ID(coBizB)}
	if _, err := measurements.RecordOrderMeasurements(ctx, crossScope, ports.RecordOrderMeasurementsInput{
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f8"),
		BusinessID:    common.ID(coBizB),
		OrderID:       orderID,
		Source:        "visit",
		Values:        map[string]string{coField1: "44"},
	}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected cross-tenant order to be not found, got %v", err)
	}
}

func TestRecordShopMeasurementsForConfirmedComeToShopOrder(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	ctx := context.Background()
	orderID := common.ID("00000000-0000-0000-0000-0000000000d3")
	customerID := common.ID("00000000-0000-0000-0000-0000000000e3")
	if err := NewOrderRepository(pool).CreateCustomOrderConfirmed(ctx, coScope(), ports.CreateCustomOrderConfirmedInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "come_to_shop", CustomerName: "IT Bespoke Customer", CustomerEmail: "shop@example.com",
	}); err != nil {
		t.Fatalf("create confirmed shop order: %v", err)
	}

	measurement, err := NewMeasurementRepository(pool).RecordOrderMeasurements(ctx, coScope(), ports.RecordOrderMeasurementsInput{
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f9"),
		BusinessID:    coScopeBusiness,
		OrderID:       orderID,
		Source:        "shop",
		Values:        map[string]string{coField1: "40"},
	})
	if err != nil {
		t.Fatalf("record shop measurements: %v", err)
	}
	if measurement.CustomerID != customerID || measurement.Source != "shop" || readMeasurement(t, pool, orderID, coField1) != "40" {
		t.Fatalf("unexpected shop measurement: %+v", measurement)
	}

	if _, err := NewMeasurementRepository(pool).RecordOrderMeasurements(ctx, coScope(), ports.RecordOrderMeasurementsInput{
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000fb"),
		BusinessID:    coScopeBusiness,
		OrderID:       orderID,
		Source:        "visit",
		Values:        map[string]string{coField1: "41"},
	}); !errors.Is(err, ports.ErrInvalidOrderState) {
		t.Fatalf("expected visit source to be invalid for a shop order, got %v", err)
	}
}
