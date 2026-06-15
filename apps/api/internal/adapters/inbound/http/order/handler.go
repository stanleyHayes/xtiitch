package orderhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	orderapp "github.com/xcreativs/xtiitch/apps/api/internal/application/order"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

const maxBodyBytes = 1 << 20

type Service interface {
	CreateWalkInOrder(ctx context.Context, command orderapp.CreateWalkInOrderCommand) (common.ID, error)
	ListOrders(ctx context.Context, scope common.TenantScope) ([]ports.OrderSummary, error)
	AdvanceStage(ctx context.Context, scope common.TenantScope, orderID common.ID) (order.Tracking, error)
	GetTracking(ctx context.Context, orderID common.ID) (order.Tracking, error)
}

type Handler struct {
	service       Service
	authenticator authhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Get("/public/orders/{id}", handler.tracking)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Post("/orders", handler.createWalkIn)
		protected.Get("/orders", handler.listOrders)
		protected.Post("/orders/{id}/advance", handler.advance)
	})
}

type createWalkInBody struct {
	DesignID         string `json:"design_id"`
	SizeBandID       string `json:"size_band_id"`
	CustomerName     string `json:"customer_name"`
	CustomerPhone    string `json:"customer_phone"`
	CustomerEmail    string `json:"customer_email"`
	AgreedTotalMinor *int64 `json:"agreed_total_minor"`
}

func (handler Handler) createWalkIn(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body createWalkInBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	cmd := orderapp.CreateWalkInOrderCommand{
		Scope:            principal.TenantScope(),
		DesignID:         common.ID(body.DesignID),
		CustomerName:     body.CustomerName,
		CustomerPhone:    body.CustomerPhone,
		CustomerEmail:    body.CustomerEmail,
		AgreedTotalMinor: body.AgreedTotalMinor,
	}
	if body.SizeBandID != "" {
		id := common.ID(body.SizeBandID)
		cmd.SizeBandID = &id
	}

	orderID, err := handler.service.CreateWalkInOrder(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"order_id": orderID.String()})
}

func (handler Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	orders, err := handler.service.ListOrders(r.Context(), principal.TenantScope())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(orders))
	for _, o := range orders {
		out = append(out, map[string]any{
			"order_id":           o.OrderID.String(),
			"design_title":       o.DesignTitle,
			"customer_name":      o.CustomerName,
			"status":             o.Status,
			"stage_name":         o.StageName,
			"colour":             o.Colour,
			"agreed_total_minor": o.AgreedTotalMinor,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": out})
}

func (handler Handler) advance(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	tracking, err := handler.service.AdvanceStage(r.Context(), principal.TenantScope(), common.ID(chi.URLParam(r, "id")))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toTrackingResponse(tracking))
}

func (handler Handler) tracking(w http.ResponseWriter, r *http.Request) {
	tracking, err := handler.service.GetTracking(r.Context(), common.ID(chi.URLParam(r, "id")))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toTrackingResponse(tracking))
}

func toTrackingResponse(tracking order.Tracking) map[string]any {
	stages := make([]map[string]any, 0, len(tracking.Stages))
	for _, stage := range tracking.Stages {
		stages = append(stages, map[string]any{
			"name":        stage.Name,
			"colour":      stage.Colour,
			"sequence":    stage.Sequence,
			"is_current":  stage.IsCurrent,
			"is_complete": stage.IsComplete,
		})
	}
	return map[string]any{
		"order_id":     tracking.OrderID.String(),
		"design_title": tracking.DesignTitle,
		"store_name":   tracking.StoreName,
		"status":       tracking.Status,
		"stage_name":   tracking.StageName,
		"colour":       tracking.Colour,
		"stages":       stages,
	}
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, orderapp.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "invalid_input")
	case errors.Is(err, ports.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found")
	default:
		writeError(w, http.StatusInternalServerError, "internal_error")
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
