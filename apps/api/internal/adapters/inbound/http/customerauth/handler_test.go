package customerauthhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	customerauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/customerauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func newTestRouter(service *fakeService) chi.Router {
	router := chi.NewRouter()
	NewHandler(service, fakeVerifier{}).Register(router)
	return router
}

func TestRequestOTPDefaultsToPhoneChannel(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/auth/request-otp", bytes.NewReader([]byte(`{"phone":"0240000000"}`)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d body=%s", response.Code, response.Body.String())
	}
	if service.requestedPhone != "0240000000" {
		t.Fatalf("expected phone request, got %q", service.requestedPhone)
	}
	if service.requestedEmail != "" {
		t.Fatal("phone-channel request must not hit the email path")
	}
}

func TestRequestOTPRoutesEmailChannel(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	router := newTestRouter(service)
	payload := []byte(`{"channel":"email","email":"ama@example.com"}`)
	request := httptest.NewRequest(http.MethodPost, "/customer/auth/request-otp", bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d body=%s", response.Code, response.Body.String())
	}
	if service.requestedEmail != "ama@example.com" {
		t.Fatalf("expected email request, got %q", service.requestedEmail)
	}
	if service.requestedPhone != "" {
		t.Fatal("email-channel request must not hit the phone path")
	}
}

