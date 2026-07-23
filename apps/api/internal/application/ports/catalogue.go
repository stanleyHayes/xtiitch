package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type StoreSettingsRepository interface {
	Get(ctx context.Context, scope common.TenantScope) (StoreSettings, error)
	Update(ctx context.Context, scope common.TenantScope, settings StoreSettings) error
	GetProfile(ctx context.Context, scope common.TenantScope) (StoreProfile, error)
}

// CatalogueRepository is the dashboard-facing, tenant-scoped catalogue store.
type CatalogueRepository interface {
	CreateCollection(ctx context.Context, scope common.TenantScope, input CollectionInput) error
	ListCollections(ctx context.Context, scope common.TenantScope) ([]catalogue.Collection, error)
	UpdateCollection(ctx context.Context, scope common.TenantScope, input CollectionUpdateInput) error
	SetCollectionStatus(ctx context.Context, scope common.TenantScope, collectionID common.ID, status catalogue.Status) error

	CreateDesign(ctx context.Context, scope common.TenantScope, input DesignInput) error
	ListDesigns(ctx context.Context, scope common.TenantScope) ([]catalogue.Design, error)
	GetDesign(ctx context.Context, scope common.TenantScope, designID common.ID) (catalogue.Design, error)
	UpdateDesign(ctx context.Context, scope common.TenantScope, input DesignInput) error
	SetDesignStatus(ctx context.Context, scope common.TenantScope, designID common.ID, status catalogue.Status) error
	CreateFeedbackReport(ctx context.Context, input FeedbackReportInput) error

	ListDesignVariations(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.DesignVariation, error)
	CreateDesignVariation(ctx context.Context, scope common.TenantScope, input DesignVariationInput) error
	UpdateDesignVariation(ctx context.Context, scope common.TenantScope, input DesignVariationUpdateInput) error
	DeleteDesignVariation(ctx context.Context, scope common.TenantScope, variationID common.ID) error
	ReorderDesignVariations(ctx context.Context, scope common.TenantScope, designID common.ID, orderedIDs []common.ID) error

	CreateSizeBand(ctx context.Context, scope common.TenantScope, input SizeBandInput) error
	ListSizeBands(ctx context.Context, scope common.TenantScope) ([]catalogue.SizeBand, error)
	UpdateSizeBand(ctx context.Context, scope common.TenantScope, input SizeBandUpdateInput) error
	DeleteSizeBand(ctx context.Context, scope common.TenantScope, sizeBandID common.ID) error

	SetDesignPrice(ctx context.Context, scope common.TenantScope, designID common.ID, sizeBandID common.ID, priceMinor int64) error
	ListDesignPrices(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.BandPrice, error)

	// Per-design size-band overrides: a design may override a master band's label
	// and/or chart without affecting the master or other designs.
	SetDesignSizeBandOverride(ctx context.Context, scope common.TenantScope, input DesignSizeBandOverrideInput) error
	DeleteDesignSizeBandOverride(ctx context.Context, scope common.TenantScope, designID common.ID, sizeBandID common.ID) error
	ListDesignSizeBandOverrides(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.DesignSizeBandOverride, error)
}

// StorefrontRepository serves the public, account-free storefront. Handle
// resolution is intentionally cross-tenant and runs with the RLS bypass; once a
// store is resolved, its catalogue reads are scoped to that one business and
// return only active items.
type StorefrontRepository interface {
	ResolveStore(ctx context.Context, handle string) (Storefront, error)
	ListActiveDesigns(ctx context.Context, businessID common.ID) ([]StorefrontDesign, error)
	GetActiveDesignByHandle(ctx context.Context, handle string) (StorefrontDesign, error)
	ListActiveCollections(ctx context.Context, businessID common.ID) ([]catalogue.Collection, error)
	GetActiveCollectionByHandle(ctx context.Context, handle string) (StorefrontCollection, error)
	SearchActiveDesigns(ctx context.Context, businessID common.ID, query string) ([]StorefrontDesign, error)
	// ListPublicShops returns the public directory of verified, active shops, each
	// with a small sample of its active designs. Cross-tenant and RLS-bypassed,
	// like store resolution.
	ListPublicShops(ctx context.Context) ([]PublicShop, error)
}

// DesignWaitlistRepository persists and reads design waiting-list registrations.
// Join is a public write scoped to the resolved business; List/UpdateStatus are
// tenant-scoped dashboard operations.
type DesignWaitlistRepository interface {
	Join(ctx context.Context, scope common.TenantScope, input DesignWaitlistEntryInput) error
	List(ctx context.Context, scope common.TenantScope) ([]DesignWaitlistEntry, error)
	UpdateStatus(ctx context.Context, scope common.TenantScope, entryID common.ID, status string) error
}
