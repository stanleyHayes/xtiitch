package postgres

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Real-Postgres coverage for custom-order balance collection (set agreed total +
// the balance webhook), run as the non-superuser xtiitch_app role. Skipped
// unless XTIITCH_TEST_DATABASE_URL points at a migrated database.

const (
	blBiz      = "55555555-5555-5555-5555-555555555555"
	blDesign   = "dddddddd-0000-0000-0000-000000000051"
	blStage    = "55555555-0000-0000-0000-000000000051"
	blCustomer = "bbbbbbbb-0000-0000-0000-000000000051"
	blOrder    = "00000000-0000-0000-0000-0000000000a5"
)

func blScope() common.TenantScope { return common.TenantScope{BusinessID: common.ID(blBiz)} }

// seedConfirmedCustomOrder seeds a confirmed bespoke order whose deposit (15000)
// is already settled and whose agreed total is not yet set.
func seedConfirmedCustomOrder(t *testing.T, pool *pgxpool.Pool, settledMinor int64) {
	t.Helper()
	cleanupBalanceFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Balance', 'it-balance', 'verified')
		`, blBiz, planID)
		mustExec(t, tx, `insert into customers (customer_id, display_name, email) values ($1, 'IT Balance Customer', 'bal@example.com')`, blCustomer)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'IT Balance Design', 'it-balance-design', 'active')
		`, blDesign, blBiz)
		mustExec(t, tx, `
			insert into stage_templates (stage_id, business_id, name, colour, flow, sequence)
			values ($1, $2, 'Being made', 'yellow', 'bespoke', 1)
		`, blStage, blBiz)
		mustExec(t, tx, `
			insert into orders (
				order_id, business_id, customer_id, design_id, size_band_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor,
				status, current_stage_id
			)
			values ($1, $2, $3, $4, null, 'custom', 'self_measure', 'bespoke', 'online', null, $5, 'confirmed', $6)
		`, blOrder, blBiz, blCustomer, blDesign, settledMinor, blStage)
	})
}

func cleanupBalanceFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference = any($1)`,
			[]string{"xt_bl_1", "xt_bl_2"})
		mustExec(t, tx, `delete from businesses where business_id = $1`, blBiz)
		mustExec(t, tx, `delete from customers where customer_id = $1`, blCustomer)
	})
}

func insertBalancePayment(t *testing.T, pool *pgxpool.Pool, reference string, amount int64) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, order_id, purpose, amount_minor,
				currency, provider_reference, status, through_platform, commission_minor)
			values (gen_random_uuid(), $1, $2, 'balance', $3, 'GHS', $4, 'initiated', true, 0)
		`, blBiz, blOrder, amount, reference)
	})
}

func readOrderSettlement(t *testing.T, pool *pgxpool.Pool) (status string, settled int64, stageID string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(),
			`select status, settled_minor, coalesce(current_stage_id::text, '') from orders where order_id = $1`,
			blOrder).Scan(&status, &settled, &stageID); err != nil {
			t.Fatalf("read order: %v", err)
		}
	})
	return
}

// TestBalanceWebhookCreditsConfirmedOrderAndIsIdempotent: a balance payment on a
// confirmed order credits settled_minor without changing the stage, and a
// re-delivered event does not double-credit.
func TestBalanceWebhookCreditsConfirmedOrderAndIsIdempotent(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmedCustomOrder(t, pool, 15000)
	defer cleanupBalanceFixtures(t, pool)

	ctx := context.Background()
	orders := NewOrderRepository(pool)

	if err := orders.SetAgreedTotal(ctx, blScope(), blOrder, 50000); err != nil {
		t.Fatalf("set agreed total: %v", err)
	}

	insertBalancePayment(t, pool, "xt_bl_1", 35000)
	event := ports.ConfirmPaymentInput{
		EventSignature: "bl_evt_1", EventType: "charge.success", ProviderReference: "xt_bl_1", Succeeded: true,
	}
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, event); err != nil {
		t.Fatalf("confirm balance: %v", err)
	}

	status, settled, stageID := readOrderSettlement(t, pool)
	if status != "confirmed" || settled != 50000 || stageID != blStage {
		t.Fatalf("expected confirmed, fully settled, same stage; got status=%q settled=%d stage=%q", status, settled, stageID)
	}

	// Re-deliver: no double credit, no stage change.
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, event); err != nil {
		t.Fatalf("redeliver: %v", err)
	}
	if _, settled, _ := readOrderSettlement(t, pool); settled != 50000 {
		t.Fatalf("balance must not double-credit, got settled=%d", settled)
	}
}

