package paymentshttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

const maxBodyBytes = 1 << 20

type Service interface {
	VerifyBusiness(ctx context.Context, command paymentsapp.VerifyBusinessCommand) error
	RequestPayoutOTP(ctx context.Context, command paymentsapp.RequestPayoutOTPCommand) error
	InitiateCharge(ctx context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error)
	HandleProviderEvent(ctx context.Context, payload []byte, signature string) error
	ListPayments(ctx context.Context, scope common.TenantScope) ([]ports.PaymentRecord, error)
	LogManualTaking(ctx context.Context, command paymentsapp.LogManualTakingCommand) (paymentsapp.LogManualTakingResult, error)
	ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ports.ManualTakingRecord, error)
	MoneySummary(ctx context.Context, scope common.TenantScope, period ports.MoneyPeriod) (ports.MoneySummary, error)
	ListMoneyTransactions(ctx context.Context, scope common.TenantScope, period ports.MoneyPeriod, limit int, offset int) ([]ports.MoneyTransactionRecord, error)
	ListPayouts(ctx context.Context, scope common.TenantScope, period ports.MoneyPeriod, limit int, offset int) ([]ports.ProviderSettlementRecord, error)
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
		protected.Post("/businesses/me/payout-otp", handler.requestPayoutOTP)
		protected.Post("/payments/checkout", handler.checkout)
		protected.Get("/payments", handler.listPayments)
		protected.Post("/money/takings", handler.logTaking)
		protected.Get("/money/takings", handler.listTakings)
		protected.Get("/money/summary", handler.moneySummary)
		protected.Get("/money/transactions", handler.listMoneyTransactions)
		protected.Get("/money/payouts", handler.listPayouts)
	})
}

type verifyRequest struct {
	// SettlementBank is the mobile-money network code (MTN / VOD / ATL) or bank
	// code Paystack settles the subaccount to; required alongside the number.
	SettlementBank    string `json:"settlement_bank"`
	SettlementAccount string `json:"settlement_account"`
	// SettlementAccountName is the MoMo-registered wallet name (§2.1); required.
	// It becomes the Paystack subaccount's business_name.
	SettlementAccountName string `json:"settlement_account_name"`
	// OTPCode proves SettlementAccount, from the code sent by payout-otp.
	OTPCode string `json:"otp_code"`
}

type payoutOTPRequest struct {
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
		BusinessID:            principal.BusinessID,
		ActorRole:             principal.Role,
		SettlementBank:        request.SettlementBank,
		SettlementAccount:     request.SettlementAccount,
		SettlementAccountName: request.SettlementAccountName,
		OTPCode:               request.OTPCode,
	}); err != nil {
		status, code := paymentError(err)
		writeError(w, status, code)
		return
	}

	// §2.2: payout setup does NOT verify the business — identity verification is
	// the admin's call and was already required to reach this point — so the
	// response confirms the payout details, not a verification status.
	writeJSON(w, http.StatusOK, map[string]string{"payout_status": "ready"})
}

