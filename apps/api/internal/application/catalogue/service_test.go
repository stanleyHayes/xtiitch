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
	created bool
	design  ports.DesignInput
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
func (r *fakeCatalogueRepo) SetCollectionStatus(_ context.Context, _ common.TenantScope, _ common.ID, _ catalogue.Status) error {
	return nil
}
func (r *fakeCatalogueRepo) ListDesigns(_ context.Context, _ common.TenantScope) ([]catalogue.Design, error) {
	return nil, nil
}
func (r *fakeCatalogueRepo) GetDesign(_ context.Context, _ common.TenantScope, _ common.ID) (catalogue.Design, error) {
	return catalogue.Design{}, nil
}
func (r *fakeCatalogueRepo) UpdateDesign(_ context.Context, _ common.TenantScope, _ ports.DesignInput) error {
	return nil
}
func (r *fakeCatalogueRepo) SetDesignStatus(_ context.Context, _ common.TenantScope, _ common.ID, _ catalogue.Status) error {
	return nil
}
func (r *fakeCatalogueRepo) CreateSizeBand(_ context.Context, _ common.TenantScope, _ ports.SizeBandInput) error {
	return nil
}
func (r *fakeCatalogueRepo) ListSizeBands(_ context.Context, _ common.TenantScope) ([]catalogue.SizeBand, error) {
	return nil, nil
}
func (r *fakeCatalogueRepo) SetDesignPrice(_ context.Context, _ common.TenantScope, _ common.ID, _ common.ID, _ int64) error {
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
