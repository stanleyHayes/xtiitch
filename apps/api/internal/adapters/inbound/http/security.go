package httpadapter

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/cors"
	"golang.org/x/time/rate"
)

// SecurityOptions configures the API's HTTP hardening. Zero values fall back to
// safe defaults, so an empty SecurityOptions still yields a hardened router.
type SecurityOptions struct {
	// Production enables HSTS unconditionally (otherwise it is only sent for
	// requests that are already over TLS).
	Production bool
	// AllowedOrigins is the CORS allow-list. go-chi/cors "*" wildcards are
	// supported (e.g. "https://*.xtiitch.com"). Empty disables CORS headers.
	AllowedOrigins []string
	// RateLimitRPS is the sustained requests/sec permitted per client IP. <= 0
	// disables rate limiting. Behind a trusted SSR/proxy many requests share one
	// source IP, so keep this generous; it blunts gross abuse, not normal load.
	RateLimitRPS int
	// MaxBodyBytes caps request bodies. <= 0 uses defaultMaxBodyBytes.
	MaxBodyBytes int64
	// TrustedProxyHops is the number of trusted reverse proxies in front of the
	// service (Render = 1). The client IP is taken from the hops-th
	// X-Forwarded-For entry counted from the right (the value the outermost
	// trusted proxy appended); 0 trusts no forwarding header and uses the direct
	// connection address. See trustedClientIP.
	TrustedProxyHops int
}

const defaultMaxBodyBytes = 2 << 20 // 2 MiB

// securityHeaders sets conservative, broadly-safe response headers on every
// response. As a pure JSON API the CSP locks out any embedded/active content.
func securityHeaders(production bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			h.Set("Cross-Origin-Opener-Policy", "same-origin")
			h.Set("Cross-Origin-Resource-Policy", "same-site")
			h.Set(
				"Permissions-Policy",
				"geolocation=(), microphone=(), camera=(), browsing-topics=()",
			)
			h.Set(
				"Content-Security-Policy",
				"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
			)
			if production || r.TLS != nil ||
				strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
				h.Set(
					"Strict-Transport-Security",
					"max-age=31536000; includeSubDomains",
				)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// bodyLimit caps the request body size to guard against memory-exhaustion.
func bodyLimit(max int64) func(http.Handler) http.Handler {
	if max <= 0 {
		max = defaultMaxBodyBytes
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, max)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// corsMiddleware builds a CORS handler from the allow-list. CORS is enforced by
// the browser, so this only ever *grants* cross-origin access to listed origins;
// it never blocks server-to-server (SSR) traffic.
func corsMiddleware(origins []string) func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	})
}

// ipRateLimiter is a per-client-IP token-bucket limiter with lazy eviction of
// idle buckets so memory stays bounded.
type ipRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*rateVisitor
	rps      rate.Limit
	burst    int
}

type rateVisitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newIPRateLimiter(rps int) *ipRateLimiter {
	limiter := &ipRateLimiter{
		visitors: make(map[string]*rateVisitor),
		rps:      rate.Limit(rps),
		burst:    rps * 2,
	}
	go limiter.cleanupLoop()
	return limiter
}

func (l *ipRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		l.mu.Lock()
		for ip, v := range l.visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(l.visitors, ip)
			}
		}
		l.mu.Unlock()
	}
}

func (l *ipRateLimiter) allow(ip string) bool {
	l.mu.Lock()
	v, ok := l.visitors[ip]
	if !ok {
		v = &rateVisitor{limiter: rate.NewLimiter(l.rps, l.burst)}
		l.visitors[ip] = v
	}
	v.lastSeen = time.Now()
	l.mu.Unlock()
	return v.limiter.Allow()
}

func (l *ipRateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if host, _, err := net.SplitHostPort(ip); err == nil {
			ip = host
		}
		if !l.allow(ip) {
			w.Header().Set("Retry-After", "1")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"rate_limited"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}
