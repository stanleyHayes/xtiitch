// Package marketinghttp exposes the public waitlist-capture endpoint and the
// admin-only lead listing.
package marketinghttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	marketingapp "github.com/xcreativs/xtiitch/apps/api/internal/application/marketingwaitlist"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type Service interface {
	Submit(ctx context.Context, cmd marketingapp.SubmitCommand) (ports.WaitlistLeadRecord, error)
	ListLeads(ctx context.Context, limit int) ([]ports.WaitlistLeadRecord, error)
}

// AdminAuthenticator is the admin token middleware (adminauthhttp.Authenticator),
// reused so the lead listing sits behind the same admin auth as the rest of /admin.
type AdminAuthenticator interface {
	Middleware(next http.Handler) http.Handler
}

type Handler struct {
	service    Service
	adminAuthn AdminAuthenticator
}

func NewHandler(service Service, adminAuthn AdminAuthenticator) Handler {
	return Handler{service: service, adminAuthn: adminAuthn}
}

func (handler Handler) Register(router chi.Router) {
	// Public, no auth: the marketing site posts leads here.
	router.Post("/marketing/waitlist", handler.submit)

	// Admin-only: list captured leads, newest first.
	router.Group(func(protected chi.Router) {
		protected.Use(handler.adminAuthn.Middleware)
		protected.Get("/admin/waitlist", handler.leads)
	})
}

type submitRequest struct {
	Name     string `json:"name"`
	Business string `json:"business"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	City     string `json:"city"`
	Message  string `json:"message"`
	Source   string `json:"source"`
}

type waitlistLeadResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Business  string `json:"business"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	City      string `json:"city"`
	Message   string `json:"message"`
	CreatedAt string `json:"created_at"`
}

func (handler Handler) submit(w http.ResponseWriter, r *http.Request) {
	var request submitRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	_, err := handler.service.Submit(r.Context(), marketingapp.SubmitCommand{
		Name:      request.Name,
		Business:  request.Business,
		Phone:     request.Phone,
		Email:     request.Email,
		City:      request.City,
		Message:   request.Message,
		Source:    request.Source,
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		if errors.Is(err, marketingapp.ErrInvalidInput) {
			writeError(w, http.StatusBadRequest, "invalid_input")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	// Opaque success: never leak whether the lead was new or a duplicate.
	w.WriteHeader(http.StatusAccepted)
}

func (handler Handler) leads(w http.ResponseWriter, r *http.Request) {
	records, err := handler.service.ListLeads(r.Context(), 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	leads := make([]waitlistLeadResponse, 0, len(records))
	for _, record := range records {
		leads = append(leads, waitlistLeadResponse{
			ID:        record.LeadID.String(),
			Name:      record.Name,
			Business:  record.Business,
			Phone:     record.Phone,
			Email:     record.Email,
			City:      record.City,
			Message:   record.Message,
			CreatedAt: record.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"leads": leads})
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
