package catalogueapp

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func newService(repo *fakeCatalogueRepo) Service {
	return NewService(Dependencies{
		Catalogue: repo,
		IDs:       &sequenceIDs{ids: []common.ID{"design-id", "token-source"}},
	})
}

func TestCreateDesignGeneratesHandleAndRecordsInput(t *testing.T) {
	t.Parallel()

	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	id, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		Title:       "  Kente Wrap Dress  ",
		Description: " Hand-woven ",
	})
	if err != nil {
		t.Fatalf("create design: %v", err)
	}
	if id != common.ID("design-id") {
		t.Fatalf("unexpected id %q", id)
	}
	if repo.design.Title != "Kente Wrap Dress" || repo.design.Description != "Hand-woven" {
		t.Fatalf("expected trimmed fields, got %+v", repo.design)
	}
	if !strings.HasPrefix(repo.design.Handle, "kente-wrap-dress-") {
		t.Fatalf("expected an unguessable slug handle, got %q", repo.design.Handle)
	}
	if repo.design.Handle == "kente-wrap-dress-" {
		t.Fatal("expected a random token appended to the handle")
	}
}

func TestCreateDesignRejectsDepositOverrideBelowFloor(t *testing.T) {
	t.Parallel()

	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	below := int64(5000)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		Title:                "Cheap",
		DepositOverrideMinor: &below,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	if repo.created {
		t.Fatal("expected no design created when deposit is below the floor")
	}
}

func TestMadeToWearDesignDropsDeposit(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	deposit := int64(30000)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		Title:                "Listed dress",
		CustomisationAllowed: false,
		DepositOverrideMinor: &deposit,
	})
	if err != nil {
		t.Fatalf("create design: %v", err)
	}
	if repo.design.DepositOverrideMinor != nil {
		t.Fatalf("made-to-wear design must not carry a deposit, got %v", *repo.design.DepositOverrideMinor)
	}
}

func TestCustomisationDesignKeepsDeposit(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	deposit := int64(30000)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		Title:                "Bespoke gown",
		CustomisationAllowed: true,
		DepositOverrideMinor: &deposit,
	})
	if err != nil {
		t.Fatalf("create design: %v", err)
	}
	if repo.design.DepositOverrideMinor == nil || *repo.design.DepositOverrideMinor != deposit {
		t.Fatalf("customisation design must keep its deposit, got %v", repo.design.DepositOverrideMinor)
	}
}

func TestUpdateCollectionTrimsAndRejectsEmpty(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	if err := service.UpdateCollection(context.Background(), UpdateCollectionCommand{
		Scope:        common.TenantScope{BusinessID: "business-1"},
		ActorRole:    business.UserRoleOwner,
		CollectionID: "collection-1",
		Name:         "  Bridal  ",
		Theme:        "  ivory ",
		Sequence:     3,
	}); err != nil {
		t.Fatalf("update collection: %v", err)
	}
	if repo.collectionUpdate.Name != "Bridal" || repo.collectionUpdate.Theme != "ivory" || repo.collectionUpdate.Sequence != 3 {
		t.Fatalf("unexpected update input: %+v", repo.collectionUpdate)
	}

	if err := service.UpdateCollection(context.Background(), UpdateCollectionCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		CollectionID: "collection-1", Name: "   ",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for empty name, got %v", err)
	}
}

func TestUpdateCollectionRequiresManageRole(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	err := service.UpdateCollection(context.Background(), UpdateCollectionCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleStaff,
		CollectionID: "collection-1", Name: "Bridal",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected forbidden for staff, got %v", err)
	}
}

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

func TestCreateCollectionRejectsEmptyName(t *testing.T) {
	t.Parallel()

	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateCollection(context.Background(), CreateCollectionCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleAdmin,
		Name:      "   ",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestCatalogueManagementRequiresOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	scope := common.TenantScope{BusinessID: "business-1"}

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:     scope,
		ActorRole: business.UserRoleStaff,
		Title:     "Staff draft",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff design creation to be forbidden, got %v", err)
	}
	if repo.created {
		t.Fatal("expected staff design creation to stop before repository write")
	}

	if err := service.SetDesignPrice(context.Background(), SetDesignPriceCommand{
		Scope:      scope,
		ActorRole:  business.UserRoleStaff,
		DesignID:   "design-1",
		SizeBandID: "size-1",
		PriceMinor: 10000,
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff price management to be forbidden, got %v", err)
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
	return nil, nil
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
