package httpadapter

import (
	"net"
	"net/http"
	"strings"
)

// trustedClientIP replaces go-chi's deprecated middleware.RealIP. RealIP trusts
// the LEFTMOST X-Forwarded-For value (and X-Real-IP / True-Client-IP), every one
// of which the client controls — so an attacker can spoof their apparent IP and
// evade per-IP rate limiting and account lockout (GHSA-3fxj-6jh8-hvhx et al.).
//
// When the service runs behind exactly `hops` trusted reverse proxies (Render is
// 1), the genuine client IP is the value the outermost trusted proxy appended:
// the hops-th entry counted from the RIGHT of X-Forwarded-For. Everything to its
// left is attacker-controlled and ignored. With hops <= 0 (no trusted proxy) or
// too few XFF entries, r.RemoteAddr (the real transport peer) is kept unchanged.
func trustedClientIP(hops int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if ip := clientIPFromXFF(r.Header.Get("X-Forwarded-For"), hops); ip != "" {
				r.RemoteAddr = ip
			}
			next.ServeHTTP(w, r)
		})
	}
}

// clientIPFromXFF returns the trusted client IP: the hops-th comma-separated
// entry counted from the right of an X-Forwarded-For header, validated as an IP.
// It returns "" (meaning "keep r.RemoteAddr") when hops <= 0, the header is empty
// or has fewer than hops entries, or the selected entry is not a valid IP.
func clientIPFromXFF(header string, hops int) string {
	if hops <= 0 || header == "" {
		return ""
	}
	parts := strings.Split(header, ",")
	if len(parts) < hops {
		return ""
	}
	candidate := strings.TrimSpace(parts[len(parts)-hops])
	if net.ParseIP(candidate) == nil {
		return ""
	}
	return candidate
}
