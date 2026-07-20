package httpadapter

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/tenantscope"
)

type healthResponse struct {
	Status string `json:"status"`
	Time   string `json:"time"`
}

type RouteRegistrar interface {
	Register(router chi.Router)
}

func NewRouter(
	logger *slog.Logger,
	ready func(context.Context) error,
	security SecurityOptions,
	registrars ...RouteRegistrar,
) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	// Client IP resolution. chi's middleware.RealIP is deprecated: it trusts the
	// spoofable leftmost X-Forwarded-For / X-Real-IP / True-Client-IP, letting a
	// client forge its IP and evade rate limiting + lockout. trustedClientIP
	// instead takes the value the trusted proxy appended (see SecurityOptions).
	if security.TrustedProxyHops > 0 {
		router.Use(trustedClientIP(security.TrustedProxyHops))
	}
	// Structured access log for every request (after client-IP/RequestID so it
	// has the real client IP + request id). This is the baseline visibility the
	// backend was missing — every sign-up, OTP, and checkout call now logs.
	router.Use(requestLogger(logger))
	router.Use(middleware.Recoverer)
	// Hardening: conservative response headers, a request timeout, a body-size
	// cap, CORS allow-list, and a generous per-IP rate limit (see SecurityOptions).
	router.Use(securityHeaders(security.Production))
	router.Use(middleware.Timeout(20 * time.Second))
	router.Use(bodyLimit(security.MaxBodyBytes))
	if len(security.AllowedOrigins) > 0 {
		router.Use(corsMiddleware(security.AllowedOrigins))
	}
	if security.RateLimitRPS > 0 {
		router.Use(newIPRateLimiter(security.RateLimitRPS).middleware)
	}

	router.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, healthResponse{
			Status: "ok",
			Time:   time.Now().UTC().Format(time.RFC3339),
		})
	})

	router.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if ready != nil {
			if err := ready(r.Context()); err != nil {
				writeJSON(w, http.StatusServiceUnavailable, healthResponse{
					Status: "not_ready",
					Time:   time.Now().UTC().Format(time.RFC3339),
				})
				return
			}
		}

		writeJSON(w, http.StatusOK, healthResponse{
			Status: "ready",
			Time:   time.Now().UTC().Format(time.RFC3339),
		})
	})

	router.Route("/v1", func(v1 chi.Router) {
		// §6 tenant isolation on the public storefront API: when the first-party
		// storefront SSR server marks a request as tenant-store traffic
		// (X-Xtiitch-Tenant), cross-store reads are refused here at the API —
		// hiding buttons in the UI is not isolation. Requests without the header
		// (general-store / direct API traffic) pass through unchanged.
		v1.Use(tenantscope.Middleware)
		v1.Get("/version", func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, http.StatusOK, map[string]string{
				"service": "xtiitch-api",
				"version": "0.0.0",
			})
		})

		for _, registrar := range registrars {
			registrar.Register(v1)
		}
	})

	logger.Info("http router initialized")

	return router
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
