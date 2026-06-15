package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Real-Postgres coverage for home-visit bookings: the atomic no-double-book
// guarantee, the booking-deposit webhook (confirm both / release on failure),
// and compensation. Run as xtiitch_app; skipped without XTIITCH_TEST_DATABASE_URL.

const (
	bkBiz      = "66666666-6666-6666-6666-666666666666"
	bkBizOther = "77777777-7777-7777-7777-777777777777"
	bkDesign   = "dddddddd-0000-0000-0000-000000000061"
	bkStage    = "55555555-0000-0000-0000-000000000061"
)

func bkScope() common.TenantScope { return common.TenantScope{BusinessID: common.ID(bkBiz)} }

func uuidN(prefix string, i int) string {
	return fmt.Sprintf("%s%012x", prefix, i)
}

func seedBookingBase(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupBookingFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []string{bkBiz, bkBizOther} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Visit', $3, 'verified')
			`, biz, planID, "it-visit-"+biz[:8])
			mustExec(t, tx, `insert into store_settings (business_id) values ($1)`, biz)
		}
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'IT Visit Design', 'it-visit-design', 'active')
		`, bkDesign, bkBiz)
		mustExec(t, tx, `
			insert into stage_templates (stage_id, business_id, name, colour, flow, sequence)
			values ($1, $2, 'Order received', 'red', 'bespoke', 1)
		`, bkStage, bkBiz)
	})
}

func cleanupBookingFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference like 'xt_bk_%'`)
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{bkBiz, bkBizOther})
		mustExec(t, tx, `delete from customers where display_name = 'IT Visit Customer'`)
	})
}

// seedDraftHomeVisitOrder creates a customer and a draft home_visit order so a
// booking can reference it (the bookings -> orders composite FK).
func seedDraftHomeVisitOrder(t *testing.T, pool *pgxpool.Pool, businessID, orderID, customerID string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `insert into customers (customer_id, display_name, email) values ($1, 'IT Visit Customer', 'v@example.com')`, customerID)
		mustExec(t, tx, `
			insert into orders (order_id, business_id, customer_id, design_id, size_band_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status)
			values ($1, $2, $3, $4, null, 'custom', 'home_visit', 'bespoke', 'online', null, 0, 'draft')
		`, orderID, businessID, customerID, bkDesign)
	})
}

func bkReadBooking(t *testing.T, pool *pgxpool.Pool, bookingID string) (status string, depositSet bool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(),
			`select status, deposit_payment_id is not null from bookings where booking_id = $1`,
			bookingID).Scan(&status, &depositSet); err != nil {
			t.Fatalf("read booking: %v", err)
		}
	})
	return
}

func bkActiveCountForSlot(t *testing.T, pool *pgxpool.Pool, slot time.Time) int {
	return countBypass(t, pool, `select count(*) from bookings where business_id = $1 and slot_start = $2 and status in ('held','booked')`, bkBiz, slot)
}

// TestHoldSlotIsRaceProof: many concurrent holds of the same slot — exactly one
// wins, the rest get ErrSlotTaken, and only one active booking exists.
func TestHoldSlotIsRaceProof(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedBookingBase(t, pool)
	defer cleanupBookingFixtures(t, pool)

	ctx := context.Background()
	repo := NewBookingRepository(pool)
	slot := time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)
	const n = 8

	for i := 0; i < n; i++ {
		seedDraftHomeVisitOrder(t, pool, bkBiz, uuidN("aaaaaaaa-0000-0000-0000-", i), uuidN("cccccccc-0000-0000-0000-", i))
	}

	results := make([]error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i] = repo.HoldSlot(ctx, bkScope(), ports.HoldSlotInput{
				BookingID:  common.ID(uuidN("bbbbbbbb-0000-0000-0000-", i)),
				BusinessID: common.ID(bkBiz),
				CustomerID: common.ID(uuidN("cccccccc-0000-0000-0000-", i)),
				OrderID:    common.ID(uuidN("aaaaaaaa-0000-0000-0000-", i)),
				SlotStart:  slot,
				SlotEnd:    slot.Add(time.Hour),
			})
		}(i)
	}
	wg.Wait()

	wins, taken, other := 0, 0, 0
	for _, err := range results {
		switch {
		case err == nil:
			wins++
		case errors.Is(err, ports.ErrSlotTaken):
			taken++
		default:
			other++
		}
	}
	if wins != 1 || taken != n-1 || other != 0 {
		t.Fatalf("expected exactly one winner, got wins=%d taken=%d other=%d", wins, taken, other)
	}
	if active := bkActiveCountForSlot(t, pool, slot); active != 1 {
		t.Fatalf("expected exactly one active booking for the slot, got %d", active)
	}
}

// TestBookingDepositConfirmsBookingAndOrder: a booking-deposit success books the
// held slot and confirms its draft order, idempotently.
func TestBookingDepositConfirmsBookingAndOrder(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedBookingBase(t, pool)
	defer cleanupBookingFixtures(t, pool)

	ctx := context.Background()
	orderID := uuidN("aaaaaaaa-0000-0000-0000-", 100)
	customerID := uuidN("cccccccc-0000-0000-0000-", 100)
	bookingID := uuidN("bbbbbbbb-0000-0000-0000-", 100)
	slot := time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC)

	seedDraftHomeVisitOrder(t, pool, bkBiz, orderID, customerID)
	if err := NewBookingRepository(pool).HoldSlot(ctx, bkScope(), ports.HoldSlotInput{
		BookingID: common.ID(bookingID), BusinessID: common.ID(bkBiz), CustomerID: common.ID(customerID),
		OrderID: common.ID(orderID), SlotStart: slot, SlotEnd: slot.Add(time.Hour),
	}); err != nil {
		t.Fatalf("hold slot: %v", err)
	}
	insertBookingDeposit(t, pool, orderID, bookingID, "xt_bk_ok", 15000)

	event := ports.ConfirmPaymentInput{
		EventSignature: "bk_ok_evt", EventType: "charge.success", ProviderReference: "xt_bk_ok", Succeeded: true,
	}
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, event); err != nil {
		t.Fatalf("confirm: %v", err)
	}

	status, depositSet := bkReadBooking(t, pool, bookingID)
	if status != "booked" || !depositSet {
		t.Fatalf("expected booked booking with deposit recorded, got status=%q depositSet=%v", status, depositSet)
	}
	if orderStatus, settled, _, seq, colour := readConfirmedStage(t, pool, common.ID(orderID)); orderStatus != "confirmed" || settled != 15000 || seq != 1 || colour != "red" {
		t.Fatalf("expected order confirmed at first bespoke stage with deposit, got status=%q settled=%d seq=%d colour=%q", orderStatus, settled, seq, colour)
	}

	// Idempotent re-delivery.
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, event); err != nil {
		t.Fatalf("redeliver: %v", err)
	}
	if s, _ := bkReadBooking(t, pool, bookingID); s != "booked" {
		t.Fatalf("redelivery changed booking to %q", s)
	}
}

// TestBookingDepositFailureReleasesSlot: a failed booking deposit cancels the
// held booking and its draft order, freeing the slot for a new hold.
func TestBookingDepositFailureReleasesSlot(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedBookingBase(t, pool)
	defer cleanupBookingFixtures(t, pool)

	ctx := context.Background()
	orderID := uuidN("aaaaaaaa-0000-0000-0000-", 200)
	customerID := uuidN("cccccccc-0000-0000-0000-", 200)
	bookingID := uuidN("bbbbbbbb-0000-0000-0000-", 200)
	slot := time.Date(2026, 7, 3, 10, 0, 0, 0, time.UTC)

	seedDraftHomeVisitOrder(t, pool, bkBiz, orderID, customerID)
	repo := NewBookingRepository(pool)
	if err := repo.HoldSlot(ctx, bkScope(), ports.HoldSlotInput{
		BookingID: common.ID(bookingID), BusinessID: common.ID(bkBiz), CustomerID: common.ID(customerID),
		OrderID: common.ID(orderID), SlotStart: slot, SlotEnd: slot.Add(time.Hour),
	}); err != nil {
		t.Fatalf("hold: %v", err)
	}
	insertBookingDeposit(t, pool, orderID, bookingID, "xt_bk_fail", 15000)

	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "bk_fail_evt", EventType: "charge.failed", ProviderReference: "xt_bk_fail", Succeeded: false,
	}); err != nil {
		t.Fatalf("confirm failure: %v", err)
	}

	if status, _ := bkReadBooking(t, pool, bookingID); status != "cancelled" {
		t.Fatalf("expected booking cancelled on failed deposit, got %q", status)
	}
	if bkActiveCountForSlot(t, pool, slot) != 0 {
		t.Fatal("the slot should be free after release")
	}
	// The freed slot can be held again.
	seedDraftHomeVisitOrder(t, pool, bkBiz, uuidN("aaaaaaaa-0000-0000-0000-", 201), uuidN("cccccccc-0000-0000-0000-", 201))
	if err := repo.HoldSlot(ctx, bkScope(), ports.HoldSlotInput{
		BookingID: common.ID(uuidN("bbbbbbbb-0000-0000-0000-", 201)), BusinessID: common.ID(bkBiz),
		CustomerID: common.ID(uuidN("cccccccc-0000-0000-0000-", 201)), OrderID: common.ID(uuidN("aaaaaaaa-0000-0000-0000-", 201)),
		SlotStart: slot, SlotEnd: slot.Add(time.Hour),
	}); err != nil {
		t.Fatalf("expected the released slot to be re-holdable, got %v", err)
	}
}

func TestDiscardHeldBookingRemovesEverything(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedBookingBase(t, pool)
	defer cleanupBookingFixtures(t, pool)

	ctx := context.Background()
	orderID := uuidN("aaaaaaaa-0000-0000-0000-", 300)
	customerID := uuidN("cccccccc-0000-0000-0000-", 300)
	bookingID := uuidN("bbbbbbbb-0000-0000-0000-", 300)
	slot := time.Date(2026, 7, 4, 10, 0, 0, 0, time.UTC)

	seedDraftHomeVisitOrder(t, pool, bkBiz, orderID, customerID)
	repo := NewBookingRepository(pool)
	if err := repo.HoldSlot(ctx, bkScope(), ports.HoldSlotInput{
		BookingID: common.ID(bookingID), BusinessID: common.ID(bkBiz), CustomerID: common.ID(customerID),
		OrderID: common.ID(orderID), SlotStart: slot, SlotEnd: slot.Add(time.Hour),
	}); err != nil {
		t.Fatalf("hold: %v", err)
	}
	if err := repo.DiscardHeldBooking(ctx, bkScope(), common.ID(bookingID), common.ID(orderID), common.ID(customerID)); err != nil {
		t.Fatalf("discard: %v", err)
	}
	if countBypass(t, pool, `select count(*) from bookings where booking_id = $1`, bookingID) != 0 {
		t.Fatal("booking should be gone")
	}
	if orderExists(t, pool, common.ID(orderID)) {
		t.Fatal("order should be gone")
	}
	if customerExists(t, pool, common.ID(customerID)) {
		t.Fatal("customer should be gone")
	}
}

func TestBookingCrossTenantOrderRejected(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedBookingBase(t, pool)
	defer cleanupBookingFixtures(t, pool)

	ctx := context.Background()
	// An order belonging to business A.
	orderID := uuidN("aaaaaaaa-0000-0000-0000-", 400)
	customerID := uuidN("cccccccc-0000-0000-0000-", 400)
	seedDraftHomeVisitOrder(t, pool, bkBiz, orderID, customerID)

	// Business B tries to hold a slot bound to A's order — the composite FK rejects it.
	err := NewBookingRepository(pool).HoldSlot(ctx, common.TenantScope{BusinessID: common.ID(bkBizOther)}, ports.HoldSlotInput{
		BookingID: common.ID(uuidN("bbbbbbbb-0000-0000-0000-", 400)), BusinessID: common.ID(bkBizOther),
		CustomerID: common.ID(customerID), OrderID: common.ID(orderID),
		SlotStart: time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC), SlotEnd: time.Date(2026, 7, 5, 11, 0, 0, 0, time.UTC),
	})
	if err == nil {
		t.Fatal("expected a cross-tenant booking to be rejected")
	}
}

// TestStaleHoldIsReclaimable: an abandoned hold past its TTL is ignored by
// availability and reclaimed (cancelled with its order) by the next hold, so the
// slot is never permanently dead.
func TestStaleHoldIsReclaimable(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedBookingBase(t, pool)
	defer cleanupBookingFixtures(t, pool)

	ctx := context.Background()
	slot := time.Date(2026, 7, 6, 10, 0, 0, 0, time.UTC)
	staleOrder := uuidN("aaaaaaaa-0000-0000-0000-", 500)
	staleCustomer := uuidN("cccccccc-0000-0000-0000-", 500)
	staleBooking := uuidN("bbbbbbbb-0000-0000-0000-", 500)

	seedDraftHomeVisitOrder(t, pool, bkBiz, staleOrder, staleCustomer)
	// Insert a held booking created over an hour ago (past the 30-minute TTL).
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into bookings (booking_id, business_id, customer_id, order_id, slot_start, slot_end, status, created_at)
			values ($1, $2, $3, $4, $5, $6, 'held', now() - interval '1 hour')
		`, staleBooking, bkBiz, staleCustomer, staleOrder, slot, slot.Add(time.Hour))
	})

	// Availability ignores the stale hold (the slot is offerable again).
	taken, err := NewAvailabilityRepository(pool).ListTakenSlots(ctx, bkScope(), slot.Add(-time.Hour), slot.Add(time.Hour))
	if err != nil {
		t.Fatalf("list taken: %v", err)
	}
	for _, s := range taken {
		if s.Equal(slot) {
			t.Fatal("a stale held slot must not count as taken")
		}
	}

	// A new hold reclaims the stale one (cancels it + its order) and succeeds.
	freshOrder := uuidN("aaaaaaaa-0000-0000-0000-", 501)
	freshCustomer := uuidN("cccccccc-0000-0000-0000-", 501)
	seedDraftHomeVisitOrder(t, pool, bkBiz, freshOrder, freshCustomer)
	if err := NewBookingRepository(pool).HoldSlot(ctx, bkScope(), ports.HoldSlotInput{
		BookingID: common.ID(uuidN("bbbbbbbb-0000-0000-0000-", 501)), BusinessID: common.ID(bkBiz),
		CustomerID: common.ID(freshCustomer), OrderID: common.ID(freshOrder),
		SlotStart: slot, SlotEnd: slot.Add(time.Hour),
	}); err != nil {
		t.Fatalf("a stale-held slot should be re-holdable, got %v", err)
	}

	if status, _ := bkReadBooking(t, pool, staleBooking); status != "cancelled" {
		t.Fatalf("stale booking should be reclaimed (cancelled), got %q", status)
	}
	if !orderExists(t, pool, common.ID(staleOrder)) {
		t.Fatal("stale order row should still exist (cancelled, not deleted)")
	}
	if bkActiveCountForSlot(t, pool, slot) != 1 {
		t.Fatal("exactly the new booking should be active for the slot")
	}
}

func insertBookingDeposit(t *testing.T, pool *pgxpool.Pool, orderID, bookingID, reference string, amount int64) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, order_id, booking_id, purpose, amount_minor,
				currency, provider_reference, status, through_platform, commission_minor)
			values (gen_random_uuid(), $1, $2, $3, 'booking_deposit', $4, 'GHS', $5, 'initiated', true, 150)
		`, bkBiz, orderID, bookingID, amount, reference)
	})
}
