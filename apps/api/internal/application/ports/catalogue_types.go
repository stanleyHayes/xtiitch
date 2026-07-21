package ports

import (
	"time"

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
	// FeePassXtiitchFee / FeePassTax / FeePassPaystackFee are the owner's three
	// fee pass-down tick boxes (§4.4): a ticked fee is added to the customer's
	// checkout (the Xtiitch and Paystack fees inside one combined "Transaction
	// fee" line, the tax on its own line); an unticked fee is deducted from the
	// store's share. All default false (the owner absorbs every fee).
	FeePassXtiitchFee  bool
	FeePassTax         bool
	FeePassPaystackFee bool
}

// StoreProfile is the authenticated business's own profile, for the dashboard.
type StoreProfile struct {
	Name               string
	Handle             string
	VerificationStatus string
	PlanCode           string
	// PayoutReady is true when the store has a provisioned payout subaccount, so
	// it can actually receive online payments. This is DISTINCT from
	// VerificationStatus (identity/Ghana-Card verification): a store can be
	// identity-verified yet still have no subaccount, in which case checkout is
	// refused. The dashboard prompts the owner to set up payouts on !PayoutReady.
	PayoutReady bool
	// SettlementBank / SettlementAccount are the payout details as saved, so the
	// settings page can show the owner what is on file instead of rendering an
	// empty form over saved values (Testing Report §3.2). Both are empty until
	// payouts are set up; SettlementBank is also empty for businesses provisioned
	// before migration 000087 mirrored the network locally.
	SettlementBank    string
	SettlementAccount string
	// SettlementAccountName is the MoMo-registered wallet name on file (§2.1),
	// shown in the payout-details summary. Empty until payouts are set up, and
	// for businesses provisioned before migration 000098.
	SettlementAccountName string
	// Entitlements is the business's resolved benefit set from its plan's features,
	// so the dashboard knows which storefront customizations to unlock.
	Entitlements map[string]bool
	// EntitlementLimits is the business's resolved NUMERIC entitlement set
	// (§11.1: analytics_level, analytics_lookback_days, crm_level,
	// scheduled_reports, plus the cap keys), read live from the entitlement
	// matrix. -1 means unlimited/full (NULL in the matrix) — the schema forbids
	// negative limits, so -1 can never collide with a real cap. Keys whose row
	// is disabled are absent. The dashboard reads this to unlock analytics/CRM
	// depth without re-deriving it from the plan code.
	EntitlementLimits map[string]int
	// DesignLimit is the plan's cap on active designs; nil means unlimited. Served
	// so the dashboard can warn BEFORE the API rejects design number limit+1. It
	// used to guess the cap from the plan slug and told every paid plan it was
	// unlimited, so a Starter merchant hit an unexplained refusal at design 51.
	DesignLimit *int
	// ImageLimit / VariationLimit are the plan's per-design caps on images and
	// colour variations; nil means unlimited. Admin-editable, so the dashboard
	// reads them instead of re-deriving them from the plan code — its copy of
	// those constants could drift from the API's, and did.
	ImageLimit     *int
	VariationLimit *int
	// ActivationRequired is true when a PAID plan has not yet paid its first
	// invoice — i.e. monthly_fee_minor > 0 AND the subscription has never been
	// charged (first_purchase_consumed is false). This covers both a brand-new
	// 'trialing' signup and a grandfathered 'active' account that never set up
	// billing. It is false for a free plan or a paid plan that has paid. The
	// catalogue paid-feature gate blocks core write-actions while it is true, so
	// nobody uses paid features without activating (paying) first.
	ActivationRequired bool
}

type CollectionInput struct {
	CollectionID common.ID
	BusinessID   common.ID
	Name         string
	Theme        string
	Handle       string
	Sequence     int
}

// CollectionUpdateInput edits a collection's name, theme, and display order. The
// handle is intentionally omitted — it is immutable so existing share links keep
// resolving.
type CollectionUpdateInput struct {
	CollectionID common.ID
	BusinessID   common.ID
	Name         string
	Theme        string
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
	BespokeDisplayMinor  int64
	Handle               string
	Sequence             int
}

