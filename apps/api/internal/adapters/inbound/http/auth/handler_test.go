package authhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestRegisterBusinessReturnsCreatedAuthResponse(t *testing.T) {
	t.Parallel()

	expiresAt := time.Date(2026, 6, 14, 20, 15, 0, 0, time.UTC)
	refreshExpiresAt := time.Date(2026, 7, 14, 20, 0, 0, 0, time.UTC)
	service := &fakeAuthService{
		result: authapp.AuthResult{
			BusinessID:       common.ID("business-1"),
			BusinessUserID:   common.ID("user-1"),
			AccessToken:      "access-token",
			RefreshToken:     "refresh-token",
			AccessExpiresAt:  expiresAt,
			RefreshExpiresAt: refreshExpiresAt,
		},
	}
	router := newTestRouter(service)

	requestBody := []byte(`{
		"business_name": "Ama Stitch House",
		"business_handle": "ama-stitch",
		"owner_display_name": "Ama",
		"owner_email": "ama@example.com",
		"owner_password": "strong-password"
	}`)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/register", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "xtiitch-test")
	request.Header.Set("X-Forwarded-For", "203.0.113.10, 10.0.0.1")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, response.Code, response.Body.String())
	}
	if !service.registerCalled {
		t.Fatal("expected register service to be called")
	}
	if service.registerCommand.UserAgent != "xtiitch-test" {
		t.Fatalf("expected user agent to be passed through, got %q", service.registerCommand.UserAgent)
	}
	if service.registerCommand.IPAddress != "203.0.113.10" {
		t.Fatalf("expected first forwarded IP, got %q", service.registerCommand.IPAddress)
	}

	var body authResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.AccessToken != "access-token" || body.RefreshToken != "refresh-token" {
		t.Fatalf("unexpected token response: %+v", body)
	}
	if body.AccessExpiresAt != expiresAt.Format(time.RFC3339) {
		t.Fatalf("unexpected access expiry %q", body.AccessExpiresAt)
	}
}

func TestRegisterBusinessRejectsUnknownFields(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/register", bytes.NewReader([]byte(`{
		"business_name": "Ama Stitch House",
		"business_handle": "ama-stitch",
		"owner_display_name": "Ama",
		"owner_email": "ama@example.com",
		"owner_password": "strong-password",
		"unexpected": true
	}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	if service.registerCalled {
		t.Fatal("expected malformed request to stop before service call")
	}
}

func TestLoginBusinessRejectsTrailingJSON(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/login", bytes.NewReader([]byte(`{
		"business_handle": "ama-stitch",
		"owner_email": "ama@example.com",
		"owner_password": "strong-password"
	} {}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	if service.loginCalled {
		t.Fatal("expected malformed request to stop before service call")
	}
}

func TestRegisterBusinessReturnsConflictWhenHandleTaken(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{err: business.ErrHandleTaken}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/register", bytes.NewReader([]byte(`{
		"business_name": "Ama Stitch House",
		"business_handle": "ama-stitch",
		"owner_display_name": "Ama",
		"owner_email": "ama@example.com",
		"owner_password": "strong-password"
	}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, response.Code)
	}

	var body errorResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error != "handle_taken" {
		t.Fatalf("expected handle_taken error code, got %q", body.Error)
	}
}

func TestMeReturnsPrincipalForValidToken(t *testing.T) {
	t.Parallel()

	verifier := fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    common.ID("user-1"),
		BusinessID: common.ID("business-1"),
		Role:       business.UserRoleOwner,
	}}
	router := newTestRouterWithVerifier(&fakeAuthService{}, verifier)

	request := httptest.NewRequest(http.MethodGet, "/auth/business/me", nil)
	request.Header.Set("Authorization", "Bearer any-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	var body meResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.BusinessID != "business-1" || body.UserID != "user-1" || body.Role != "owner" {
		t.Fatalf("unexpected principal: %+v", body)
	}
}

func TestMeRejectsMissingToken(t *testing.T) {
	t.Parallel()

	router := newTestRouterWithVerifier(&fakeAuthService{}, fakeTokenVerifier{err: errors.New("no token")})
	request := httptest.NewRequest(http.MethodGet, "/auth/business/me", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestMeRejectsInvalidToken(t *testing.T) {
	t.Parallel()

	router := newTestRouterWithVerifier(&fakeAuthService{}, fakeTokenVerifier{err: errors.New("bad token")})
	request := httptest.NewRequest(http.MethodGet, "/auth/business/me", nil)
	request.Header.Set("Authorization", "Bearer rubbish")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestRefreshSessionReturnsTokens(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{result: authapp.AuthResult{AccessToken: "access-token", RefreshToken: "refresh-token"}}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/refresh", bytes.NewReader([]byte(`{"refresh_token":"old-token"}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !service.refreshCalled {
		t.Fatal("expected refresh service to be called")
	}
}

func TestLogoutReturnsNoContent(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/logout", bytes.NewReader([]byte(`{"refresh_token":"old-token"}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, response.Code)
	}
	if !service.logoutCalled {
		t.Fatal("expected logout service to be called")
	}
}

func newTestRouter(service *fakeAuthService) http.Handler {
	return newTestRouterWithVerifier(service, fakeTokenVerifier{err: errors.New("no verifier")})
}

func newTestRouterWithVerifier(service *fakeAuthService, verifier ports.TokenVerifier) http.Handler {
	router := chi.NewRouter()
	NewHandler(service, NewAuthenticator(verifier)).Register(router)
	return router
}

type fakeTokenVerifier struct {
	verified ports.VerifiedAccessToken
	err      error
}

func (v fakeTokenVerifier) VerifyAccessToken(_ context.Context, _ string) (ports.VerifiedAccessToken, error) {
	return v.verified, v.err
}

type fakeAuthService struct {
	result          authapp.AuthResult
	err             error
	registerCalled  bool
	registerCommand authapp.RegisterBusinessCommand
	loginCalled     bool
	loginCommand    authapp.LoginBusinessCommand
	refreshCalled   bool
	logoutCalled    bool
}

func (service *fakeAuthService) RegisterBusiness(_ context.Context, command authapp.RegisterBusinessCommand) (authapp.AuthResult, error) {
	service.registerCalled = true
	service.registerCommand = command
	if service.err != nil {
		return authapp.AuthResult{}, service.err
	}

	return service.result, nil
}

func (service *fakeAuthService) LoginBusiness(_ context.Context, command authapp.LoginBusinessCommand) (authapp.AuthResult, error) {
	service.loginCalled = true
	service.loginCommand = command
	if service.err != nil {
		return authapp.AuthResult{}, service.err
	}

	if service.result.AccessToken == "" {
		return authapp.AuthResult{}, errors.New("missing fake auth result")
	}

	return service.result, nil
}

func (service *fakeAuthService) RefreshSession(_ context.Context, _ authapp.RefreshSessionCommand) (authapp.AuthResult, error) {
	service.refreshCalled = true
	if service.err != nil {
		return authapp.AuthResult{}, service.err
	}

	return service.result, nil
}

func (service *fakeAuthService) Logout(_ context.Context, _ authapp.LogoutCommand) error {
	service.logoutCalled = true
	return service.err
}
