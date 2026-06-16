package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// Real-Postgres coverage for the transactional notification outbox: a lifecycle
// state change enqueues exactly one deduplicated message, in the same
// transaction, and a business reads only its own log. Reuses the confirm
// fixtures; run as xtiitch_app; skipped without XTIITCH_TEST_DATABASE_URL.

func giveCustomerPhone(t *testing.T, pool *pgxpool.Pool, phone string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update customers set phone = $2 where customer_id = $1`, itCustA, phone)
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
	if recipient != "0241234567" || kind != "order_confirmed" || status != "pending" || channel != "whatsapp" {
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