// requestPayoutOTP sends a code to a candidate payout number so the owner can
// prove it. Always 202 on success, mirroring the signup code-send: the response
// says a code was sent, never whether the number was interesting.
func (handler Handler) requestPayoutOTP(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request payoutOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.RequestPayoutOTP(r.Context(), paymentsapp.RequestPayoutOTPCommand{
		BusinessID:        principal.BusinessID,
		ActorRole:         principal.Role,
		SettlementAccount: request.SettlementAccount,
	}); err != nil {
		status, code := paymentError(err)
		writeError(w, status, code)
		return
	}

	w.WriteHeader(http.StatusAccepted)
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

type logTakingResponse struct {
	TakingID         string `json:"taking_id"`
	CommissionMinor  int64  `json:"commission_minor"`
	CommissionStatus string `json:"commission_status"`
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
		ActorUserID: principal.UserID,
		AmountMinor: request.AmountMinor,
		Method:      request.Method,
		WhatFor:     request.WhatFor,
	}
	if request.OrderID != "" {
		id := common.ID(request.OrderID)
		cmd.OrderID = &id
	}

	result, err := handler.service.LogManualTaking(r.Context(), cmd)
	if err != nil {
		status, code := paymentError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusCreated, logTakingResponse{
		TakingID:         result.TakingID.String(),
		CommissionMinor:  result.CommissionMinor,
		CommissionStatus: result.CommissionStatus,
	})
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
			"taking_id":         record.TakingID.String(),
			"amount_minor":      record.AmountMinor,
			"method":            record.Method,
			"what_for":          record.WhatFor,
			"commission_bps":    record.CommissionBps,
			"commission_minor":  record.CommissionMinor,
			"commission_status": record.CommissionStatus,
			"commission_note":   record.CommissionNote,
			"taken_at":          record.TakenAt.Format(time.RFC3339),
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
	summary, err := handler.service.MoneySummary(r.Context(), principal.TenantScope(), parseMoneyPeriod(r.URL.Query().Get("period"), time.Now))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	// §3.1: every card is a sum over PERSISTED Paystack-derived figures (§3.2) —
	// through-platform gross, the provider fee, the Xtiitch fee split from its
	// tax, the payouts already settled, net income (amount due) and all-time
	// income. commission_minor keeps its existing meaning (fee + tax).
	writeJSON(w, http.StatusOK, map[string]any{
		"through_platform_minor":       summary.ThroughPlatformMinor,
		"paystack_fee_minor":           summary.PaystackFeeMinor,
		"xtiitch_fee_minor":            summary.XtiitchFeeMinor,
		"xtiitch_tax_minor":            summary.XtiitchTaxMinor,
		"commission_minor":             summary.CommissionMinor,
		"settled_payouts_minor":        summary.SettledPayoutsMinor,
		"manual_takings_minor":         summary.ManualTakingsMinor,
		"offline_commission_due_minor": summary.OfflineCommissionDueMinor,
		"all_time_income_minor":        summary.AllTimeIncomeMinor,
		"net_income_minor":             summary.NetIncomeMinor,
	})
}

