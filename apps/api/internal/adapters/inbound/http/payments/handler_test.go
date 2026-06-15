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
	charge        paymentsapp.ChargeResult
	chargeCommand paymentsapp.InitiateChargeCommand
}

func (s *fakeService) VerifyBusiness(_ context.Context, _ paymentsapp.VerifyBusinessCommand) error {
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
