package checkoutapp

import (
	"context"
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
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
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
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
	}
}
func customStore() ports.Storefront {
	return ports.Storefront{
		BusinessID:            testBusinessID,
		DefaultDepositMinor:   15000,
		OnlineOrderingEnabled: true,
		Settings:              ports.StoreSettings{BespokeEnabled: true, MeasurementsEnabled: true},
	}
}

func customDesign() ports.StorefrontDesign {
	return ports.StorefrontDesign{Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID}}
}

func verifiedCharge() ports.BusinessChargeContext {
	return ports.BusinessChargeContext{BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1", CommissionBps: 300}
}

func customService(
	orders ports.OrderRepository,
	payments Payments,
	store ports.Storefront,
	design ports.StorefrontDesign,
	charge ports.BusinessChargeContext,
	ids []common.ID,
) Service {
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

func bookingService(
	orders ports.OrderRepository,
	bookings ports.BookingRepository,
	availability Availability,
	payments Payments,
	ids []common.ID,
) Service {
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

func (f fakeStorefront) ListPublicShops(context.Context) ([]ports.PublicShop, error) {
	return nil, nil
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

func (f fakeCharge) ProvisionSubaccount(context.Context, ports.ProvisionSubaccountInput) error {
	return nil
}

type fakeOrders struct {
	created              ports.CreateOnlineOrderInput
	createdGroup         []ports.CreateOnlineOrderInput
	createGroupErr       error
	discardGroupCalled   bool
	discardGroupID       common.ID
	discardGroupCustomer common.ID
	discardCalled        bool
	discardOrder         common.ID
	discardCustomer      common.ID
	draftTotalSet        bool
	draftTotalOrder      common.ID
	draftTotal           int64
	customCreated        ports.CreateCustomOrderInput
	customGroup          []ports.CreateCustomOrderInput
	createCustomErr      error
	customConfirmed      ports.CreateCustomOrderConfirmedInput
	customDiscardCalled  bool
	customDiscardOrder   common.ID
	resolveErr           error
	resolvePhone         string
}

func (f *fakeOrders) CreateWalkInOrder(context.Context, common.TenantScope, ports.CreateWalkInOrderInput) error {
	return nil
}

func (f *fakeOrders) CreateOnlineOrder(_ context.Context, _ common.TenantScope, input ports.CreateOnlineOrderInput) error {
	f.created = input
	return nil
}

// fakeDeliveryZones is a minimal DeliveryZoneRepository for checkout tests: it
// resolves one configured zone by id.
type fakeDeliveryZones struct {
	zone     ports.DeliveryZone
	getErr   error
	getCalls int
}

func (f *fakeDeliveryZones) ListDeliveryZones(_ context.Context, _ common.TenantScope) ([]ports.DeliveryZone, error) {
	return []ports.DeliveryZone{f.zone}, nil
}

func (f *fakeDeliveryZones) ListActiveDeliveryZones(_ context.Context, _ common.TenantScope) ([]ports.DeliveryZone, error) {
	return []ports.DeliveryZone{f.zone}, nil
}

func (f *fakeDeliveryZones) CreateDeliveryZone(_ context.Context, _ common.TenantScope, _ ports.CreateDeliveryZoneInput) error {
	return nil
}

func (f *fakeDeliveryZones) UpdateDeliveryZone(_ context.Context, _ common.TenantScope, _ ports.UpdateDeliveryZoneInput) error {
	return nil
}

func (f *fakeDeliveryZones) DeleteDeliveryZone(_ context.Context, _ common.TenantScope, _ common.ID) error {
	return nil
}

func (f *fakeDeliveryZones) GetDeliveryZone(_ context.Context, _ common.TenantScope, zoneID common.ID) (ports.DeliveryZone, error) {
	f.getCalls++
	if f.getErr != nil {
		return ports.DeliveryZone{}, f.getErr
	}
	if f.zone.ID != zoneID {
		return ports.DeliveryZone{}, ports.ErrNotFound
	}
	return f.zone, nil
}

func (f *fakeOrders) CreateOnlineOrderGroup(_ context.Context, _ common.TenantScope, inputs []ports.CreateOnlineOrderInput) error {
	if f.createGroupErr != nil {
		return f.createGroupErr
	}
	f.createdGroup = inputs
	return nil
}

func (f *fakeOrders) DiscardDraftOrderGroup(_ context.Context, _ common.TenantScope, groupID, customerID common.ID) error {
	f.discardGroupCalled = true
	f.discardGroupID = groupID
	f.discardGroupCustomer = customerID
	return nil
}

func (f *fakeOrders) FindCustomerIDByPhone(_ context.Context, _ string) (common.ID, bool, error) {
	return "", false, nil
}

func (f *fakeOrders) ResolveOrCreateCustomerByPhone(_ context.Context, phone string, newID common.ID) (common.ID, bool, error) {
	f.resolvePhone = phone
	if f.resolveErr != nil {
		return "", false, f.resolveErr
	}
	return newID, true, nil
}

func (f *fakeOrders) DiscardDraftOrder(_ context.Context, _ common.TenantScope, orderID, customerID common.ID) error {
	f.discardCalled = true
	f.discardOrder = orderID
	f.discardCustomer = customerID
	return nil
}

func (f *fakeOrders) SetDraftOrderAgreedTotal(_ context.Context, _ common.TenantScope, orderID common.ID, agreedTotalMinor int64) error {
	f.draftTotalSet = true
	f.draftTotalOrder = orderID
	f.draftTotal = agreedTotalMinor
	return nil
}

func (f *fakeOrders) CreateCustomOrder(_ context.Context, _ common.TenantScope, input ports.CreateCustomOrderInput) error {
	if f.createCustomErr != nil {
		return f.createCustomErr
	}
	f.customCreated = input
	f.customGroup = append(f.customGroup, input)
	return nil
}

func (f *fakeOrders) CreateCustomOrderConfirmed(
	_ context.Context,
	_ common.TenantScope,
	input ports.CreateCustomOrderConfirmedInput,
) error {
	f.customConfirmed = input
	return nil
}

func (f *fakeOrders) DiscardCustomDraftOrder(_ context.Context, _ common.TenantScope, orderID, _ common.ID) error {
	f.customDiscardCalled = true
	f.customDiscardOrder = orderID
	return nil
}

func (f *fakeOrders) ListOrders(context.Context, common.TenantScope) ([]ports.OrderSummary, error) {
	return nil, nil
}

func (f *fakeOrders) ListStageTemplates(context.Context, common.TenantScope) ([]ports.StageTemplate, error) {
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
	result       paymentsapp.ChargeResult
	err          error
	called       bool
	command      paymentsapp.InitiateChargeCommand
	quote        money.StoreSaleQuote
	quoteErr     error
	quoteCommand paymentsapp.QuoteStoreSaleCommand
	quoteCalled  bool
}

func (f *fakePayments) InitiateCharge(_ context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error) {
	f.called = true
	f.command = command
	return f.result, f.err
}

func (f *fakePayments) QuoteStoreSale(_ context.Context, command paymentsapp.QuoteStoreSaleCommand) (money.StoreSaleQuote, error) {
	f.quoteCalled = true
	f.quoteCommand = command
	return f.quote, f.quoteErr
}

type fakePromotions struct {
	redemption ports.PromotionRedemption
	err        error
	reserve    ports.ReservePromotionInput
	voidCalled bool
	voidOrder  common.ID
}

func (f *fakePromotions) ListBusinessPromotions(context.Context, common.TenantScope) ([]ports.BusinessPromotionRecord, error) {
	return nil, nil
}

func (f *fakePromotions) CreateBusinessPromotion(
	context.Context,
	common.TenantScope,
	ports.BusinessPromotionInput) (ports.BusinessPromotionRecord,
	error,
) {
	return ports.BusinessPromotionRecord{}, nil
}

func (f *fakePromotions) UpdateBusinessPromotion(
	context.Context,
	common.TenantScope,
	ports.BusinessPromotionInput) (ports.BusinessPromotionRecord,
	error,
) {
	return ports.BusinessPromotionRecord{}, nil
}

func (f *fakePromotions) ArchiveBusinessPromotion(context.Context, common.TenantScope, common.ID) (ports.BusinessPromotionRecord, error) {
	return ports.BusinessPromotionRecord{}, nil
}

func (f *fakePromotions) ReservePromotion(
	_ context.Context,
	_ common.TenantScope,
	input ports.ReservePromotionInput) (ports.PromotionRedemption,
	error,
) {
	f.reserve = input
	if f.err != nil {
		return ports.PromotionRedemption{}, f.err
	}
	redemption := f.redemption
	redemption.RedemptionID = input.RedemptionID
	redemption.BusinessID = input.BusinessID
	redemption.OrderID = input.OrderID
	redemption.CustomerID = input.CustomerID
	redemption.SubtotalMinor = input.SubtotalMinor
	return redemption, nil
}

func (f *fakePromotions) VoidPendingPromotionRedemptions(_ context.Context, _ common.TenantScope, orderID common.ID) error {
	f.voidCalled = true
	f.voidOrder = orderID
	return nil
}

type fakeAffiliates struct {
	reserveCalled bool
	reserve       ports.ReserveAffiliateAttributionInput
	err           error
}

func (f *fakeAffiliates) RecordAffiliateClick(context.Context, ports.RecordAffiliateClickInput) (ports.AffiliateClickRecord, error) {
	return ports.AffiliateClickRecord{}, nil
}

func (f *fakeAffiliates) ReserveAffiliateAttribution(
	_ context.Context,
	_ common.TenantScope,
	input ports.ReserveAffiliateAttributionInput) (ports.AffiliateAttributionReservation,
	error,
) {
	f.reserveCalled = true
	f.reserve = input
	if f.err != nil {
		return ports.AffiliateAttributionReservation{}, f.err
	}
	return ports.AffiliateAttributionReservation{
		ReservationID:   input.ReservationID,
		AffiliateID:     "affiliate-1",
		BusinessID:      input.BusinessID,
		OrderID:         input.OrderID,
		GrossMinor:      input.GrossMinor,
		CommissionMinor: 5000,
	}, nil
}

type fakeReferrals struct {
	reserveCalled bool
	reserve       ports.ReserveReferralAttributionInput
	err           error
}

func (f *fakeReferrals) ResolveReferralCode(context.Context, ports.ResolveReferralCodeInput) (ports.ReferralCodeRecord, error) {
	return ports.ReferralCodeRecord{}, nil
}

func (f *fakeReferrals) ReserveReferralAttribution(
	_ context.Context,
	_ common.TenantScope,
	input ports.ReserveReferralAttributionInput) (ports.ReferralAttributionReservation,
	error,
) {
	f.reserveCalled = true
	f.reserve = input
	if f.err != nil {
		return ports.ReferralAttributionReservation{}, f.err
	}
	return ports.ReferralAttributionReservation{
		ReferralID:          input.ReferralID,
		ReferralProgrammeID: "programme-1",
		ReferralCodeID:      "code-1",
		BusinessID:          input.BusinessID,
		OrderID:             input.OrderID,
		RefereeCustomerID:   input.RefereeCustomerID,
		GrossMinor:          input.GrossMinor,
		Status:              "pending",
	}, nil
}

type seqIDs struct {
	ids []common.ID
}

func (s *seqIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
