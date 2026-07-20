package business_test

import (
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

// §13.4: promotions is a paid-plan entitlement enforced by the catalogue
// service, so the key must survive SanitizeFeatures like any other gate — a key
// dropped here would read as "not entitled" for every plan.
func TestSanitizeFeaturesKeepsPromotionsAndExportKeys(t *testing.T) {
	t.Parallel()

	clean := business.SanitizeFeatures(map[string]bool{
		business.FeaturePromotions: true,
		business.FeatureExportCSV:  true,
		business.FeatureExportPDF:  true,
		business.FeatureExportDOCX: true,
		business.FeatureExportXLSX: true,
	})

	for _, key := range []string{
		business.FeaturePromotions,
		business.FeatureExportCSV,
		business.FeatureExportPDF,
		business.FeatureExportDOCX,
		business.FeatureExportXLSX,
	} {
		if !clean.Has(key) {
			t.Fatalf("catalogue key %q was dropped by SanitizeFeatures", key)
		}
	}
}

// §14.5: analytics enters the matrix as Basic / Standard / Full / Advanced;
// §15.1 uses the same ladder for the CRM. CapabilityLevel is the one place the
// 0..3 encoding becomes those words.
func TestCapabilityLevelNames(t *testing.T) {
	t.Parallel()

	expected := map[int]string{0: "basic", 1: "standard", 2: "full", 3: "advanced"}
	for level, name := range expected {
		if got := business.CapabilityLevel(level); got != name {
			t.Fatalf("level %d should be %q, got %q", level, name, got)
		}
	}
	if got := business.CapabilityLevel(4); got != "" {
		t.Fatalf("an unknown level must report empty, got %q", got)
	}
}

// The numeric entitlement keys are constants, never free-typed strings.
func TestLimitEntitlementKeys(t *testing.T) {
	t.Parallel()

	keys := []string{
		business.LimitAnalyticsLevel,
		business.LimitAnalyticsLookbackDays,
		business.LimitCRMLevel,
		business.LimitScheduledReports,
	}
	for _, key := range keys {
		if key == "" {
			t.Fatal("a limit entitlement key must never be empty")
		}
		// Limit keys are NOT boolean catalogue members — mixing the two encodings
		// would let a level read as a plain on/off.
		if business.IsKnownFeature(key) {
			t.Fatalf("limit key %q must not be a boolean catalogue feature", key)
		}
	}
}
