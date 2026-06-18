package paymentshttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
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
	request := httptest.NewRequest(http.MethodPost, "/payments/checkout", bytes.NewReader([]byte(`{"purpose":"standard_full","amount_minor":20000,"customer_email":"b@x.com"}`)))
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
	request := httptest.NewRequest(http.MethodPost, "/payments/checkout", bytes.NewReader([]byte(`{"purpose":"standard_full","amount_minor":20000,"method":"momo","customer_email":"b@x.com"}`)))
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

func TestLogTakingMapsForbidden(t *testing.T) {
	t.Parallel()

	service := &fakeService{takingErr: authdomain.ErrForbidden}
	verifier := fakeVerifier{principal: ports.VerifiedAccessToken{Subject: "staff-1", BusinessID: "business-1", Role: business.UserRoleStaff}}
	router := newRouter(service, verifier)
	request := httptest.NewRequest(http.MethodPost, "/money/takings", bytes.NewReader([]byte(`{"amount_minor":5000,"method":"cash","what_for":"cash sale"}`)))
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
	handleErr     error
	handleCalled  bool
	verifyCommand paymentsapp.VerifyBusinessCommand
	charge        paymentsapp.ChargeResult
	chargeCommand paymentsapp.InitiateChargeCommand
	takingCommand paymentsapp.LogManualTakingCommand
	takingErr     error
}

func (s *fakeService) VerifyBusiness(_ context.Context, command paymentsapp.VerifyBusinessCommand) error {
	s.verifyCommand = command
	return nil
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

func (s *fakeService) LogManualTaking(_ context.Context, command paymentsapp.LogManualTakingCommand) (common.ID, error) {
	s.takingCommand = command
	if s.takingErr != nil {
		return "", s.takingErr
	}
	return "taking-1", nil
}

func (s *fakeService) ListManualTakings(_ context.Context, _ common.TenantScope) ([]ports.ManualTakingRecord, error) {
	return nil, nil
}

func (s *fakeService) MoneySummary(_ context.Context, _ common.TenantScope) (ports.MoneySummary, error) {
	return ports.MoneySummary{}, nil
}
