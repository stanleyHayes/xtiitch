package growthhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	growthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/growth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

const maxBodyBytes = 1 << 20

type Service interface {
	RecordAffiliateClick(ctx context.Context, command growthapp.RecordAffiliateClickCommand) (ports.AffiliateClickRecord, error)
}

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/public/affiliates/{code}/clicks", handler.recordAffiliateClick)
}

type affiliateClickRequest struct {
	VisitorID   string `json:"visitor_id"`
	LandingURL  string `json:"landing_url"`
	ReferrerURL string `json:"referrer_url"`
}

func (handler Handler) recordAffiliateClick(w http.ResponseWriter, r *http.Request) {
	var request affiliateClickRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.RecordAffiliateClick(r.Context(), growthapp.RecordAffiliateClickCommand{
		Code:        chi.URLParam(r, "code"),
		VisitorID:   request.VisitorID,
		LandingURL:  request.LandingURL,
		ReferrerURL: request.ReferrerURL,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := growthError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"click_id":     record.ClickID.String(),
		"affiliate_id": record.AffiliateID.String(),
		"code":         record.Code,
		"clicked_at":   record.ClickedAt.Format(time.RFC3339),
	})
}

func growthError(err error) (int, string) {
	switch {
	case errors.Is(err, growthapp.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_click"
	case errors.Is(err, growthapp.ErrAffiliateNotFound):
		return http.StatusNotFound, "affiliate_not_found"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
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

func requestIP(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		return strings.TrimSpace(strings.Split(forwardedFor, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
