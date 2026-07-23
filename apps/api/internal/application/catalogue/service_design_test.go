package catalogueapp

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
	below := int64(50)

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

func TestCreateDesignNormalizesStyleCategory(t *testing.T) {
	t.Parallel()

	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		ActorRole:     business.UserRoleOwner,
		Title:         "Engagement gown",
		StyleCategory: "Kente Adire",
	})
	if err != nil {
		t.Fatalf("create design: %v", err)
	}
	if repo.design.StyleCategory != "kente_adire" {
		t.Fatalf("expected normalized category, got %q", repo.design.StyleCategory)
	}
}

func TestCreateDesignRejectsUnknownStyleCategory(t *testing.T) {
	t.Parallel()

	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		ActorRole:     business.UserRoleOwner,
		Title:         "Mystery piece",
		StyleCategory: "costumes",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	if repo.created {
		t.Fatal("expected no design created for an unknown style category")
	}
}

func TestCustomisationDesignZeroDepositMeansUnset(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)
	zero := int64(0)

	// A 0 deposit override is "unset", not an error: it is stored as NULL so the
	// deposit resolves to the store default / GHS 1 floor at quote time.
	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		Title:                "Bespoke gown",
		CustomisationAllowed: true,
		DepositOverrideMinor: &zero,
	})
	if err != nil {
		t.Fatalf("create design: %v", err)
	}
	if repo.design.DepositOverrideMinor != nil {
		t.Fatalf("zero deposit override must be stored as unset, got %v", *repo.design.DepositOverrideMinor)
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
func TestCreateDesignVariationSurfacesPlanCap(t *testing.T) {
	t.Parallel()
	// The repository enforces the cap and returns ErrVariationLimitReached; the
	// service must surface it unchanged so the HTTP layer can map it to a 409.
	repo := &fakeCatalogueRepo{createVariationErr: ports.ErrVariationLimitReached}
	service := newService(repo)

	_, err := service.CreateDesignVariation(context.Background(), CreateDesignVariationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		DesignID:  "design-1",
		Name:      "Red",
	})
	if !errors.Is(err, ports.ErrVariationLimitReached) {
		t.Fatalf("expected variation limit reached, got %v", err)
	}
}
func TestCreateDesignVariationRequiresManageRole(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesignVariation(context.Background(), CreateDesignVariationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleStaff,
		DesignID:  "design-1",
		Name:      "Red",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected forbidden for staff, got %v", err)
	}
	if repo.variationCreated {
		t.Fatal("staff variation creation must stop before the repository write")
	}
}
func TestCreateDesignVariationTrimsNameAndImages(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesignVariation(context.Background(), CreateDesignVariationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		DesignID:  "design-1",
		Name:      "  Royal Blue  ",
		Images:    []string{" a.jpg ", "", "  ", "b.jpg"},
	})
	if err != nil {
		t.Fatalf("create variation: %v", err)
	}
	if repo.createdVariation.Name != "Royal Blue" {
		t.Fatalf("name not trimmed: %q", repo.createdVariation.Name)
	}
	if len(repo.createdVariation.Images) != 2 ||
		repo.createdVariation.Images[0] != "a.jpg" || repo.createdVariation.Images[1] != "b.jpg" {
		t.Fatalf("images not normalized: %+v", repo.createdVariation.Images)
	}
}
func TestCreateDesignVariationRejectsEmptyName(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesignVariation(context.Background(), CreateDesignVariationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		DesignID:  "design-1",
		Name:      "   ",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	if repo.variationCreated {
		t.Fatal("must not create a variation with a blank name")
	}
}
func TestCustomisationDesignKeepsBespokeDisplayAmount(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		Title:                "Bespoke gown",
		CustomisationAllowed: true,
		BespokeDisplayMinor:  45000,
	})
	if err != nil {
		t.Fatalf("create design: %v", err)
	}
	if repo.design.BespokeDisplayMinor != 45000 {
		t.Fatalf("bespoke display amount not persisted, got %d", repo.design.BespokeDisplayMinor)
	}
}
func TestMadeToWearDesignDropsBespokeDisplayAmount(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		Title:                "Listed dress",
		CustomisationAllowed: false,
		BespokeDisplayMinor:  45000,
	})
	if err != nil {
		t.Fatalf("create design: %v", err)
	}
	if repo.design.BespokeDisplayMinor != 0 {
		t.Fatalf("made-to-wear design must not carry a bespoke display amount, got %d", repo.design.BespokeDisplayMinor)
	}
}
func TestUpdateDesignRoundTripsBespokeDisplayAmount(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	err := service.UpdateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		DesignID:             "design-1",
		Title:                "Bespoke gown",
		CustomisationAllowed: true,
		BespokeDisplayMinor:  60000,
	})
	if err != nil {
		t.Fatalf("update design: %v", err)
	}
	if repo.design.BespokeDisplayMinor != 60000 {
		t.Fatalf("bespoke display amount not round-tripped, got %d", repo.design.BespokeDisplayMinor)
	}
}
func TestDesignRejectsNegativeBespokeDisplayAmount(t *testing.T) {
	t.Parallel()
	repo := &fakeCatalogueRepo{}
	service := newService(repo)

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:                common.TenantScope{BusinessID: "business-1"},
		ActorRole:            business.UserRoleOwner,
		Title:                "Bad",
		CustomisationAllowed: true,
		BespokeDisplayMinor:  -1,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	if repo.created {
		t.Fatal("must not create a design with a negative bespoke display amount")
	}
}
