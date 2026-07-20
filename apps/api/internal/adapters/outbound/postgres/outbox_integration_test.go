package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// Real-Postgres coverage for the transactional notification outbox: a lifecycle
// state change enqueues exactly one deduplicated message, in the same
// transaction, and a business reads only its own log. Reuses the confirm
// fixtures; run as xtiitch_app; skipped without XTIITCH_TEST_DATABASE_URL.

func giveCustomerPhone(t *testing.T, pool *pgxpool.Pool, phone string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update customers set phone = $2 where customer_id = any($1)`,
			[]string{itCustA, itCustOK}, phone)
	})
}

// outboundRow reads the single message for a dedup key, or found=false.
func outboundRow(t *testing.T, pool *pgxpool.Pool, businessID, dedupKey string) (found bool, recipient, kind, status, channel string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		err := tx.QueryRow(context.Background(),
			`select recipient, kind, status, channel from outbound_messages where business_id = $1 and dedup_key = $2`,
			businessID, dedupKey).Scan(&recipient, &kind, &status, &channel)
		if err == nil {
			found = true
			return
		}
		if err != pgx.ErrNoRows {
			t.Fatalf("read outbound: %v", err)
		}
	})
	return
}

func outboundCount(t *testing.T, pool *pgxpool.Pool, businessID, dedupKey string) int {
	return countBypass(t, pool, `select count(*) from outbound_messages where business_id = $1 and dedup_key = $2`, businessID, dedupKey)
}

func paymentIDByReference(t *testing.T, pool *pgxpool.Pool, reference string) string {
	t.Helper()
	var paymentID string
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select payment_id::text from payments where provider_reference = $1
		`, reference).Scan(&paymentID); err != nil {
			t.Fatalf("read payment id: %v", err)
		}
	})
	return paymentID
}

func TestConfirmOrderEnqueuesNotification(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)
	giveCustomerPhone(t, pool, "0241234567")

	ctx := context.Background()
	repo := NewPaymentRepository(pool)
	dedup := notification.DedupKey(notification.KindOrderConfirmed, itOrderOK)

	if _, err := repo.ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "ob_succ_1", EventType: "charge.success", ProviderReference: itRefOK, Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm: %v", err)
	}

	found, recipient, kind, status, channel := outboundRow(t, pool, itBizA, dedup)
	if !found {
		t.Fatal("a confirmed order must enqueue an order_confirmed message")
	}
	// Order confirmations go out by SMS (the channel Ghanaian customers read;
	// enqueueOrderNotification pins notification.ChannelSMS).
	if recipient != "0241234567" || kind != "order_confirmed" || status != "pending" || channel != "sms" {
		t.Fatalf("unexpected message: recipient=%q kind=%q status=%q channel=%q", recipient, kind, status, channel)
	}

	// A redelivered webhook (new signature, same reference) does not re-confirm
	// the already-succeeded payment, so no second message is enqueued.
	if _, err := repo.ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "ob_succ_2", EventType: "charge.success", ProviderReference: itRefOK, Succeeded: true,
	}); err != nil {
		t.Fatalf("redeliver: %v", err)
	}
	if n := outboundCount(t, pool, itBizA, dedup); n != 1 {
		t.Fatalf("expected exactly one order_confirmed message, got %d", n)
	}
}

func TestFulfilledOrderEnqueuesNotification(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)
	giveCustomerPhone(t, pool, "0249999999")

	ctx := context.Background()
	// Confirm the order (it lands at the single ready-made stage), then advance:
	// with no next stage it becomes fulfilled and enqueues order_fulfilled.
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "ob_ful_1", EventType: "charge.success", ProviderReference: itRefOK, Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm: %v", err)
	}
	tracking, err := NewOrderRepository(pool).AdvanceStage(ctx, common.TenantScope{BusinessID: common.ID(itBizA)}, common.ID(itOrderOK))
	if err != nil {
		t.Fatalf("advance: %v", err)
	}
	if tracking.Status != "fulfilled" {
		t.Fatalf("expected the order to be fulfilled, got %q", tracking.Status)
	}

	dedup := notification.DedupKey(notification.KindOrderFulfilled, itOrderOK)
	found, _, kind, status, _ := outboundRow(t, pool, itBizA, dedup)
	if !found || kind != "order_fulfilled" || status != "pending" {
		t.Fatalf("a fulfilled order must enqueue an order_fulfilled message, got found=%v kind=%q status=%q", found, kind, status)
	}
}

