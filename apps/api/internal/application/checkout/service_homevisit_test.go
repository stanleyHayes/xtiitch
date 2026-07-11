package checkoutapp

import (
	"context"
	"errors"
	"testing"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

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
