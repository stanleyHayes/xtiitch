package orderhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	orderapp "github.com/xcreativs/xtiitch/apps/api/internal/application/order"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

const maxBodyBytes = 1 << 20

type Service interface {
	CreateWalkInOrder(ctx context.Context, command orderapp.CreateWalkInOrderCommand) (common.ID, error)
	ListOrders(ctx context.Context, scope common.TenantScope) ([]ports.OrderSummary, error)
	AdvanceStage(ctx context.Context, command orderapp.AdvanceStageCommand) (order.Tracking, error)
	GetTracking(ctx context.Context, orderID common.ID) (order.Tracking, error)
	SetAgreedTotal(ctx context.Context, command orderapp.SetAgreedTotalCommand) error
	CollectBalance(ctx context.Context, command orderapp.CollectBalanceCommand) (orderapp.CollectBalanceResult, error)
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
		protected.Post("/orders/{id}/agreed-total", handler.setAgreedTotal)
		protected.Post("/orders/{id}/balance", handler.collectBalance)
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
		ActorRole:        principal.Role,
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
			"order_id":             o.OrderID.String(),
			"design_title":         o.DesignTitle,
			"customer_name":        o.CustomerName,
			"customer_phone":       o.CustomerPhone,
			"customer_email":       o.CustomerEmail,
			"status":               o.Status,
			"order_type":           o.OrderType,
			"size_mode":            o.SizeMode,
			"channel":              o.Channel,
			"stage_name":           o.StageName,
			"colour":               o.Colour,
			"agreed_total_minor":   o.AgreedTotalMinor,
			"settled_minor":        o.SettledMinor,
			"payment_status":       o.PaymentStatus,
			"payment_purpose":      o.PaymentPurpose,
			"payment_amount_minor": o.PaymentAmount,
			"created_at":           o.CreatedAt,
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
	tracking, err := handler.service.AdvanceStage(r.Context(), orderapp.AdvanceStageCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		OrderID:   common.ID(chi.URLParam(r, "id")),
	})
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

type agreedTotalBody struct {
	AgreedTotalMinor int64 `json:"agreed_total_minor"`
}

func (handler Handler) setAgreedTotal(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body agreedTotalBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.SetAgreedTotal(r.Context(), orderapp.SetAgreedTotalCommand{
		Scope:            principal.TenantScope(),
		ActorRole:        principal.Role,
		OrderID:          common.ID(chi.URLParam(r, "id")),
		AgreedTotalMinor: body.AgreedTotalMinor,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"agreed_total_minor": body.AgreedTotalMinor})
}

type collectBalanceBody struct {
	Method string `json:"method"`
}

func (handler Handler) collectBalance(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body collectBalanceBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.CollectBalance(r.Context(), orderapp.CollectBalanceCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		OrderID:   common.ID(chi.URLParam(r, "id")),
		Method:    money.PaymentMethod(body.Method),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"reference":         result.Reference,
		"authorization_url": result.AuthorizationURL,
		"amount_minor":      result.AmountMinor,
	})
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
	response := map[string]any{
		"order_id":     tracking.OrderID.String(),
		"design_title": tracking.DesignTitle,
		"store_name":   tracking.StoreName,
		"status":       tracking.Status,
		"stage_name":   tracking.StageName,
		"colour":       tracking.Colour,
		"stages":       stages,
	}
	if tracking.Handover != nil {
		response["handover"] = map[string]any{
			"method":          tracking.Handover.Method,
			"status":          tracking.Handover.Status,
			"recipient_name":  tracking.Handover.RecipientName,
			"recipient_phone": tracking.Handover.RecipientPhone,
			"address":         tracking.Handover.Address,
			"courier":         tracking.Handover.Courier,
			"note":            tracking.Handover.Note,
			"updated_at":      tracking.Handover.UpdatedAt.Format(time.RFC3339),
		}
	}
	return response
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, authdomain.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, orderapp.ErrInvalidInput), errors.Is(err, paymentsapp.ErrInvalidCharge):
		writeError(w, http.StatusBadRequest, "invalid_input")
	case errors.Is(err, ports.ErrInvalidOrderState):
		writeError(w, http.StatusConflict, "order_not_advanceable")
	case errors.Is(err, orderapp.ErrBalanceNotDue):
		writeError(w, http.StatusConflict, "balance_not_due")
	case errors.Is(err, orderapp.ErrBalanceInProgress):
		writeError(w, http.StatusConflict, "balance_in_progress")
	case errors.Is(err, paymentsapp.ErrBusinessNotVerified):
		writeError(w, http.StatusConflict, "store_not_verified")
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
