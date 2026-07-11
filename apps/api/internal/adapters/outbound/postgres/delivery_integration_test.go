package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
)

// Real-Postgres coverage for fulfilment handovers: the fulfilled-order gate, the
// one-open-handover-per-order guarantee, guarded status transitions (with the
// pickup-never-dispatched DB check), cancel freeing the order for a fresh
// handover, the tenant-scoped queue, and cross-tenant rejection. Run as
// xtiitch_app; skipped without XTIITCH_TEST_DATABASE_URL.

const (
	dlBiz      = "88888888-8888-8888-8888-888888888888"
	dlBizOther = "99999999-9999-9999-9999-999999999999"
	dlDesign   = "dddddddd-1111-0000-0000-000000000061"
)

// Distinct uuid prefixes from the booking suite: the orders PK is global, so a
// shared prefix could collide across test files.
func dlOrder(i int) string    { return uuidN("a1110000-0000-0000-0000-", i) }
func dlCustomer(i int) string { return uuidN("c1110000-0000-0000-0000-", i) }
func dlHandover(i int) string { return uuidN("d1110000-0000-0000-0000-", i) }

func dlScope() common.TenantScope { return common.TenantScope{BusinessID: common.ID(dlBiz)} }

func seedDeliveryBase(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupDeliveryFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []string{dlBiz, dlBizOther} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Handover', $3, 'verified')
			`, biz, planID, "it-handover-"+biz[:8])
			mustExec(t, tx, `insert into store_settings (business_id) values ($1)`, biz)
		}
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'IT Handover Design', 'it-handover-design', 'active')
		`, dlDesign, dlBiz)
	})
}

func cleanupDeliveryFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{dlBiz, dlBizOther})
		mustExec(t, tx, `delete from customers where display_name = 'IT Handover Customer'`)
	})
}

