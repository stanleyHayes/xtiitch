package authhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// fakeAuthService methods for the §8 verify-only and §9 self-service profile
// endpoints (kept here so handler_test.go stays inside the size budget).

func (service *fakeAuthService) VerifyRegistrationOTP(_ context.Context, phone string, code string) error {
	service.verifyRegOTPCalled = true
	service.verifyRegOTPPhone = phone
	service.verifyRegOTPCode = code
	return service.profileErr
}

func (service *fakeAuthService) RequestProfilePhoneOTP(_ context.Context, phone string) error {
	service.requestPhoneOTPCalled = true
	service.requestPhoneOTPPhone = phone
	return service.profileErr
}

func (service *fakeAuthService) GetOwnProfile(
	_ context.Context,
	_ common.TenantScope,
	userID common.ID) (ports.BusinessUserProfileRecord,
	error,
) {
	service.profileUserID = userID
	if service.profileErr != nil {
		return ports.BusinessUserProfileRecord{}, service.profileErr
	}
	return service.profile, nil
}

func (service *fakeAuthService) UpdateOwnProfile(
	_ context.Context,
	command authapp.UpdateOwnProfileCommand) (ports.BusinessUserProfileRecord,
	error,
) {
	service.updateProfileCalled = true
	service.updateProfileCommand = command
	if service.profileErr != nil {
		return ports.BusinessUserProfileRecord{}, service.profileErr
	}
	return service.profile, nil
}

func ownerVerifier() fakeTokenVerifier {
	return fakeTokenVerifier{verified: ports.VerifiedAccessToken{
		Subject:    common.ID("user-1"),
		BusinessID: common.ID("business-1"),
		Role:       business.UserRoleOwner,
	}}
}

// §8: the verify-only endpoint proves the code without registering anything.
func TestVerifyRegistrationOTPReturnsNoContent(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/register/otp/verify", bytes.NewReader([]byte(`{
		"phone": "0244000111",
		"code": "123456"
	}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNoContent, response.Code, response.Body.String())
	}
	if !service.verifyRegOTPCalled || service.verifyRegOTPPhone != "0244000111" || service.verifyRegOTPCode != "123456" {
		t.Fatalf("unexpected verify command: called=%v phone=%q", service.verifyRegOTPCalled, service.verifyRegOTPPhone)
	}
}

// Wrong codes surface as the same 401 invalid_code the other OTP endpoints
// return, so the frontend maps every OTP error 1:1.
func TestVerifyRegistrationOTPMapsInvalidCode(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{profileErr: authapp.ErrInvalidCode}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/auth/business/register/otp/verify", bytes.NewReader([]byte(`{
		"phone": "0244000111",
		"code": "000000"
	}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
	var body errorResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error != "invalid_code" {
		t.Fatalf("expected invalid_code, got %q", body.Error)
	}
}

// §9: a phone change without an SMS proof answers a stable, mappable
// 400 phone_verification_required.
func TestUpdateOwnProfileMapsPhoneVerificationRequired(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{profileErr: authapp.ErrPhoneVerificationRequired}
	router := newTestRouterWithVerifier(service, ownerVerifier())
	request := httptest.NewRequest(http.MethodPatch, "/auth/business/me", bytes.NewReader([]byte(`{
		"phone": "0209999888"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	var body errorResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error != "phone_verification_required" {
		t.Fatalf("expected phone_verification_required, got %q", body.Error)
	}
}

// The command is scoped by the token's user id — the caller's OWN row — never
// by anything in the request body.
func TestUpdateOwnProfilePassesCallerIdentityAndFields(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{profile: ports.BusinessUserProfileRecord{
		UserID:      "user-1",
		BusinessID:  "business-1",
		Email:       "ama@example.com",
		DisplayName: "Ama Serwaa",
		Role:        business.UserRoleOwner,
		IsActive:    true,
	}}
	router := newTestRouterWithVerifier(service, ownerVerifier())
	request := httptest.NewRequest(http.MethodPatch, "/auth/business/me", bytes.NewReader([]byte(`{
		"display_name": "Ama Serwaa",
		"phone": "0209999888",
		"otp_code": "123456"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, response.Code, response.Body.String())
	}
	if !service.updateProfileCalled {
		t.Fatal("expected the profile service to be called")
	}
	command := service.updateProfileCommand
	if command.UserID != "user-1" || command.Scope.BusinessID != "business-1" {
		t.Fatalf("expected the caller's own id/tenant, got %+v", command)
	}
	if command.DisplayName == nil || *command.DisplayName != "Ama Serwaa" {
		t.Fatalf("expected display name passed through, got %+v", command.DisplayName)
	}
	if command.Phone == nil || *command.Phone != "0209999888" || command.OTPCode != "123456" {
		t.Fatalf("expected phone + otp code passed through, got %+v", command)
	}
	if command.Email != nil || command.WhatsAppNumber != nil {
		t.Fatal("omitted fields must stay nil so the service keeps the stored values")
	}
}

func TestUpdateOwnProfileRejectsUnknownFields(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouterWithVerifier(service, ownerVerifier())
	request := httptest.NewRequest(http.MethodPatch, "/auth/business/me", bytes.NewReader([]byte(`{
		"display_name": "Ama",
		"role": "owner"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	if service.updateProfileCalled {
		t.Fatal("a request smuggling a role must stop before the service call")
	}
}

func TestRequestProfilePhoneOTPRequiresAuth(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouterWithVerifier(service, ownerVerifier())
	request := httptest.NewRequest(http.MethodPost, "/auth/business/me/phone-otp", bytes.NewReader([]byte(`{
		"phone": "0209999888"
	}`)))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
	if service.requestPhoneOTPCalled {
		t.Fatal("the phone-otp route must never run unauthenticated")
	}
}

func TestRequestProfilePhoneOTPReturnsAccepted(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{}
	router := newTestRouterWithVerifier(service, ownerVerifier())
	request := httptest.NewRequest(http.MethodPost, "/auth/business/me/phone-otp", bytes.NewReader([]byte(`{
		"phone": "0209999888"
	}`)))
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("expected status %d, got %d", http.StatusAccepted, response.Code)
	}
	if !service.requestPhoneOTPCalled || service.requestPhoneOTPPhone != "0209999888" {
		t.Fatalf("unexpected phone-otp command: called=%v phone=%q", service.requestPhoneOTPCalled, service.requestPhoneOTPPhone)
	}
}

// §9: GET /me returns the live profile row, so a profile edit shows up
// everywhere the dashboard reads /me.
func TestMeReturnsLiveProfileFields(t *testing.T) {
	t.Parallel()

	service := &fakeAuthService{profile: ports.BusinessUserProfileRecord{
		UserID:         "user-1",
		BusinessID:     "business-1",
		Email:          "ama@example.com",
		DisplayName:    "Ama Serwaa",
		Phone:          "233244000111",
		WhatsAppNumber: "233209999888",
		Role:           business.UserRoleOwner,
		IsActive:       true,
	}}
	router := newTestRouterWithVerifier(service, ownerVerifier())
	request := httptest.NewRequest(http.MethodGet, "/auth/business/me", nil)
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, response.Code, response.Body.String())
	}
	if service.profileUserID != "user-1" {
		t.Fatalf("expected the profile read keyed on the caller, got %q", service.profileUserID)
	}
	var body meResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Email != "ama@example.com" || body.DisplayName != "Ama Serwaa" ||
		body.Phone != "233244000111" || body.WhatsAppNumber != "233209999888" || body.PhoneVerified {
		t.Fatalf("unexpected /me profile payload: %+v", body)
	}
}
