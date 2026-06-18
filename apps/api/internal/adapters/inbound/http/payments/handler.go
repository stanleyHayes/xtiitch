package paymentshttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

const maxBodyBytes = 1 << 20

type Service interface {
	VerifyBusiness(ctx context.Context, command paymentsapp.VerifyBusinessCommand) error
	InitiateCharge(ctx context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error)
	HandleProviderEvent(ctx context.Context, payload []byte, signature string) error
	ListPayments(ctx context.Context, scope common.TenantScope) ([]ports.PaymentRecord, error)
	LogManualTaking(ctx context.Context, command paymentsapp.LogManualTakingCommand) (common.ID, error)
	ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ports.ManualTakingRecord, error)
	MoneySummary(ctx context.Context, scope common.TenantScope) (ports.MoneySummary, error)
}

type Handler struct {
	service       Service
	authenticator authhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/webhooks/paystack", handler.webhook)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Post("/businesses/me/verify", handler.verify)
		protected.Post("/payments/checkout", handler.checkout)
		protected.Get("/payments", handler.listPayments)
		protected.Post("/money/takings", handler.logTaking)
		protected.Get("/money/takings", handler.listTakings)
		protected.Get("/money/summary", handler.moneySummary)
	})
}

type verifyRequest struct {
	SettlementAccount string `json:"settlement_account"`
}

type checkoutRequest struct {
	Purpose       string `json:"purpose"`
	AmountMinor   int64  `json:"amount_minor"`
	Method        string `json:"method"`
	CustomerEmail string `json:"customer_email"`
}

type checkoutResponse struct {
	Reference        string `json:"reference"`
	AuthorizationURL string `json:"authorization_url"`
	CommissionMinor  int64  `json:"commission_minor"`
}

type paymentResponse struct {
	PaymentID         string `json:"payment_id"`
	Purpose           string `json:"purpose"`
	AmountMinor       int64  `json:"amount_minor"`
	Currency          string `json:"currency"`
	Method            string `json:"method"`
	ProviderReference string `json:"provider_reference"`
	Status            string `json:"status"`
	CommissionMinor   int64  `json:"commission_minor"`
}

func (handler Handler) verify(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request verifyRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.VerifyBusiness(r.Context(), paymentsapp.VerifyBusinessCommand{
		BusinessID:        principal.BusinessID,
		ActorRole:         principal.Role,
		SettlementAccount: request.SettlementAccount,
	}); err != nil {
		status, code := paymentError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"verification_status": "verified"})
}

func (handler Handler) checkout(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request checkoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.InitiateCharge(r.Context(), paymentsapp.InitiateChargeCommand{
		Scope:                      principal.TenantScope(),
		ActorRole:                  principal.Role,
		RequireMoneyManagementRole: true,
		Purpose:                    money.PaymentPurpose(request.Purpose),
		AmountMinor:                request.AmountMinor,
		Method:                     money.PaymentMethod(request.Method),
		CustomerEmail:              request.CustomerEmail,
	})
	if err != nil {
		status, code := paymentError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, checkoutResponse{
		Reference:        result.Reference,
		AuthorizationURL: result.AuthorizationURL,
		CommissionMinor:  result.CommissionMinor,
	})
}

func (handler Handler) listPayments(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListPayments(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	response := make([]paymentResponse, 0, len(records))
	for _, record := range records {
		response = append(response, paymentResponse{
			PaymentID:         record.PaymentID.String(),
			Purpose:           record.Purpose,
			AmountMinor:       record.AmountMinor,
			Currency:          record.Currency,
			Method:            record.Method,
			ProviderReference: record.ProviderReference,
			Status:            record.Status,
			CommissionMinor:   record.CommissionMinor,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"payments": response})
}

type logTakingRequest struct {
	OrderID     string `json:"order_id"`
	AmountMinor int64  `json:"amount_minor"`
	Method      string `json:"method"`
	WhatFor     string `json:"what_for"`
}

func (handler Handler) logTaking(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request logTakingRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	cmd := paymentsapp.LogManualTakingCommand{
		Scope:       principal.TenantScope(),
		ActorRole:   principal.Role,
		AmountMinor: request.AmountMinor,
		Method:      request.Method,
		WhatFor:     request.WhatFor,
	}
	if request.OrderID != "" {
		id := common.ID(request.OrderID)
		cmd.OrderID = &id
	}

	takingID, err := handler.service.LogManualTaking(r.Context(), cmd)
	if err != nil {
		status, code := paymentError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"taking_id": takingID.String()})
}

func (handler Handler) listTakings(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	records, err := handler.service.ListManualTakings(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	response := make([]map[string]any, 0, len(records))
	for _, record := range records {
		response = append(response, map[string]any{
			"taking_id":    record.TakingID.String(),
			"amount_minor": record.AmountMinor,
			"method":       record.Method,
			"what_for":     record.WhatFor,
			"taken_at":     record.TakenAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"takings": response})
}

func (handler Handler) moneySummary(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	summary, err := handler.service.MoneySummary(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"through_platform_minor": summary.ThroughPlatformMinor,
		"commission_minor":       summary.CommissionMinor,
		"manual_takings_minor":   summary.ManualTakingsMinor,
		"net_income_minor":       summary.NetIncomeMinor,
	})
}

func (handler Handler) webhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	signature := r.Header.Get("x-paystack-signature")
	if err := handler.service.HandleProviderEvent(r.Context(), body, signature); err != nil {
		if errors.Is(err, paymentsapp.ErrInvalidSignature) {
			writeError(w, http.StatusUnauthorized, "invalid_signature")
			return
		}
		// Any other failure: ask the provider to retry by not acknowledging.
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func paymentError(err error) (int, string) {
	switch {
	case errors.Is(err, authdomain.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	case errors.Is(err, paymentsapp.ErrInvalidCharge), errors.Is(err, paymentsapp.ErrInvalidTaking):
		return http.StatusBadRequest, "invalid_charge"
	case errors.Is(err, paymentsapp.ErrBusinessNotVerified):
		return http.StatusConflict, "business_not_verified"
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
