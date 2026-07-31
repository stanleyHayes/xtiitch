package growthhttp

import (
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type routeRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]routeRateVisitor
	limit    rate.Limit
	burst    int
}

type routeRateVisitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newRouteRateLimiter(limit rate.Limit, burst int) *routeRateLimiter {
	return &routeRateLimiter{
		visitors: map[string]routeRateVisitor{},
		limit:    limit,
		burst:    burst,
	}
}

func (limiter *routeRateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if host, _, err := net.SplitHostPort(ip); err == nil {
			ip = host
		}
		limiter.mu.Lock()
		visitor, ok := limiter.visitors[ip]
		if !ok {
			visitor = routeRateVisitor{
				limiter: rate.NewLimiter(limiter.limit, limiter.burst),
			}
		}
		visitor.lastSeen = time.Now()
		limiter.visitors[ip] = visitor
		for key, candidate := range limiter.visitors {
			if time.Since(candidate.lastSeen) > 10*time.Minute {
				delete(limiter.visitors, key)
			}
		}
		allowed := visitor.limiter.Allow()
		limiter.mu.Unlock()
		if !allowed {
			w.Header().Set("Retry-After", "60")
			writeError(w, http.StatusTooManyRequests, "rate_limited")
			return
		}
		next.ServeHTTP(w, r)
	})
}
