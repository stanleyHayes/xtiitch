package aisearchhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	aisearchapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aisearch"
)

type Service interface {
	Search(ctx context.Context, query string, limit int) ([]aisearchapp.SearchResult, error)
}

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/public/ai-search", handler.search)
}

type searchRequest struct {
	Query string `json:"query"`
	Limit int    `json:"limit"`
}

type searchHit struct {
	DesignTitle  string  `json:"design_title"`
	DesignHandle string  `json:"design_handle"`
	Image        string  `json:"image"`
	PriceMinor   int64   `json:"price_minor"`
	StoreName    string  `json:"store_name"`
	StoreHandle  string  `json:"store_handle"`
	Score        float64 `json:"score"`
}

func (handler Handler) search(w http.ResponseWriter, r *http.Request) {
	var request searchRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	results, err := handler.service.Search(r.Context(), request.Query, request.Limit)
	if err != nil {
		if errors.Is(err, aisearchapp.ErrEmptyQuery) {
			writeError(w, http.StatusBadRequest, "empty_query")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	hits := make([]searchHit, 0, len(results))
	for _, res := range results {
		hits = append(hits, searchHit{
			DesignTitle:  res.DesignTitle,
			DesignHandle: res.DesignHandle,
			Image:        res.Image,
			PriceMinor:   res.PriceMinor,
			StoreName:    res.StoreName,
			StoreHandle:  res.StoreHandle,
			Score:        res.Score,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": hits})
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	var trailing struct{}
	if err := decoder.Decode(&trailing); err != io.EOF {
		return errors.New("request body must contain a single JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
