package paymentshttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestWebhookRejectsBadSignature(t *testing.T) {
	t.Parallel()

	router := newRouter(&fakeService{handleErr: paymentsapp.ErrInvalidSignature}, fakeVerifier{})
	request := httptest.NewRequest(http.MethodPost, "/webhooks/paystack", bytes.NewReader([]byte(`{"event":"charge.success"}`)))
	request.Header.Set("x-paystack-signature", "wrong")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for bad signature, got %d", response.Code)
	}
}

func TestWebhookAcknowledgesValidEvent(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	router := newRouter(service, fakeVerifier{})
	request := httptest.NewRequest(http.MethodPost, "/webhooks/paystack", bytes.NewReader([]byte(`{"event":"charge.success"}`)))
	request.Header.Set("x-paystack-signature", "ok")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 ack, got %d", response.Code)
	}
	if !service.handleCalled {
		t.Fatal("expected webhook to invoke the service")
	}
}

func TestCheckoutRequiresAuthentication(t *testing.T) {
	t.Parallel()

	router := newRouter(&fakeService{}, fakeVerifier{err: errTest})
	body := []byte(`{"purpose":"standard_full","amount_minor":20000,"customer_email":"b@x.com"}`)
	request := httptest.NewRequest(http.MethodPost, "/payments/checkout", bytes.NewReader(body))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", response.Code)
	}
}

func TestCheckoutReturnsAuthorization(t *testing.T) {
	t.Parallel()

	service := &fakeService{charge: paymentsapp.ChargeResult{Reference: "xt_1", AuthorizationURL: "https://pay/x", CommissionMinor: 600}}
	verifier := fakeVerifier{principal: ports.VerifiedAccessToken{Subject: "user-1", BusinessID: "business-1", Role: business.UserRoleOwner}}
	router := newRouter(service, verifier)
	body := []byte(`{"purpose":"standard_full","amount_minor":20000,"method":"momo","customer_email":"b@x.com"}`)
	request := httptest.NewRequest(http.MethodPost, "/payments/checkout", bytes.NewReader(body))
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (%s)", response.Code, response.Body.String())
	}
	if service.chargeCommand.Scope.BusinessID != common.ID("business-1") {
		t.Fatalf("expected tenant scope from token, got %q", service.chargeCommand.Scope.BusinessID)
	}
	if service.chargeCommand.ActorRole != business.UserRoleOwner || !service.chargeCommand.RequireMoneyManagementRole {
		t.Fatalf("expected protected checkout to require owner/admin role, got %+v", service.chargeCommand)
	}
}

func TestVerifyBusinessPassesPrincipalRole(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	verifier := fakeVerifier{principal: ports.VerifiedAccessToken{Subject: "owner-1", BusinessID: "business-1", Role: business.UserRoleOwner}}
	router := newRouter(service, verifier)
	request := httptest.NewRequest(http.MethodPost, "/businesses/me/verify", bytes.NewReader([]byte(`{"settlement_account":"0240000000"}`)))
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", response.Code, response.Body.String())
	}
	if service.verifyCommand.BusinessID != "business-1" || service.verifyCommand.ActorRole != business.UserRoleOwner {
		t.Fatalf("unexpected verify command: %+v", service.verifyCommand)
	}
}

func TestVerifyBusinessPassesOTPCode(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	verifier := fakeVerifier{principal: ports.VerifiedAccessToken{Subject: "owner-1", BusinessID: "business-1", Role: business.UserRoleOwner}}
	router := newRouter(service, verifier)
	body := `{"settlement_account":"0240000000","settlement_bank":"MTN","settlement_account_name":"Ama Serwaa Mensah","otp_code":"123456"}`
	request := httptest.NewRequest(http.MethodPost, "/businesses/me/verify", bytes.NewReader([]byte(body)))
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	// decodeJSON rejects unknown fields, so an unwired otp_code or
	// settlement_account_name would 400 here rather than being quietly ignored.
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", response.Code, response.Body.String())
	}
	if service.verifyCommand.OTPCode != "123456" {
		t.Fatalf("expected the OTP code to reach the service, got %q", service.verifyCommand.OTPCode)
	}
	if service.verifyCommand.SettlementAccountName != "Ama Serwaa Mensah" {
		t.Fatalf("expected the MoMo account name to reach the service, got %q", service.verifyCommand.SettlementAccountName)
	}
}

