package checkouthttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	checkoutapp "github.com/xcreativs/xtiitch/apps/api/internal/application/checkout"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// §5.2: the settle-all route is gone for good — payment happens store-basket
// by store-basket, never one charge across stores.
func TestMarketplaceSettleAllRouteIsGone(t *testing.T) {
	t.Parallel()

	router := newTestRouter(&fakeService{})
	request := httptest.NewRequest(http.MethodPost, "/public/marketplace/orders",
		bytes.NewReader([]byte(`{"stores":[],"customer_name":"Ama","customer_email":"ama@example.com"}`)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("the settle-all route must not exist (§5.2), got %d", response.Code)
	}
}

// The checkout-quote read works over POST too: a browser fetch cannot send a
// body with GET, so the storefront quotes baskets with POST.
func TestCheckoutQuoteAcceptsPOST(t *testing.T) {
	t.Parallel()

	service := &fakeService{quoteResult: checkoutapp.CheckoutQuoteResult{
		Lines: []checkoutapp.CheckoutQuoteLine{{DesignHandle: "smock", Kind: checkoutapp.CartLineMadeToWear, AmountMinor: 25000}},
		Quote: money.StoreSaleQuote{ItemsTotalMinor: 25000, VATRateBps: 2000, TaxPassedDown: true, TotalChargeMinor: 25000},
	}}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/public/stores/tdh/checkout-quote",
		bytes.NewReader([]byte(`{"items":[{"design_handle":"smock","size_band_id":"band-1"}]}`)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.quoteCommand.StoreHandle != "tdh" || len(service.quoteCommand.Lines) != 1 {
		t.Fatalf("expected the basket quoted for tdh, got %+v", service.quoteCommand)
	}
	var body checkoutQuoteResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.ItemsTotalMinor != 25000 || body.VATRateBps != 2000 || !body.TaxPassedDown || body.TotalMinor != 25000 || len(body.Lines) != 1 {
		t.Fatalf("unexpected quote body: %+v", body)
	}
}

// The GET variant stays live for existing callers.
func TestCheckoutQuoteStillAcceptsGET(t *testing.T) {
	t.Parallel()

	service := &fakeService{quoteResult: checkoutapp.CheckoutQuoteResult{
		Quote: money.StoreSaleQuote{ItemsTotalMinor: 1000, TotalChargeMinor: 1000},
	}}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodGet, "/public/stores/tdh/checkout-quote",
		bytes.NewReader([]byte(`{"items":[{"design_handle":"smock","size_band_id":"band-1"}]}`)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.quoteCommand.StoreHandle != "tdh" {
		t.Fatalf("expected the GET variant routed to the same handler, got %+v", service.quoteCommand)
	}
}

// §5.2: each checkout path accepts an optional callback_url and threads it to
// the application command unchanged (validation lives in the app layer).
func TestPlaceEndpointsThreadCallbackURL(t *testing.T) {
	t.Parallel()

	service := &fakeService{
		standardResult: checkoutapp.PlaceStandardOrderResult{OrderID: "order-1"},
		cartResult:     checkoutapp.PlaceCartOrderResult{OrderID: "order-1"},
		customResult:   checkoutapp.PlaceCustomOrderResult{OrderID: "order-1"},
		bookingResult:  checkoutapp.PlaceHomeVisitBookingResult{OrderID: "order-1"},
	}
	router := newTestRouter(service)
	callback := "https://store.xtiitch.com/cart"

	post := func(path string, payload string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader([]byte(payload)))
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	if resp := post("/public/stores/tdh/orders", `{"callback_url":"`+callback+`"}`); resp.Code != http.StatusCreated {
		t.Fatalf("orders: expected 201, got %d body=%s", resp.Code, resp.Body.String())
	}
	if service.standardCommand.CallbackURL != callback {
		t.Fatalf("orders: expected the callback threaded, got %+v", service.standardCommand)
	}

	if resp := post("/public/stores/tdh/cart-orders", `{"callback_url":"`+callback+`"}`); resp.Code != http.StatusCreated {
		t.Fatalf("cart-orders: expected 201, got %d body=%s", resp.Code, resp.Body.String())
	}
	if service.cartCommand.CallbackURL != callback {
		t.Fatalf("cart-orders: expected the callback threaded, got %+v", service.cartCommand)
	}

	if resp := post("/public/stores/tdh/custom-orders", `{"callback_url":"`+callback+`"}`); resp.Code != http.StatusCreated {
		t.Fatalf("custom-orders: expected 201, got %d body=%s", resp.Code, resp.Body.String())
	}
	if service.customCommand.CallbackURL != callback {
		t.Fatalf("custom-orders: expected the callback threaded, got %+v", service.customCommand)
	}

	if resp := post("/public/stores/tdh/bookings",
		`{"callback_url":"`+callback+`","slot_start":"2026-07-20T10:00:00Z"}`); resp.Code != http.StatusCreated {
		t.Fatalf("bookings: expected 201, got %d body=%s", resp.Code, resp.Body.String())
	}
	if service.bookingCommand.CallbackURL != callback {
		t.Fatalf("bookings: expected the callback threaded, got %+v", service.bookingCommand)
	}
}

func TestPlaceEndpointsBindVerifiedCustomer(t *testing.T) {
	t.Parallel()

	service := &fakeService{
		standardResult: checkoutapp.PlaceStandardOrderResult{OrderID: "order-1"},
		cartResult:     checkoutapp.PlaceCartOrderResult{OrderID: "order-1"},
	}
	router := chi.NewRouter()
	NewHandler(service, fakeCustomerVerifier{}).Register(router)

	post := func(path string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader([]byte(`{}`)))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer customer-token")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	if response := post("/public/stores/tdh/orders"); response.Code != http.StatusCreated {
		t.Fatalf("orders: expected 201, got %d body=%s", response.Code, response.Body.String())
	}
	if service.standardCommand.CustomerID != "customer-signed-in" {
		t.Fatalf("orders: verified customer was not bound: %+v", service.standardCommand)
	}
	if response := post("/public/stores/tdh/cart-orders"); response.Code != http.StatusCreated {
		t.Fatalf("cart-orders: expected 201, got %d body=%s", response.Code, response.Body.String())
	}
	if service.cartCommand.CustomerID != "customer-signed-in" {
		t.Fatalf("cart-orders: verified customer was not bound: %+v", service.cartCommand)
	}
}

func TestPlaceEndpointRejectsInvalidSuppliedCustomerToken(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	router := chi.NewRouter()
	NewHandler(service, fakeCustomerVerifier{err: errors.New("expired")}).Register(router)
	request := httptest.NewRequest(http.MethodPost, "/public/stores/tdh/orders", bytes.NewReader([]byte(`{}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer expired-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized || !service.standardCommand.CustomerID.IsZero() {
		t.Fatalf("invalid supplied token must fail before order creation: status=%d command=%+v",
			response.Code, service.standardCommand)
	}
}

// The payments/verify endpoint settles a checkout payment by its provider
// reference, scoped to the store handle, and reports the customer-facing
// status.
func TestVerifyPaymentReturnsStatus(t *testing.T) {
	t.Parallel()

	service := &fakeService{verifyResult: checkoutapp.VerifyStorePaymentResult{Status: "pending"}}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/public/stores/tdh/payments/verify",
		bytes.NewReader([]byte(`{"reference":"xt_ref-1"}`)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.verifyCommand.StoreHandle != "tdh" || service.verifyCommand.ProviderReference != "xt_ref-1" {
		t.Fatalf("expected the verify scoped to the store handle, got %+v", service.verifyCommand)
	}
	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["status"] != "pending" {
		t.Fatalf("unexpected status body: %+v", body)
	}
}

func newTestRouter(service *fakeService) chi.Router {
	router := chi.NewRouter()
	NewHandler(service, nil).Register(router)
	return router
}

// ── fakes ──────────────────────────────────────────────────────────────────

type fakeService struct {
	standardResult  checkoutapp.PlaceStandardOrderResult
	standardCommand checkoutapp.PlaceStandardOrderCommand
	cartResult      checkoutapp.PlaceCartOrderResult
	cartCommand     checkoutapp.PlaceCartOrderCommand
	customResult    checkoutapp.PlaceCustomOrderResult
	customCommand   checkoutapp.PlaceCustomOrderCommand
	bookingResult   checkoutapp.PlaceHomeVisitBookingResult
	bookingCommand  checkoutapp.PlaceHomeVisitBookingCommand
	quoteResult     checkoutapp.CheckoutQuoteResult
	quoteCommand    checkoutapp.CheckoutQuoteCommand
	verifyResult    checkoutapp.VerifyStorePaymentResult
	verifyCommand   checkoutapp.VerifyStorePaymentCommand
	verifyErr       error
}

type fakeCustomerVerifier struct {
	err error
}

func (verifier fakeCustomerVerifier) VerifyCustomerAccessToken(
	_ context.Context,
	_ string,
) (ports.VerifiedCustomerToken, error) {
	if verifier.err != nil {
		return ports.VerifiedCustomerToken{}, verifier.err
	}
	return ports.VerifiedCustomerToken{CustomerID: common.ID("customer-signed-in")}, nil
}

func (s *fakeService) PlaceStandardOrder(_ context.Context, command checkoutapp.PlaceStandardOrderCommand) (checkoutapp.PlaceStandardOrderResult, error) {
	s.standardCommand = command
	return s.standardResult, nil
}

func (s *fakeService) PlaceCartOrder(_ context.Context, command checkoutapp.PlaceCartOrderCommand) (checkoutapp.PlaceCartOrderResult, error) {
	s.cartCommand = command
	return s.cartResult, nil
}

func (s *fakeService) PlaceCustomOrder(_ context.Context, command checkoutapp.PlaceCustomOrderCommand) (checkoutapp.PlaceCustomOrderResult, error) {
	s.customCommand = command
	return s.customResult, nil
}

func (s *fakeService) PlaceHomeVisitBooking(_ context.Context, command checkoutapp.PlaceHomeVisitBookingCommand) (checkoutapp.PlaceHomeVisitBookingResult, error) {
	s.bookingCommand = command
	return s.bookingResult, nil
}

func (s *fakeService) CheckoutQuote(_ context.Context, command checkoutapp.CheckoutQuoteCommand) (checkoutapp.CheckoutQuoteResult, error) {
	s.quoteCommand = command
	return s.quoteResult, nil
}

func (s *fakeService) VerifyStorePayment(_ context.Context, command checkoutapp.VerifyStorePaymentCommand) (checkoutapp.VerifyStorePaymentResult, error) {
	s.verifyCommand = command
	return s.verifyResult, s.verifyErr
}

func (s *fakeService) StoreDeliveryZones(_ context.Context, _ string) ([]ports.DeliveryZone, error) {
	return nil, nil
}
