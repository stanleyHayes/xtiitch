package bookinghttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const maxBodyBytes = 1 << 20

type Service interface {
	ListBookings(ctx context.Context, scope common.TenantScope) ([]ports.BookingSummary, error)
	CancelBooking(ctx context.Context, scope common.TenantScope, bookingID common.ID) error
	RescheduleBooking(ctx context.Context, scope common.TenantScope, bookingID common.ID, newSlotStart time.Time) error
}

type Handler struct {
	service       Service
	authenticator authhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/bookings", handler.listBookings)
		protected.Post("/bookings/{id}/cancel", handler.cancel)
		protected.Post("/bookings/{id}/reschedule", handler.reschedule)
	})
}

func (handler Handler) listBookings(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	bookings, err := handler.service.ListBookings(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	out := make([]map[string]any, 0, len(bookings))
	for _, b := range bookings {
		out = append(out, map[string]any{
			"booking_id":     b.BookingID.String(),
			"order_id":       b.OrderID.String(),
			"customer_name":  b.CustomerName,
			"customer_phone": b.CustomerPhone,
			"design_title":   b.DesignTitle,
			"slot_start":     b.SlotStart.Format(time.RFC3339),
			"slot_end":       b.SlotEnd.Format(time.RFC3339),
			"status":         b.Status,
			"address":        b.Address,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"bookings": out})
}

func (handler Handler) cancel(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	if err := handler.service.CancelBooking(r.Context(), principal.TenantScope(), common.ID(chi.URLParam(r, "id"))); err != nil {
		status, code := bookingError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

type rescheduleBody struct {
	SlotStart string `json:"slot_start"`
}

func (handler Handler) reschedule(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body rescheduleBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	slotStart, err := time.Parse(time.RFC3339, body.SlotStart)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RescheduleBooking(r.Context(), principal.TenantScope(), common.ID(chi.URLParam(r, "id")), slotStart); err != nil {
		status, code := bookingError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "rescheduled"})
}

func bookingError(err error) (int, string) {
	switch {
	case errors.Is(err, ports.ErrNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, ports.ErrSlotTaken), errors.Is(err, ports.ErrNoAvailability):
		return http.StatusConflict, "slot_unavailable"
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
