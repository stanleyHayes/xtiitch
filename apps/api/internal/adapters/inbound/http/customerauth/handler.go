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
)

type Service interface {
	RequestOTP(ctx context.Context, phone string) error
	VerifyOTP(ctx context.Context, phone string, code string) (customerauthapp.CustomerAuthResult, error)
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
}

type requestOTPRequest struct {
	Phone string `json:"phone"`
}

type verifyOTPRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type customerAuthResponse struct {
	CustomerID  string `json:"customer_id"`
	Phone       string `json:"phone"`
	AccessToken string `json:"access_token"`
	ExpiresAt   string `json:"expires_at"`
}

type meResponse struct {
	CustomerID string `json:"customer_id"`
	Phone      string `json:"phone"`
}

func (handler Handler) requestOTP(w http.ResponseWriter, r *http.Request) {
	var request requestOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RequestOTP(r.Context(), request.Phone); err != nil {
		status, code := customerAuthError(err)
		writeError(w, status, code)
		return
	}
	// Always 202 — never reveal whether the phone is registered.
	w.WriteHeader(http.StatusAccepted)
}

func (handler Handler) verifyOTP(w http.ResponseWriter, r *http.Request) {
	var request verifyOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.VerifyOTP(r.Context(), request.Phone, request.Code)
	if err != nil {
		status, code := customerAuthError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, customerAuthResponse{
		CustomerID:  result.CustomerID.String(),
		Phone:       result.Phone,
		AccessToken: result.AccessToken,
		ExpiresAt:   result.ExpiresAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	})
}

func (handler Handler) me(w http.ResponseWriter, r *http.Request) {
	token, ok := bearerToken(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing_token")
		return
	}
	verified, err := handler.verifier.VerifyCustomerAccessToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{
		CustomerID: verified.CustomerID.String(),
		Phone:      verified.Phone,
	})
}

func customerAuthError(err error) (int, string) {
	switch {
	case errors.Is(err, customerauthapp.ErrInvalidPhone):
		return http.StatusBadRequest, "invalid_phone"
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
