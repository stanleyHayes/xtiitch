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
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
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

func TestListBusinessUsersPassesPrincipalRole(t *testing.T) {
	t.Parallel()

	createdAt := time.Date(2026, 6, 16, 10, 0, 0, 0, time.UTC)
	service := &fakeAuthService{
		users: []ports.BusinessUserRecord{
			{
				UserID:      "user-1",
				BusinessID:  "business-1",
				Email:       "ama@example.com",
				DisplayName: "Ama",
				Role:        business.UserRoleOwner,
				IsActive:    true,
				CreatedAt:   createdAt,
				UpdatedAt:   createdAt,
			},
		},
	}
	router := newTestRouterWithVerifier(service, fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "owner-1",
		BusinessID: "business-1",
		Role:       business.UserRoleOwner,
	}})
	request := httptest.NewRequest(http.MethodGet, "/auth/business/users", nil)
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, response.Code, response.Body.String())
	}
	if !service.listUsersCalled {
		t.Fatal("expected list users service to be called")
	}
	if service.listUsersCommand.Scope.BusinessID != "business-1" || service.listUsersCommand.ActorRole != business.UserRoleOwner {
		t.Fatalf("unexpected list users command: %+v", service.listUsersCommand)
	}

	var body struct {
		Users []businessUserResponse `json:"users"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Users) != 1 || body.Users[0].UserID != "user-1" || body.Users[0].Role != "owner" {
		t.Fatalf("unexpected users response: %+v", body.Users)
	}
}

func TestCreateBusinessUserReturnsCreatedUser(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{
		businessUser: ports.BusinessUserRecord{
			UserID:      "user-2",
			BusinessID:  "business-1",
			Email:       "kofi@example.com",
			DisplayName: "Kofi",
			Role:        business.UserRoleStaff,
			IsActive:    true,
			CreatedAt:   time.Date(2026, 6, 16, 10, 0, 0, 0, time.UTC),
			UpdatedAt:   time.Date(2026, 6, 16, 10, 0, 0, 0, time.UTC),
		},
	}
	router := newTestRouterWithVerifier(service, fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "owner-1",
		BusinessID: "business-1",
		Role:       business.UserRoleAdmin,
	}})
	request := httptest.NewRequest(http.MethodPost, "/auth/business/users", bytes.NewReader([]byte(`{
		"display_name": "Kofi",
		"email": "kofi@example.com",
		"password": "strong-password",
		"role": "staff"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, response.Code, response.Body.String())
	}
	if !service.createUserCalled {
		t.Fatal("expected create user service to be called")
	}
	if service.createUserCommand.Scope.BusinessID != "business-1" || service.createUserCommand.ActorRole != business.UserRoleAdmin {
		t.Fatalf("unexpected create user command scope/role: %+v", service.createUserCommand)
	}
	if service.createUserCommand.Role != business.UserRoleStaff || service.createUserCommand.Email != "kofi@example.com" {
		t.Fatalf("unexpected create user command body: %+v", service.createUserCommand)
	}
}

