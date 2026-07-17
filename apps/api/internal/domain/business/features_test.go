package business_test

import (
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

// SanitizeFeatures is a closed allowlist over FeatureCatalogue, so a key missing
// from the catalogue is silently dropped on read -- no error, no log, just an
// entitlement that never turns on. Adding a key to the entitlements matrix or the
// mirror's SQL allowlist without adding it here looks like it works and does
// nothing, so pin the catalogue's membership.
func TestSanitizeFeaturesKeepsEveryCatalogueKey(t *testing.T) {
	t.Parallel()

	raw := map[string]bool{}
	for _, feature := range business.FeatureCatalogue() {
		raw[feature.Key] = true
	}

	clean := business.SanitizeFeatures(raw)

	for _, feature := range business.FeatureCatalogue() {
		if !clean.Has(feature.Key) {
			t.Fatalf("catalogue key %q was dropped by SanitizeFeatures", feature.Key)
		}
	}
}

// The badge is sold as a paid benefit, so it has to survive the read path like
// any other. It reached the matrix long before it reached this catalogue, which
// is exactly the shape of bug this guards.
func TestSanitizeFeaturesKeepsTheBadgeRemovalKey(t *testing.T) {
	t.Parallel()

	clean := business.SanitizeFeatures(map[string]bool{
		business.FeatureRemovePoweredByBadge: true,
	})

	if !clean.Has(business.FeatureRemovePoweredByBadge) {
		t.Fatal("a plan granting badge removal must keep the key through SanitizeFeatures")
	}
}

// Only granted keys are emitted, so a plan with no benefits yields an empty set
// rather than a set of falses. The storefront relies on this: it shows the badge
// unless removal is present, so an ungranted key must be ABSENT, not false.
func TestSanitizeFeaturesDropsUngrantedKeys(t *testing.T) {
	t.Parallel()

	clean := business.SanitizeFeatures(map[string]bool{
		business.FeatureRemovePoweredByBadge: false,
	})

	if clean.Has(business.FeatureRemovePoweredByBadge) {
		t.Fatal("an ungranted key must not appear in the resolved entitlements")
	}
	if len(clean) != 0 {
		t.Fatalf("expected no entitlements, got %v", clean)
	}
}

// An unknown key is dropped rather than trusted.
func TestSanitizeFeaturesDropsUnknownKeys(t *testing.T) {
	t.Parallel()

	clean := business.SanitizeFeatures(map[string]bool{"not_a_real_feature": true})

	if len(clean) != 0 {
		t.Fatalf("expected unknown keys to be dropped, got %v", clean)
	}
}
