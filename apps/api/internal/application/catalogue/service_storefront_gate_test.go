package catalogueapp

import (
	"context"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// fakeStorefrontRepo is a minimal StorefrontRepository for the storefront
// not-live gating tests: it resolves one store and counts catalogue reads so a
// test can prove a gated store's designs are never loaded.
type fakeStorefrontRepo struct {
	store          ports.Storefront
	designs        []ports.StorefrontDesign
	designsListed  bool
	designsFetched bool
}

func (r *fakeStorefrontRepo) ResolveStore(_ context.Context, _ string) (ports.Storefront, error) {
	return r.store, nil
}

func (r *fakeStorefrontRepo) ListActiveDesigns(_ context.Context, _ common.ID) ([]ports.StorefrontDesign, error) {
	r.designsListed = true
	return r.designs, nil
}

func (r *fakeStorefrontRepo) GetActiveDesignByHandle(_ context.Context, _ string) (ports.StorefrontDesign, error) {
	r.designsFetched = true
	return ports.StorefrontDesign{Store: r.store}, nil
}

func (r *fakeStorefrontRepo) ListActiveCollections(_ context.Context, _ common.ID) ([]catalogue.Collection, error) {
	return nil, nil
}

func (r *fakeStorefrontRepo) GetActiveCollectionByHandle(_ context.Context, _ string) (ports.StorefrontCollection, error) {
	return ports.StorefrontCollection{}, nil
}

func (r *fakeStorefrontRepo) SearchActiveDesigns(_ context.Context, _ common.ID, _ string) ([]ports.StorefrontDesign, error) {
	r.designsListed = true
	return r.designs, nil
}

func (r *fakeStorefrontRepo) ListPublicShops(_ context.Context) ([]ports.PublicShop, error) {
	return nil, nil
}

func newStorefrontService(storefront *fakeStorefrontRepo) Service {
	return NewService(Dependencies{Storefront: storefront})
}

// A not-live store (unverified, or no payout details) resolves to its shell
// only: no designs are loaded or returned, so a direct storefront visit shows
// the store as not-live rather than its catalogue.
func TestLoadStorefrontNotLiveReturnsShellOnly(t *testing.T) {
	t.Parallel()

	storefront := &fakeStorefrontRepo{
		store:   ports.Storefront{BusinessID: "business-1", Name: "Adwoa Studio", Live: false},
		designs: []ports.StorefrontDesign{{}},
	}
	view, err := newStorefrontService(storefront).LoadStorefront(context.Background(), "adwoa-studio")
	if err != nil {
		t.Fatalf("load storefront: %v", err)
	}
	if view.Store.Name != "Adwoa Studio" {
		t.Fatalf("expected the store shell to resolve, got %+v", view.Store)
	}
	if len(view.Designs) != 0 || len(view.Collections) != 0 {
		t.Fatalf("a not-live store must expose no catalogue, got %+v", view)
	}
	if storefront.designsListed {
		t.Fatal("a not-live store's designs must never be loaded")
	}
}

// A live store's catalogue loads exactly as before.
func TestLoadStorefrontLiveReturnsCatalogue(t *testing.T) {
	t.Parallel()

	storefront := &fakeStorefrontRepo{
		store:   ports.Storefront{BusinessID: "business-1", Name: "Adwoa Studio", Live: true},
		designs: []ports.StorefrontDesign{{}},
	}
	view, err := newStorefrontService(storefront).LoadStorefront(context.Background(), "adwoa-studio")
	if err != nil {
		t.Fatalf("load storefront: %v", err)
	}
	if len(view.Designs) != 1 {
		t.Fatalf("expected the live store's designs, got %+v", view)
	}
}

// A direct/shared design link into a not-live store reports not-found, exactly
// like an unknown design.
func TestGetStoreDesignNotLiveIsUnavailable(t *testing.T) {
	t.Parallel()

	storefront := &fakeStorefrontRepo{
		store: ports.Storefront{BusinessID: "business-1", Live: false},
	}
	_, err := newStorefrontService(storefront).GetStoreDesign(context.Background(), "kente-wrap-dress-x1")
	if err != ports.ErrNotFound {
		t.Fatalf("expected not found for a not-live store's design, got %v", err)
	}
}
