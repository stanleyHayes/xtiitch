package catalogueapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

var ErrInvalidInput = errors.New("invalid catalogue input")

type Service struct {
	catalogue  ports.CatalogueRepository
	storefront ports.StorefrontRepository
	settings   ports.StoreSettingsRepository
	promotions ports.PromotionRepository
	ids        ports.IDGenerator
}

type Dependencies struct {
	Catalogue  ports.CatalogueRepository
	Storefront ports.StorefrontRepository
	Settings   ports.StoreSettingsRepository
	Promotions ports.PromotionRepository
	IDs        ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{
		catalogue:  deps.Catalogue,
		storefront: deps.Storefront,
		settings:   deps.Settings,
		promotions: deps.Promotions,
		ids:        deps.IDs,
	}
}

func (s Service) newHandle(name string) string {
	return catalogue.BuildHandle(name, catalogue.NewHandleToken(s.ids.NewID().String()))
}

// --- Store settings ---

func (s Service) GetSettings(ctx context.Context, scope common.TenantScope) (ports.StoreSettings, error) {
	return s.settings.Get(ctx, scope)
}

type UpdateSettingsCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Settings  ports.StoreSettings
}

func (s Service) UpdateSettings(ctx context.Context, cmd UpdateSettingsCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.settings.Update(ctx, cmd.Scope, cmd.Settings)
}

func (s Service) GetStoreProfile(ctx context.Context, scope common.TenantScope) (ports.StoreProfile, error) {
	return s.settings.GetProfile(ctx, scope)
}

// --- Collections ---

type CreateCollectionCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Name      string
	Theme     string
	Sequence  int
}

func (s Service) CreateCollection(ctx context.Context, cmd CreateCollectionCommand) (common.ID, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return "", err
	}
	name := strings.TrimSpace(cmd.Name)
	if name == "" {
		return "", ErrInvalidInput
	}
	id := s.ids.NewID()
	err := s.catalogue.CreateCollection(ctx, cmd.Scope, ports.CollectionInput{
		CollectionID: id,
		BusinessID:   cmd.Scope.BusinessID,
		Name:         name,
		Theme:        strings.TrimSpace(cmd.Theme),
		Handle:       s.newHandle(name),
		Sequence:     cmd.Sequence,
	})
	return id, err
}

func (s Service) ListCollections(ctx context.Context, scope common.TenantScope) ([]catalogue.Collection, error) {
	return s.catalogue.ListCollections(ctx, scope)
}

type CollectionStatusCommand struct {
	Scope        common.TenantScope
	ActorRole    business.UserRole
	CollectionID common.ID
}

func (s Service) RetireCollection(ctx context.Context, cmd CollectionStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.catalogue.SetCollectionStatus(ctx, cmd.Scope, cmd.CollectionID, catalogue.StatusRetired)
}

func (s Service) RestoreCollection(ctx context.Context, cmd CollectionStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.catalogue.SetCollectionStatus(ctx, cmd.Scope, cmd.CollectionID, catalogue.StatusActive)
}

func (s Service) DeleteCollection(ctx context.Context, cmd CollectionStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.catalogue.SetCollectionStatus(ctx, cmd.Scope, cmd.CollectionID, catalogue.StatusDeleted)
}

// --- Designs ---

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
		DepositOverrideMinor: cmd.DepositOverrideMinor,
		Handle:               s.newHandle(title),
		Sequence:             cmd.Sequence,
	})
	return id, createErr
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
		DepositOverrideMinor: cmd.DepositOverrideMinor,
		Sequence:             cmd.Sequence,
	})
}

func (s Service) ListDesigns(ctx context.Context, scope common.TenantScope) ([]catalogue.Design, error) {
	return s.catalogue.ListDesigns(ctx, scope)
}

func (s Service) GetDesign(ctx context.Context, scope common.TenantScope, id common.ID) (catalogue.Design, error) {
	return s.catalogue.GetDesign(ctx, scope, id)
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

// --- Size bands & pricing ---

type CreateSizeBandCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Label     string
	Sequence  int
}

func (s Service) CreateSizeBand(ctx context.Context, cmd CreateSizeBandCommand) (common.ID, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return "", err
	}
	label := strings.TrimSpace(cmd.Label)
	if label == "" {
		return "", ErrInvalidInput
	}
	id := s.ids.NewID()
	err := s.catalogue.CreateSizeBand(ctx, cmd.Scope, ports.SizeBandInput{
		SizeBandID: id,
		BusinessID: cmd.Scope.BusinessID,
		Label:      label,
		Sequence:   cmd.Sequence,
	})
	return id, err
}

func (s Service) ListSizeBands(ctx context.Context, scope common.TenantScope) ([]catalogue.SizeBand, error) {
	return s.catalogue.ListSizeBands(ctx, scope)
}

type SetDesignPriceCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	DesignID   common.ID
	SizeBandID common.ID
	PriceMinor int64
}

func (s Service) SetDesignPrice(ctx context.Context, cmd SetDesignPriceCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.PriceMinor < 0 {
		return ErrInvalidInput
	}
	return s.catalogue.SetDesignPrice(ctx, cmd.Scope, cmd.DesignID, cmd.SizeBandID, cmd.PriceMinor)
}

func (s Service) ListDesignPrices(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.BandPrice, error) {
	return s.catalogue.ListDesignPrices(ctx, scope, designID)
}

// --- Public storefront ---

type StorefrontView struct {
	Store       ports.Storefront
	Collections []catalogue.Collection
	Designs     []ports.StorefrontDesign
}

// LoadStorefront resolves a store handle and returns its active catalogue. The
// repository enforces that only active, non-retired items are returned.
func (s Service) LoadStorefront(ctx context.Context, handle string) (StorefrontView, error) {
	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(handle))
	if err != nil {
		return StorefrontView{}, err
	}

	designs, err := s.storefront.ListActiveDesigns(ctx, store.BusinessID)
	if err != nil {
		return StorefrontView{}, err
	}

	var collections []catalogue.Collection
	if store.Settings.CollectionsEnabled {
		collections, err = s.storefront.ListActiveCollections(ctx, store.BusinessID)
		if err != nil {
			return StorefrontView{}, err
		}
	}

	return StorefrontView{Store: store, Collections: collections, Designs: designs}, nil
}

func (s Service) GetStoreDesign(ctx context.Context, handle string) (ports.StorefrontDesign, error) {
	return s.storefront.GetActiveDesignByHandle(ctx, strings.TrimSpace(handle))
}

func (s Service) GetStoreCollection(ctx context.Context, handle string) (ports.StorefrontCollection, error) {
	return s.storefront.GetActiveCollectionByHandle(ctx, strings.TrimSpace(handle))
}

func (s Service) SearchStore(ctx context.Context, handle string, query string) (ports.Storefront, []ports.StorefrontDesign, error) {
	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(handle))
	if err != nil {
		return ports.Storefront{}, nil, err
	}
	designs, err := s.storefront.SearchActiveDesigns(ctx, store.BusinessID, strings.TrimSpace(query))
	return store, designs, err
}

func authorizeCatalogueManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return ErrInvalidInput
	}
	if role == business.UserRoleOwner || role == business.UserRoleAdmin {
		return nil
	}
	return authdomain.ErrForbidden
}
