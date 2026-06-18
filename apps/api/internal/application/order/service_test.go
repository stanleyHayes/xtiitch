package orderapp

import (
	"context"
	"errors"
	"testing"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

func ptr[T any](v T) *T { return &v }

func TestCreateWalkInOrderRejectsMissingDesignOrCustomer(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{Orders: &fakeOrderRepo{}, IDs: &seqIDs{ids: []common.ID{"order-1", "customer-1"}}})

	if _, err := service.CreateWalkInOrder(context.Background(), CreateWalkInOrderCommand{
		Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, DesignID: "", CustomerName: "Ama",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for missing design, got %v", err)
	}
	if _, err := service.CreateWalkInOrder(context.Background(), CreateWalkInOrderCommand{
		Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, DesignID: "d1", CustomerName: "  ",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for missing customer, got %v", err)
	}
}

func TestCreateWalkInOrderRecordsScopedInput(t *testing.T) {
	t.Parallel()

	repo := &fakeOrderRepo{}
	service := NewService(Dependencies{Orders: repo, IDs: &seqIDs{ids: []common.ID{"order-1", "customer-1"}}})

	id, err := service.CreateWalkInOrder(context.Background(), CreateWalkInOrderCommand{
		Scope:        common.TenantScope{BusinessID: "b1"},
		ActorRole:    business.UserRoleStaff,
		DesignID:     "d1",
		CustomerName: "  Ama Boateng  ",
	})
	if err != nil {
		t.Fatalf("create walk-in order: %v", err)
	}
	if id != common.ID("order-1") {
		t.Fatalf("unexpected order id %q", id)
	}
	if repo.input.OrderID != "order-1" || repo.input.CustomerID != "customer-1" || repo.input.BusinessID != "b1" {
		t.Fatalf("unexpected ids on input: %+v", repo.input)
	}
	if repo.input.CustomerName != "Ama Boateng" {
		t.Fatalf("expected trimmed customer name, got %q", repo.input.CustomerName)
	}
}

func TestOrderOperationsRequireKnownBusinessRole(t *testing.T) {
	t.Parallel()

	repo := &fakeOrderRepo{}
	service := NewService(Dependencies{Orders: repo, IDs: &seqIDs{ids: []common.ID{"order-1", "customer-1"}}})
	scope := common.TenantScope{BusinessID: "b1"}

	if _, err := service.CreateWalkInOrder(context.Background(), CreateWalkInOrderCommand{
		Scope:        scope,
		ActorRole:    business.UserRole("viewer"),
		DesignID:     "d1",
		CustomerName: "Ama Boateng",
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected unknown role to be forbidden for walk-in creation, got %v", err)
	}
	if repo.createCalled {
		t.Fatal("walk-in creation should stop before repository write")
	}

	if _, err := service.AdvanceStage(context.Background(), AdvanceStageCommand{
		Scope:     scope,
		ActorRole: business.UserRole("viewer"),
		OrderID:   "o1",
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected unknown role to be forbidden for stage advancement, got %v", err)
	}
	if repo.advanceCalled {
		t.Fatal("stage advancement should stop before repository write")
	}

	if _, err := service.AdvanceStage(context.Background(), AdvanceStageCommand{
		Scope:     common.TenantScope{},
		ActorRole: business.UserRoleStaff,
		OrderID:   "o1",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected missing scope to be invalid, got %v", err)
	}
	if repo.advanceCalled {
		t.Fatal("stage advancement should not reach the repository without a tenant scope")
	}
}

type fakeOrderRepo struct {
	input          ports.CreateWalkInOrderInput
	createCalled   bool
	advanceCalled  bool
	advanceScope   common.TenantScope
	advanceOrderID common.ID
	agreedTotalSet int64
	setAgreedErr   error
	billing        ports.OrderBilling
	billingErr     error
}

func (r *fakeOrderRepo) CreateWalkInOrder(_ context.Context, _ common.TenantScope, input ports.CreateWalkInOrderInput) error {
	r.createCalled = true
	r.input = input
	return nil
}

func (r *fakeOrderRepo) CreateOnlineOrder(_ context.Context, _ common.TenantScope, _ ports.CreateOnlineOrderInput) error {
	return nil
}

func (r *fakeOrderRepo) DiscardDraftOrder(_ context.Context, _ common.TenantScope, _, _ common.ID) error {
	return nil
}

func (r *fakeOrderRepo) SetDraftOrderAgreedTotal(_ context.Context, _ common.TenantScope, _ common.ID, _ int64) error {
	return nil
}

func (r *fakeOrderRepo) CreateCustomOrder(_ context.Context, _ common.TenantScope, _ ports.CreateCustomOrderInput) error {
	return nil
}

func (r *fakeOrderRepo) CreateCustomOrderConfirmed(_ context.Context, _ common.TenantScope, _ ports.CreateCustomOrderConfirmedInput) error {
	return nil
}

func (r *fakeOrderRepo) DiscardCustomDraftOrder(_ context.Context, _ common.TenantScope, _, _ common.ID) error {
	return nil
}

func (r *fakeOrderRepo) ListOrders(_ context.Context, _ common.TenantScope) ([]ports.OrderSummary, error) {
	return nil, nil
}

func (r *fakeOrderRepo) AdvanceStage(_ context.Context, scope common.TenantScope, orderID common.ID) (order.Tracking, error) {
	r.advanceCalled = true
	r.advanceScope = scope
	r.advanceOrderID = orderID
	return order.Tracking{}, nil
}

func (r *fakeOrderRepo) GetTracking(_ context.Context, _ common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

func (r *fakeOrderRepo) SetAgreedTotal(_ context.Context, _ common.TenantScope, _ common.ID, agreedTotalMinor int64) error {
	r.agreedTotalSet = agreedTotalMinor
	return r.setAgreedErr
}

func (r *fakeOrderRepo) GetOrderBilling(_ context.Context, _ common.TenantScope, _ common.ID) (ports.OrderBilling, error) {
	return r.billing, r.billingErr
}

type fakeOrderPayments struct {
	command paymentsapp.InitiateChargeCommand
	result  paymentsapp.ChargeResult
	err     error
	called  bool
}

func (f *fakeOrderPayments) InitiateCharge(_ context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error) {
	f.called = true
	f.command = command
	return f.result, f.err
}

func TestSetAgreedTotalRejectsNonPositive(t *testing.T) {
	t.Parallel()

	repo := &fakeOrderRepo{}
	service := NewService(Dependencies{Orders: repo, IDs: &seqIDs{}})
	if err := service.SetAgreedTotal(context.Background(), SetAgreedTotalCommand{
		Scope:            common.TenantScope{BusinessID: "b1"},
		ActorRole:        business.UserRoleOwner,
		OrderID:          "o1",
		AgreedTotalMinor: 0,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for non-positive total, got %v", err)
	}
	if repo.agreedTotalSet != 0 {
		t.Fatal("a non-positive total must never reach the repository")
	}
}

func TestOrderMoneyMutationsRequireOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	repo := &fakeOrderRepo{billing: ports.OrderBilling{
		OrderType: "custom", Status: "confirmed", AgreedTotalMinor: ptr(int64(50000)), SettledMinor: 15000, CustomerEmail: "c@x.z",
	}}
	payments := &fakeOrderPayments{}
	service := NewService(Dependencies{Orders: repo, Payments: payments, IDs: &seqIDs{}})
	scope := common.TenantScope{BusinessID: "b1"}

	err := service.SetAgreedTotal(context.Background(), SetAgreedTotalCommand{
		Scope:            scope,
		ActorRole:        business.UserRoleStaff,
		OrderID:          "o1",
		AgreedTotalMinor: 50000,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff agreed total to be forbidden, got %v", err)
	}
	if repo.agreedTotalSet != 0 {
		t.Fatal("expected staff agreed total to stop before repository write")
	}

	_, err = service.CollectBalance(context.Background(), CollectBalanceCommand{
		Scope:     scope,
		ActorRole: business.UserRoleStaff,
		OrderID:   "o1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff balance collection to be forbidden, got %v", err)
	}
	if payments.called {
		t.Fatal("expected staff balance collection to stop before charge creation")
	}
}

func TestCollectBalanceChargesOutstanding(t *testing.T) {
	t.Parallel()

	repo := &fakeOrderRepo{billing: ports.OrderBilling{
		OrderType: "custom", Status: "confirmed", AgreedTotalMinor: ptr(int64(50000)), SettledMinor: 15000, CustomerEmail: "c@x.z",
	}}
	payments := &fakeOrderPayments{result: paymentsapp.ChargeResult{Reference: "xt_bal", AuthorizationURL: "https://pay"}}
	service := NewService(Dependencies{Orders: repo, Payments: payments, IDs: &seqIDs{}})

	res, err := service.CollectBalance(context.Background(), CollectBalanceCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleAdmin,
		OrderID:   "o1",
	})
	if err != nil {
		t.Fatalf("collect balance: %v", err)
	}
	if res.AmountMinor != 35000 || res.Reference != "xt_bal" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if payments.command.Purpose != money.PaymentPurposeBalance || payments.command.AmountMinor != 35000 {
		t.Fatalf("expected a 35000 balance charge, got %+v", payments.command)
	}
	if payments.command.Method != money.PaymentMethodMomo || payments.command.CustomerEmail != "c@x.z" {
		t.Fatalf("unexpected charge command: %+v", payments.command)
	}
	if payments.command.OrderID == nil || *payments.command.OrderID != "o1" {
		t.Fatalf("expected the charge tied to the order, got %+v", payments.command.OrderID)
	}
}

func TestCollectBalanceRejectsWhenNothingDue(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		billing ports.OrderBilling
	}{
		{"standard order", ports.OrderBilling{OrderType: "standard", Status: "confirmed", AgreedTotalMinor: ptr(int64(50000)), CustomerEmail: "c@x.z"}},
		{"not confirmed", ports.OrderBilling{OrderType: "custom", Status: "draft", AgreedTotalMinor: ptr(int64(50000)), CustomerEmail: "c@x.z"}},
		{"no agreed total", ports.OrderBilling{OrderType: "custom", Status: "confirmed", AgreedTotalMinor: nil, CustomerEmail: "c@x.z"}},
		{"fully settled", ports.OrderBilling{OrderType: "custom", Status: "confirmed", AgreedTotalMinor: ptr(int64(50000)), SettledMinor: 50000, CustomerEmail: "c@x.z"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeOrderRepo{billing: tc.billing}
			payments := &fakeOrderPayments{}
			service := NewService(Dependencies{Orders: repo, Payments: payments, IDs: &seqIDs{}})
			if _, err := service.CollectBalance(context.Background(), CollectBalanceCommand{
				Scope:     common.TenantScope{BusinessID: "b1"},
				ActorRole: business.UserRoleOwner,
				OrderID:   "o1",
			}); !errors.Is(err, ErrBalanceNotDue) {
				t.Fatalf("expected balance not due, got %v", err)
			}
			if payments.called {
				t.Fatal("no charge should be raised when nothing is due")
			}
		})
	}
}

func TestCollectBalanceRejectsWhenBalanceInFlight(t *testing.T) {
	t.Parallel()

	repo := &fakeOrderRepo{billing: ports.OrderBilling{
		OrderType: "custom", Status: "confirmed", AgreedTotalMinor: ptr(int64(50000)), SettledMinor: 15000, CustomerEmail: "c@x.z", BalanceInFlight: true,
	}}
	payments := &fakeOrderPayments{}
	service := NewService(Dependencies{Orders: repo, Payments: payments, IDs: &seqIDs{}})

	if _, err := service.CollectBalance(context.Background(), CollectBalanceCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleOwner,
		OrderID:   "o1",
	}); !errors.Is(err, ErrBalanceInProgress) {
		t.Fatalf("expected balance in progress, got %v", err)
	}
	if payments.called {
		t.Fatal("no second charge may be raised while a balance is in flight")
	}
}

type seqIDs struct {
	ids []common.ID
}

func (s *seqIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
