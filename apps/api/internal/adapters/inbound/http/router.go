package httpadapter

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type healthResponse struct {
	Status string `json:"status"`
	Time   string `json:"time"`
}

type RouteRegistrar interface {
	Register(router chi.Router)
}

func NewRouter(logger *slog.Logger, ready func(context.Context) error, registrars ...RouteRegistrar) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Recoverer)

	router.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
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
		v1.Get("/version", func(w http.ResponseWriter, r *http.Request) {
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
