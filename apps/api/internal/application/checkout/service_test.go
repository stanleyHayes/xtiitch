package checkoutapp

import (
	"context"
	"errors"
	"testing"
	"time"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
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

func customStore() ports.Storefront {
	return ports.Storefront{
		BusinessID:          testBusinessID,
		DefaultDepositMinor: 15000,
		Settings:            ports.StoreSettings{BespokeEnabled: true, MeasurementsEnabled: true},
	}
}

func customDesign() ports.StorefrontDesign {
	return ports.StorefrontDesign{Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID}}
}

func verifiedCharge() ports.BusinessChargeContext {
	return ports.BusinessChargeContext{BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1", CommissionBps: 300}
}

func customService(orders ports.OrderRepository, payments Payments, store ports.Storefront, design ports.StorefrontDesign, charge ports.BusinessChargeContext, ids []common.ID) Service {
	return NewService(Dependencies{
		Storefront: fakeStorefront{store: store, design: design},
		Businesses: fakeCharge{ctx: charge},
		Orders:     orders,
		Payments:   payments,
		IDs:        &seqIDs{ids: ids},
	})
}

func customCommand(mode string) PlaceCustomOrderCommand {
	return PlaceCustomOrderCommand{
		StoreHandle:   "shop",
		DesignHandle:  "design",
		SizeMode:      mode,
		CustomerName:  "Ama",
		CustomerEmail: "ama@example.com",
	}
}

func TestPlaceCustomOrderSelfMeasureRaisesDepositAndStoresMeasurements(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1", "meas-1"})

	cmd := customCommand("self_measure")
	cmd.Measurements = map[string]string{"field-1": "40", "field-2": "32"}

	res, err := svc.PlaceCustomOrder(context.Background(), cmd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OrderID != "order-1" || res.AmountMinor != 15000 || res.Reference != "xt_ref" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if orders.customCreated.SizeMode != "self_measure" || orders.customCreated.MeasurementID != "meas-1" {
		t.Fatalf("unexpected custom order input: %+v", orders.customCreated)
	}
	if len(orders.customCreated.Measurements) != 2 {
		t.Fatalf("expected measurements to be passed through, got %+v", orders.customCreated.Measurements)
	}
	if payments.command.Purpose != money.PaymentPurposeDeposit || payments.command.AmountMinor != 15000 {
		t.Fatalf("expected a 15000 deposit charge, got %+v", payments.command)
	}
	if payments.command.OrderID == nil || *payments.command.OrderID != "order-1" {
		t.Fatalf("expected the deposit tied to the order, got %+v", payments.command.OrderID)
	}
}

func TestPlaceCustomOrderHomeVisitRaisesDepositWithoutMeasurements(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref"}}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	res, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.AmountMinor != 15000 || !payments.called {
		t.Fatalf("expected a deposit charge, got %+v / called=%v", res, payments.called)
	}
	if orders.customCreated.SizeMode != "home_visit" || orders.customCreated.MeasurementID != "" || orders.customCreated.Measurements != nil {
		t.Fatalf("home_visit must not capture measurements at checkout: %+v", orders.customCreated)
	}
}

func TestPlaceCustomOrderComeToShopConfirmsWithoutPayment(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	res, err := svc.PlaceCustomOrder(context.Background(), customCommand("come_to_shop"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payments.called {
		t.Fatal("come_to_shop must raise no payment")
	}
	if res.OrderID != "order-1" || res.AmountMinor != 0 || res.Reference != "" || res.AuthorizationURL != "" {
		t.Fatalf("unexpected come_to_shop result: %+v", res)
	}
	if orders.customConfirmed.OrderID != "order-1" || orders.customConfirmed.SizeMode != "come_to_shop" {
		t.Fatalf("unexpected confirmed order input: %+v", orders.customConfirmed)
	}
}

func TestPlaceCustomOrderDepositPrecedenceUsesDesignOverride(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref"}}
	design := customDesign()
	override := int64(20000)
	design.Design.DepositOverrideMinor = &override
	svc := customService(orders, payments, customStore(), design, verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	res, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.AmountMinor != 20000 || payments.command.AmountMinor != 20000 {
		t.Fatalf("design override must win over store default, got %d", res.AmountMinor)
	}
}

func TestPlaceCustomOrderDiscardsDraftWhenDepositChargeFails(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{err: errors.New("provider down")}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	if _, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit")); err == nil {
		t.Fatal("expected the charge failure to propagate")
	}
	if !orders.customDiscardCalled || orders.customDiscardOrder != "order-1" {
		t.Fatalf("expected the custom draft to be discarded, got called=%v order=%q", orders.customDiscardCalled, orders.customDiscardOrder)
	}
}

func TestPlaceCustomOrderMapsUnknownMeasurementField(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{createCustomErr: ports.ErrUnknownMeasurementField}
	payments := &fakePayments{}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1", "meas-1"})

	cmd := customCommand("self_measure")
	cmd.Measurements = map[string]string{"not-a-field": "40"}

	if _, err := svc.PlaceCustomOrder(context.Background(), cmd); !errors.Is(err, ErrInvalidMeasurements) {
		t.Fatalf("expected invalid measurements, got %v", err)
	}
	if payments.called {
		t.Fatal("a rejected measurement must stop before any charge")
	}
}

func TestPlaceCustomOrderRejectsInvalidRoutesAndGates(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		mode     string
		store    ports.Storefront
		measures map[string]string
		want     error
	}{
		{"band is not a custom route", "band", customStore(), nil, ErrInvalidSizeMode},
		{"unknown mode", "nonsense", customStore(), nil, ErrInvalidSizeMode},
		{"bespoke disabled", "home_visit", ports.Storefront{BusinessID: testBusinessID, Settings: ports.StoreSettings{BespokeEnabled: false}}, nil, ErrBespokeDisabled},
		{"measurements disabled", "self_measure", ports.Storefront{BusinessID: testBusinessID, Settings: ports.StoreSettings{BespokeEnabled: true, MeasurementsEnabled: false}}, map[string]string{"f": "1"}, ErrMeasurementsDisabled},
		{"self_measure without measurements", "self_measure", customStore(), nil, ErrInvalidMeasurements},
		{"self_measure with a blank value", "self_measure", customStore(), map[string]string{"field-1": "   "}, ErrInvalidMeasurements},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			orders := &fakeOrders{}
			payments := &fakePayments{}
			svc := customService(orders, payments, tc.store, customDesign(), verifiedCharge(),
				[]common.ID{"order-1", "customer-1", "meas-1"})
			cmd := customCommand(tc.mode)
			cmd.Measurements = tc.measures
			if _, err := svc.PlaceCustomOrder(context.Background(), cmd); !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
			if payments.called || orders.customCreated.OrderID != "" || orders.customConfirmed.OrderID != "" {
				t.Fatal("a rejected custom order must create nothing and charge nothing")
			}
		})
	}
}