func TestBookingDepositEnqueuesBookingNotification(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedBookingBase(t, pool)
	defer cleanupBookingFixtures(t, pool)

	ctx := context.Background()
	orderID := uuidN("aaaaaaaa-0000-0000-0000-", 900)
	customerID := uuidN("cccccccc-0000-0000-0000-", 900)
	bookingID := uuidN("bbbbbbbb-0000-0000-0000-", 900)
	slot := time.Date(2026, 7, 12, 10, 0, 0, 0, time.UTC)

	seedDraftHomeVisitOrder(t, pool, bkBiz, orderID, customerID)
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update customers set phone = '0247770000' where customer_id = $1`, customerID)
	})
	if err := NewBookingRepository(pool).HoldSlot(ctx, bkScope(), ports.HoldSlotInput{
		BookingID: common.ID(bookingID), BusinessID: common.ID(bkBiz), CustomerID: common.ID(customerID),
		OrderID: common.ID(orderID), SlotStart: slot, SlotEnd: slot.Add(time.Hour),
	}); err != nil {
		t.Fatalf("hold slot: %v", err)
	}
	insertBookingDeposit(t, pool, orderID, bookingID, "xt_bk_notify", 15000)

	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "bk_notify_evt", EventType: "charge.success", ProviderReference: "xt_bk_notify", Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm booking deposit: %v", err)
	}

	dedup := notification.DedupKey(notification.KindBookingConfirmed, bookingID)
	found, recipient, kind, status, _ := outboundRow(t, pool, bkBiz, dedup)
	if !found || recipient != "0247770000" || kind != "booking_confirmed" || status != "pending" {
		t.Fatalf("expected booking_confirmed message, got found=%v recipient=%q kind=%q status=%q", found, recipient, kind, status)
	}
}

func TestBalancePaymentEnqueuesNotification(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmedCustomOrder(t, pool, 15000)
	defer cleanupBalanceFixtures(t, pool)

	ctx := context.Background()
	if err := NewOrderRepository(pool).SetAgreedTotal(ctx, blScope(), blOrder, 50000); err != nil {
		t.Fatalf("set agreed total: %v", err)
	}
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update customers set phone = '0248880000' where customer_id = $1`, blCustomer)
	})
	insertBalancePayment(t, pool, "xt_bl_1", 35000)
	paymentID := paymentIDByReference(t, pool, "xt_bl_1")

	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "bl_notify_evt", EventType: "charge.success", ProviderReference: "xt_bl_1", Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm balance: %v", err)
	}

	dedup := notification.DedupKey(notification.KindBalancePaid, paymentID)
	found, recipient, kind, status, _ := outboundRow(t, pool, blBiz, dedup)
	if !found || recipient != "0248880000" || kind != "balance_paid" || status != "pending" {
		t.Fatalf("expected balance_paid message, got found=%v recipient=%q kind=%q status=%q", found, recipient, kind, status)
	}
}

func TestHandoverTransitionsEnqueueNotifications(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	repo := NewDeliveryRepository(pool)
	orderID := dlOrder(900)
	handoverID := dlHandover(900)
	seedOrder(t, pool, dlBiz, orderID, dlCustomer(900), "fulfilled")
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(handoverID), OrderID: common.ID(orderID), Method: delivery.MethodDelivery,
		Address: "12 Oxford St, Accra", RecipientPhone: "0249990000",
	}); err != nil {
		t.Fatalf("arrange: %v", err)
	}

	if err := repo.SetHandoverStatus(ctx, dlScope(), ports.SetHandoverStatusInput{
		HandoverID: common.ID(handoverID), From: delivery.StatusPending, To: delivery.StatusDispatched, Courier: "DHL-99",
	}); err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	dispatched := notification.DedupKey(notification.KindHandoverDispatched, handoverID)
	found, recipient, kind, status, _ := outboundRow(t, pool, dlBiz, dispatched)
	if !found || recipient != "0249990000" || kind != "handover_dispatched" || status != "pending" {
		t.Fatalf("expected handover_dispatched message, got found=%v recipient=%q kind=%q status=%q", found, recipient, kind, status)
	}

	if err := repo.SetHandoverStatus(ctx, dlScope(), ports.SetHandoverStatusInput{
		HandoverID: common.ID(handoverID), From: delivery.StatusDispatched, To: delivery.StatusCompleted,
	}); err != nil {
		t.Fatalf("complete: %v", err)
	}
	completed := notification.DedupKey(notification.KindHandoverCompleted, handoverID)
	found, recipient, kind, status, _ = outboundRow(t, pool, dlBiz, completed)
	if !found || recipient != "0249990000" || kind != "handover_completed" || status != "pending" {
		t.Fatalf("expected handover_completed message, got found=%v recipient=%q kind=%q status=%q", found, recipient, kind, status)
	}
}

func TestListMessagesIsTenantScoped(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)
	giveCustomerPhone(t, pool, "0240000000")

	ctx := context.Background()
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "ob_list_1", EventType: "charge.success", ProviderReference: itRefOK, Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm: %v", err)
	}

	repo := NewNotificationRepository(pool)
	mine, err := repo.ListMessages(ctx, common.TenantScope{BusinessID: common.ID(itBizA)})
	if err != nil {
		t.Fatalf("list A: %v", err)
	}
	if len(mine) == 0 || mine[0].Kind != "order_confirmed" {
		t.Fatalf("business A should see its own order_confirmed message, got %+v", mine)
	}

	// Business B sees none of A's messages (RLS read scoping).
	other, err := repo.ListMessages(ctx, common.TenantScope{BusinessID: common.ID(itBizB)})
	if err != nil {
		t.Fatalf("list B: %v", err)
	}
	if len(other) != 0 {
		t.Fatalf("business B must not see another tenant's messages, got %d", len(other))
	}
}
