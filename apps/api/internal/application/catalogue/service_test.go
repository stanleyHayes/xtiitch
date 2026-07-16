package catalogueapp

import (
	"context"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func newService(repo *fakeCatalogueRepo) Service {
	return newServiceWithSettings(repo, &fakeStoreSettingsRepo{})
}

// newServiceWithSettings wires an explicit store-settings fake so a test can drive
// the subscription-status activation gate (a zero-value fake reports an empty
// status ⇒ activated, leaving all existing tests unaffected).
func newServiceWithSettings(repo *fakeCatalogueRepo, settings *fakeStoreSettingsRepo) Service {
	return NewService(Dependencies{
		Catalogue: repo,
		Settings:  settings,
		IDs:       &sequenceIDs{ids: []common.ID{"design-id", "token-source"}},
	})
}

// fakeStoreSettingsRepo is a minimal StoreSettingsRepository for catalogue tests.
// GetProfile returns the configured profile (zero-value ActivationRequired=false ⇒ activated).
type fakeStoreSettingsRepo struct {
	profile       ports.StoreProfile
	settings      ports.StoreSettings
	updated       *ports.StoreSettings
	getProfileErr error
}

func (r *fakeStoreSettingsRepo) Get(_ context.Context, _ common.TenantScope) (ports.StoreSettings, error) {
	return r.settings, nil
}

func (r *fakeStoreSettingsRepo) Update(_ context.Context, _ common.TenantScope, settings ports.StoreSettings) error {
	updated := settings
	r.updated = &updated
	return nil
}

func (r *fakeStoreSettingsRepo) GetProfile(_ context.Context, _ common.TenantScope) (ports.StoreProfile, error) {
	return r.profile, r.getProfileErr
}
func TestVariationCreateAllowedCountsImplicitDefault(t *testing.T) {
	t.Parallel()
	capOf := func(value int) *int { return &value }

	// A cap of 2 (the seeded Free value) = 1 implicit default + 1 stored.
	if !catalogue.VariationCreateAllowed(capOf(2), 0) {
		t.Fatal("a cap of 2 must allow the first stored variation")
	}
	if catalogue.VariationCreateAllowed(capOf(2), 1) {
		t.Fatal("a cap of 2 must reject a second stored variation (default + 1 = 2)")
	}
	// A cap of 10 (the seeded Studio value) = 1 implicit default + 9 stored.
	if !catalogue.VariationCreateAllowed(capOf(10), 8) {
		t.Fatal("a cap of 10 must allow the ninth stored variation")
	}
	if catalogue.VariationCreateAllowed(capOf(10), 9) {
		t.Fatal("a cap of 10 must reject the tenth stored variation")
	}
}

// nil is unlimited, matching plans.variation_limit's NULL. An admin clearing the
// limit must not be read as a cap of zero.
func TestVariationCreateAllowedTreatsNilCapAsUnlimited(t *testing.T) {
	t.Parallel()
	if !catalogue.VariationCreateAllowed(nil, 0) {
		t.Fatal("a blank limit must allow the first stored variation")
	}
	if !catalogue.VariationCreateAllowed(nil, 9999) {
		t.Fatal("a blank limit must impose no cap at all")
	}
}

// A cap of 0 withholds the feature: the mirror writes 0 for a DISABLED
// entitlement, and that must not permit the default-plus-one slot.
func TestVariationCreateAllowedTreatsZeroCapAsWithheld(t *testing.T) {
	t.Parallel()
	zero := 0
	if catalogue.VariationCreateAllowed(&zero, 0) {
		t.Fatal("a cap of 0 must reject every stored variation")
	}
}

type fakeCatalogueRepo struct {
	created            bool
	design             ports.DesignInput
	collectionUpdate   ports.CollectionUpdateInput
	sizeBand           ports.SizeBandInput
	sizeBandUpdate     ports.SizeBandUpdateInput
	deletedSizeBand    common.ID
	getDesign          catalogue.Design
	priceSet           bool
	priceSetSizeBandID common.ID

	variations         []catalogue.DesignVariation
	variationCreated   bool
	createdVariation   ports.DesignVariationInput
	createVariationErr error
	updatedVariation   ports.DesignVariationUpdateInput
	deletedVariation   common.ID
	reorderedDesign    common.ID
	reorderedIDs       []common.ID

	overrides            []catalogue.DesignSizeBandOverride
	overrideSet          ports.DesignSizeBandOverrideInput
	overrideWasSet       bool
	overrideDeletedBand  common.ID
	overrideWasDeleted   bool
	listDesignPricesFunc func() []catalogue.BandPrice
}

func (r *fakeCatalogueRepo) CreateDesign(_ context.Context, _ common.TenantScope, input ports.DesignInput) error {
	r.created = true
	r.design = input
	return nil
}
func (r *fakeCatalogueRepo) CreateCollection(_ context.Context, _ common.TenantScope, _ ports.CollectionInput) error {
	return nil
}
func (r *fakeCatalogueRepo) ListCollections(_ context.Context, _ common.TenantScope) ([]catalogue.Collection, error) {
	return nil, nil
}
func (r *fakeCatalogueRepo) UpdateCollection(_ context.Context, _ common.TenantScope, input ports.CollectionUpdateInput) error {
	r.collectionUpdate = input
	return nil
}
func (r *fakeCatalogueRepo) SetCollectionStatus(_ context.Context, _ common.TenantScope, _ common.ID, _ catalogue.Status) error {
	return nil
}
func (r *fakeCatalogueRepo) ListDesigns(_ context.Context, _ common.TenantScope) ([]catalogue.Design, error) {
	return nil, nil
}
func (r *fakeCatalogueRepo) GetDesign(_ context.Context, _ common.TenantScope, _ common.ID) (catalogue.Design, error) {
	return r.getDesign, nil
}
func (r *fakeCatalogueRepo) UpdateDesign(_ context.Context, _ common.TenantScope, input ports.DesignInput) error {
	r.design = input
	return nil
}
func (r *fakeCatalogueRepo) SetDesignStatus(_ context.Context, _ common.TenantScope, _ common.ID, _ catalogue.Status) error {
	return nil
}
func (r *fakeCatalogueRepo) CreateSizeBand(_ context.Context, _ common.TenantScope, input ports.SizeBandInput) error {
	r.sizeBand = input
	return nil
}
func (r *fakeCatalogueRepo) ListSizeBands(_ context.Context, _ common.TenantScope) ([]catalogue.SizeBand, error) {
	return nil, nil
}
func (r *fakeCatalogueRepo) UpdateSizeBand(_ context.Context, _ common.TenantScope, input ports.SizeBandUpdateInput) error {
	r.sizeBandUpdate = input
	return nil
}
func (r *fakeCatalogueRepo) DeleteSizeBand(_ context.Context, _ common.TenantScope, sizeBandID common.ID) error {
	r.deletedSizeBand = sizeBandID
	return nil
}
func (r *fakeCatalogueRepo) SetDesignPrice(_ context.Context, _ common.TenantScope, _ common.ID, sizeBandID common.ID, _ int64) error {
	// Mirror the real repository's atomic pricing-mode guard.
	if r.getDesign.CustomisationAllowed {
		return ports.ErrPricingModeConflict
	}
	r.priceSet = true
	r.priceSetSizeBandID = sizeBandID
	return nil
}
func (r *fakeCatalogueRepo) ListDesignPrices(_ context.Context, _ common.TenantScope, _ common.ID) ([]catalogue.BandPrice, error) {
	if r.listDesignPricesFunc != nil {
		return r.listDesignPricesFunc(), nil
	}
	return nil, nil
}
func (r *fakeCatalogueRepo) SetDesignSizeBandOverride(
	_ context.Context,
	_ common.TenantScope,
	input ports.DesignSizeBandOverrideInput,
) error {
	r.overrideWasSet = true
	r.overrideSet = input
	return nil
}
func (r *fakeCatalogueRepo) DeleteDesignSizeBandOverride(_ context.Context, _ common.TenantScope, _ common.ID, sizeBandID common.ID) error {
	r.overrideWasDeleted = true
	r.overrideDeletedBand = sizeBandID
	return nil
}
func (r *fakeCatalogueRepo) ListDesignSizeBandOverrides(
	_ context.Context,
	_ common.TenantScope,
	_ common.ID) ([]catalogue.DesignSizeBandOverride,
	error,
) {
	return r.overrides, nil
}
func (r *fakeCatalogueRepo) ListDesignVariations(
	_ context.Context,
	_ common.TenantScope,
	_ common.ID) ([]catalogue.DesignVariation,
	error,
) {
	return r.variations, nil
}
func (r *fakeCatalogueRepo) CreateDesignVariation(_ context.Context, _ common.TenantScope, input ports.DesignVariationInput) error {
	if r.createVariationErr != nil {
		return r.createVariationErr
	}
	r.variationCreated = true
	r.createdVariation = input
	return nil
}
func (r *fakeCatalogueRepo) UpdateDesignVariation(_ context.Context, _ common.TenantScope, input ports.DesignVariationUpdateInput) error {
	r.updatedVariation = input
	return nil
}
func (r *fakeCatalogueRepo) DeleteDesignVariation(_ context.Context, _ common.TenantScope, variationID common.ID) error {
	r.deletedVariation = variationID
	return nil
}
func (r *fakeCatalogueRepo) ReorderDesignVariations(
	_ context.Context,
	_ common.TenantScope,
	designID common.ID,
	orderedIDs []common.ID,
) error {
	r.reorderedDesign = designID
	r.reorderedIDs = orderedIDs
	return nil
}

type sequenceIDs struct {
	ids []common.ID
}

func (s *sequenceIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
func TestCoerceStoreCustomizationResetsUngrantedFeatures(t *testing.T) {
	// A plan that grants nothing must have every customization coerced back to the
	// Xtiitch defaults — this is the server-side entitlement gate.
	none := business.Entitlements{}
	got := coerceStoreCustomization(none, ports.StoreSettings{
		BrandColor:    "#112233",
		LogoURL:       "https://cdn.example.com/logo.png",
		BannerURL:     "https://cdn.example.com/banner.jpg",
		LayoutVariant: "spotlight",
	})
	if got.BrandColor != business.DefaultBrandColor {
		t.Fatalf("brand colour not reset: got %q", got.BrandColor)
	}
	if got.LogoURL != "" {
		t.Fatalf("logo not cleared: got %q", got.LogoURL)
	}
	if got.BannerURL != "" {
		t.Fatalf("banner not cleared: got %q", got.BannerURL)
	}
	if got.LayoutVariant != business.DefaultLayoutVariant {
		t.Fatalf("layout not reset: got %q", got.LayoutVariant)
	}
}
func TestCoerceStoreCustomizationKeepsGrantedFeatures(t *testing.T) {
	all := business.Entitlements{
		business.FeatureCustomBrandColor: true,
		business.FeatureCustomLogo:       true,
		business.FeatureCustomBanner:     true,
		business.FeatureCustomLayout:     true,
	}
	got := coerceStoreCustomization(all, ports.StoreSettings{
		BrandColor:    "#112233",
		LogoURL:       "https://cdn.example.com/logo.png",
		BannerURL:     "https://cdn.example.com/banner.jpg",
		LayoutVariant: "spotlight",
	})
	if got.BrandColor != "#112233" || got.LogoURL == "" || got.BannerURL == "" || got.LayoutVariant != "spotlight" {
		t.Fatalf("granted customization was dropped: %+v", got)
	}
	// An unknown layout still falls back even when the feature is granted.
	got = coerceStoreCustomization(all, ports.StoreSettings{LayoutVariant: "bogus"})
	if got.LayoutVariant != business.DefaultLayoutVariant {
		t.Fatalf("invalid layout not defaulted: got %q", got.LayoutVariant)
	}
}