func TestRequestPayoutOTPRequiresAuthentication(t *testing.T) {
	t.Parallel()

	router := newRouter(&fakeService{}, fakeVerifier{err: errTest})
	request := httptest.NewRequest(
		http.MethodPost, "/businesses/me/payout-otp",
		bytes.NewReader([]byte(`{"settlement_account":"0240000000"}`)),
	)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for an unauthenticated payout OTP, got %d", response.Code)
	}
}

// Each OTP failure must reach the dashboard as its own code. Collapsed to a 500,
// a wrong or expired code looks like a server fault and the owner cannot tell
// what to fix.
func TestVerifyBusinessMapsOTPErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   string
	}{
		{"invalid code", authapp.ErrInvalidCode, http.StatusUnauthorized, "invalid_code"},
		{"expired code", authapp.ErrCodeExpired, http.StatusUnauthorized, "code_expired"},
		{"too many attempts", authapp.ErrTooManyAttempts, http.StatusTooManyRequests, "too_many_attempts"},
		{"invalid phone", authapp.ErrInvalidPhone, http.StatusBadRequest, "invalid_phone"},
		{"delivery failed", authapp.ErrOTPDeliveryFailed, http.StatusBadGateway, "delivery_failed"},
		{"verifier unwired", paymentsapp.ErrOTPUnavailable, http.StatusServiceUnavailable, "whatsapp_unavailable"},
		// §2.1 / §2.2: the new payout gates must also reach the dashboard as
		// their own stable codes, not a generic 500.
		{"identity not verified", paymentsapp.ErrIdentityVerificationRequired, http.StatusConflict, "identity_verification_required"},
		{"bad payout number", paymentsapp.ErrInvalidPayoutNumber, http.StatusBadRequest, "invalid_payout_number"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			service := &fakeService{verifyErr: testCase.err}
			verifier := fakeVerifier{principal: ports.VerifiedAccessToken{BusinessID: "business-1", Role: business.UserRoleOwner}}
			router := newRouter(service, verifier)
			body := `{"settlement_account":"0240000000","settlement_bank":"MTN","otp_code":"000000"}`
			request := httptest.NewRequest(http.MethodPost, "/businesses/me/verify", bytes.NewReader([]byte(body)))
			request.Header.Set("Authorization", "Bearer token")
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != testCase.wantStatus {
				t.Fatalf("expected %d, got %d (%s)", testCase.wantStatus, response.Code, response.Body.String())
			}
			if !bytes.Contains(response.Body.Bytes(), []byte(testCase.wantCode)) {
				t.Fatalf("expected error code %q, got %s", testCase.wantCode, response.Body.String())
			}
		})
	}
}

func TestLogTakingMapsForbidden(t *testing.T) {
	t.Parallel()

	service := &fakeService{takingErr: authdomain.ErrForbidden}
	verifier := fakeVerifier{principal: ports.VerifiedAccessToken{Subject: "staff-1", BusinessID: "business-1", Role: business.UserRoleStaff}}
	router := newRouter(service, verifier)
	body := []byte(`{"amount_minor":5000,"method":"cash","what_for":"cash sale"}`)
	request := httptest.NewRequest(http.MethodPost, "/money/takings", bytes.NewReader(body))
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d (%s)", response.Code, response.Body.String())
	}
	if service.takingCommand.ActorRole != business.UserRoleStaff {
		t.Fatalf("expected staff role in taking command, got %+v", service.takingCommand)
	}
}