func TestPlaceCustomOrderRejectsUnverifiedForDepositRoute(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := customService(orders, payments, customStore(), customDesign(),
		ports.BusinessChargeContext{BusinessID: testBusinessID, Verified: false},
		[]common.ID{"order-1", "customer-1"})

	if _, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit")); !errors.Is(err, ErrNotVerified) {
		t.Fatalf("expected unverified rejection, got %v", err)
	}
	if orders.customCreated.OrderID != "" || payments.called {
		t.Fatal("unverified deposit route must create nothing and charge nothing")
	}
}

type fakeBookings struct {
	held          ports.HoldSlotInput
	holdErr       error
	discardCalled bool
}

func (f *fakeBookings) HoldSlot(_ context.Context, _ common.TenantScope, input ports.HoldSlotInput) error {
	f.held = input
	return f.holdErr
}

func (f *fakeBookings) DiscardHeldBooking(_ context.Context, _ common.TenantScope, _, _, _ common.ID) error {
	f.discardCalled = true
	return nil
}

func (f *fakeBookings) ListBookings(_ context.Context, _ common.TenantScope) ([]ports.BookingSummary, error) {
	return nil, nil
}

func (f *fakeBookings) CancelBooking(_ context.Context, _ common.TenantScope, _ common.ID) error {
	return nil
}

func (f *fakeBookings) RescheduleBooking(_ context.Context, _ common.TenantScope, _ ports.RescheduleBookingInput) error {
	return nil
}

type fakeAvailability struct {
	slot booking.Slot
	err  error
}

func (f fakeAvailability) ResolveOpenSlot(_ context.Context, _ common.TenantScope, _ time.Time) (booking.Slot, error) {
	return f.slot, f.err
}

func bookingService(orders ports.OrderRepository, bookings ports.BookingRepository, availability Availability, payments Payments, ids []common.ID) Service {
	return NewService(Dependencies{
		Storefront:   fakeStorefront{store: customStore(), design: customDesign()},
		Businesses:   fakeCharge{ctx: verifiedCharge()},
		Orders:       orders,
		Bookings:     bookings,
		Availability: availability,
		Payments:     payments,
		IDs:          &seqIDs{ids: ids},
	})
}

