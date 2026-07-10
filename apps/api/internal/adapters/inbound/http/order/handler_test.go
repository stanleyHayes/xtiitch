package orderhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	orderapp "github.com/xcreativs/xtiitch/apps/api/internal/application/order"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
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
	if service.advanceCommand.Scope.BusinessID != "business-1" ||
		service.advanceCommand.ActorRole != business.UserRoleOwner ||
		service.advanceCommand.OrderID != "order-1" {
		t.Fatalf("unexpected advance command: %+v", service.advanceCommand)
	}
}

func TestCreateWalkInPassesActorRole(t *testing.T) {
	t.Parallel()

	service := &fakeOrderService{createdOrderID: "order-1"}
	router := newOrderRouter(service, fakeOrderVerifier{
		principal: ports.VerifiedAccessToken{Subject: "admin-1", BusinessID: "business-1", Role: business.UserRoleAdmin},
	})
	request := httptest.NewRequest(http.MethodPost, "/orders", strings.NewReader(`{"design_id":"design-1","customer_name":"Ama Boateng"}`))
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (%s)", response.Code, response.Body.String())
	}
	if service.createCommand.Scope.BusinessID != "business-1" ||
		service.createCommand.ActorRole != business.UserRoleAdmin ||
		service.createCommand.DesignID != "design-1" {
		t.Fatalf("unexpected create command: %+v", service.createCommand)
	}
}

func TestTrackingSerializesHandover(t *testing.T) {
	t.Parallel()

	updatedAt := time.Date(2026, 6, 18, 9, 45, 0, 0, time.UTC)
	service := &fakeOrderService{tracking: order.Tracking{
		OrderID:     "order-1",
		DesignTitle: "Kente wrap dress",
		StoreName:   "Demo Atelier",
		Status:      order.StatusFulfilled,
		StageName:   "Ready",
		Colour:      order.ColourGreen,
		Handover: &order.HandoverTracking{
			Method:         "delivery",
			Status:         "dispatched",
			RecipientName:  "Ama Boateng",
			RecipientPhone: "+233200000000",
			Address:        "Osu, Accra",
			Courier:        "Courier GH",
			Note:           "Call on arrival",
			UpdatedAt:      updatedAt,
		},
	}}
	router := newOrderRouter(service, fakeOrderVerifier{})
	response := httptest.NewRecorder()

	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/public/orders/order-1", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", response.Code, response.Body.String())
	}
	var body struct {
		Handover struct {
			Method         string `json:"method"`
			Status         string `json:"status"`
			RecipientName  string `json:"recipient_name"`
			RecipientPhone string `json:"recipient_phone"`
			Address        string `json:"address"`
			Courier        string `json:"courier"`
			Note           string `json:"note"`
			UpdatedAt      string `json:"updated_at"`
		} `json:"handover"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Handover.Method != "delivery" || body.Handover.Status != "dispatched" ||
		body.Handover.RecipientName != "Ama Boateng" || body.Handover.UpdatedAt != updatedAt.Format(time.RFC3339) {
		t.Fatalf("handover was not serialized correctly: %+v", body.Handover)
	}
}

func TestSetAgreedTotalMapsForbidden(t *testing.T) {
	t.Parallel()

	service := &fakeOrderService{setAgreedErr: authdomain.ErrForbidden}
	router := newOrderRouter(service, fakeOrderVerifier{
		principal: ports.VerifiedAccessToken{Subject: "staff-1", BusinessID: "business-1", Role: business.UserRoleStaff},
	})
	request := httptest.NewRequest(http.MethodPost, "/orders/order-1/agreed-total", strings.NewReader(`{"agreed_total_minor":50000}`))
	request.Header.Set("Authorization", "Bearer token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d (%s)", response.Code, response.Body.String())
	}
	if service.setAgreedCommand.ActorRole != business.UserRoleStaff || service.setAgreedCommand.OrderID != "order-1" {
		t.Fatalf("unexpected agreed total command: %+v", service.setAgreedCommand)
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
	orders           []ports.OrderSummary
	createdOrderID   common.ID
	createCommand    orderapp.CreateWalkInOrderCommand
	customCommand    orderapp.CreateConfirmedCustomOrderCommand
	advanceErr       error
	advanceCommand   orderapp.AdvanceStageCommand
	tracking         order.Tracking
	setAgreedErr     error
	setAgreedCommand orderapp.SetAgreedTotalCommand
	collectCommand   orderapp.CollectBalanceCommand
}

func (s *fakeOrderService) CreateWalkInOrder(_ context.Context, command orderapp.CreateWalkInOrderCommand) (common.ID, error) {
	s.createCommand = command
	return s.createdOrderID, nil
}

func (s *fakeOrderService) CreateConfirmedCustomOrder(_ context.Context, command orderapp.CreateConfirmedCustomOrderCommand) (common.ID, error) {
	s.customCommand = command
	return s.createdOrderID, nil
}

func (s *fakeOrderService) ListOrders(context.Context, common.TenantScope) ([]ports.OrderSummary, error) {
	return s.orders, nil
}

func (s *fakeOrderService) ListStages(context.Context, common.TenantScope) ([]ports.StageTemplate, error) {
	return nil, nil
}

func (s *fakeOrderService) AdvanceStage(_ context.Context, command orderapp.AdvanceStageCommand) (order.Tracking, error) {
	s.advanceCommand = command
	return order.Tracking{}, s.advanceErr
}

func (s *fakeOrderService) GetTracking(context.Context, common.ID) (order.Tracking, error) {
	return s.tracking, nil
}

func (s *fakeOrderService) SetAgreedTotal(_ context.Context, command orderapp.SetAgreedTotalCommand) error {
	s.setAgreedCommand = command
	return s.setAgreedErr
}

func (s *fakeOrderService) CollectBalance(_ context.Context, command orderapp.CollectBalanceCommand) (orderapp.CollectBalanceResult, error) {
	s.collectCommand = command
	return orderapp.CollectBalanceResult{}, nil
}