func TestUpdateBusinessUserMapsForbidden(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{userErr: authdomain.ErrForbidden}
	router := newTestRouterWithVerifier(service, fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "staff-1",
		BusinessID: "business-1",
		Role:       business.UserRoleStaff,
	}})
	request := httptest.NewRequest(http.MethodPatch, "/auth/business/users/user-2", bytes.NewReader([]byte(`{
		"display_name": "Kofi",
		"role": "staff",
		"is_active": false
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusForbidden, response.Code, response.Body.String())
	}
	if !service.updateUserCalled {
		t.Fatal("expected update user service to be called")
	}
	if service.updateUserCommand.UserID != "user-2" || service.updateUserCommand.IsActive {
		t.Fatalf("unexpected update user command: %+v", service.updateUserCommand)
	}
}

func TestResetBusinessUserPasswordReturnsNoContent(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouterWithVerifier(service, fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "owner-1",
		BusinessID: "business-1",
		Role:       business.UserRoleOwner,
	}})
	request := httptest.NewRequest(http.MethodPost, "/auth/business/users/user-2/password", bytes.NewReader([]byte(`{
		"password": "new-strong-password"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNoContent, response.Code, response.Body.String())
	}
	if !service.resetUserPasswordCalled {
		t.Fatal("expected reset password service to be called")
	}
	if service.resetUserPasswordCommand.Scope.BusinessID != "business-1" ||
		service.resetUserPasswordCommand.ActorRole != business.UserRoleOwner ||
		service.resetUserPasswordCommand.UserID != "user-2" ||
		service.resetUserPasswordCommand.NewPassword != "new-strong-password" {
		t.Fatalf("unexpected reset password command: %+v", service.resetUserPasswordCommand)
	}
}

func TestTransferBusinessOwnerReturnsAffectedUsers(t *testing.T) {
	t.Parallel()

	createdAt := time.Date(2026, 6, 16, 10, 0, 0, 0, time.UTC)
	service := &fakeAuthService{
		transferResult: ports.TransferBusinessOwnerResult{
			PreviousOwner: ports.BusinessUserRecord{
				UserID:      "owner-1",
				BusinessID:  "business-1",
				Email:       "owner@example.com",
				DisplayName: "Old Owner",
				Role:        business.UserRoleAdmin,
				IsActive:    true,
				CreatedAt:   createdAt,
				UpdatedAt:   createdAt,
			},
			NewOwner: ports.BusinessUserRecord{
				UserID:      "admin-1",
				BusinessID:  "business-1",
				Email:       "admin@example.com",
				DisplayName: "New Owner",
				Role:        business.UserRoleOwner,
				IsActive:    true,
				CreatedAt:   createdAt,
				UpdatedAt:   createdAt,
			},
		},
	}
	router := newTestRouterWithVerifier(service, fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "owner-1",
		BusinessID: "business-1",
		Role:       business.UserRoleOwner,
	}})
	request := httptest.NewRequest(http.MethodPost, "/auth/business/owner-transfer", bytes.NewReader([]byte(`{
		"new_owner_user_id": "admin-1",
		"confirmation": "TRANSFER OWNER"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, response.Code, response.Body.String())
	}
	if !service.transferOwnerCalled {
		t.Fatal("expected transfer owner service to be called")
	}
	if service.transferOwnerCommand.Scope.BusinessID != "business-1" ||
		service.transferOwnerCommand.ActorUserID != "owner-1" ||
		service.transferOwnerCommand.ActorRole != business.UserRoleOwner ||
		service.transferOwnerCommand.NewOwnerUserID != "admin-1" ||
		service.transferOwnerCommand.Confirmation != "TRANSFER OWNER" {
		t.Fatalf("unexpected transfer owner command: %+v", service.transferOwnerCommand)
	}

	var body transferBusinessOwnerResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.PreviousOwner.Role != "admin" || body.NewOwner.Role != "owner" {
		t.Fatalf("unexpected transfer response: %+v", body)
	}
}

func TestSubmitIdentityVerificationPassesPrincipalRole(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouterWithVerifier(service, fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "admin-1",
		BusinessID: "business-1",
		Role:       business.UserRoleAdmin,
	}})
	request := httptest.NewRequest(http.MethodPost, "/auth/business/identity-verification", bytes.NewReader([]byte(`{
		"card_number": "GHA-123456789-0",
		"id_photo_url": "https://cdn.example.com/card.jpg"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, response.Code, response.Body.String())
	}
	if !service.submitIdentityCalled {
		t.Fatal("expected submit identity service to be called")
	}
	if service.submitIdentityCommand.Scope.BusinessID != "business-1" ||
		service.submitIdentityCommand.ActorRole != business.UserRoleAdmin ||
		service.submitIdentityCommand.CardNumber != "GHA-123456789-0" ||
		service.submitIdentityCommand.IDPhotoURL != "https://cdn.example.com/card.jpg" {
		t.Fatalf("unexpected identity command: %+v", service.submitIdentityCommand)
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
	result                   authapp.AuthResult
	err                      error
	registerCalled           bool
	registerCommand          authapp.RegisterBusinessCommand
	loginCalled              bool
	loginCommand             authapp.LoginBusinessCommand
	refreshCalled            bool
	logoutCalled             bool
	users                    []ports.BusinessUserRecord
	businessUser             ports.BusinessUserRecord
	userErr                  error
	listUsersCalled          bool
	listUsersCommand         authapp.ListBusinessUsersCommand
	createUserCalled         bool
	createUserCommand        authapp.CreateBusinessUserCommand
	updateUserCalled         bool
	updateUserCommand        authapp.UpdateBusinessUserCommand
	resetUserPasswordCalled  bool
	resetUserPasswordCommand authapp.ResetBusinessUserPasswordCommand
	changeOwnPasswordCalled  bool
	changeOwnPasswordCommand authapp.ChangeOwnPasswordCommand
	transferOwnerCalled      bool
	transferOwnerCommand     authapp.TransferBusinessOwnerCommand
	transferResult           ports.TransferBusinessOwnerResult
	submitIdentityCalled     bool
	submitIdentityCommand    authapp.SubmitIdentityVerificationCommand
}

func (service *fakeAuthService) RegisterBusiness(_ context.Context, command authapp.RegisterBusinessCommand) (authapp.AuthResult, error) {
	service.registerCalled = true
	service.registerCommand = command
	if service.err != nil {
		return authapp.AuthResult{}, service.err
	}

	return service.result, nil
}

func (service *fakeAuthService) CheckHandleAvailability(_ context.Context, raw string) (authapp.HandleAvailability, error) {
	return authapp.HandleAvailability{Handle: raw, Available: true}, nil
}

func (service *fakeAuthService) ListPublicPlans(_ context.Context) ([]ports.PublicPlanRecord, error) {
	return nil, nil
}

func (service *fakeAuthService) InitializeSubscriptionAuthorization(_ context.Context, _ authapp.InitializeSubscriptionAuthorizationCommand) (authapp.SubscriptionAuthorizationLink, error) {
	return authapp.SubscriptionAuthorizationLink{}, nil
}

func (service *fakeAuthService) VerifySubscriptionAuthorization(_ context.Context, _ authapp.VerifySubscriptionAuthorizationCommand) (authapp.SubscriptionAuthorizationResult, error) {
	return authapp.SubscriptionAuthorizationResult{}, nil
}

func (service *fakeAuthService) SubmitIdentityVerification(_ context.Context, command authapp.SubmitIdentityVerificationCommand) error {
	service.submitIdentityCalled = true
	service.submitIdentityCommand = command
	return nil
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

func (service *fakeAuthService) ListBusinessUsers(_ context.Context, command authapp.ListBusinessUsersCommand) ([]ports.BusinessUserRecord, error) {
	service.listUsersCalled = true
	service.listUsersCommand = command
	if service.userErr != nil {
		return nil, service.userErr
	}
	return service.users, nil
}

func (service *fakeAuthService) CreateBusinessUser(_ context.Context, command authapp.CreateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	service.createUserCalled = true
	service.createUserCommand = command
	if service.userErr != nil {
		return ports.BusinessUserRecord{}, service.userErr
	}
	return service.businessUser, nil
}

func (service *fakeAuthService) UpdateBusinessUser(_ context.Context, command authapp.UpdateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	service.updateUserCalled = true
	service.updateUserCommand = command
	if service.userErr != nil {
		return ports.BusinessUserRecord{}, service.userErr
	}
	return service.businessUser, nil
}

func (service *fakeAuthService) ResetBusinessUserPassword(_ context.Context, command authapp.ResetBusinessUserPasswordCommand) error {
	service.resetUserPasswordCalled = true
	service.resetUserPasswordCommand = command
	return service.userErr
}

func (service *fakeAuthService) ChangeOwnPassword(_ context.Context, command authapp.ChangeOwnPasswordCommand) error {
	service.changeOwnPasswordCalled = true
	service.changeOwnPasswordCommand = command
	return service.userErr
}

func (service *fakeAuthService) RequestPasswordReset(_ context.Context, _ string) error {
	return service.err
}

func (service *fakeAuthService) ConfirmPasswordReset(_ context.Context, _ string, _ string, _ string) error {
	return service.err
}

func (service *fakeAuthService) TransferBusinessOwner(_ context.Context, command authapp.TransferBusinessOwnerCommand) (ports.TransferBusinessOwnerResult, error) {
	service.transferOwnerCalled = true
	service.transferOwnerCommand = command
	if service.userErr != nil {
		return ports.TransferBusinessOwnerResult{}, service.userErr
	}
	return service.transferResult, nil
}

func (service *fakeAuthService) GetMFAStatus(_ context.Context, _ common.TenantScope, _ common.ID) (authapp.MFAStatus, error) {
	return authapp.MFAStatus{}, nil
}

func (service *fakeAuthService) StartMFAEnrollment(_ context.Context, _ common.TenantScope, _ common.ID) (authapp.MFAEnrollmentSetup, error) {
	return authapp.MFAEnrollmentSetup{}, nil
}

func (service *fakeAuthService) ActivateMFA(_ context.Context, _ common.TenantScope, _ common.ID, _ string) ([]string, error) {
	return nil, nil
}

func (service *fakeAuthService) DisableMFA(_ context.Context, _ common.TenantScope, _ common.ID, _ string) error {
	return nil
}

func (service *fakeAuthService) VerifyMFALogin(_ context.Context, _ authapp.VerifyMFALoginCommand) (authapp.AuthResult, error) {
	return authapp.AuthResult{}, nil
}
