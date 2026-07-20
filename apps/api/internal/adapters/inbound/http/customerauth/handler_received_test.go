package customerauthhttp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	customerauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/customerauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// The §5.3/§12 orders payload: every ordered design carries its source store
// (name, handle, PHONE), its basket link, its standard/bespoke kind and its
// received marker.

func TestOrdersPayloadCarriesStorePhoneKindBasketAndReceived(t *testing.T) {
	t.Parallel()

	groupID := common.ID("group-1")
	received := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	service := &fakeService{ordersResult: []ports.CustomerOrderSummary{
		{
			OrderID:          "order-1",
			BusinessName:     "KB Designs",
			BusinessHandle:   "kbdesigns",
			StorePhone:       "0244000000",
			DesignTitle:      "Kente Wrap",
			Status:           "fulfilled",
			Kind:             "bespoke",
			CheckoutGroupID:  &groupID,
			AgreedTotalMinor: 25000,
			CreatedAt:        time.Date(2026, 6, 28, 9, 30, 0, 0, time.UTC),
			ReceivedAt:       &received,
		},
		{
			OrderID:          "order-2",
			BusinessName:     "Top Designers Hub",
			BusinessHandle:   "tdh",
			StorePhone:       "",
			DesignTitle:      "Smock",
			Status:           "confirmed",
			Kind:             "standard",
			CheckoutGroupID:  nil,
			AgreedTotalMinor: 12000,
			CreatedAt:        time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC),
		},
	}}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodGet, "/customer/orders", nil)
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	var body struct {
		Orders []customerOrderResponse `json:"orders"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Orders) != 2 {
		t.Fatalf("expected 2 orders, got %d", len(body.Orders))
	}
	first := body.Orders[0]
	if first.StorePhone != "0244000000" {
		t.Fatalf("expected the store phone on the order (§12), got %q", first.StorePhone)
	}
	if first.Kind != "bespoke" {
		t.Fatalf("expected bespoke kind, got %q", first.Kind)
	}
	if first.CheckoutGroupID == nil || *first.CheckoutGroupID != "group-1" {
		t.Fatalf("expected checkout_group_id group-1, got %+v", first.CheckoutGroupID)
	}
	if first.ReceivedAt == nil || *first.ReceivedAt != "2026-07-01T12:00:00Z" {
		t.Fatalf("expected received_at rendered, got %+v", first.ReceivedAt)
	}
	second := body.Orders[1]
	if second.Kind != "standard" {
		t.Fatalf("expected standard kind, got %q", second.Kind)
	}
	if second.CheckoutGroupID != nil {
		t.Fatalf("a single-design checkout must carry a null checkout_group_id, got %+v", second.CheckoutGroupID)
	}
	if second.ReceivedAt != nil {
		t.Fatalf("an unacknowledged order must carry a null received_at, got %+v", second.ReceivedAt)
	}
}

// §5.3.2 "Received" button: final-stage only, idempotent, own orders only.

func TestMarkReceivedStampsOrder(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/order-1/received", nil)
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.markedOrderID != "order-1" {
		t.Fatalf("expected order-1 marked, got %q", service.markedOrderID)
	}
	var body map[string]bool
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || !body["ok"] {
		t.Fatalf("expected {ok:true}, got %s", response.Body.String())
	}
}

func TestMarkReceivedWrongStageIsConflict(t *testing.T) {
	t.Parallel()

	service := &fakeService{markErr: customerauthapp.ErrOrderNotInFinalStage}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/order-1/received", nil)
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", response.Code, response.Body.String())
	}
	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || body["error"] != "order_not_in_final_stage" {
		t.Fatalf("expected stable code order_not_in_final_stage, got %s", response.Body.String())
	}
}

func TestMarkReceivedOtherCustomersOrderIsNotFound(t *testing.T) {
	t.Parallel()

	service := &fakeService{markErr: ports.ErrNotFound}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/order-9/received", nil)
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", response.Code, response.Body.String())
	}
	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || body["error"] != "not_found" {
		t.Fatalf("expected not_found, got %s", response.Body.String())
	}
}

func TestMarkReceivedRequiresAuth(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/order-1/received", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.Code)
	}
	if service.markedOrderID != "" {
		t.Fatal("an unauthenticated request must never mark an order")
	}
}

func TestMarkBasketReceivedReportsCount(t *testing.T) {
	t.Parallel()

	service := &fakeService{markedCount: 4}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/received-basket",
		bytes.NewReader([]byte(`{"checkout_group_id":"group-1"}`)))
	request.Header.Set("Authorization", "Bearer token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.markedGroupID != "group-1" {
		t.Fatalf("expected basket group-1 marked, got %q", service.markedGroupID)
	}
	var body map[string]any
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["ok"] != true || body["marked_count"] != float64(4) {
		t.Fatalf("expected {ok:true, marked_count:4}, got %s", response.Body.String())
	}
}

func TestMarkBasketReceivedRequiresGroupID(t *testing.T) {
	t.Parallel()

	service := &fakeService{}
	router := newTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/customer/orders/received-basket",
		bytes.NewReader([]byte(`{}`)))
	request.Header.Set("Authorization", "Bearer token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", response.Code, response.Body.String())
	}
	if service.markedGroupID != "" {
		t.Fatal("an empty basket id must never reach the service")
	}
}