// seedOrder creates a customer and an order with the given status so a handover
// can reference it (the handovers -> orders composite FK).
//
//nolint:unparam // test helper uses fixed business across current cases
func seedOrder(t *testing.T, pool *pgxpool.Pool, businessID, orderID, customerID, status string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into customers (customer_id, display_name, phone, email)
			values ($1, 'IT Handover Customer', '0240000000', 'h@example.com')
		`, customerID)
		mustExec(t, tx, `
			insert into orders (order_id, business_id, customer_id, design_id, size_band_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status)
			values ($1, $2, $3, $4, null, 'standard', 'band', 'ready_made', 'online', null, 0, $5)
		`, orderID, businessID, customerID, dlDesign, status)
	})
}

func dlStatus(t *testing.T, pool *pgxpool.Pool, handoverID string) string {
	t.Helper()
	var status string
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `select status from handovers where handover_id = $1`, handoverID).Scan(&status); err != nil {
			t.Fatalf("read handover status: %v", err)
		}
	})
	return status
}

func dlOpenCount(t *testing.T, pool *pgxpool.Pool, orderID string) int {
	return countBypass(t, pool, `select count(*) from handovers where order_id = $1 and status in ('pending', 'dispatched')`, orderID)
}

func TestArrangeHandoverRequiresFulfilledOrder(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	repo := NewDeliveryRepository(pool)

	// A still-in-production (confirmed) order cannot be handed over yet.
	pending := dlOrder(1)
	seedOrder(t, pool, dlBiz, pending, dlCustomer(1), "confirmed")
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(1)), OrderID: common.ID(pending), Method: delivery.MethodPickup,
	}); !errors.Is(err, ports.ErrInvalidOrderState) {
		t.Fatalf("expected ErrInvalidOrderState for a non-fulfilled order, got %v", err)
	}

	// A fulfilled order can be handed over.
	done := dlOrder(2)
	seedOrder(t, pool, dlBiz, done, dlCustomer(2), "fulfilled")
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(2)), OrderID: common.ID(done), Method: delivery.MethodPickup,
	}); err != nil {
		t.Fatalf("arrange on a fulfilled order: %v", err)
	}
	if s := dlStatus(t, pool, dlHandover(2)); s != "pending" {
		t.Fatalf("a new handover should be pending, got %q", s)
	}

	// An unknown order is a clean not-found.
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(3)), OrderID: common.ID(dlOrder(999)), Method: delivery.MethodPickup,
	}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for a missing order, got %v", err)
	}
}

func TestOneOpenHandoverPerOrder(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	repo := NewDeliveryRepository(pool)
	orderID := dlOrder(10)
	seedOrder(t, pool, dlBiz, orderID, dlCustomer(10), "fulfilled")

	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(10)), OrderID: common.ID(orderID), Method: delivery.MethodPickup,
	}); err != nil {
		t.Fatalf("first arrange: %v", err)
	}
	// A second open handover for the same order is refused by the partial index.
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(11)), OrderID: common.ID(orderID), Method: delivery.MethodDelivery, Address: "12 Oxford St",
	}); !errors.Is(err, ports.ErrHandoverInProgress) {
		t.Fatalf("expected ErrHandoverInProgress for a second open handover, got %v", err)
	}
	if n := dlOpenCount(t, pool, orderID); n != 1 {
		t.Fatalf("expected exactly one open handover, got %d", n)
	}
}

func TestHandoverTransitions(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	repo := NewDeliveryRepository(pool)
	orderID := dlOrder(20)
	handoverID := dlHandover(20)
	seedOrder(t, pool, dlBiz, orderID, dlCustomer(20), "fulfilled")
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(handoverID), OrderID: common.ID(orderID), Method: delivery.MethodDelivery, Address: "12 Oxford St, Accra",
	}); err != nil {
		t.Fatalf("arrange: %v", err)
	}

	// GetHandover reports the method/status the service validates against.
	state, err := repo.GetHandover(ctx, dlScope(), common.ID(handoverID))
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if state.Method != delivery.MethodDelivery || state.Status != delivery.StatusPending {
		t.Fatalf("unexpected state: %+v", state)
	}

	// pending -> dispatched -> completed, each guarded on the prior status.
	if err := repo.SetHandoverStatus(ctx, dlScope(), ports.SetHandoverStatusInput{
		HandoverID: common.ID(handoverID), From: delivery.StatusPending, To: delivery.StatusDispatched, Courier: "DHL-99",
	}); err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if s := dlStatus(t, pool, handoverID); s != "dispatched" {
		t.Fatalf("expected dispatched, got %q", s)
	}
	if err := repo.SetHandoverStatus(ctx, dlScope(), ports.SetHandoverStatusInput{
		HandoverID: common.ID(handoverID), From: delivery.StatusDispatched, To: delivery.StatusCompleted,
	}); err != nil {
		t.Fatalf("deliver: %v", err)
	}
	if s := dlStatus(t, pool, handoverID); s != "completed" {
		t.Fatalf("expected completed, got %q", s)
	}

	// A stale from-status no longer matches: the guard leaves the row untouched
	// and reports not-found.
	if err := repo.SetHandoverStatus(ctx, dlScope(), ports.SetHandoverStatusInput{
		HandoverID: common.ID(handoverID), From: delivery.StatusPending, To: delivery.StatusCompleted,
	}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for a stale from-status, got %v", err)
	}
}

func TestPickupCannotBeDispatched(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	repo := NewDeliveryRepository(pool)
	orderID := dlOrder(30)
	handoverID := dlHandover(30)
	seedOrder(t, pool, dlBiz, orderID, dlCustomer(30), "fulfilled")
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(handoverID), OrderID: common.ID(orderID), Method: delivery.MethodPickup,
	}); err != nil {
		t.Fatalf("arrange: %v", err)
	}

	// The DB check forbids dispatching a pickup (only deliveries are dispatched).
	err := repo.SetHandoverStatus(ctx, dlScope(), ports.SetHandoverStatusInput{
		HandoverID: common.ID(handoverID), From: delivery.StatusPending, To: delivery.StatusDispatched,
	})
	if err == nil || errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected a check violation dispatching a pickup, got %v", err)
	}
	if s := dlStatus(t, pool, handoverID); s != "pending" {
		t.Fatalf("the pickup should still be pending, got %q", s)
	}
}

func TestCancelHandoverFreesOrder(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	repo := NewDeliveryRepository(pool)
	orderID := dlOrder(40)
	seedOrder(t, pool, dlBiz, orderID, dlCustomer(40), "fulfilled")
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(40)), OrderID: common.ID(orderID), Method: delivery.MethodPickup,
	}); err != nil {
		t.Fatalf("arrange: %v", err)
	}
	if err := repo.SetHandoverStatus(ctx, dlScope(), ports.SetHandoverStatusInput{
		HandoverID: common.ID(dlHandover(40)), From: delivery.StatusPending, To: delivery.StatusCancelled,
	}); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if n := dlOpenCount(t, pool, orderID); n != 0 {
		t.Fatalf("a cancelled handover must not be open, got %d", n)
	}
	// With the cancelled row out of the open index, a fresh handover is allowed.
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(41)), OrderID: common.ID(orderID), Method: delivery.MethodDelivery, Address: "New address",
	}); err != nil {
		t.Fatalf("re-arrange after cancel: %v", err)
	}
	if n := dlOpenCount(t, pool, orderID); n != 1 {
		t.Fatalf("expected the re-arranged handover to be open, got %d", n)
	}
}

func TestListHandoversReturnsTenantQueue(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	repo := NewDeliveryRepository(pool)
	orderID := dlOrder(50)
	seedOrder(t, pool, dlBiz, orderID, dlCustomer(50), "fulfilled")
	if err := repo.ArrangeHandover(ctx, dlScope(), ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(50)), OrderID: common.ID(orderID), Method: delivery.MethodDelivery,
		Address: "12 Oxford St, Accra", RecipientName: "Ama", Courier: "DHL",
	}); err != nil {
		t.Fatalf("arrange: %v", err)
	}

	handovers, err := repo.ListHandovers(ctx, dlScope())
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(handovers) != 1 {
		t.Fatalf("expected 1 handover, got %d", len(handovers))
	}
	h := handovers[0]
	if h.CustomerName != "IT Handover Customer" || h.DesignTitle != "IT Handover Design" ||
		h.Method != "delivery" || h.Status != "pending" || h.Address != "12 Oxford St, Accra" {
		t.Fatalf("unexpected handover summary: %+v", h)
	}
}

func TestHandoverCrossTenantOrderRejected(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeliveryBase(t, pool)
	defer cleanupDeliveryFixtures(t, pool)

	ctx := context.Background()
	// A fulfilled order belonging to business A.
	orderID := dlOrder(60)
	seedOrder(t, pool, dlBiz, orderID, dlCustomer(60), "fulfilled")

	// Business B cannot arrange a handover against A's order: under B's scope the
	// order is not visible, so the gate reports not-found.
	err := NewDeliveryRepository(pool).ArrangeHandover(ctx, common.TenantScope{BusinessID: common.ID(dlBizOther)}, ports.ArrangeHandoverInput{
		HandoverID: common.ID(dlHandover(60)), OrderID: common.ID(orderID), Method: delivery.MethodPickup,
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected ErrNotFound arranging a cross-tenant handover, got %v", err)
	}
}
