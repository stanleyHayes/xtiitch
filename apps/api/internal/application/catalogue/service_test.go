package catalogueapp

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
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
		Scope: common.TenantScope{BusinessID: "business-1"},
		Name:  "   ",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
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
