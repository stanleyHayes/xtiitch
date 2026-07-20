package tenantscope

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ok is the stand-in downstream handler: everything it sees "succeeds".
var ok = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
})

func exercise(t *testing.T, method, path, tenant string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, nil)
	if tenant != "" {
		request.Header.Set(HeaderName, tenant)
	}
	response := httptest.NewRecorder()
	Middleware(ok).ServeHTTP(response, request)
	return response
}

func errorCode(t *testing.T, response *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode refusal body: %v", err)
	}
	return body["error"]
}

// §6 in a tenant context: the tenant's own store endpoints pass, cross-store
// discovery is 404, and another store's data is 403 cross_tenant_refused.
func TestTenantContextAllowsOwnStore(t *testing.T) {
	t.Parallel()

	for _, path := range []string{
		"/v1/public/stores/tdh",
		"/v1/public/stores/tdh/search",
		"/v1/public/stores/tdh/checkout-quote",
		"/v1/public/stores/tdh/delivery-zones",
		"/v1/public/stores/tdh/designs/smock/waitlist",
	} {
		if response := exercise(t, http.MethodGet, path, "tdh"); response.Code != http.StatusOK {
			t.Fatalf("%s: expected 200 for the tenant's own endpoint, got %d", path, response.Code)
		}
	}
	for _, path := range []string{
		"/v1/public/stores/tdh/orders",
		"/v1/public/stores/tdh/cart-orders",
		"/v1/public/stores/tdh/custom-orders",
		"/v1/public/stores/tdh/bookings",
	} {
		if response := exercise(t, http.MethodPost, path, "tdh"); response.Code != http.StatusOK {
			t.Fatalf("%s: expected 200 for the tenant's own checkout, got %d", path, response.Code)
		}
	}
}

func TestTenantContextRefusesOtherStore(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/public/stores/kbdesigns"},
		{http.MethodGet, "/v1/public/stores/kbdesigns/search"},
		{http.MethodPost, "/v1/public/stores/kbdesigns/orders"},
		{http.MethodPost, "/v1/public/stores/kbdesigns/cart-orders"},
		{http.MethodPost, "/v1/public/stores/kbdesigns/custom-orders"},
		{http.MethodPost, "/v1/public/stores/kbdesigns/bookings"},
	} {
		response := exercise(t, tc.method, tc.path, "tdh")
		if response.Code != http.StatusForbidden {
			t.Fatalf("%s %s: expected 403, got %d", tc.method, tc.path, response.Code)
		}
		if code := errorCode(t, response); code != "cross_tenant_refused" {
			t.Fatalf("%s %s: expected cross_tenant_refused, got %q", tc.method, tc.path, code)
		}
	}
}

func TestTenantContextRemovesCrossStoreDiscovery(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/v1/public/ai-search"}, // §5.4: never on a tenant store
		{http.MethodGet, "/v1/public/shops"},      // cross-store studios browse
		{http.MethodGet, "/v1/public/sponsored"},  // cross-store sponsored listing
	} {
		response := exercise(t, tc.method, tc.path, "tdh")
		if response.Code != http.StatusNotFound {
			t.Fatalf("%s %s: expected 404, got %d", tc.method, tc.path, response.Code)
		}
		if code := errorCode(t, response); code != "not_found" {
			t.Fatalf("%s %s: expected not_found, got %q", tc.method, tc.path, code)
		}
	}
}

func TestTenantContextKeepsGlobalReads(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		method string
		path   string
	}{
		// Design/collection pages resolve by their unguessable handles; the
		// tenant storefront only ever surfaces its own.
		{http.MethodGet, "/v1/public/designs/kente-wrap"},
		{http.MethodGet, "/v1/public/collections/harmattan"},
		// The customer's own order tracking is their own data (§6's one shared thing).
		{http.MethodGet, "/v1/public/orders/9f0d2c"},
		// Sponsored EVENT recording is a write, not a cross-store listing.
		{http.MethodPost, "/v1/public/sponsored/abc123/events"},
		{http.MethodPost, "/v1/public/affiliates/AMA24/clicks"},
		{http.MethodGet, "/v1/public/referrals/AMA24"},
		// Outside the public group entirely: the customer account (global) and
		// the version probe.
		{http.MethodGet, "/v1/customer/orders"},
		{http.MethodGet, "/v1/version"},
	} {
		if response := exercise(t, tc.method, tc.path, "tdh"); response.Code != http.StatusOK {
			t.Fatalf("%s %s: expected 200, got %d", tc.method, tc.path, response.Code)
		}
	}
}

func TestTenantHeaderIsCaseInsensitive(t *testing.T) {
	t.Parallel()

	if response := exercise(t, http.MethodGet, "/v1/public/stores/TDH", "tdh"); response.Code != http.StatusOK {
		t.Fatalf("expected the uppercased path handle to match, got %d", response.Code)
	}
	if response := exercise(t, http.MethodGet, "/v1/public/stores/tdh", " TDH "); response.Code != http.StatusOK {
		t.Fatalf("expected a padded/uppercased header value to match, got %d", response.Code)
	}
}

// No header = general-store (store.xtiitch.com) or direct API traffic:
// everything behaves exactly as it did before the middleware existed.
func TestNoHeaderPassesEverythingThrough(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/public/shops"},
		{http.MethodPost, "/v1/public/ai-search"},
		{http.MethodGet, "/v1/public/sponsored"},
		{http.MethodGet, "/v1/public/stores/kbdesigns"},
		{http.MethodPost, "/v1/public/stores/kbdesigns/cart-orders"},
	} {
		if response := exercise(t, tc.method, tc.path, ""); response.Code != http.StatusOK {
			t.Fatalf("%s %s: expected 200 without the tenant header, got %d", tc.method, tc.path, response.Code)
		}
	}
}

func TestBlankHeaderPassesEverythingThrough(t *testing.T) {
	t.Parallel()

	if response := exercise(t, http.MethodGet, "/v1/public/shops", "   "); response.Code != http.StatusOK {
		t.Fatalf("a blank tenant header must behave as absent, got %d", response.Code)
	}
}
