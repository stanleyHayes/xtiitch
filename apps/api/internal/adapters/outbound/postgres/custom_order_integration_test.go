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

// Real-Postgres coverage for the custom (bespoke) order path, run as the
// non-superuser xtiitch_app role so row-level security is enforced. Skipped
// unless XTIITCH_TEST_DATABASE_URL points at a migrated database (see the
// payment confirm integration tests for setup).

const (
	coBizA   = "33333333-3333-3333-3333-333333333333"
	coBizB   = "44444444-4444-4444-4444-444444444444" // exists, but has NO bespoke stages
	coDesign = "dddddddd-0000-0000-0000-000000000031"
	coField1 = "ffffffff-0000-0000-0000-000000000001"
	coField2 = "ffffffff-0000-0000-0000-000000000002"

	coScopeBusiness = common.ID(coBizA)
)

func coScope() common.TenantScope { return common.TenantScope{BusinessID: coScopeBusiness} }

func seedCustomFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupCustomFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []string{coBizA, coBizB} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Bespoke', $3, 'verified')
			`, biz, planID, "it-co-"+biz[:8])
		}
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'IT Bespoke Design', 'it-co-design', 'active')
		`, coDesign, coBizA)
		// Only business A gets bespoke stages (B is left without, to prove the
		// fail-fast guard). Sequence 1 is the red "Order received" first stage.
		mustExec(t, tx, `
			insert into stage_templates (stage_id, business_id, name, colour, flow, sequence)
			values
				(gen_random_uuid(), $1, 'Order received', 'red', 'bespoke', 1),
				(gen_random_uuid(), $1, 'Being made', 'yellow', 'bespoke', 2),
				(gen_random_uuid(), $1, 'Ready / delivered', 'green', 'bespoke', 3)
		`, coBizA)
		mustExec(t, tx, `
			insert into measurement_fields (field_id, business_id, label, unit, sequence)
			values ($1, $3, 'Chest', 'in', 1), ($2, $3, 'Waist', 'in', 2)
		`, coField1, coField2, coBizA)
	})
}

func cleanupCustomFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference = any($1)`,
			[]string{"xt_co_self"})
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{coBizA, coBizB})
		mustExec(t, tx, `delete from customers where display_name = 'IT Bespoke Customer'`)
	})
}

func newCustomOrderID(t *testing.T) (common.ID, common.ID) {
	t.Helper()
	// Deterministic-but-unique ids per subtest are not needed; the cleanup keys
	// on the business, so fixed ids are fine within a single seeded run.
	return common.ID("00000000-0000-0000-0000-0000000000d1"), common.ID("00000000-0000-0000-0000-0000000000e1")
}

// TestCreateCustomOrderSelfMeasureThenDepositConfirmsAtFirstBespokeStage is the
// core custom-order E2E at the repository layer: a self-measure draft (with its
// measurement) plus a deposit payment, confirmed by the webhook at the first
// BESPOKE stage (not ready_made), crediting the deposit.
func TestCreateCustomOrderSelfMeasureThenDepositConfirmsAtFirstBespokeStage(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	ctx := context.Background()
	orders := NewOrderRepository(pool)
	orderID, customerID := newCustomOrderID(t)

	if err := orders.CreateCustomOrder(ctx, coScope(), ports.CreateCustomOrderInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "self_measure", CustomerName: "IT Bespoke Customer", CustomerEmail: "co@example.com",
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f1"),
		Measurements:  map[string]string{coField1: "40", coField2: "32"},
	}); err != nil {
		t.Fatalf("create custom order: %v", err)
	}

	// Draft custom/bespoke order with its self-measure measurement stored.
	assertCustomOrder(t, pool, orderID, "draft", "custom", "bespoke", "self_measure")
	if chest := readMeasurement(t, pool, orderID, coField1); chest != "40" {
		t.Fatalf("expected chest measurement 40, got %q", chest)
	}

	// A deposit payment, then the (unchanged) webhook confirms it.
	insertDepositPayment(t, pool, orderID, "xt_co_self", 15000)
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "co_self_evt", EventType: "charge.success", ProviderReference: "xt_co_self", Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm deposit: %v", err)
	}

	status, settled, stageFlow, stageSeq, colour := readConfirmedStage(t, pool, orderID)
	if status != "confirmed" || settled != 15000 {
		t.Fatalf("expected confirmed+settled deposit, got status=%q settled=%d", status, settled)
	}
	if stageFlow != "bespoke" || stageSeq != 1 || colour != "red" {
		t.Fatalf("expected confirmation at the first bespoke (red) stage, got flow=%q seq=%d colour=%q", stageFlow, stageSeq, colour)
	}
}

func TestCreateCustomOrderRejectsUnknownMeasurementField(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	orders := NewOrderRepository(pool)
	orderID, customerID := newCustomOrderID(t)

	err := orders.CreateCustomOrder(context.Background(), coScope(), ports.CreateCustomOrderInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "self_measure", CustomerName: "IT Bespoke Customer", CustomerEmail: "co@example.com",
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f2"),
		Measurements:  map[string]string{"not-a-field-of-this-business": "99"},
	})
	if !errors.Is(err, ports.ErrUnknownMeasurementField) {
		t.Fatalf("expected ErrUnknownMeasurementField, got %v", err)
	}
	if orderExists(t, pool, orderID) {
		t.Fatal("a rejected measurement must roll back the whole order")
	}
}

func TestCreateCustomOrderConfirmedComeToShop(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	orders := NewOrderRepository(pool)
	orderID, customerID := newCustomOrderID(t)

	if err := orders.CreateCustomOrderConfirmed(context.Background(), coScope(), ports.CreateCustomOrderConfirmedInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "come_to_shop", CustomerName: "IT Bespoke Customer", CustomerEmail: "co@example.com",
	}); err != nil {
		t.Fatalf("create come_to_shop order: %v", err)
	}

	_, settled, stageFlow, stageSeq, colour := readConfirmedStage(t, pool, orderID)
	assertCustomOrder(t, pool, orderID, "confirmed", "custom", "bespoke", "come_to_shop")
	if settled != 0 || stageFlow != "bespoke" || stageSeq != 1 || colour != "red" {
		t.Fatalf("come_to_shop must confirm at first bespoke stage with no settlement, got settled=%d flow=%q seq=%d", settled, stageFlow, stageSeq)
	}
	if paymentCount(t, pool, orderID) != 0 {
		t.Fatal("come_to_shop must raise no payment")
	}
}

func TestListOrdersIncludesDashboardContext(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	orders := NewOrderRepository(pool)
	orderID, customerID := newCustomOrderID(t)
	if err := orders.CreateCustomOrder(context.Background(), coScope(), ports.CreateCustomOrderInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "home_visit", CustomerName: "IT Bespoke Customer", CustomerPhone: "+233200000000", CustomerEmail: "co@example.com",
	}); err != nil {
		t.Fatalf("create custom order: %v", err)
	}
	insertDepositPayment(t, pool, orderID, "xt_co_list", 15000)

	summaries, err := orders.ListOrders(context.Background(), coScope())
	if err != nil {
		t.Fatalf("list orders: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("expected one summary, got %+v", summaries)
	}
	got := summaries[0]
	if got.OrderID != orderID || got.OrderType != "custom" || got.SizeMode != "home_visit" || got.Channel != "online" {
		t.Fatalf("unexpected order route fields: %+v", got)
	}
	if got.CustomerPhone != "+233200000000" || got.CustomerEmail != "co@example.com" {
		t.Fatalf("expected contact context, got phone=%q email=%q", got.CustomerPhone, got.CustomerEmail)
	}
	if got.PaymentStatus != "initiated" || got.PaymentPurpose != "deposit" || got.PaymentAmount == nil || *got.PaymentAmount != 15000 {
		t.Fatalf("expected deposit payment context, got %+v", got)
	}
}

func TestCreateCustomOrderFailsWithoutBespokeStages(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	// Business B has no bespoke stages; the guard must fail fast before charging.
	orders := NewOrderRepository(pool)
	err := orders.CreateCustomOrder(context.Background(), common.TenantScope{BusinessID: common.ID(coBizB)}, ports.CreateCustomOrderInput{
		OrderID: common.ID("00000000-0000-0000-0000-0000000000d9"), BusinessID: common.ID(coBizB),
		CustomerID: common.ID("00000000-0000-0000-0000-0000000000e9"), DesignID: coDesign,
		SizeMode: "home_visit", CustomerName: "IT Bespoke Customer", CustomerEmail: "co@example.com",
	})
	if err == nil || !strings.Contains(err.Error(), "no bespoke stages") {
		t.Fatalf("expected a no-bespoke-stages error, got %v", err)
	}
}

func TestDiscardCustomDraftOrderRemovesMeasurementOrderAndCustomer(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	ctx := context.Background()
	orders := NewOrderRepository(pool)
	orderID, customerID := newCustomOrderID(t)

	if err := orders.CreateCustomOrder(ctx, coScope(), ports.CreateCustomOrderInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "self_measure", CustomerName: "IT Bespoke Customer", CustomerEmail: "co@example.com",
		MeasurementID: common.ID("00000000-0000-0000-0000-0000000000f3"),
		Measurements:  map[string]string{coField1: "41"},
	}); err != nil {
		t.Fatalf("create custom order: %v", err)
	}

	if err := orders.DiscardCustomDraftOrder(ctx, coScope(), orderID, customerID); err != nil {
		t.Fatalf("discard: %v", err)
	}
	if orderExists(t, pool, orderID) {
		t.Fatal("order should be gone")
	}
	if measurementCount(t, pool, orderID) != 0 {
		t.Fatal("measurement should be gone")
	}
	if customerExists(t, pool, customerID) {
		t.Fatal("customer should be gone")
	}
}

func TestOrderMeasurementCrossTenantRejected(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCustomFixtures(t, pool)
	defer cleanupCustomFixtures(t, pool)

	ctx := context.Background()
	orders := NewOrderRepository(pool)
	orderID, customerID := newCustomOrderID(t)
	if err := orders.CreateCustomOrder(ctx, coScope(), ports.CreateCustomOrderInput{
		OrderID: orderID, BusinessID: coScopeBusiness, CustomerID: customerID, DesignID: coDesign,
		SizeMode: "home_visit", CustomerName: "IT Bespoke Customer", CustomerEmail: "co@example.com",
	}); err != nil {
		t.Fatalf("create custom order: %v", err)
	}

	// Business B claims A's order via a measurement row — the composite FK must
	// reject it even under the RLS bypass.
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.bypass', 'on', true)`); err != nil {
		t.Fatalf("set bypass: %v", err)
	}
	_, err = tx.Exec(ctx, `
		insert into order_measurements (measurement_id, business_id, order_id, customer_id, source, values)
		values ($1, $2, $3, $4, 'visit', '{}'::jsonb)
	`, "00000000-0000-0000-0000-0000000000fa", coBizB, orderID.String(), customerID.String())
	if err == nil || !strings.Contains(err.Error(), "order_measurements_order_same_business_fk") {
		t.Fatalf("expected the composite FK to reject a cross-tenant measurement, got %v", err)
	}
}

