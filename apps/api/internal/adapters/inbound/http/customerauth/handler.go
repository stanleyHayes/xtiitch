package customerauthhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	checkoutapp "github.com/xcreativs/xtiitch/apps/api/internal/application/checkout"
	customerauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/customerauth"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service interface {
	RequestOTP(ctx context.Context, phone string) error
	RequestEmailOTP(ctx context.Context, email string) error
	VerifyOTP(ctx context.Context, phone string, code string) (customerauthapp.CustomerAuthResult, error)
	VerifyEmailOTP(ctx context.Context, email string, code string) (customerauthapp.CustomerAuthResult, error)
	ListOrders(ctx context.Context, customerID common.ID) ([]ports.CustomerOrderSummary, error)
	CloseOrder(ctx context.Context, customerID common.ID, orderID common.ID) error
	MarkOrderReceived(ctx context.Context, customerID common.ID, orderID common.ID) error
	MarkBasketReceived(ctx context.Context, customerID common.ID, checkoutGroupID common.ID) (int, error)
	GetProfile(ctx context.Context, customerID common.ID) (ports.CustomerProfile, error)
	UpdateProfile(ctx context.Context, customerID common.ID, displayName, email, whatsAppPhone string) (ports.CustomerProfile, error)
	// CreateOrderPaymentLink re-initiates a Paystack checkout for one of the
	// customer's draft orders (the abandoned-checkout recovery path).
	CreateOrderPaymentLink(
		ctx context.Context,
		customerID common.ID,
		orderID common.ID,
		callbackURL string,
	) (customerauthapp.OrderPaymentLinkResult, error)
}

type Handler struct {
	service  Service
	verifier ports.CustomerTokenVerifier
}

func NewHandler(service Service, verifier ports.CustomerTokenVerifier) Handler {
	return Handler{service: service, verifier: verifier}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/customer/auth/request-otp", handler.requestOTP)
	router.Post("/customer/auth/verify-otp", handler.verifyOTP)
	router.Get("/customer/me", handler.me)
	router.Patch("/customer/me", handler.updateProfile)
	router.Get("/customer/orders", handler.orders)
	router.Post("/customer/orders/{orderID}/close", handler.closeOrder)
	// §5.3.2 "Received": one order, or a whole store basket at once. Both are
	// scoped to the signed-in customer's own orders (their own data — the one
	// thing §6 deliberately shares across stores).
	router.Post("/customer/orders/{orderID}/received", handler.markReceived)
	router.Post("/customer/orders/received-basket", handler.markBasketReceived)
	// Re-pay a draft order after backing out of Paystack: a fresh charge for
	// the order's outstanding amount. The old 'initiated' payment is settled
	// (or failed) separately via the public payments/verify endpoint.
	router.Post("/customer/orders/{orderID}/payment-link", handler.paymentLink)
}

type requestOTPRequest struct {
	Channel string `json:"channel"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
}

type verifyOTPRequest struct {
	Channel string `json:"channel"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Code    string `json:"code"`
}

