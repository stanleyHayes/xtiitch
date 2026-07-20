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
	// FeaturePromotions gates creating and managing storefront discount
	// promotions (§13.4: "Free-plan stores cannot run promotions"). Paid plans
	// only; the catalogue promotion service rejects writes without it.
	FeaturePromotions = "promotions"
	// FeatureExportCSV / PDF / DOCX / XLSX are the report-export formats the
	// plan may use (§14.4: Starter CSV; Growth CSV+PDF; Studio any format).
	// Which format is on per plan is a matrix setting, not code.
	FeatureExportCSV  = "export_csv"
	FeatureExportPDF  = "export_pdf"
	FeatureExportDOCX = "export_docx"
	FeatureExportXLSX = "export_xlsx"
	// FeatureRemovePoweredByBadge hides the "Powered by Xtiitch" badge from the
	// public storefront. Inverted by design: the badge shows unless a plan grants
	// its REMOVAL, so a store with no entitlements carries the badge rather than
	// quietly getting the paid treatment (Pricing Book §5: Free on, paid off).
	FeatureRemovePoweredByBadge = "remove_powered_by_badge"
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
			Key:   FeatureOnlineOrdering,
			Label: "Online ordering & checkout",
			Description: "Let customers place and pay for orders directly from the storefront. " +
				"Without it the store is a catalogue and customers arrange orders off-platform.",
		},
		{
			Key:   FeaturePromotions,
			Label: "Promotions",
			Description: "Run discount-code promotions on the storefront. " +
				"Paid plans only: a Free-plan store's promotion writes are rejected (§13.4).",
		},
		{
			Key:         FeatureExportCSV,
			Label:       "CSV export",
			Description: "Export reports and records as CSV (§14.4: Starter and above).",
		},
		{
			Key:         FeatureExportPDF,
			Label:       "PDF export",
			Description: "Export reports and records as PDF (§14.4: Growth and above).",
		},
		{
			Key:         FeatureExportDOCX,
			Label:       "DOCX export",
			Description: "Export reports and records as DOCX (§14.4: Studio any-format).",
		},
		{
			Key:         FeatureExportXLSX,
			Label:       "XLSX export",
			Description: "Export reports and records as Excel (§14.4: Studio any-format).",
		},
		{
			Key:   FeatureRemovePoweredByBadge,
			Label: "Remove the \"Powered by Xtiitch\" badge",
			Description: "Hide the Xtiitch badge from the public storefront. " +
				"Granting it removes the badge; without it the badge shows.",
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

// Limit-entitlement keys (§11.1/§14.1/§15.1). These are NUMERIC matrix rows, so
// they can never live in the boolean FeatureCatalogue / plans.features jsonb:
// they are read live from plan_entitlement_values and surface on the owner
// dashboard as Profile.EntitlementLimits. Encoding:
//   - analytics_level / crm_level: 0=basic, 1=standard, 2=full, 3=advanced.
//   - analytics_lookback_days: days of history; -1 (NULL in the matrix) = full.
//   - scheduled_reports: 0=off, 1=monthly, 2=any cadence.
const (
	LimitAnalyticsLevel        = "analytics_level"
	LimitAnalyticsLookbackDays = "analytics_lookback_days"
	LimitCRMLevel              = "crm_level"
	LimitScheduledReports      = "scheduled_reports"
)

// CapabilityLevel names an analytics_level / crm_level value (0..3) as the
// tier words the spec uses (§13.4). Unknown values report the empty string.
func CapabilityLevel(level int) string {
	switch level {
	case 0:
		return "basic"
	case 1:
		return "standard"
	case 2:
		return "full"
	case 3:
		return "advanced"
	}
	return ""
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
