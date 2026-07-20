// Package tenantscope enforces §6 tenant isolation on the PUBLIC storefront
// API (server-side, not just in the interface): when a request arrives in a
// tenant-store context it may only touch that store's own public data.
//
// The tenant context arrives in the X-Xtiitch-Tenant header, whose value is
// the tenant store's handle. The header is set by the FIRST-PARTY storefront
// SSR server, which knows the request host (business-name.xtiitch.com) and
// resolves it to a store; that SSR server is the trust boundary this
// middleware enforces, exactly as documented in §6 ("a request from Store A's
// context for Store B's data must be refused — no matter what the client asks
// for"). A request WITHOUT the header is treated as general-store traffic
// (store.xtiitch.com) and passes through unchanged — cross-store browse is
// legitimate there. Isolation is identical on every plan; nothing here looks
// at entitlements.
package tenantscope

import (
	"encoding/json"
	"net/http"
	"strings"
)

// HeaderName carries the tenant store's handle from the first-party
// storefront SSR server (the trust boundary — see the package doc).
const HeaderName = "X-Xtiitch-Tenant"

// publicPrefix scopes the middleware to the public storefront API; every other
// route group (dashboard, admin, customer account, webhooks) has its own
// authn/authz and is unaffected by the tenant header.
const publicPrefix = "/v1/public/"

// crossStoreEndpoints are the public endpoints whose whole PURPOSE is
// cross-store discovery, so they cannot exist inside a tenant store (§6: "you
// cannot search or find other stores' designs inside a tenant store"; §5.4: AI
// Search "must not be available at all on any tenant store"). They are refused
// with 404 — inside a tenant context they simply do not exist, same as the
// removed UI. Listed exactly, so per-store or event-recording cousins keep
// working (e.g. POST /v1/public/sponsored/{id}/events stays live).
var crossStoreEndpoints = map[string]bool{
	"/v1/public/ai-search": true, // §5.4: cross-store AI search, general store only
	"/v1/public/shops":     true, // cross-store studios/marketplace browse
	"/v1/public/sponsored": true, // cross-store sponsored placements listing
}

// Middleware refuses tenant-context requests that step outside the tenant
// store, and passes everything else through. The rules, applied only when the
// tenant header is present and only under /v1/public:
//
//   - cross-store discovery endpoints (ai-search, shops, sponsored) → 404.
//   - /v1/public/stores/{handle}/... where handle ≠ the tenant's → 403
//     cross_tenant_refused (Store A's context may never read Store B's data).
//   - everything else (the tenant's OWN store/catalogue/checkout endpoints,
//     per-store search, order tracking, designs/collections by their
//     unguessable handles, affiliate/referral mechanics, branding and other
//     truly global reads) → allowed.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenant := strings.ToLower(strings.TrimSpace(r.Header.Get(HeaderName)))
		if tenant == "" || !strings.HasPrefix(r.URL.Path, publicPrefix) {
			next.ServeHTTP(w, r)
			return
		}

		if crossStoreEndpoints[r.URL.Path] {
			writeRefusal(w, http.StatusNotFound, "not_found")
			return
		}

		if handle, ok := storeHandleParam(r.URL.Path); ok && handle != tenant {
			// §6: refuse Store B's data in Store A's context — hiding the button
			// is not isolation.
			writeRefusal(w, http.StatusForbidden, "cross_tenant_refused")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// storeHandleParam extracts the {handle} path segment of a
// /v1/public/stores/{handle}/... URL, lowercased for comparison (handles are
// stored lowercase). ok is false for any other public path.
func storeHandleParam(path string) (string, bool) {
	const storesPrefix = publicPrefix + "stores/"
	if !strings.HasPrefix(path, storesPrefix) {
		return "", false
	}
	rest := strings.TrimPrefix(path, storesPrefix)
	handle, _, _ := strings.Cut(rest, "/")
	if handle == "" {
		return "", false
	}
	return strings.ToLower(handle), true
}

func writeRefusal(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code})
}