func bookingCommand() PlaceHomeVisitBookingCommand {
	return PlaceHomeVisitBookingCommand{
		StoreHandle:   "shop",
		DesignHandle:  "design",
		CustomerName:  "Ama",
		CustomerEmail: "ama@example.com",
		SlotStart:     time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC),
	}
}

func bookingSlot() booking.Slot {
	return booking.Slot{
		Start: time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC),
		End:   time.Date(2026, 7, 1, 11, 0, 0, 0, time.UTC),
	}
}

func TestPlaceHomeVisitBookingHoldsSlotAndChargesDeposit(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_bk", AuthorizationURL: "https://pay"}}
	svc := bookingService(orders, bookings, fakeAvailability{slot: bookingSlot()}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	res, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OrderID != "order-1" || res.BookingID != "booking-1" || res.AmountMinor != 15000 || res.Reference != "xt_bk" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if orders.customCreated.SizeMode != "home_visit" {
		t.Fatalf("expected a home_visit order, got %+v", orders.customCreated)
	}
	if bookings.held.BookingID != "booking-1" || !bookings.held.SlotStart.Equal(bookingSlot().Start) {
		t.Fatalf("unexpected hold: %+v", bookings.held)
	}
	if payments.command.Purpose != money.PaymentPurposeBookingDeposit || payments.command.AmountMinor != 15000 {
		t.Fatalf("unexpected charge: %+v", payments.command)
	}
	if payments.command.BookingID == nil || *payments.command.BookingID != "booking-1" {
		t.Fatalf("expected the deposit tied to the booking, got %+v", payments.command.BookingID)
	}
}

func TestPlaceHomeVisitBookingDiscardsWhenSlotTaken(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{holdErr: ports.ErrSlotTaken}
	payments := &fakePayments{}
	svc := bookingService(orders, bookings, fakeAvailability{slot: bookingSlot()}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	if _, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand()); !errors.Is(err, ports.ErrSlotTaken) {
		t.Fatalf("expected slot taken, got %v", err)
	}
	if !bookings.discardCalled {
		t.Fatal("expected the draft order to be discarded when the slot was taken")
	}
	if payments.called {
		t.Fatal("no charge should be raised when the slot was taken")
	}
}

func TestPlaceHomeVisitBookingDiscardsOnChargeFailure(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{}
	payments := &fakePayments{err: errors.New("provider down")}
	svc := bookingService(orders, bookings, fakeAvailability{slot: bookingSlot()}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	if _, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand()); err == nil {
		t.Fatal("expected the charge failure to propagate")
	}
	if !bookings.discardCalled {
		t.Fatal("expected the held booking + draft order to be compensated on a charge failure")
	}
}

func TestPlaceHomeVisitBookingPropagatesNoAvailability(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{}
	payments := &fakePayments{}
	svc := bookingService(orders, bookings, fakeAvailability{err: ports.ErrNoAvailability}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	if _, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand()); !errors.Is(err, ports.ErrNoAvailability) {
		t.Fatalf("expected no availability, got %v", err)
	}
	if orders.customCreated.OrderID != "" || bookings.held.BookingID != "" || payments.called {
		t.Fatal("no order, booking, or charge should be created when there is no open slot")
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
	created             ports.CreateOnlineOrderInput
	discardCalled       bool
	discardOrder        common.ID
	discardCustomer     common.ID
	customCreated       ports.CreateCustomOrderInput
	createCustomErr     error
	customConfirmed     ports.CreateCustomOrderConfirmedInput
	customDiscardCalled bool
	customDiscardOrder  common.ID
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

func (f *fakeOrders) CreateCustomOrder(_ context.Context, _ common.TenantScope, input ports.CreateCustomOrderInput) error {
	f.customCreated = input
	return f.createCustomErr
}

func (f *fakeOrders) CreateCustomOrderConfirmed(_ context.Context, _ common.TenantScope, input ports.CreateCustomOrderConfirmedInput) error {
	f.customConfirmed = input
	return nil
}

func (f *fakeOrders) DiscardCustomDraftOrder(_ context.Context, _ common.TenantScope, orderID, customerID common.ID) error {
	f.customDiscardCalled = true
	f.customDiscardOrder = orderID
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

func (f *fakeOrders) SetAgreedTotal(context.Context, common.TenantScope, common.ID, int64) error {
	return nil
}

func (f *fakeOrders) GetOrderBilling(context.Context, common.TenantScope, common.ID) (ports.OrderBilling, error) {
	return ports.OrderBilling{}, nil
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
