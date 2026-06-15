package authhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

type Service interface {
	RegisterBusiness(ctx context.Context, command authapp.RegisterBusinessCommand) (authapp.AuthResult, error)
	LoginBusiness(ctx context.Context, command authapp.LoginBusinessCommand) (authapp.AuthResult, error)
	RefreshSession(ctx context.Context, command authapp.RefreshSessionCommand) (authapp.AuthResult, error)
	Logout(ctx context.Context, command authapp.LogoutCommand) error
}

type Handler struct {
	service       Service
	authenticator Authenticator
}

func NewHandler(service Service, authenticator Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/auth/business/register", handler.registerBusiness)
	router.Post("/auth/business/login", handler.loginBusiness)
	router.Post("/auth/business/refresh", handler.refreshSession)
	router.Post("/auth/business/logout", handler.logout)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/auth/business/me", handler.me)
	})
}

type registerBusinessRequest struct {
	BusinessName     string `json:"business_name"`
	BusinessHandle   string `json:"business_handle"`
	OwnerDisplayName string `json:"owner_display_name"`
	OwnerEmail       string `json:"owner_email"`
	OwnerPassword    string `json:"owner_password"`
}

type loginBusinessRequest struct {
	BusinessHandle string `json:"business_handle"`
	OwnerEmail     string `json:"owner_email"`
	OwnerPassword  string `json:"owner_password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type meResponse struct {
	BusinessID string `json:"business_id"`
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
}

type authResponse struct {
	BusinessID       string `json:"business_id"`
	BusinessUserID   string `json:"business_user_id"`
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	AccessExpiresAt  string `json:"access_expires_at"`
	RefreshExpiresAt string `json:"refresh_expires_at"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func (handler Handler) registerBusiness(w http.ResponseWriter, r *http.Request) {
	var request registerBusinessRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.RegisterBusiness(r.Context(), authapp.RegisterBusinessCommand{
		BusinessName:     request.BusinessName,
		BusinessHandle:   request.BusinessHandle,
		OwnerDisplayName: request.OwnerDisplayName,
		OwnerEmail:       request.OwnerEmail,
		OwnerPassword:    request.OwnerPassword,
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAuthResponse(result))
}

func (handler Handler) loginBusiness(w http.ResponseWriter, r *http.Request) {
	var request loginBusinessRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.LoginBusiness(r.Context(), authapp.LoginBusinessCommand{
		BusinessHandle: request.BusinessHandle,
		OwnerEmail:     request.OwnerEmail,
		OwnerPassword:  request.OwnerPassword,
		UserAgent:      r.UserAgent(),
		IPAddress:      requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

func (handler Handler) refreshSession(w http.ResponseWriter, r *http.Request) {
	var request refreshRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.RefreshSession(r.Context(), authapp.RefreshSessionCommand{
		RefreshToken: request.RefreshToken,
		UserAgent:    r.UserAgent(),
		IPAddress:    requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

func (handler Handler) logout(w http.ResponseWriter, r *http.Request) {
	var request logoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.Logout(r.Context(), authapp.LogoutCommand{RefreshToken: request.RefreshToken}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) me(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	writeJSON(w, http.StatusOK, meResponse{
		BusinessID: principal.BusinessID.String(),
		UserID:     principal.UserID.String(),
		Role:       string(principal.Role),
	})
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

func newAuthResponse(result authapp.AuthResult) authResponse {
	return authResponse{
		BusinessID:       result.BusinessID.String(),
		BusinessUserID:   result.BusinessUserID.String(),
		AccessToken:      result.AccessToken,
		RefreshToken:     result.RefreshToken,
		AccessExpiresAt:  result.AccessExpiresAt.Format(time.RFC3339),
		RefreshExpiresAt: result.RefreshExpiresAt.Format(time.RFC3339),
	}
}

func authError(err error) (int, string) {
	switch {
	case errors.Is(err, authdomain.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_input"
	case errors.Is(err, authdomain.ErrInvalidCredentials):
		return http.StatusUnauthorized, "invalid_credentials"
	case errors.Is(err, business.ErrHandleTaken):
		return http.StatusConflict, "handle_taken"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, errorResponse{Error: code})
}

func requestIP(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}
