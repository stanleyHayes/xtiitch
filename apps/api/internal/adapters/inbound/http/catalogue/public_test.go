package cataloguehttp

import (
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestToStoreSummaryExposesCustomOrderMetadata(t *testing.T) {
	t.Parallel()

	summary := toStoreSummary(ports.Storefront{
		Name:                "Akosua's Atelier",
		Handle:              "akosua",
		BrandColor:          "#800020",
		DefaultDepositMinor: 12500,
		MeasurementFields: []ports.MeasurementField{
			{FieldID: common.ID("field-1"), Label: "Chest / Bust", Unit: "in", Sequence: 1},
			{FieldID: common.ID("field-2"), Label: "Waist", Unit: "in", Sequence: 2},
		},
		Settings: ports.StoreSettings{BespokeEnabled: true, MeasurementsEnabled: true},
	})

	if summary.DefaultDepositMinor != 12500 {
		t.Fatalf("expected default deposit to be public, got %d", summary.DefaultDepositMinor)
	}
	if len(summary.MeasurementFields) != 2 {
		t.Fatalf("expected measurement fields, got %+v", summary.MeasurementFields)
	}
	if got := summary.MeasurementFields[0]; got.FieldID != "field-1" || got.Label != "Chest / Bust" || got.Unit != "in" {
		t.Fatalf("unexpected first measurement field: %+v", got)
	}
	if !summary.Settings.BespokeEnabled || !summary.Settings.MeasurementsEnabled {
		t.Fatalf("expected bespoke settings to survive summary conversion: %+v", summary.Settings)
	}
}