// §3.3: the payout history endpoint serves the store's mirrored settlement
// rows, paged, to an authenticated member of the business.
func TestListPayoutsReturnsMirroredRows(t *testing.T) {
	t.Parallel()

	settledAt := time.Date(2026, 7, 18, 9, 30, 0, 0, time.UTC)
	service := &fakeService{
		payouts: []ports.ProviderSettlementRecord{
			{SettlementID: "s-1", ProviderReference: "paystack_settlement:11", AmountMinor: 9700, Status: "success", SettledAt: &settledAt},
			{SettlementID: "s-2", ProviderReference: "paystack_settlement:12", AmountMinor: 4850, Status: "pending"},
		},
	}
	verifier := fakeVerifier{principal: ports.VerifiedAccessToken{Subject: "owner-1", BusinessID: "business-1", Role: business.UserRoleOwner}}
	router := newRouter(service, verifier)
	request := httptest.NewRequest(http.MethodGet, "/money/payouts?limit=10&offset=20", nil)
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", response.Code, response.Body.String())
	}
	if service.payoutsLimit != 10 || service.payoutsOffset != 20 {
		t.Fatalf("expected limit/offset passthrough, got %d/%d", service.payoutsLimit, service.payoutsOffset)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"paystack_settlement:11"`)) ||
		!bytes.Contains(response.Body.Bytes(), []byte(`"amount_minor":9700`)) ||
		!bytes.Contains(response.Body.Bytes(), []byte(`"status":"pending"`)) {
		t.Fatalf("unexpected payouts payload: %s", response.Body.String())
	}
	// A nil settled_at renders as an empty string rather than a zero time.
	if !bytes.Contains(response.Body.Bytes(), []byte(`"settled_at":""`)) {
		t.Fatalf("expected an empty settled_at on the pending row: %s", response.Body.String())
	}
}

func TestListPayoutsRequiresAuthentication(t *testing.T) {
	t.Parallel()

	router := newRouter(&fakeService{}, fakeVerifier{err: errTest})
	request := httptest.NewRequest(http.MethodGet, "/money/payouts", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", response.Code)
	}
}

func newRouter(service Service, verifier ports.TokenVerifier) http.Handler {
	router := chi.NewRouter()
	NewHandler(service, authhttp.NewAuthenticator(verifier)).Register(router)
	return router
}

var errTest = &staticError{"no token"}

type staticError struct{ msg string }

func (e *staticError) Error() string { return e.msg }

type fakeVerifier struct {
	principal ports.VerifiedAccessToken
	err       error
}

func (v fakeVerifier) VerifyAccessToken(_ context.Context, _ string) (ports.VerifiedAccessToken, error) {
	return v.principal, v.err
}

type fakeService struct {
	handleErr        error
	handleCalled     bool
	verifyCommand    paymentsapp.VerifyBusinessCommand
	verifyErr        error
	payoutOTPCommand paymentsapp.RequestPayoutOTPCommand
	payoutOTPErr     error
	charge           paymentsapp.ChargeResult
	chargeCommand    paymentsapp.InitiateChargeCommand
	takingCommand    paymentsapp.LogManualTakingCommand
	takingErr        error
	payouts          []ports.ProviderSettlementRecord
	payoutsLimit     int
	payoutsOffset    int
}

func (s *fakeService) VerifyBusiness(_ context.Context, command paymentsapp.VerifyBusinessCommand) error {
	s.verifyCommand = command
	return s.verifyErr
}

func (s *fakeService) RequestPayoutOTP(_ context.Context, command paymentsapp.RequestPayoutOTPCommand) error {
	s.payoutOTPCommand = command
	return s.payoutOTPErr
}

func (s *fakeService) InitiateCharge(_ context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error) {
	s.chargeCommand = command
	return s.charge, nil
}

func (s *fakeService) HandleProviderEvent(_ context.Context, _ []byte, _ string) error {
	s.handleCalled = true
	return s.handleErr
}

func (s *fakeService) ListPayments(_ context.Context, _ common.TenantScope) ([]ports.PaymentRecord, error) {
	return nil, nil
}

func (s *fakeService) LogManualTaking(
	_ context.Context,
	command paymentsapp.LogManualTakingCommand) (paymentsapp.LogManualTakingResult,
	error,
) {
	s.takingCommand = command
	if s.takingErr != nil {
		return paymentsapp.LogManualTakingResult{}, s.takingErr
	}
	return paymentsapp.LogManualTakingResult{TakingID: "taking-1", CommissionStatus: "due"}, nil
}

func (s *fakeService) ListManualTakings(_ context.Context, _ common.TenantScope) ([]ports.ManualTakingRecord, error) {
	return nil, nil
}

func (s *fakeService) MoneySummary(_ context.Context, _ common.TenantScope) (ports.MoneySummary, error) {
	return ports.MoneySummary{}, nil
}

func (s *fakeService) ListPayouts(_ context.Context, _ common.TenantScope, limit int, offset int) ([]ports.ProviderSettlementRecord, error) {
	s.payoutsLimit = limit
	s.payoutsOffset = offset
	return s.payouts, nil
}
