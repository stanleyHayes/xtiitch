package checkoutapp

import (
	"context"
	"errors"
	"testing"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

const testBusinessID = common.ID("biz-1")

func newTestService(orders ports.OrderRepository, payments Payments) Service {
	return NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:   orders,
		Payments: payments,
		IDs:      &seqIDs{ids: []common.ID{"order-1", "customer-1"}},
	})
}

func placeCommand() PlaceStandardOrderCommand {
	return PlaceStandardOrderCommand{
		StoreHandle: "shop", DesignHandle: "design", SizeBandID: "band-1",
		CustomerName: "Ama", CustomerEmail: "ama@example.com",
	}
}

// A charge that cannot be raised must not leave the just-created draft order
// behind: it is compensated so checkout stays all-or-nothing (finding 4).
func TestPlaceStandardOrderDiscardsDraftWhenChargeFails(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{err: errors.New("provider down")}
	svc := newTestService(orders, payments)

	if _, err := svc.PlaceStandardOrder(context.Background(), placeCommand()); err == nil {
		t.Fatal("expected the charge failure to propagate")
	}
	if !orders.discardCalled {
		t.Fatal("expected the draft order to be discarded after the charge failed")
	}
	if orders.discardOrder != "order-1" || orders.discardCustomer != "customer-1" {
		t.Fatalf("discarded the wrong rows: order=%q customer=%q", orders.discardOrder, orders.discardCustomer)
	}
}

func TestPlaceStandardOrderKeepsOrderWhenChargeSucceeds(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := newTestService(orders, payments)

	res, err := svc.PlaceStandardOrder(context.Background(), placeCommand())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if orders.discardCalled {
		t.Fatal("a successfully charged order must never be discarded")
	}
	if res.OrderID != "order-1" || res.Reference != "xt_ref" || res.AmountMinor != 50000 {
		t.Fatalf("unexpected result: %+v", res)
	}
	if orders.created.OrderID != "order-1" || orders.created.CustomerID != "customer-1" || orders.created.BusinessID != testBusinessID {
		t.Fatalf("unexpected draft order ids: %+v", orders.created)
	}
	if orders.created.CustomerName != "Ama" || orders.created.CustomerEmail != "ama@example.com" || orders.created.AgreedTotalMinor != 50000 {
		t.Fatalf("unexpected draft order details: %+v", orders.created)
	}
	if payments.command.OrderID == nil || *payments.command.OrderID != "order-1" {
		t.Fatalf("expected charge to be tied to the draft order, got %+v", payments.command.OrderID)
	}
	if payments.command.Purpose != money.PaymentPurposeStandardFull || payments.command.AmountMinor != 50000 {
		t.Fatalf("unexpected charge command: %+v", payments.command)
	}
	if payments.command.Method != money.PaymentMethodMomo {
		t.Fatalf("expected momo to be the default method, got %q", payments.command.Method)
	}
}

func TestPlaceStandardOrderRejectsInvalidPaymentMethod(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := newTestService(orders, payments)
	cmd := placeCommand()
	cmd.Method = money.PaymentMethod("cash")

	if _, err := svc.PlaceStandardOrder(context.Background(), cmd); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for unsupported method, got %v", err)
	}
	if orders.created.OrderID != "" || payments.called {
		t.Fatal("expected invalid method to stop before draft order or charge")
	}
}

func TestPlaceStandardOrderRejectsUnavailableBand(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := newTestService(orders, payments)
	cmd := placeCommand()
	cmd.SizeBandID = "missing-band"

	if _, err := svc.PlaceStandardOrder(context.Background(), cmd); !errors.Is(err, ErrBandUnavailable) {
		t.Fatalf("expected unavailable band, got %v", err)
	}
	if orders.created.OrderID != "" || payments.called {
		t.Fatal("expected unavailable band to stop before draft order or charge")
	}
}

func TestPlaceStandardOrderRejectsUnverifiedStore(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{BusinessID: testBusinessID, Verified: false}},
		Orders:     orders,
		Payments:   payments,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1"}},
	})

	if _, err := svc.PlaceStandardOrder(context.Background(), placeCommand()); !errors.Is(err, ErrNotVerified) {
		t.Fatalf("expected unverified store rejection, got %v", err)
	}
	if orders.created.OrderID != "" || payments.called {
		t.Fatal("expected unverified store to stop before draft order or charge")
	}
}

type fakeStorefront struct {
	store  ports.Storefront
	design ports.StorefrontDesign
}

func (f fakeStorefront) ResolveStore(context.Context, string) (ports.Storefront, error) {
	return f.store, nil
}

func (f fakeStorefront) ListActiveDesigns(context.Context, common.ID) ([]ports.StorefrontDesign, error) {
	return nil, nil
}

func (f fakeStorefront) GetActiveDesignByHandle(context.Context, string) (ports.StorefrontDesign, error) {
	return f.design, nil
}

func (f fakeStorefront) ListActiveCollections(context.Context, common.ID) ([]catalogue.Collection, error) {
	return nil, nil
}

func (f fakeStorefront) GetActiveCollectionByHandle(context.Context, string) (ports.StorefrontCollection, error) {
	return ports.StorefrontCollection{}, nil
}

func (f fakeStorefront) SearchActiveDesigns(context.Context, common.ID, string) ([]ports.StorefrontDesign, error) {
	return nil, nil
}

type fakeCharge struct {
	ctx ports.BusinessChargeContext
}

func (f fakeCharge) GetChargeContext(context.Context, common.TenantScope) (ports.BusinessChargeContext, error) {
	return f.ctx, nil
}

func (f fakeCharge) ProvisionSubaccount(context.Context, common.ID, string, string) error {
	return nil
}

type fakeOrders struct {
	created         ports.CreateOnlineOrderInput
	discardCalled   bool
	discardOrder    common.ID
	discardCustomer common.ID
}

func (f *fakeOrders) CreateWalkInOrder(context.Context, common.TenantScope, ports.CreateWalkInOrderInput) error {
	return nil
}

func (f *fakeOrders) CreateOnlineOrder(_ context.Context, _ common.TenantScope, input ports.CreateOnlineOrderInput) error {
	f.created = input
	return nil
}

func (f *fakeOrders) DiscardDraftOrder(_ context.Context, _ common.TenantScope, orderID, customerID common.ID) error {
	f.discardCalled = true
	f.discardOrder = orderID
	f.discardCustomer = customerID
	return nil
}

func (f *fakeOrders) ListOrders(context.Context, common.TenantScope) ([]ports.OrderSummary, error) {
	return nil, nil
}

func (f *fakeOrders) AdvanceStage(context.Context, common.TenantScope, common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

func (f *fakeOrders) GetTracking(context.Context, common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

type fakePayments struct {
	result  paymentsapp.ChargeResult
	err     error
	called  bool
	command paymentsapp.InitiateChargeCommand
}

func (f *fakePayments) InitiateCharge(_ context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error) {
	f.called = true
	f.command = command
	return f.result, f.err
}

type seqIDs struct {
	ids []common.ID
}

func (s *seqIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
