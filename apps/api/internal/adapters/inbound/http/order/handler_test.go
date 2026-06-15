package orderhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	orderapp "github.com/xcreativs/xtiitch/apps/api/internal/application/order"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

func TestListOrdersReturnsDashboardFields(t *testing.T) {
	t.Parallel()

	total := int64(50000)
	paymentAmount := int64(20000)
	createdAt := time.Date(2026, 6, 15, 12, 30, 0, 0, time.UTC)
	service := &fakeOrderService{orders: []ports.OrderSummary{{
		OrderID:          "order-1",
		DesignTitle:      "Kente wrap dress",
		CustomerName:     "Ama Boateng",
		CustomerPhone:    "+233200000000",
		CustomerEmail:    "ama@example.com",
		Status:           "confirmed",
		OrderType:        "custom",
		SizeMode:         "self_measure",
		Channel:          "online",
		StageName:        "Being made",
		Colour:           "yellow",
		AgreedTotalMinor: &total,
		SettledMinor:     20000,
		PaymentStatus:    "succeeded",
		PaymentPurpose:   "deposit",
		PaymentAmount:    &paymentAmount,
		CreatedAt:        createdAt,
	}}}
	router := newOrderRouter(service, fakeOrderVerifier{
		principal: ports.VerifiedAccessToken{Subject: "user-1", BusinessID: "business-1", Role: business.UserRoleOwner},
	})
	request := httptest.NewRequest(http.MethodGet, "/orders", nil)
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", response.Code, response.Body.String())
	}
	var body struct {
		Orders []struct {
			OrderID            string `json:"order_id"`
			CustomerPhone      string `json:"customer_phone"`
			OrderType          string `json:"order_type"`
			SizeMode           string `json:"size_mode"`
			Channel            string `json:"channel"`
			PaymentStatus      string `json:"payment_status"`
			PaymentAmountMinor *int64 `json:"payment_amount_minor"`
			CreatedAt          string `json:"created_at"`
		} `json:"orders"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Orders) != 1 {
		t.Fatalf("expected one order, got %+v", body.Orders)
	}
	got := body.Orders[0]
	if got.OrderID != "order-1" || got.CustomerPhone != "+233200000000" || got.OrderType != "custom" ||
		got.SizeMode != "self_measure" || got.Channel != "online" || got.PaymentStatus != "succeeded" {
		t.Fatalf("dashboard fields were not serialized correctly: %+v", got)
	}
	if got.PaymentAmountMinor == nil || *got.PaymentAmountMinor != paymentAmount {
		t.Fatalf("expected payment amount %d, got %+v", paymentAmount, got.PaymentAmountMinor)
	}
	if got.CreatedAt == "" {
		t.Fatal("expected created_at to be serialized")
	}
}

func TestAdvanceStageRejectsInvalidOrderState(t *testing.T) {
	t.Parallel()

	service := &fakeOrderService{advanceErr: ports.ErrInvalidOrderState}
	router := newOrderRouter(service, fakeOrderVerifier{
		principal: ports.VerifiedAccessToken{Subject: "user-1", BusinessID: "business-1", Role: business.UserRoleOwner},
	})
	request := httptest.NewRequest(http.MethodPost, "/orders/order-1/advance", nil)
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d (%s)", response.Code, response.Body.String())
	}
}

func newOrderRouter(service Service, verifier ports.TokenVerifier) http.Handler {
	router := chi.NewRouter()
	NewHandler(service, authhttp.NewAuthenticator(verifier)).Register(router)
	return router
}

type fakeOrderVerifier struct {
	principal ports.VerifiedAccessToken
	err       error
}

func (v fakeOrderVerifier) VerifyAccessToken(_ context.Context, _ string) (ports.VerifiedAccessToken, error) {
	return v.principal, v.err
}

type fakeOrderService struct {
	orders     []ports.OrderSummary
	advanceErr error
}

func (s *fakeOrderService) CreateWalkInOrder(context.Context, orderapp.CreateWalkInOrderCommand) (common.ID, error) {
	return "", nil
}

func (s *fakeOrderService) ListOrders(context.Context, common.TenantScope) ([]ports.OrderSummary, error) {
	return s.orders, nil
}

func (s *fakeOrderService) AdvanceStage(context.Context, common.TenantScope, common.ID) (order.Tracking, error) {
	return order.Tracking{}, s.advanceErr
}

func (s *fakeOrderService) GetTracking(context.Context, common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

func (s *fakeOrderService) SetAgreedTotal(context.Context, common.TenantScope, common.ID, int64) error {
	return nil
}

func (s *fakeOrderService) CollectBalance(context.Context, common.TenantScope, common.ID, money.PaymentMethod) (orderapp.CollectBalanceResult, error) {
	return orderapp.CollectBalanceResult{}, nil
}
