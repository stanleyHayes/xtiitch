package checkoutapp

import (
	"context"
	"errors"
	"strings"
	"time"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

type PlaceHomeVisitBookingCommand struct {
	StoreHandle        string
	DesignHandle       string
	CustomerName       string
	CustomerPhone      string
	CustomerWhatsApp   string
	CustomerEmail      string
	Method             money.PaymentMethod
	PromoCode          string
	AffiliateCode      string
	AffiliateClickID   common.ID
	AffiliateVisitorID string
	ReferralCode       string
	SlotStart          time.Time
	Address            string
	// Note is the customer's free-text instruction captured at checkout ('' if none).
	Note string
}

type PlaceHomeVisitBookingResult struct {
	OrderID          common.ID
	BookingID        common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
}

// PlaceHomeVisitBooking books a home visit against one of the business's open
// availability slots: it holds the slot atomically, records a draft bespoke
// order for the visit, and raises the booking deposit. The slot stays held and
// the order draft until the deposit webhook confirms both; a failed or
// un-raiseable deposit releases the slot. This is an additive flow — the
// existing custom-order endpoint is untouched.
func (s Service) PlaceHomeVisitBooking(ctx context.Context, cmd PlaceHomeVisitBookingCommand) (PlaceHomeVisitBookingResult, error) {
	customer := customerDetails{
		name:     strings.TrimSpace(cmd.CustomerName),
		phone:    strings.TrimSpace(cmd.CustomerPhone),
		whatsapp: strings.TrimSpace(cmd.CustomerWhatsApp),
		email:    strings.TrimSpace(cmd.CustomerEmail),
	}
	if customer.name == "" || customer.email == "" || cmd.SlotStart.IsZero() {
		return PlaceHomeVisitBookingResult{}, ErrInvalidInput
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return PlaceHomeVisitBookingResult{}, ErrInvalidInput
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return PlaceHomeVisitBookingResult{}, ErrStoreNotFound
		}
		return PlaceHomeVisitBookingResult{}, err
	}
	if !store.OnlineOrderingEnabled {
		return PlaceHomeVisitBookingResult{}, ErrOnlineOrderingOff
	}
	scope := common.TenantScope{BusinessID: store.BusinessID}

	design, err := s.resolveCustomDesign(ctx, store, cmd.DesignHandle, order.SizeModeHomeVisit)
	if err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}

	charge, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}
	if !charge.Verified || charge.SubaccountRef == "" {
		return PlaceHomeVisitBookingResult{}, ErrNotVerified
	}

	slot, err := s.availability.ResolveOpenSlot(ctx, scope, cmd.SlotStart)
	if err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}

	return s.holdAndCharge(ctx, scope, store, design, slot, customer, cmd)
}

func (s Service) holdAndCharge(ctx context.Context, scope common.TenantScope, store ports.Storefront, design catalogue.Design, slot booking.Slot, customer customerDetails, cmd PlaceHomeVisitBookingCommand) (PlaceHomeVisitBookingResult, error) {
	deposit := money.ResolveDeposit(design.DepositOverrideMinor, &store.DefaultDepositMinor)

	orderID := s.ids.NewID()
	customerID, customerCreated := s.resolveCustomerByPhone(ctx, customer.phone)
	cleanupCustomerID := common.ID("")
	if customerCreated {
		cleanupCustomerID = customerID
	}
	bookingID := s.ids.NewID()

	if err := s.orders.CreateCustomOrder(ctx, scope, ports.CreateCustomOrderInput{
		OrderID:          orderID,
		BusinessID:       store.BusinessID,
		CustomerID:       customerID,
		DesignID:         design.ID,
		SizeMode:         string(order.SizeModeHomeVisit),
		CustomerName:     customer.name,
		CustomerPhone:    customer.phone,
		CustomerWhatsApp: customer.whatsapp,
		CustomerEmail:    customer.email,
		Note:             strings.TrimSpace(cmd.Note),
	}); err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}

	if err := s.bookings.HoldSlot(ctx, scope, ports.HoldSlotInput{
		BookingID:  bookingID,
		BusinessID: store.BusinessID,
		CustomerID: customerID,
		OrderID:    orderID,
		SlotStart:  slot.Start,
		SlotEnd:    slot.End,
		Address:    strings.TrimSpace(cmd.Address),
	}); err != nil {
		s.discardBooking(ctx, scope, bookingID, orderID, cleanupCustomerID)
		return PlaceHomeVisitBookingResult{}, err
	}
	s.reserveAffiliateAttribution(ctx, scope, affiliateCheckoutInput{
		code:       cmd.AffiliateCode,
		clickID:    cmd.AffiliateClickID,
		visitorID:  cmd.AffiliateVisitorID,
		orderID:    orderID,
		grossMinor: deposit,
	})
	s.reserveReferralAttribution(ctx, scope, referralCheckoutInput{
		code:              cmd.ReferralCode,
		orderID:           orderID,
		refereeCustomerID: customerID,
		refereeEmail:      customer.email,
		refereePhone:      customer.phone,
		grossMinor:        deposit,
	})

	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	chargeResult, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:         scope,
		OrderID:       &orderID,
		BookingID:     &bookingID,
		Purpose:       money.PaymentPurposeBookingDeposit,
		AmountMinor:   deposit,
		Method:        method,
		CustomerEmail: customer.email,
	})
	if err != nil {
		s.discardBooking(ctx, scope, bookingID, orderID, cleanupCustomerID)
		return PlaceHomeVisitBookingResult{}, err
	}

	return PlaceHomeVisitBookingResult{
		OrderID:          orderID,
		BookingID:        bookingID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      deposit,
	}, nil
}

func (s Service) discardBooking(ctx context.Context, scope common.TenantScope, bookingID, orderID, customerID common.ID) {
	if err := s.bookings.DiscardHeldBooking(ctx, scope, bookingID, orderID, customerID); err != nil {
		s.logger.ErrorContext(ctx, "checkout: failed to discard held booking after a failed deposit",
			"business_id", scope.BusinessID.String(), "booking_id", bookingID.String(), "order_id", orderID.String(), "error", err)
	}
}
