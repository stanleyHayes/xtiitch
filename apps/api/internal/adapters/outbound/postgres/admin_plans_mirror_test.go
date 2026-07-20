package postgres

import (
	"strings"
	"testing"
)

// The mirror is the only writer of plans.features from the entitlements matrix.
// §11.1's new boolean keys must be in its allowlist or a matrix toggle would
// save successfully yet never reach the runtime read path (gating + dashboard).
func TestMirrorProjectsPromotionsAndExportKeys(t *testing.T) {
	t.Parallel()

	sql := mirrorAdminPlanEntitlementsSQL()
	for _, key := range []string{"promotions", "export_csv", "export_pdf", "export_docx", "export_xlsx"} {
		if !strings.Contains(sql, "'"+key+"'") {
			t.Fatalf("mirror SQL must project %q into plans.features", key)
		}
	}
}

// §13.4: orders and customer records carry no cap on any tier — "the matrix
// holds no order limit". The orders_per_month projection was removed with the
// matrix row; the SQL must not reference it any more.
func TestMirrorNoLongerProjectsOrderCaps(t *testing.T) {
	t.Parallel()

	sql := mirrorAdminPlanEntitlementsSQL()
	if strings.Contains(sql, "orders_per_month") {
		t.Fatal("the forbidden orders_per_month entitlement must not be mirrored")
	}
	if strings.Contains(sql, "order_review_threshold =") {
		t.Fatal("order_review_threshold is a static internal signal now, not a matrix projection")
	}
}
