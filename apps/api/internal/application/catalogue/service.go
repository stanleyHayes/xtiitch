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

// ErrWaitlistUnavailable is returned when a customer tries to join a design's
// waiting list but the store's plan does not grant the design_waitlist benefit.
var ErrWaitlistUnavailable = errors.New("waiting list not available for this store")

// ErrStoreNotFound is returned when a public store handle does not resolve.
var ErrStoreNotFound = errors.New("store not found")

// ErrDesignUnavailable is returned when a design handle does not resolve to an
// active design within the resolved store.
var ErrDesignUnavailable = errors.New("design unavailable")

// validWaitlistStatuses are the dashboard-settable states for an entry.
var validWaitlistStatuses = map[string]bool{
	"waiting":  true,
	"notified": true,
	"closed":   true,
}

type Service struct {
	catalogue  ports.CatalogueRepository
	storefront ports.StorefrontRepository
	settings   ports.StoreSettingsRepository
	promotions ports.PromotionRepository
	waitlist   ports.DesignWaitlistRepository
	ids        ports.IDGenerator
}

type Dependencies struct {
	Catalogue  ports.CatalogueRepository
	Storefront ports.StorefrontRepository
	Settings   ports.StoreSettingsRepository
	Promotions ports.PromotionRepository
	Waitlist   ports.DesignWaitlistRepository
	IDs        ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{
		catalogue:  deps.Catalogue,
		storefront: deps.Storefront,
		settings:   deps.Settings,
		promotions: deps.Promotions,
		waitlist:   deps.Waitlist,
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
	// Server-side entitlement gate: resolve the business's plan benefits and coerce
	// any customization its plan does not grant back to the Xtiitch default before
	// persisting. This is the enforceable backstop behind the dashboard's UI gating —
	// a business on a plan without custom_* simply cannot persist that customization.
	profile, err := s.settings.GetProfile(ctx, cmd.Scope)
	if err != nil {
		return err
	}
	settings := coerceStoreCustomization(business.Entitlements(profile.Entitlements), cmd.Settings)
	return s.settings.Update(ctx, cmd.Scope, settings)
}

// coerceStoreCustomization forces plan-gated storefront fields back to their
// defaults whenever the business is not entitled to the matching benefit.
func coerceStoreCustomization(ent business.Entitlements, settings ports.StoreSettings) ports.StoreSettings {
	settings.BrandColor = strings.TrimSpace(settings.BrandColor)
	settings.LogoURL = strings.TrimSpace(settings.LogoURL)
	settings.BannerURL = strings.TrimSpace(settings.BannerURL)
	settings.LayoutVariant = strings.TrimSpace(settings.LayoutVariant)

	if !ent.Has(business.FeatureCustomBrandColor) || settings.BrandColor == "" {
		settings.BrandColor = business.DefaultBrandColor
	}
	if !ent.Has(business.FeatureCustomLogo) {
		settings.LogoURL = ""
	}
	if !ent.Has(business.FeatureCustomBanner) {
		settings.BannerURL = ""
	}
	if !ent.Has(business.FeatureCustomLayout) || !business.IsValidLayoutVariant(settings.LayoutVariant) {
		settings.LayoutVariant = business.DefaultLayoutVariant
	}
	return settings
}

func (s Service) GetStoreProfile(ctx context.Context, scope common.TenantScope) (ports.StoreProfile, error) {
	return s.settings.GetProfile(ctx, scope)
}

// --- Design waitlist ---

type JoinDesignWaitlistCommand struct {
	StoreHandle     string
	DesignHandle    string
	CustomerName    string
	CustomerContact string
	Note            string
}

// JoinDesignWaitlist registers a customer's interest in a design from the public
// storefront. It resolves the store + design, enforces the design_waitlist plan
// benefit, and verifies the design belongs to the resolved store (tenant safety).
func (s Service) JoinDesignWaitlist(ctx context.Context, cmd JoinDesignWaitlistCommand) error {
	name := strings.TrimSpace(cmd.CustomerName)
	contact := strings.TrimSpace(cmd.CustomerContact)
	if name == "" || contact == "" {
		return ErrInvalidInput
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return ErrStoreNotFound
		}
		return err
	}
	if !store.WaitlistEnabled {
		return ErrWaitlistUnavailable
	}

	design, err := s.storefront.GetActiveDesignByHandle(ctx, strings.TrimSpace(cmd.DesignHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return ErrDesignUnavailable
		}
		return err
	}
	if design.Design.BusinessID != store.BusinessID {
		return ErrDesignUnavailable
	}

	scope := common.TenantScope{BusinessID: store.BusinessID}
	return s.waitlist.Join(ctx, scope, ports.DesignWaitlistEntryInput{
		EntryID:         s.ids.NewID(),
		BusinessID:      store.BusinessID,
		DesignID:        design.Design.ID,
		CustomerName:    name,
		CustomerContact: contact,
		Note:            strings.TrimSpace(cmd.Note),
	})
}

func (s Service) ListWaitlistEntries(ctx context.Context, scope common.TenantScope) ([]ports.DesignWaitlistEntry, error) {
	return s.waitlist.List(ctx, scope)
}

type UpdateWaitlistStatusCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	EntryID   common.ID
	Status    string
}

func (s Service) UpdateWaitlistStatus(ctx context.Context, cmd UpdateWaitlistStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if !validWaitlistStatuses[cmd.Status] {
		return ErrInvalidInput
	}
	return s.waitlist.UpdateStatus(ctx, cmd.Scope, cmd.EntryID, cmd.Status)
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

// ListPublicShops returns the public directory of verified, active storefronts.
func (s Service) ListPublicShops(ctx context.Context) ([]ports.PublicShop, error) {
	return s.storefront.ListPublicShops(ctx)
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
