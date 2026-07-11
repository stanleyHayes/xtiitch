package catalogueapp

import (
	"context"
	"errors"
	"testing"

	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