// --- assertion helpers (all read under bypass) ---

func assertCustomOrder(t *testing.T, pool *pgxpool.Pool, orderID common.ID, status, orderType, flow, sizeMode string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		var gotStatus, gotType, gotFlow, gotMode string
		var bandID *string
		if err := tx.QueryRow(context.Background(), `
			select status, order_type, flow, size_mode, size_band_id::text
			from orders where order_id = $1
		`, orderID.String()).Scan(&gotStatus, &gotType, &gotFlow, &gotMode, &bandID); err != nil {
			t.Fatalf("read order: %v", err)
		}
		if gotStatus != status || gotType != orderType || gotFlow != flow || gotMode != sizeMode {
			t.Fatalf("order mismatch: status=%q type=%q flow=%q mode=%q", gotStatus, gotType, gotFlow, gotMode)
		}
		if bandID != nil {
			t.Fatalf("custom order must have no size band, got %q", *bandID)
		}
	})
}

func readConfirmedStage(t *testing.T, pool *pgxpool.Pool, orderID common.ID) (status string, settled int64, stageFlow string, stageSeq int, colour string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select o.status, o.settled_minor, st.flow, st.sequence, st.colour
			from orders o
			join stage_templates st on st.stage_id = o.current_stage_id
			where o.order_id = $1
		`, orderID.String()).Scan(&status, &settled, &stageFlow, &stageSeq, &colour); err != nil {
			t.Fatalf("read confirmed stage: %v", err)
		}
	})
	return
}

func readMeasurement(t *testing.T, pool *pgxpool.Pool, orderID common.ID, fieldID string) string {
	t.Helper()
	var value string
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select coalesce(values->>$2, '') from order_measurements where order_id = $1
		`, orderID.String(), fieldID).Scan(&value); err != nil {
			t.Fatalf("read measurement: %v", err)
		}
	})
	return value
}

func insertDepositPayment(t *testing.T, pool *pgxpool.Pool, orderID common.ID, reference string, amount int64) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, order_id, purpose, amount_minor,
				currency, provider_reference, status, through_platform, commission_minor)
			values (gen_random_uuid(), $1, $2, 'deposit', $3, 'GHS', $4, 'initiated', true, 150)
		`, coBizA, orderID.String(), amount, reference)
	})
}

func orderExists(t *testing.T, pool *pgxpool.Pool, orderID common.ID) bool {
	return countBypass(t, pool, `select count(*) from orders where order_id = $1`, orderID.String()) > 0
}

func customerExists(t *testing.T, pool *pgxpool.Pool, customerID common.ID) bool {
	return countBypass(t, pool, `select count(*) from customers where customer_id = $1`, customerID.String()) > 0
}

func measurementCount(t *testing.T, pool *pgxpool.Pool, orderID common.ID) int {
	return countBypass(t, pool, `select count(*) from order_measurements where order_id = $1`, orderID.String())
}

func paymentCount(t *testing.T, pool *pgxpool.Pool, orderID common.ID) int {
	return countBypass(t, pool, `select count(*) from payments where order_id = $1`, orderID.String())
}

func countBypass(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int {
	t.Helper()
	var n int
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
			t.Fatalf("count: %v", err)
		}
	})
	return n
}