// listMoneyTransactions is the Money Desk transaction ledger: every successful
// storefront payment with the exact persisted split/take-home breakdown.
func (handler Handler) listMoneyTransactions(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	records, err := handler.service.ListMoneyTransactions(
		r.Context(),
		principal.TenantScope(),
		parseMoneyPeriod(r.URL.Query().Get("period"), time.Now),
		parsePagingLimit(r.URL.Query().Get("limit")),
		parsePagingOffset(r.URL.Query().Get("offset")),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	response := make([]transactionResponse, 0, len(records))
	for _, record := range records {
		response = append(response, newTransactionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{"transactions": response})
}

// listPayouts is the §3.3 payout history table: the store's mirrored Paystack
// settlement rows (amount, status, settled_at, reference), paged.
func (handler Handler) listPayouts(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	records, err := handler.service.ListPayouts(
		r.Context(),
		principal.TenantScope(),
		parseMoneyPeriod(r.URL.Query().Get("period"), time.Now),
		parsePagingLimit(r.URL.Query().Get("limit")),
		parsePagingOffset(r.URL.Query().Get("offset")),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	response := make([]payoutResponse, 0, len(records))
	for _, record := range records {
		response = append(response, newPayoutResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{"payouts": response})
}

type transactionResponse struct {
	PaymentID         string `json:"payment_id"`
	OrderID           string `json:"order_id"`
	Reference         string `json:"reference"`
	Purpose           string `json:"purpose"`
	Method            string `json:"method"`
	AmountMinor       int64  `json:"amount_minor"`
	DesignCostMinor   int64  `json:"design_cost_minor"`
	PaystackFeeMinor  int64  `json:"paystack_fee_minor"`
	XtiitchFeeMinor   int64  `json:"xtiitch_fee_minor"`
	XtiitchTaxMinor   int64  `json:"xtiitch_tax_minor"`
	TakeHomeMinor     int64  `json:"take_home_minor"`
	DesignTitle       string `json:"design_title"`
	CustomerName      string `json:"customer_name"`
	CreatedAt         string `json:"created_at"`
}

func newTransactionResponse(record ports.MoneyTransactionRecord) transactionResponse {
	orderID := ""
	if record.OrderID != nil {
		orderID = record.OrderID.String()
	}
	return transactionResponse{
		PaymentID:        record.PaymentID.String(),
		OrderID:          orderID,
		Reference:        record.ProviderReference,
		Purpose:          record.Purpose,
		Method:           record.Method,
		AmountMinor:      record.AmountMinor,
		DesignCostMinor:  record.DesignCostMinor,
		PaystackFeeMinor: record.PaystackFeeMinor,
		XtiitchFeeMinor:  record.XtiitchFeeMinor,
		XtiitchTaxMinor:  record.XtiitchTaxMinor,
		TakeHomeMinor:    record.TakeHomeMinor,
		DesignTitle:      record.DesignTitle,
		CustomerName:     record.CustomerName,
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
	}
}

type payoutResponse struct {
	SettlementID string `json:"settlement_id"`
	Reference    string `json:"reference"`
	AmountMinor  int64  `json:"amount_minor"`
	Status       string `json:"status"`
	SettledAt    string `json:"settled_at"`
	CreatedAt    string `json:"created_at"`
}

func newPayoutResponse(record ports.ProviderSettlementRecord) payoutResponse {
	settledAt := ""
	if record.SettledAt != nil {
		settledAt = record.SettledAt.Format(time.RFC3339)
	}
	return payoutResponse{
		SettlementID: record.SettlementID.String(),
		Reference:    record.ProviderReference,
		AmountMinor:  record.AmountMinor,
		Status:       record.Status,
		SettledAt:    settledAt,
		CreatedAt:    record.CreatedAt.Format(time.RFC3339),
	}
}

// Payout-history paging bounds: a sane default page and a hard cap, matching
// the admin CRM's clamps.
const (
	defaultPayoutPageLimit = 50
	maxPayoutPageLimit     = 200
)

func parseMoneyPeriod(value string, now func() time.Time) ports.MoneyPeriod {
	current := now().UTC()
	today := time.Date(current.Year(), current.Month(), current.Day(), 0, 0, 0, 0, time.UTC)
	thisMonth := time.Date(current.Year(), current.Month(), 1, 0, 0, 0, 0, time.UTC)
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "today":
		to := today.AddDate(0, 0, 1)
		return ports.MoneyPeriod{From: &today, To: &to}
	case "last_7_days", "last7", "7_days":
		from := today.AddDate(0, 0, -6)
		to := today.AddDate(0, 0, 1)
		return ports.MoneyPeriod{From: &from, To: &to}
	case "this_month", "month":
		to := thisMonth.AddDate(0, 1, 0)
		return ports.MoneyPeriod{From: &thisMonth, To: &to}
	case "last_month":
		from := thisMonth.AddDate(0, -1, 0)
		return ports.MoneyPeriod{From: &from, To: &thisMonth}
	default:
		return ports.MoneyPeriod{}
	}
}

func parsePagingLimit(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 || parsed > maxPayoutPageLimit {
		return defaultPayoutPageLimit
	}
	return parsed
}

func parsePagingOffset(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
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
	// §2.2: payout setup before admin-approved identity verification. 409 (like
	// business_not_verified) — the request conflicts with the business's current
	// state, and the dashboard maps the code to "verify your Ghana Card first".
	case errors.Is(err, paymentsapp.ErrIdentityVerificationRequired):
		return http.StatusConflict, "identity_verification_required"
	// §2.1: the payout number is not a 10-digit local MoMo number.
	case errors.Is(err, paymentsapp.ErrInvalidPayoutNumber):
		return http.StatusBadRequest, "invalid_payout_number"
	// The payout OTP errors originate in authapp and reach here through the
	// MoMoOTP port. Without these cases a wrong or expired code would surface as
	// a generic 500 and the owner could not tell what to fix. The status/string
	// vocabulary is kept identical to authhttp's and customerauth's mappers so
	// one code means one thing across the API.
	case errors.Is(err, paymentsapp.ErrOTPUnavailable), errors.Is(err, authapp.ErrWhatsAppOTPUnavailable):
		return http.StatusServiceUnavailable, "whatsapp_unavailable"
	case errors.Is(err, authapp.ErrInvalidPhone):
		return http.StatusBadRequest, "invalid_phone"
	case errors.Is(err, authapp.ErrInvalidCode):
		return http.StatusUnauthorized, "invalid_code"
	case errors.Is(err, authapp.ErrCodeExpired):
		return http.StatusUnauthorized, "code_expired"
	case errors.Is(err, authapp.ErrTooManyAttempts):
		return http.StatusTooManyRequests, "too_many_attempts"
	case errors.Is(err, authapp.ErrOTPResendTooSoon):
		return http.StatusTooManyRequests, "resend_too_soon"
	case errors.Is(err, authapp.ErrOTPDeliveryFailed):
		return http.StatusBadGateway, "delivery_failed"
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
