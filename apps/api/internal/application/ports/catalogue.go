package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// StoreSettings holds a business's feature switches (Technical Specification
// section 4.3).
type StoreSettings struct {
	BespokeEnabled       bool
	MeasurementsEnabled  bool
	CustomisationEnabled bool
	CollectionsEnabled   bool
	DeliveryEnabled      bool
	DispatchEnabled      bool
	BrandColor           string
	// Plan-gated storefront customizations. Only honoured when the business's plan
	// grants the matching feature (custom_logo / custom_banner / custom_layout);
	// otherwise the service coerces them back to defaults before persisting.
	LogoURL       string
	BannerURL     string
	LayoutVariant string
}

type StoreSettingsRepository interface {
	Get(ctx context.Context, scope common.TenantScope) (StoreSettings, error)
	Update(ctx context.Context, scope common.TenantScope, settings StoreSettings) error
	GetProfile(ctx context.Context, scope common.TenantScope) (StoreProfile, error)
}

// StoreProfile is the authenticated business's own profile, for the dashboard.
type StoreProfile struct {
	Name               string
	Handle             string
	VerificationStatus string
	PlanCode           string
	// Entitlements is the business's resolved benefit set from its plan's features,
	// so the dashboard knows which storefront customizations to unlock.
	Entitlements map[string]bool
}

// CatalogueRepository is the dashboard-facing, tenant-scoped catalogue store.
type CatalogueRepository interface {
	CreateCollection(ctx context.Context, scope common.TenantScope, input CollectionInput) error
	ListCollections(ctx context.Context, scope common.TenantScope) ([]catalogue.Collection, error)
	SetCollectionStatus(ctx context.Context, scope common.TenantScope, collectionID common.ID, status catalogue.Status) error

	CreateDesign(ctx context.Context, scope common.TenantScope, input DesignInput) error
	ListDesigns(ctx context.Context, scope common.TenantScope) ([]catalogue.Design, error)
	GetDesign(ctx context.Context, scope common.TenantScope, designID common.ID) (catalogue.Design, error)
	UpdateDesign(ctx context.Context, scope common.TenantScope, input DesignInput) error
	SetDesignStatus(ctx context.Context, scope common.TenantScope, designID common.ID, status catalogue.Status) error

	CreateSizeBand(ctx context.Context, scope common.TenantScope, input SizeBandInput) error
	ListSizeBands(ctx context.Context, scope common.TenantScope) ([]catalogue.SizeBand, error)

	SetDesignPrice(ctx context.Context, scope common.TenantScope, designID common.ID, sizeBandID common.ID, priceMinor int64) error
	ListDesignPrices(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.BandPrice, error)
}

type CollectionInput struct {
	CollectionID common.ID
	BusinessID   common.ID
	Name         string
	Theme        string
	Handle       string
	Sequence     int
}

type DesignInput struct {
	DesignID             common.ID
	BusinessID           common.ID
	CollectionID         *common.ID
	Title                string
	Description          string
	Images               []string
	CustomisationAllowed bool
	DepositOverrideMinor *int64
	Handle               string
	Sequence             int
}

type SizeBandInput struct {
	SizeBandID common.ID
	BusinessID common.ID
	Label      string
	Sequence   int
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

// PublicShopDesign is a lightweight design sample for the discovery directory.
type PublicShopDesign struct {
	Title      string
	Handle     string
	Image      string
	PriceMinor int64
}

// PublicShop is a single verified, active storefront as listed in the public
// shops directory on the marketing site.
type PublicShop struct {
	BusinessID  common.ID
	Name        string
	Handle      string
	BrandColor  string
	DesignCount int
	Designs     []PublicShopDesign
}

type Storefront struct {
	BusinessID common.ID
	Name       string
	Handle     string
	BrandColor string
	// DefaultDepositMinor is the business's store-default custom-order deposit in
	// GHS pesewas (always >= the platform floor). Public storefront clients can
	// display it as the expected deposit before checkout; the backend remains the
	// source of truth when the order is created.
	DefaultDepositMinor int64
	MeasurementFields   []MeasurementField
	Settings            StoreSettings
}

type MeasurementField struct {
	FieldID  common.ID
	Label    string
	Unit     string
	Sequence int
}

type StorefrontDesign struct {
	Design catalogue.Design
	Prices []catalogue.BandPrice
	Store  Storefront
}

type StorefrontCollection struct {
	Collection catalogue.Collection
	Designs    []StorefrontDesign
}
