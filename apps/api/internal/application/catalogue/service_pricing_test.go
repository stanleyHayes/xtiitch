package catalogueapp

import (
	"context"
	"errors"
	"testing"

	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestCreateSizeBandNormalizesChart(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateSizeBand(context.Background(), CreateSizeBandCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		Label:     "Medium",
		Chart: []catalogue.SizeChartItem{
			{Name: "  Bust ", Value: " 36 ", Unit: "INCHES"},
		},
	})
	if err != nil {
		t.Fatalf("create size band: %v", err)
	}
	if len(repo.sizeBand.Chart) != 1 {
		t.Fatalf("expected 1 chart item, got %d", len(repo.sizeBand.Chart))
	}
	item := repo.sizeBand.Chart[0]
	if item.Name != "Bust" || item.Value != "36" || item.Unit != "inches" {
		t.Fatalf("chart item not normalized: %+v", item)
	}
}
func TestCreateSizeBandRejectsInvalidChart(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	cases := [][]catalogue.SizeChartItem{
		{{Name: "", Value: "36", Unit: "in"}},
		{{Name: "Bust", Value: "", Unit: "in"}},
		{{Name: "Bust", Value: "36", Unit: "furlongs"}},
	}
	for i, chart := range cases {
		if _, err := service.CreateSizeBand(context.Background(), CreateSizeBandCommand{
			Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
			Label: "Medium", Chart: chart,
		}); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("case %d: expected invalid input, got %v", i, err)
		}
	}
}
func TestUpdateAndDeleteSizeBand(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	if err := service.UpdateSizeBand(context.Background(), UpdateSizeBandCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		SizeBandID: "band-1", Label: "Large", Sequence: 2,
	}); err != nil {
		t.Fatalf("update size band: %v", err)
	}
	if repo.sizeBandUpdate.Label != "Large" || repo.sizeBandUpdate.SizeBandID != common.ID("band-1") {
		t.Fatalf("unexpected size band update: %+v", repo.sizeBandUpdate)
	}

	if err := service.DeleteSizeBand(context.Background(), DeleteSizeBandCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		SizeBandID: "band-1",
	}); err != nil {
		t.Fatalf("delete size band: %v", err)
	}
	if repo.deletedSizeBand != common.ID("band-1") {
		t.Fatalf("expected band-1 deleted, got %q", repo.deletedSizeBand)
	}
}
func TestSetDesignPriceRejectedForCustomisationDesign(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{getDesign: catalogue.Design{CustomisationAllowed: true}}
	service := newService(repo)

	err := service.SetDesignPrice(context.Background(), SetDesignPriceCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		DesignID: "design-1", SizeBandID: "band-1", PriceMinor: 20000,
	})
	if !errors.Is(err, ErrPricingModeConflict) {
		t.Fatalf("expected pricing mode conflict, got %v", err)
	}
	if repo.priceSet {
		t.Fatal("price must not be set on a customisation design")
	}
}
func TestSetDesignPriceAllowedForMadeToWear(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{getDesign: catalogue.Design{CustomisationAllowed: false}}
	service := newService(repo)

	if err := service.SetDesignPrice(context.Background(), SetDesignPriceCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		DesignID: "design-1", SizeBandID: "band-1", PriceMinor: 20000,
	}); err != nil {
		t.Fatalf("set design price: %v", err)
	}
	if !repo.priceSet || repo.priceSetSizeBandID != common.ID("band-1") {
		t.Fatalf("expected price set for made-to-wear design, got %+v", repo)
	}
}
func TestApplyBandOverridesResolvesEffectiveLabelAndChart(t *testing.T) {
	t.Parallel()
	label := "Petite"
	master := []catalogue.BandPrice{
		{SizeBandID: "band-1", Label: "Small", PriceMinor: 10000, Chart: []catalogue.SizeChartItem{{Name: "Bust", Value: "34", Unit: "in"}}},
		{SizeBandID: "band-2", Label: "Medium", PriceMinor: 12000},
	}
	overrides := []catalogue.DesignSizeBandOverride{
		{SizeBandID: "band-1", Label: &label, ChartSet: true, Chart: []catalogue.SizeChartItem{{Name: "Bust", Value: "30", Unit: "in"}}},
	}

	got := catalogue.ApplyBandOverrides(master, overrides)
	if got[0].Label != "Petite" || len(got[0].Chart) != 1 || got[0].Chart[0].Value != "30" {
		t.Fatalf("override band should win, got %+v", got[0])
	}
	if got[1].Label != "Medium" {
		t.Fatalf("unmatched band must keep master label, got %+v", got[1])
	}
	// The input must not be mutated.
	if master[0].Label != "Small" || master[0].Chart[0].Value != "34" {
		t.Fatalf("master prices were mutated: %+v", master[0])
	}
}
func TestApplyBandOverridesInheritsUnsetFields(t *testing.T) {
	t.Parallel()
	label := "Tiny"
	master := []catalogue.BandPrice{
		{SizeBandID: "band-1", Label: "Small", Chart: []catalogue.SizeChartItem{{Name: "Bust", Value: "34", Unit: "in"}}},
	}
	// Label-only override: ChartSet false must leave the master chart in place.
	overrides := []catalogue.DesignSizeBandOverride{{SizeBandID: "band-1", Label: &label}}

	got := catalogue.ApplyBandOverrides(master, overrides)
	if got[0].Label != "Tiny" {
		t.Fatalf("label override should win, got %q", got[0].Label)
	}
	if len(got[0].Chart) != 1 || got[0].Chart[0].Value != "34" {
		t.Fatalf("unset chart override must inherit master chart, got %+v", got[0].Chart)
	}
}
func TestListDesignPricesAppliesSizeBandOverride(t *testing.T) {
	t.Parallel()
	label := "Petite"
	repo := &fakeCatalogueRepo{
		listDesignPricesFunc: func() []catalogue.BandPrice {
			return []catalogue.BandPrice{
				{SizeBandID: "band-1", Label: "Small", PriceMinor: 10000},
			}
		},
		overrides: []catalogue.DesignSizeBandOverride{
			{SizeBandID: "band-1", Label: &label, ChartSet: true, Chart: []catalogue.SizeChartItem{{Name: "Waist", Value: "28", Unit: "in"}}},
		},
	}
	service := newService(repo)

	prices, err := service.ListDesignPrices(context.Background(), common.TenantScope{BusinessID: "business-1"}, "design-1")
	if err != nil {
		t.Fatalf("list design prices: %v", err)
	}
	if len(prices) != 1 || prices[0].Label != "Petite" || prices[0].Chart[0].Value != "28" {
		t.Fatalf("dashboard price read should show effective override, got %+v", prices)
	}
}
func TestSetDesignSizeBandOverrideNormalizesAndRecords(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	label := "  Petite  "

	err := service.SetDesignSizeBandOverride(context.Background(), SetDesignSizeBandOverrideCommand{
		Scope:      common.TenantScope{BusinessID: "business-1"},
		ActorRole:  business.UserRoleOwner,
		DesignID:   "design-1",
		SizeBandID: "band-1",
		Label:      &label,
		ChartSet:   true,
		Chart:      []catalogue.SizeChartItem{{Name: " Bust ", Value: "30", Unit: "IN"}},
	})
	if err != nil {
		t.Fatalf("set override: %v", err)
	}
	if !repo.overrideWasSet {
		t.Fatal("expected the override to be written")
	}
	if repo.overrideSet.Label == nil || *repo.overrideSet.Label != "Petite" {
		t.Fatalf("label should be trimmed, got %v", repo.overrideSet.Label)
	}
	if !repo.overrideSet.ChartSet || len(repo.overrideSet.Chart) != 1 || repo.overrideSet.Chart[0].Unit != "in" || repo.overrideSet.Chart[0].Name != "Bust" {
		t.Fatalf("chart should be normalized, got %+v", repo.overrideSet.Chart)
	}
	if repo.overrideSet.BusinessID != "business-1" {
		t.Fatalf("override must be scoped to the tenant, got %q", repo.overrideSet.BusinessID)
	}
}
func TestSetDesignSizeBandOverrideRejectsEmpty(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	// Neither a label nor a chart is an empty (no-op) override.
	err := service.SetDesignSizeBandOverride(context.Background(), SetDesignSizeBandOverrideCommand{
		Scope:      common.TenantScope{BusinessID: "business-1"},
		ActorRole:  business.UserRoleOwner,
		DesignID:   "design-1",
		SizeBandID: "band-1",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	if repo.overrideWasSet {
		t.Fatal("must not write an empty override")
	}
}
func TestSetDesignSizeBandOverrideRequiresOwnerOrAdmin(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	label := "Petite"

	err := service.SetDesignSizeBandOverride(context.Background(), SetDesignSizeBandOverrideCommand{
		Scope:      common.TenantScope{BusinessID: "business-1"},
		ActorRole:  business.UserRoleStaff,
		DesignID:   "design-1",
		SizeBandID: "band-1",
		Label:      &label,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected forbidden for staff, got %v", err)
	}
	if repo.overrideWasSet {
		t.Fatal("staff must not be able to set an override")
	}
}
func TestDeleteDesignSizeBandOverride(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	err := service.DeleteDesignSizeBandOverride(context.Background(), DeleteDesignSizeBandOverrideCommand{
		Scope:      common.TenantScope{BusinessID: "business-1"},
		ActorRole:  business.UserRoleAdmin,
		DesignID:   "design-1",
		SizeBandID: "band-1",
	})
	if err != nil {
		t.Fatalf("delete override: %v", err)
	}
	if !repo.overrideWasDeleted || repo.overrideDeletedBand != "band-1" {
		t.Fatalf("expected the band override to be cleared, got deleted=%v band=%q", repo.overrideWasDeleted, repo.overrideDeletedBand)
	}
}
