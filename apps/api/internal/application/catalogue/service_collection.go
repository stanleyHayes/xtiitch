package catalogueapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

type UpdateCollectionCommand struct {
	Scope        common.TenantScope
	ActorRole    business.UserRole
	CollectionID common.ID
	Name         string
	Theme        string
	Sequence     int
}

// UpdateCollection edits a collection's name, theme, and display order. The
// handle stays immutable so existing share links keep resolving.
func (s Service) UpdateCollection(ctx context.Context, cmd UpdateCollectionCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	name := strings.TrimSpace(cmd.Name)
	if name == "" {
		return ErrInvalidInput
	}
	return s.catalogue.UpdateCollection(ctx, cmd.Scope, ports.CollectionUpdateInput{
		CollectionID: cmd.CollectionID,
		BusinessID:   cmd.Scope.BusinessID,
		Name:         name,
		Theme:        strings.TrimSpace(cmd.Theme),
		Sequence:     cmd.Sequence,
	})
}

type StorefrontView struct {
	Store       ports.Storefront
	Collections []catalogue.Collection
	Designs     []ports.StorefrontDesign
}

// LoadStorefront resolves a store handle and returns its active catalogue. The
// repository enforces that only active, non-retired items are returned. A store
// that is not LIVE (owner not Ghana-Card-verified, or no payout details) resolves
// to its shell only — no designs, no collections — so a direct visit shows the
// store as not-live rather than its catalogue (verification gates selling,
// never paying; the marketplace directory already excludes such stores).
func (s Service) LoadStorefront(ctx context.Context, handle string) (StorefrontView, error) {
	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(handle))
	if err != nil {
		return StorefrontView{}, err
	}
	if !store.Live {
		return StorefrontView{Store: store}, nil
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

// GetStoreDesign returns a public storefront design with its stored colour
// variations attached so the storefront can render colour swatches. The
// variations are read under the resolved business's tenant scope (their table is
// tenant-isolated), which is safe because the storefront read already resolved
// the design to that business.
func (s Service) GetStoreDesign(ctx context.Context, handle string) (ports.StorefrontDesign, error) {
	design, err := s.storefront.GetActiveDesignByHandle(ctx, strings.TrimSpace(handle))
	if err != nil {
		return ports.StorefrontDesign{}, err
	}
	if !design.Store.Live {
		// A not-live store's designs do not display, even via a direct/shared link
		// (verification gates selling). Report it exactly like an unknown design.
		return ports.StorefrontDesign{}, ports.ErrNotFound
	}
	scope := common.TenantScope{BusinessID: design.Design.BusinessID}
	// §14.1 design performance: count the public view. Best-effort on purpose —
	// a counter hiccup must never break a storefront page (and the public read
	// already resolved the tenant, so this is a cheap scoped UPDATE).
	if s.views != nil {
		_ = s.views.RecordDesignView(ctx, scope, design.Design.ID)
	}
	variations, err := s.catalogue.ListDesignVariations(ctx, scope, design.Design.ID)
	if err != nil {
		return ports.StorefrontDesign{}, err
	}
	design.Design.Variations = variations
	// Resolve the EFFECTIVE size-band label/chart for the storefront: any
	// per-design override wins over the master band (Xtiitch-Updates §1a/§6). The
	// overrides table is tenant-isolated, read under the resolved business's scope.
	overrides, err := s.catalogue.ListDesignSizeBandOverrides(ctx, scope, design.Design.ID)
	if err != nil {
		return ports.StorefrontDesign{}, err
	}
	design.Prices = catalogue.ApplyBandOverrides(design.Prices, overrides)
	return design, nil
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
	if !store.Live {
		// A not-live store displays nothing (same rule as LoadStorefront).
		return store, nil, nil
	}
	designs, err := s.storefront.SearchActiveDesigns(ctx, store.BusinessID, strings.TrimSpace(query))
	return store, designs, err
}
