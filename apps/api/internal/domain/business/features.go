package business

// Storefront-customization benefit keys. These are the canonical, code-defined
// feature codes stored in plans.features (jsonb) and resolved into a business's
// entitlements. They are never free-typed: admin picks from FeatureCatalogue when
// building a package, and the storefront/store-settings layers gate on these keys.
const (
	FeatureCustomBrandColor = "custom_brand_color"
	FeatureCustomLogo       = "custom_logo"
	FeatureCustomBanner     = "custom_banner"
	FeatureCustomLayout     = "custom_layout"
	FeatureDesignWaitlist   = "design_waitlist"
	// FeatureOnlineOrdering gates in-app online ordering + checkout on the
	// storefront. Without it a store is a catalogue/showcase only and customers
	// arrange orders off-platform.
	FeatureOnlineOrdering = "online_ordering"
)

// Defaults applied when a business is not entitled to (or has not set) a
// customization. Kept in sync with the store_settings column defaults.
const (
	DefaultBrandColor    = "#800020"
	DefaultLayoutVariant = "standard"
)

// LayoutVariants are the storefront hero layouts a business may choose from when
// entitled to FeatureCustomLayout. The first entry is the default.
var LayoutVariants = []string{"standard", "spotlight", "minimal"}

// IsValidLayoutVariant reports whether v is a recognised storefront layout.
func IsValidLayoutVariant(v string) bool {
	for _, candidate := range LayoutVariants {
		if candidate == v {
			return true
		}
	}
	return false
}

// Feature is a predefined, admin-selectable package benefit.
type Feature struct {
	Key         string
	Label       string
	Description string
}

// FeatureCatalogue is the single source of truth for the benefits a package can
// grant. Admin renders this list as the toggle set on the plan editor.
func FeatureCatalogue() []Feature {
	return []Feature{
		{
			Key:         FeatureCustomBrandColor,
			Label:       "Storefront accent colour",
			Description: "Set the storefront's accent colour instead of the Xtiitch wine default.",
		},
		{
			Key:         FeatureCustomLogo,
			Label:       "Custom storefront logo",
			Description: "Show the business logo on the storefront in place of the Xtiitch mark.",
		},
		{
			Key:         FeatureCustomBanner,
			Label:       "Custom hero banner image",
			Description: "Replace the default storefront hero with the business's own banner image.",
		},
		{
			Key:         FeatureCustomLayout,
			Label:       "Storefront layout variants",
			Description: "Choose a storefront hero layout (standard, spotlight or minimal).",
		},
		{
			Key:         FeatureDesignWaitlist,
			Label:       "Design waiting lists",
			Description: "Open a waiting list on a design so customers can register interest when a piece is sold out or made-to-order.",
		},
		{
			Key:         FeatureOnlineOrdering,
			Label:       "Online ordering & checkout",
			Description: "Let customers place and pay for orders directly from the storefront. Without it the store is a catalogue and customers arrange orders off-platform.",
		},
	}
}

// IsKnownFeature reports whether key is part of the predefined catalogue.
func IsKnownFeature(key string) bool {
	for _, feature := range FeatureCatalogue() {
		if feature.Key == key {
			return true
		}
	}
	return false
}

// Entitlements is a business's resolved benefit set (from its plan's features).
type Entitlements map[string]bool

// Has reports whether the entitlement set grants the given feature key.
func (e Entitlements) Has(key string) bool {
	return e != nil && e[key]
}

// SanitizeFeatures keeps only recognised catalogue keys that are enabled, so an
// admin-supplied or persisted feature map can never carry unknown/disabled noise.
func SanitizeFeatures(raw map[string]bool) Entitlements {
	clean := Entitlements{}
	for _, feature := range FeatureCatalogue() {
		if raw[feature.Key] {
			clean[feature.Key] = true
		}
	}
	return clean
}