// DesignSizeBandOverrideInput upserts one design's override of a master size
// band's label and/or chart. A nil Label leaves the master band's label in place;
// ChartSet==false leaves the master band's chart in place (ChartSet==true
// overrides it, even with an empty Chart).
type DesignSizeBandOverrideInput struct {
	OverrideID common.ID
	DesignID   common.ID
	BusinessID common.ID
	SizeBandID common.ID
	Label      *string
	Chart      []catalogue.SizeChartItem
	ChartSet   bool
}

// DesignVariationInput creates one stored colour variation for a design. A
// Sequence of 0 (or below) auto-assigns the next free position for the design.
type DesignVariationInput struct {
	VariationID common.ID
	DesignID    common.ID
	BusinessID  common.ID
	Name        string
	Images      []string
	IsDefault   bool
	Sequence    int
}

// DesignVariationUpdateInput edits a stored colour variation's name, images,
// default flag, and display order. A Sequence of 0 (or below) keeps the
// variation's current position.
type DesignVariationUpdateInput struct {
	VariationID common.ID
	BusinessID  common.ID
	Name        string
	Images      []string
	IsDefault   bool
	Sequence    int
}

type SizeBandInput struct {
	SizeBandID common.ID
	BusinessID common.ID
	Label      string
	Chart      []catalogue.SizeChartItem
	Sequence   int
}

// SizeBandUpdateInput edits a size band's label, measurement chart, and display
// order.
type SizeBandUpdateInput struct {
	SizeBandID common.ID
	BusinessID common.ID
	Label      string
	Chart      []catalogue.SizeChartItem
	Sequence   int
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
	BusinessID common.ID
	Name       string
	Handle     string
	BrandColor string
	// BannerURL is the merchant's uploaded storefront banner (empty when unset or
	// not plan-entitled). The discovery card renders it so its cover matches the
	// store page hero, which uses the same banner.
	BannerURL   string
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
	// WaitlistEnabled is true when the business's plan grants the design_waitlist
	// benefit, so the storefront may offer "join the waiting list" on designs.
	WaitlistEnabled bool
	// OnlineOrderingEnabled is true when the business's plan grants the
	// online_ordering benefit. When false the storefront is a catalogue only and
	// checkout is refused server-side.
	OnlineOrderingEnabled bool
	// ShowPoweredByBadge is true when the storefront must carry the "Powered by
	// Xtiitch" badge -- i.e. when the plan does NOT grant remove_powered_by_badge
	// (Pricing Book §5: Free on, paid off).
	//
	// Carried as SHOW rather than the entitlement's own "remove" sense so the
	// inversion is resolved once, here, next to the entitlement it derives from,
	// instead of at each render site where getting it backwards would either bill
	// paying merchants a badge or give it away free.
	ShowPoweredByBadge bool
	// PlanCode is the business's current plan code (e.g. "free", "starter").
	// The storefront uses it to gate plan-specific surfaces such as the
	// "Discover other studios" strip, which only shows for free-plan stores.
	PlanCode string
	// Live is true when the store may SELL and be displayed publicly: the owner
	// has verified their business (Ghana Card) AND set up payout details — the
	// same pair checkout enforces (verification gates selling, never paying).
	// When false the storefront is not live: the public catalogue endpoints
	// return the store shell with no designs, so a direct visit shows the store
	// as unavailable rather than its catalogue.
	Live bool
}

// DesignWaitlistEntryInput is a customer's public request to join a design's
// waiting list, already resolved to a concrete business + design.
type DesignWaitlistEntryInput struct {
	EntryID         common.ID
	BusinessID      common.ID
	DesignID        common.ID
	CustomerName    string
	CustomerContact string
	Note            string
}

// DesignWaitlistEntry is one waiting-list registration, for the dashboard list.
type DesignWaitlistEntry struct {
	EntryID         common.ID
	DesignID        common.ID
	DesignTitle     string
	DesignHandle    string
	CustomerName    string
	CustomerContact string
	Note            string
	Status          string
	CreatedAt       time.Time
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
