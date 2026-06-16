package deliveryhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	deliveryapp "github.com/xcreativs/xtiitch/apps/api/internal/application/delivery"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
)

const maxBodyBytes = 1 << 20

type Service interface {
	ArrangeHandover(ctx context.Context, scope common.TenantScope, cmd deliveryapp.ArrangeHandoverCommand) (common.ID, error)
	ListHandovers(ctx context.Context, scope common.TenantScope) ([]ports.HandoverSummary, error)
	AdvanceHandover(ctx context.Context, scope common.TenantScope, handoverID common.ID, courier, note string) error
	CancelHandover(ctx context.Context, scope common.TenantScope, handoverID common.ID) error
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
		protected.Post("/handovers", handler.arrange)
		protected.Get("/handovers", handler.list)
		protected.Post("/handovers/{id}/advance", handler.advance)
		protected.Post("/handovers/{id}/cancel", handler.cancel)
	})
}

type arrangeBody struct {
	OrderID        string `json:"order_id"`
	Method         string `json:"method"`
	RecipientName  string `json:"recipient_name"`
	RecipientPhone string `json:"recipient_phone"`
	Address        string `json:"address"`
	Courier        string `json:"courier"`
	Note           string `json:"note"`
}

func (handler Handler) arrange(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body arrangeBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	method := delivery.Method(body.Method)
	if body.OrderID == "" || !method.Valid() {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if method == delivery.MethodDelivery && body.Address == "" {
		writeError(w, http.StatusBadRequest, "address_required")
		return
	}
	id, err := handler.service.ArrangeHandover(r.Context(), principal.TenantScope(), deliveryapp.ArrangeHandoverCommand{
		OrderID:        common.ID(body.OrderID),
		Method:         method,
		RecipientName:  body.RecipientName,
		RecipientPhone: body.RecipientPhone,
		Address:        body.Address,
		Courier:        body.Courier,
		Note:           body.Note,
	})
	if err != nil {
		status, code := handoverError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"handover_id": id.String(), "status": "pending"})
}

func (handler Handler) list(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	handovers, err := handler.service.ListHandovers(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	out := make([]map[string]any, 0, len(handovers))
	for _, h := range handovers {
		out = append(out, map[string]any{
			"handover_id":     h.HandoverID.String(),
			"order_id":        h.OrderID.String(),
			"customer_name":   h.CustomerName,
			"customer_phone":  h.CustomerPhone,
			"design_title":    h.DesignTitle,
			"method":          h.Method,
			"status":          h.Status,
			"recipient_name":  h.RecipientName,
			"recipient_phone": h.RecipientPhone,
			"address":         h.Address,
			"courier":         h.Courier,
			"note":            h.Note,
			"created_at":      h.CreatedAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"handovers": out})
}

type advanceBody struct {
	Courier string `json:"courier"`
	Note    string `json:"note"`
}

func (handler Handler) advance(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	// The body is optional dispatch context; an empty body is fine.
	var body advanceBody
	if r.ContentLength != 0 {
		if err := decodeJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request")
			return
		}
	}
	if err := handler.service.AdvanceHandover(r.Context(), principal.TenantScope(), common.ID(chi.URLParam(r, "id")), body.Courier, body.Note); err != nil {
		status, code := handoverError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "advanced"})
}

func (handler Handler) cancel(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	if err := handler.service.CancelHandover(r.Context(), principal.TenantScope(), common.ID(chi.URLParam(r, "id"))); err != nil {
		status, code := handoverError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

func handoverError(err error) (int, string) {
	switch {
	case errors.Is(err, ports.ErrNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, ports.ErrHandoverInProgress):
		return http.StatusConflict, "handover_in_progress"
	case errors.Is(err, ports.ErrInvalidHandoverState):
		return http.StatusConflict, "invalid_handover_state"
	case errors.Is(err, ports.ErrInvalidOrderState):
		return http.StatusConflict, "order_not_fulfilled"
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
