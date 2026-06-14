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

func newTestRouter(service *fakeAuthService) http.Handler {
	router := chi.NewRouter()
	NewHandler(service).Register(router)
	return router
}

type fakeAuthService struct {
	result          authapp.AuthResult
	err             error
	registerCalled  bool
	registerCommand authapp.RegisterBusinessCommand
	loginCalled     bool
	loginCommand    authapp.LoginBusinessCommand
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