func TestVerifyOTPRoutesEmailChannelAndReturnsToken(t *testing.T) {
	t.Parallel()

	service := &fakeService{
		emailResult: customerauthapp.CustomerAuthResult{
			CustomerID:  common.ID("customer-1"),
			Email:       "ama@example.com",
			AccessToken: "token-abc",
			ExpiresAt:   time.Date(2026, 6, 20, 20, 5, 0, 0, time.UTC),
		},
	}
	router := newTestRouter(service)
	payload := []byte(`{"channel":"email","email":"ama@example.com","code":"123456"}`)
	request := httptest.NewRequest(http.MethodPost, "/customer/auth/verify-otp", bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.verifiedEmail != "ama@example.com" || service.verifiedEmailCode != "123456" {
		t.Fatalf("expected email verify, got email=%q code=%q", service.verifiedEmail, service.verifiedEmailCode)
	}
	var body customerAuthResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.AccessToken != "token-abc" || body.Email != "ama@example.com" || body.Phone != "" {
		t.Fatalf("unexpected response body: %+v", body)
	}
}

func TestVerifyOTPDefaultsToPhoneChannel(t *testing.T) {
	t.Parallel()

	service := &fakeService{
		phoneResult: customerauthapp.CustomerAuthResult{
			CustomerID:  common.ID("customer-1"),
			Phone:       "233240000000",
			AccessToken: "token-phone",
			ExpiresAt:   time.Date(2026, 6, 20, 20, 5, 0, 0, time.UTC),
		},
	}
	router := newTestRouter(service)
	payload := []byte(`{"phone":"0240000000","code":"123456"}`)
	request := httptest.NewRequest(http.MethodPost, "/customer/auth/verify-otp", bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.verifiedPhone != "0240000000" {
		t.Fatalf("expected phone verify, got %q", service.verifiedPhone)
	}
	if service.verifiedEmail != "" {
		t.Fatal("phone-channel verify must not hit the email path")
	}
}

// The payment-link route re-initiates a checkout for a draft order and
// returns the fresh authorization URL + reference; a non-payable order is a
// 409 the UI keys its message off.
func TestPaymentLinkReturnsFreshCheckout(t *testing.T) {
	t.Parallel()

	service := &fakeService{paymentLinkResult: customerauthapp.OrderPaymentLinkResult{
		AuthorizationURL: "https://pay/x",
		Reference:        "xt_ref-2",
	}}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/order-1/payment-link",
		bytes.NewReader([]byte(`{"callback_url":"https://store.xtiitch.com/orders"}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.paymentLinkOrderID != "order-1" || service.paymentLinkCallback != "https://store.xtiitch.com/orders" {
		t.Fatalf("unexpected command: order=%q callback=%q", service.paymentLinkOrderID, service.paymentLinkCallback)
	}
	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["authorization_url"] != "https://pay/x" || body["reference"] != "xt_ref-2" {
		t.Fatalf("unexpected response body: %+v", body)
	}
}

func TestPaymentLinkConflictWhenNotPayable(t *testing.T) {
	t.Parallel()

	service := &fakeService{paymentLinkErr: customerauthapp.ErrOrderNotPayable}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/order-1/payment-link",
		bytes.NewReader([]byte(`{"callback_url":"https://store.xtiitch.com/orders"}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestPaymentLinkConflictWhileProviderStillPending(t *testing.T) {
	t.Parallel()

	service := &fakeService{paymentLinkErr: customerauthapp.ErrOrderPaymentPending}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/order-1/payment-link",
		bytes.NewReader([]byte(`{"callback_url":"https://store.xtiitch.com/orders"}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", response.Code, response.Body.String())
	}
	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"] != "payment_pending" {
		t.Fatalf("expected payment_pending, got %+v", body)
	}
}

// ── fakes ──────────────────────────────────────────────────────────────────

type fakeService struct {
	requestedPhone    string
	requestedEmail    string
	verifiedPhone     string
	verifiedEmail     string
	verifiedEmailCode string
	phoneResult       customerauthapp.CustomerAuthResult
	emailResult       customerauthapp.CustomerAuthResult
	ordersResult      []ports.CustomerOrderSummary
	markedOrderID     common.ID
	markedGroupID     common.ID
	markedCount       int
	markErr           error

	paymentLinkResult   customerauthapp.OrderPaymentLinkResult
	paymentLinkErr      error
	paymentLinkOrderID  common.ID
	paymentLinkCallback string
}

func (s *fakeService) RequestOTP(_ context.Context, phone string) error {
	s.requestedPhone = phone
	return nil
}

func (s *fakeService) RequestEmailOTP(_ context.Context, email string) error {
	s.requestedEmail = email
	return nil
}

func (s *fakeService) VerifyOTP(_ context.Context, phone string, _ string) (customerauthapp.CustomerAuthResult, error) {
	s.verifiedPhone = phone
	return s.phoneResult, nil
}

func (s *fakeService) VerifyEmailOTP(_ context.Context, email string, code string) (customerauthapp.CustomerAuthResult, error) {
	s.verifiedEmail = email
	s.verifiedEmailCode = code
	return s.emailResult, nil
}

func (s *fakeService) ListOrders(_ context.Context, _ common.ID) ([]ports.CustomerOrderSummary, error) {
	return s.ordersResult, nil
}

func (s *fakeService) MarkOrderReceived(_ context.Context, _ common.ID, orderID common.ID) error {
	s.markedOrderID = orderID
	return s.markErr
}

func (s *fakeService) MarkBasketReceived(_ context.Context, _ common.ID, checkoutGroupID common.ID) (int, error) {
	s.markedGroupID = checkoutGroupID
	return s.markedCount, s.markErr
}

func (s *fakeService) GetProfile(_ context.Context, _ common.ID) (ports.CustomerProfile, error) {
	return ports.CustomerProfile{}, nil
}

func (s *fakeService) UpdateProfile(_ context.Context, _ common.ID, _, _, _ string) (ports.CustomerProfile, error) {
	return ports.CustomerProfile{}, nil
}

func (s *fakeService) CreateOrderPaymentLink(_ context.Context, _ common.ID, orderID common.ID, callbackURL string) (customerauthapp.OrderPaymentLinkResult, error) {
	s.paymentLinkOrderID = orderID
	s.paymentLinkCallback = callbackURL
	return s.paymentLinkResult, s.paymentLinkErr
}

type fakeVerifier struct{}

func (fakeVerifier) VerifyCustomerAccessToken(_ context.Context, _ string) (ports.VerifiedCustomerToken, error) {
	return ports.VerifiedCustomerToken{}, nil
}
