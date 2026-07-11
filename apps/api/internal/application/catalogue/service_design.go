package catalogueapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

type DesignCommand struct {
	Scope                common.TenantScope
	ActorRole            business.UserRole
	DesignID             common.ID
	CollectionID         *common.ID
	Title                string
	Description          string
	Images               []string
	CustomisationAllowed bool
	DepositOverrideMinor *int64
	BespokeDisplayMinor  int64
	Sequence             int
}

func (cmd DesignCommand) validate() (string, error) {
	title := strings.TrimSpace(cmd.Title)
	if title == "" {
		return "", ErrInvalidInput
	}
	if cmd.DepositOverrideMinor != nil {
		if err := money.ValidateDepositConfig(*cmd.DepositOverrideMinor); err != nil {
			return "", errors.Join(ErrInvalidInput, err)
		}
	}
	if cmd.BespokeDisplayMinor < 0 {
		return "", ErrInvalidInput
	}
	return title, nil
}
func (s Service) CreateDesign(ctx context.Context, cmd DesignCommand) (common.ID, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return "", err
	}
	title, err := cmd.validate()
	if err != nil {
		return "", err
	}
	id := s.ids.NewID()
	createErr := s.catalogue.CreateDesign(ctx, cmd.Scope, ports.DesignInput{
		DesignID:             id,
		BusinessID:           cmd.Scope.BusinessID,
		CollectionID:         cmd.CollectionID,
		Title:                title,
		Description:          strings.TrimSpace(cmd.Description),
		Images:               cmd.Images,
		CustomisationAllowed: cmd.CustomisationAllowed,
		DepositOverrideMinor: cmd.depositForMode(),
		BespokeDisplayMinor:  cmd.displayForMode(),
		Handle:               s.newHandle(title),
		Sequence:             cmd.Sequence,
	})
	return id, createErr
}

// depositForMode enforces pricing-mode exclusivity: only a customisation design
// carries a deposit. A made-to-wear design is priced by its size bands, so any
// deposit value is coerced away (deposit is N/A on the storefront).
func (cmd DesignCommand) depositForMode() *int64 {
	if !cmd.CustomisationAllowed {
		return nil
	}
	return cmd.DepositOverrideMinor
}

// displayForMode mirrors depositForMode for the bespoke display amount: the
// indicative custom-order price only applies to a customisation design, so it is
// coerced to 0 for a made-to-wear design (priced by its size bands instead).
func (cmd DesignCommand) displayForMode() int64 {
	if !cmd.CustomisationAllowed {
		return 0
	}
	return cmd.BespokeDisplayMinor
}
func (s Service) UpdateDesign(ctx context.Context, cmd DesignCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	title, err := cmd.validate()
	if err != nil {
		return err
	}
	return s.catalogue.UpdateDesign(ctx, cmd.Scope, ports.DesignInput{
		DesignID:             cmd.DesignID,
		BusinessID:           cmd.Scope.BusinessID,
		CollectionID:         cmd.CollectionID,
		Title:                title,
		Description:          strings.TrimSpace(cmd.Description),
		Images:               cmd.Images,
		CustomisationAllowed: cmd.CustomisationAllowed,
		DepositOverrideMinor: cmd.depositForMode(),
		BespokeDisplayMinor:  cmd.displayForMode(),
		Sequence:             cmd.Sequence,
	})
}
func (s Service) ListDesigns(ctx context.Context, scope common.TenantScope) ([]catalogue.Design, error) {
	return s.catalogue.ListDesigns(ctx, scope)
}

// GetDesign returns a single design with its stored colour variations attached,
// for the dashboard's design editor.
func (s Service) GetDesign(ctx context.Context, scope common.TenantScope, id common.ID) (catalogue.Design, error) {
	design, err := s.catalogue.GetDesign(ctx, scope, id)
	if err != nil {
		return catalogue.Design{}, err
	}
	variations, err := s.catalogue.ListDesignVariations(ctx, scope, design.ID)
	if err != nil {
		return catalogue.Design{}, err
	}
	design.Variations = variations
	return design, nil
}

type DesignStatusCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	DesignID  common.ID
}

func (s Service) RetireDesign(ctx context.Context, cmd DesignStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.catalogue.SetDesignStatus(ctx, cmd.Scope, cmd.DesignID, catalogue.StatusRetired)
}
func (s Service) RestoreDesign(ctx context.Context, cmd DesignStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.catalogue.SetDesignStatus(ctx, cmd.Scope, cmd.DesignID, catalogue.StatusActive)
}
func (s Service) DeleteDesign(ctx context.Context, cmd DesignStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.catalogue.SetDesignStatus(ctx, cmd.Scope, cmd.DesignID, catalogue.StatusDeleted)
}

// normalizeVariationImages trims image entries and drops the blanks, returning a
// non-nil slice so an empty image set is stored as the column's '{}' default.
func normalizeVariationImages(images []string) []string {
	cleaned := make([]string, 0, len(images))
	for _, image := range images {
		if trimmed := strings.TrimSpace(image); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	return cleaned
}
func (s Service) ListDesignVariations(
	ctx context.Context,
	scope common.TenantScope,
	designID common.ID) ([]catalogue.DesignVariation,
	error,
) {
	return s.catalogue.ListDesignVariations(ctx, scope, designID)
}

type CreateDesignVariationCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	DesignID  common.ID
	Name      string
	Images    []string
	IsDefault bool
	Sequence  int
}

// CreateDesignVariation adds a colour variation (name + ordered images) to a
// design. The repository enforces the plan's per-design variation cap (counting
// the implicit default) and the plan image cap, returning typed errors the HTTP
// layer maps to 409.
func (s Service) CreateDesignVariation(ctx context.Context, cmd CreateDesignVariationCommand) (common.ID, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return "", err
	}
	name := strings.TrimSpace(cmd.Name)
	if name == "" || cmd.DesignID.IsZero() {
		return "", ErrInvalidInput
	}
	id := s.ids.NewID()
	err := s.catalogue.CreateDesignVariation(ctx, cmd.Scope, ports.DesignVariationInput{
		VariationID: id,
		DesignID:    cmd.DesignID,
		BusinessID:  cmd.Scope.BusinessID,
		Name:        name,
		Images:      normalizeVariationImages(cmd.Images),
		IsDefault:   cmd.IsDefault,
		Sequence:    cmd.Sequence,
	})
	return id, err
}

type UpdateDesignVariationCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	VariationID common.ID
	Name        string
	Images      []string
	IsDefault   bool
	Sequence    int
}

func (s Service) UpdateDesignVariation(ctx context.Context, cmd UpdateDesignVariationCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	name := strings.TrimSpace(cmd.Name)
	if name == "" || cmd.VariationID.IsZero() {
		return ErrInvalidInput
	}
	return s.catalogue.UpdateDesignVariation(ctx, cmd.Scope, ports.DesignVariationUpdateInput{
		VariationID: cmd.VariationID,
		BusinessID:  cmd.Scope.BusinessID,
		Name:        name,
		Images:      normalizeVariationImages(cmd.Images),
		IsDefault:   cmd.IsDefault,
		Sequence:    cmd.Sequence,
	})
}

type DeleteDesignVariationCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	VariationID common.ID
}

func (s Service) DeleteDesignVariation(ctx context.Context, cmd DeleteDesignVariationCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.VariationID.IsZero() {
		return ErrInvalidInput
	}
	return s.catalogue.DeleteDesignVariation(ctx, cmd.Scope, cmd.VariationID)
}

type ReorderDesignVariationsCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	DesignID   common.ID
	OrderedIDs []common.ID
}

func (s Service) ReorderDesignVariations(ctx context.Context, cmd ReorderDesignVariationsCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.DesignID.IsZero() {
		return ErrInvalidInput
	}
	return s.catalogue.ReorderDesignVariations(ctx, cmd.Scope, cmd.DesignID, cmd.OrderedIDs)
}