type customerAuthResponse struct {
	CustomerID  string `json:"customer_id"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	AccessToken string `json:"access_token"`
	ExpiresAt   string `json:"expires_at"`
}

// isEmailChannel reports whether the request asked for the email channel. The
// default (empty/unknown) is the WhatsApp phone channel, preserving existing
// callers that only send a phone.
func isEmailChannel(channel string) bool {
	return strings.EqualFold(strings.TrimSpace(channel), string(ports.CustomerOTPChannelEmail))
}

type meResponse struct {
	CustomerID    string `json:"customer_id"`
	Phone         string `json:"phone"`
	DisplayName   string `json:"display_name"`
	Email         string `json:"email"`
	WhatsAppPhone string `json:"whatsapp_phone"`
}

func (handler Handler) requestOTP(w http.ResponseWriter, r *http.Request) {
	var request requestOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	var err error
	if isEmailChannel(request.Channel) {
		err = handler.service.RequestEmailOTP(r.Context(), request.Email)
	} else {
		err = handler.service.RequestOTP(r.Context(), request.Phone)
	}
	if err != nil {
		status, code := customerAuthError(err)
		writeError(w, status, code)
		return
	}
	// Always 202 — never reveal whether the identifier is registered.
	w.WriteHeader(http.StatusAccepted)
}

func (handler Handler) verifyOTP(w http.ResponseWriter, r *http.Request) {
	var request verifyOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	var result customerauthapp.CustomerAuthResult
	var err error
	if isEmailChannel(request.Channel) {
		result, err = handler.service.VerifyEmailOTP(r.Context(), request.Email, request.Code)
	} else {
		result, err = handler.service.VerifyOTP(r.Context(), request.Phone, request.Code)
	}
	if err != nil {
		status, code := customerAuthError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, customerAuthResponse{
		CustomerID:  result.CustomerID.String(),
		Phone:       result.Phone,
		Email:       result.Email,
		AccessToken: result.AccessToken,
		ExpiresAt:   result.ExpiresAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	})
}

// authCustomer verifies the bearer token and returns the customer identity, or
// writes a 401 and reports ok=false.
func (handler Handler) authCustomer(w http.ResponseWriter, r *http.Request) (ports.VerifiedCustomerToken, bool) {
	token, ok := bearerToken(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing_token")
		return ports.VerifiedCustomerToken{}, false
	}
	verified, err := handler.verifier.VerifyCustomerAccessToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return ports.VerifiedCustomerToken{}, false
	}
	return verified, true
}

func (handler Handler) me(w http.ResponseWriter, r *http.Request) {
	verified, ok := handler.authCustomer(w, r)
	if !ok {
		return
	}
	response := meResponse{
		CustomerID: verified.CustomerID.String(),
		Phone:      verified.Phone,
	}
	// Enrich with the editable profile; fall back to the token identity if the
	// profile read fails (a valid token always maps to a customer).
	if profile, err := handler.service.GetProfile(r.Context(), verified.CustomerID); err == nil {
		response.DisplayName = profile.DisplayName
		response.Email = profile.Email
		response.WhatsAppPhone = profile.WhatsAppPhone
		if profile.Phone != "" {
			response.Phone = profile.Phone
		}
	}
	writeJSON(w, http.StatusOK, response)
}

type updateProfileRequest struct {
	DisplayName   string `json:"display_name"`
	Email         string `json:"email"`
	WhatsAppPhone string `json:"whatsapp_phone"`
}

func (handler Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	verified, ok := handler.authCustomer(w, r)
	if !ok {
		return
	}
	var request updateProfileRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	profile, err := handler.service.UpdateProfile(r.Context(), verified.CustomerID, request.DisplayName, request.Email, request.WhatsAppPhone)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{
		CustomerID:    profile.CustomerID.String(),
		Phone:         profile.Phone,
		DisplayName:   profile.DisplayName,
		Email:         profile.Email,
		WhatsAppPhone: profile.WhatsAppPhone,
	})
}

type customerOrderResponse struct {
	OrderID          string  `json:"order_id"`
	BusinessName     string  `json:"business_name"`
	BusinessHandle   string  `json:"business_handle"`
	StorePhone       string  `json:"store_phone"`
	DesignTitle      string  `json:"design_title"`
	Status           string  `json:"status"`
	Kind             string  `json:"kind"`
	CheckoutGroupID  *string `json:"checkout_group_id"`
	AgreedTotalMinor int64   `json:"agreed_total_minor"`
	CreatedAt        string  `json:"created_at"`
	ReceivedAt       *string `json:"received_at"`
}

func (handler Handler) orders(w http.ResponseWriter, r *http.Request) {
	verified, ok := handler.authCustomer(w, r)
	if !ok {
		return
	}
	orders, err := handler.service.ListOrders(r.Context(), verified.CustomerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	response := make([]customerOrderResponse, 0, len(orders))
	for _, o := range orders {
		item := customerOrderResponse{
			OrderID:          o.OrderID.String(),
			BusinessName:     o.BusinessName,
			BusinessHandle:   o.BusinessHandle,
			StorePhone:       o.StorePhone,
			DesignTitle:      o.DesignTitle,
			Status:           o.Status,
			Kind:             o.Kind,
			AgreedTotalMinor: o.AgreedTotalMinor,
			CreatedAt:        o.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		}
		if o.CheckoutGroupID != nil {
			value := o.CheckoutGroupID.String()
			item.CheckoutGroupID = &value
		}
		if o.ReceivedAt != nil {
			value := o.ReceivedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
			item.ReceivedAt = &value
		}
		response = append(response, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": response})
}

// closeOrder dismisses one awaiting-payment order. Cart orders close as a
// whole basket in the repository, keeping the customer and business views in
// sync and preventing partial-basket payment retries.
func (handler Handler) closeOrder(w http.ResponseWriter, r *http.Request) {
	verified, ok := handler.authCustomer(w, r)
	if !ok {
		return
	}
	if err := handler.service.CloseOrder(
		r.Context(), verified.CustomerID, common.ID(chi.URLParam(r, "orderID")),
	); err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// markReceived stamps one archived (final-stage) order received (§5.3.2), so it
// disappears from the customer's Archived tab. Re-marking is a 200 no-op.
func (handler Handler) markReceived(w http.ResponseWriter, r *http.Request) {
	verified, ok := handler.authCustomer(w, r)
	if !ok {
		return
	}
	err := handler.service.MarkOrderReceived(r.Context(), verified.CustomerID, common.ID(chi.URLParam(r, "orderID")))
	if err != nil {
		status, code := receivedError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type markBasketReceivedRequest struct {
	// CheckoutGroupID names the basket. Baskets are per-store by construction
	// (a checkout group only ever holds one store's orders), so the group id
	// alone identifies "the whole basket from that store" — no business handle
	// is needed, and none is accepted.
	CheckoutGroupID string `json:"checkout_group_id"`
}

// markBasketReceived stamps every final-stage order in one store basket
// received in a single transaction (§5.3.2 whole-basket "Received") and
// reports how many were newly stamped. Idempotent: a repeat call returns 0.
func (handler Handler) markBasketReceived(w http.ResponseWriter, r *http.Request) {
	verified, ok := handler.authCustomer(w, r)
	if !ok {
		return
	}
	var request markBasketReceivedRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	groupID := common.ID(strings.TrimSpace(request.CheckoutGroupID))
	if groupID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	marked, err := handler.service.MarkBasketReceived(r.Context(), verified.CustomerID, groupID)
	if err != nil {
		status, code := receivedError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "marked_count": marked})
}

type paymentLinkRequest struct {
	// CallbackURL is where Paystack returns the customer after paying (the
	// storefront order-tracking page). Optional; validated in the application
	// layer exactly like the checkout callback.
	CallbackURL string `json:"callback_url"`
}

// paymentLink re-initiates a Paystack checkout for one of the signed-in
// customer's draft orders (the abandoned-checkout recovery path): the response
// carries a fresh authorization_url + reference, and the customer verifies the
// outcome through the public payments/verify endpoint on return. A confirmed
// or cancelled order is a 409; another customer's order is a 404.
func (handler Handler) paymentLink(w http.ResponseWriter, r *http.Request) {
	verified, ok := handler.authCustomer(w, r)
	if !ok {
		return
	}
	var request paymentLinkRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.CreateOrderPaymentLink(
		r.Context(), verified.CustomerID, common.ID(chi.URLParam(r, "orderID")), request.CallbackURL)
	if err != nil {
		status, code := paymentLinkError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"authorization_url": result.AuthorizationURL,
		"reference":         result.Reference,
	})
}

// paymentLinkError maps the payment-link failures to stable codes: not_found
// covers both a missing order and another customer's order (indistinguishable
// by design); order_not_payable is the 409 the UI keys its "this order can no
// longer be paid" message off.
func paymentLinkError(err error) (int, string) {
	switch {
	case errors.Is(err, ports.ErrNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, customerauthapp.ErrOrderNotPayable):
		return http.StatusConflict, "order_not_payable"
	case errors.Is(err, customerauthapp.ErrOrderPaymentPending):
		return http.StatusConflict, "payment_pending"
	case errors.Is(err, checkoutapp.ErrInvalidInput), errors.Is(err, paymentsapp.ErrInvalidCharge):
		return http.StatusBadRequest, "invalid_request"
	case errors.Is(err, paymentsapp.ErrBusinessNotVerified):
		return http.StatusConflict, "store_cannot_take_payment"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

// receivedError maps the §5.3.2 mark-received failures to stable codes:
// not_found covers both a missing order and another customer's order (they are
// indistinguishable by design); order_not_in_final_stage is the 409 the UI keys
// its "the store is still working on this one" message off.
func receivedError(err error) (int, string) {
	switch {
	case errors.Is(err, ports.ErrNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, customerauthapp.ErrOrderNotInFinalStage):
		return http.StatusConflict, "order_not_in_final_stage"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func customerAuthError(err error) (int, string) {
	switch {
	case errors.Is(err, customerauthapp.ErrInvalidPhone):
		return http.StatusBadRequest, "invalid_phone"
	case errors.Is(err, customerauthapp.ErrInvalidEmail):
		return http.StatusBadRequest, "invalid_email"
	case errors.Is(err, customerauthapp.ErrInvalidCode):
		return http.StatusUnauthorized, "invalid_code"
	case errors.Is(err, customerauthapp.ErrCodeExpired):
		return http.StatusUnauthorized, "code_expired"
	case errors.Is(err, customerauthapp.ErrTooManyAttempts):
		return http.StatusTooManyRequests, "too_many_attempts"
	case errors.Is(err, customerauthapp.ErrOTPDeliveryFailed):
		return http.StatusBadGateway, "delivery_failed"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func bearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	return token, token != ""
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