// TestBalanceWebhookCapsAtAgreedTotal: even an over-large balance payment can
// never settle more than the agreed total.
func TestBalanceWebhookCapsAtAgreedTotal(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmedCustomOrder(t, pool, 40000)
	defer cleanupBalanceFixtures(t, pool)

	ctx := context.Background()
	orders := NewOrderRepository(pool)
	if err := orders.SetAgreedTotal(ctx, blScope(), blOrder, 50000); err != nil {
		t.Fatalf("set agreed total: %v", err)
	}

	// Only 10000 is owed, but a 35000 payment arrives; settlement must cap at agreed.
	insertBalancePayment(t, pool, "xt_bl_2", 35000)
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "bl_evt_2", EventType: "charge.success", ProviderReference: "xt_bl_2", Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm balance: %v", err)
	}

	if _, settled, _ := readOrderSettlement(t, pool); settled != 50000 {
		t.Fatalf("settled must be capped at the agreed total, got %d", settled)
	}
}

func TestSetAgreedTotalRejectsBelowSettledOrWrongState(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmedCustomOrder(t, pool, 15000)
	defer cleanupBalanceFixtures(t, pool)

	ctx := context.Background()
	orders := NewOrderRepository(pool)

	// Below the already-settled deposit -> rejected, nothing changed.
	if err := orders.SetAgreedTotal(ctx, blScope(), blOrder, 10000); !errors.Is(err, ports.ErrInvalidOrderState) {
		t.Fatalf("expected invalid order state for below-settled total, got %v", err)
	}
	if _, settled, _ := readOrderSettlement(t, pool); settled != 15000 {
		t.Fatal("a rejected agreed-total must not change the order")
	}

	// Another tenant's scope cannot touch this order (RLS); reports invalid state.
	if err := orders.SetAgreedTotal(ctx, common.TenantScope{BusinessID: "99999999-9999-9999-9999-999999999999"}, blOrder, 60000); !errors.Is(err, ports.ErrInvalidOrderState) {
		t.Fatalf("expected invalid order state across tenants, got %v", err)
	}
}

// TestOneOpenBalancePerOrder: a second in-flight balance charge is impossible
// (the partial unique index), GetOrderBilling reports the in-flight balance, and
// re-pricing is blocked while a balance is being collected.
func TestOneOpenBalancePerOrder(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmedCustomOrder(t, pool, 15000)
	defer cleanupBalanceFixtures(t, pool)

	ctx := context.Background()
	orders := NewOrderRepository(pool)
	if err := orders.SetAgreedTotal(ctx, blScope(), blOrder, 50000); err != nil {
		t.Fatalf("set agreed total: %v", err)
	}

	insertBalancePayment(t, pool, "xt_bl_1", 35000)

	billing, err := orders.GetOrderBilling(ctx, blScope(), blOrder)
	if err != nil {
		t.Fatalf("billing: %v", err)
	}
	if !billing.BalanceInFlight {
		t.Fatal("expected BalanceInFlight=true while a balance payment is initiated")
	}

	// A second initiated balance payment is rejected by the partial unique index.
	// The failing insert aborts its transaction, so this runs (and rolls back) its
	// own tx rather than the committing inBypass helper.
	insertErr := func() error {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin: %v", err)
		}
		defer func() { _ = tx.Rollback(ctx) }()
		if _, err := tx.Exec(ctx, `select set_config('xtiitch.bypass', 'on', true)`); err != nil {
			t.Fatalf("set bypass: %v", err)
		}
		_, err = tx.Exec(ctx, `
			insert into payments (payment_id, business_id, order_id, purpose, amount_minor,
				currency, provider_reference, status, through_platform, commission_minor)
			values (gen_random_uuid(), $1, $2, 'balance', 35000, 'GHS', 'xt_bl_2', 'initiated', true, 0)
		`, blBiz, blOrder)
		return err
	}()
	if insertErr == nil || !strings.Contains(insertErr.Error(), "payments_one_open_balance_idx") {
		t.Fatalf("expected the one-open-balance index to reject a second charge, got %v", insertErr)
	}

	// Re-pricing is refused while a balance is in flight.
	if err := orders.SetAgreedTotal(ctx, blScope(), blOrder, 60000); !errors.Is(err, ports.ErrInvalidOrderState) {
		t.Fatalf("expected re-pricing blocked while a balance is in flight, got %v", err)
	}
}

func TestGetOrderBillingReturnsFinancialState(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmedCustomOrder(t, pool, 15000)
	defer cleanupBalanceFixtures(t, pool)

	billing, err := NewOrderRepository(pool).GetOrderBilling(context.Background(), blScope(), blOrder)
	if err != nil {
		t.Fatalf("get billing: %v", err)
	}
	if billing.OrderType != "custom" || billing.Status != "confirmed" || billing.SettledMinor != 15000 || billing.CustomerEmail != "bal@example.com" {
		t.Fatalf("unexpected billing: %+v", billing)
	}
	if billing.AgreedTotalMinor != nil {
		t.Fatalf("expected no agreed total yet, got %v", *billing.AgreedTotalMinor)
	}
}
