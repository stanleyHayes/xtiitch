package customerauthhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	customerauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/customerauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service interface {
	RequestOTP(ctx context.Context, phone string) error
	RequestEmailOTP(ctx context.Context, email string) error
	VerifyOTP(ctx context.Context, phone string, code string) (customerauthapp.CustomerAuthResult, error)
	VerifyEmailOTP(ctx context.Context, email string, code string) (customerauthapp.CustomerAuthResult, error)
	ListOrders(ctx context.Context, customerID common.ID) ([]ports.CustomerOrderSummary, error)
	GetProfile(ctx context.Context, customerID common.ID) (ports.CustomerProfile, error)
	UpdateProfile(ctx context.Context, customerID common.ID, displayName string, email string) (ports.CustomerProfile, error)
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
	CustomerID  string `json:"customer_id"`
	Phone       string `json:"phone"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
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
		if profile.Phone != "" {
			response.Phone = profile.Phone
		}
	}
	writeJSON(w, http.StatusOK, response)
}

type updateProfileRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
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
	profile, err := handler.service.UpdateProfile(r.Context(), verified.CustomerID, request.DisplayName, request.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{
		CustomerID:  profile.CustomerID.String(),
		Phone:       profile.Phone,
		DisplayName: profile.DisplayName,
		Email:       profile.Email,
	})
}

type customerOrderResponse struct {
	OrderID          string `json:"order_id"`
	BusinessName     string `json:"business_name"`
	BusinessHandle   string `json:"business_handle"`
	DesignTitle      string `json:"design_title"`
	Status           string `json:"status"`
	AgreedTotalMinor int64  `json:"agreed_total_minor"`
	CreatedAt        string `json:"created_at"`
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
		response = append(response, customerOrderResponse{
			OrderID:          o.OrderID.String(),
			BusinessName:     o.BusinessName,
			BusinessHandle:   o.BusinessHandle,
			DesignTitle:      o.DesignTitle,
			Status:           o.Status,
			AgreedTotalMinor: o.AgreedTotalMinor,
			CreatedAt:        o.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": response})
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
