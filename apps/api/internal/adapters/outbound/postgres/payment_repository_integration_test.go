package postgres

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// These tests run against a real Postgres connected as the non-superuser
// application role, so row-level security is actually enforced — the only way
// to prove the webhook confirm path is both money-correct and tenant-safe. They
// are skipped unless XTIITCH_TEST_DATABASE_URL points at a migrated database.
//
// The database must be migrated (goose up) and the URL must use the xtiitch_app
// role, e.g. postgres://xtiitch_app:xtiitch_app@localhost:5440/xtiitch?sslmode=disable

const (
	itPlanProbe = `select plan_id from plans limit 1`

	itBizA    = "11111111-1111-1111-1111-111111111111"
	itBizB    = "22222222-2222-2222-2222-222222222222"
	itCustA   = "aaaaaaaa-0000-0000-0000-000000000001"
	itDesignA = "dddddddd-0000-0000-0000-000000000001"
	itStage1  = "55555555-0000-0000-0000-000000000001"

	itOrderFail = "00000000-0000-0000-0000-0000000000a1"
	itPayFail   = "00000000-0000-0000-0000-0000000000b1"
	itRefFail   = "xt_it_ref_fail"
	itPromoFail = "77777777-0000-0000-0000-0000000000a1"
	itRedFail   = "77777777-0000-0000-0000-0000000000b1"

	itOrderOK = "00000000-0000-0000-0000-0000000000a2"
	itPayOK   = "00000000-0000-0000-0000-0000000000b2"
	itRefOK   = "xt_it_ref_ok"
	itPromoOK = "77777777-0000-0000-0000-0000000000a2"
	itRedOK   = "77777777-0000-0000-0000-0000000000b2"

	itPayCross = "00000000-0000-0000-0000-0000000000c1"
	itRefCross = "xt_it_ref_cross"

	itAmount = 50000
)

func openIntegrationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("XTIITCH_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set XTIITCH_TEST_DATABASE_URL (xtiitch_app role) to run payment confirm integration tests")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Fatalf("ping: %v", err)
	}
	return pool
}

// inBypass runs fn inside one transaction with the RLS bypass on, for test
// fixtures and cross-tenant assertions only.
func inBypass(t *testing.T, pool *pgxpool.Pool, fn func(tx pgx.Tx)) {
	t.Helper()
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.bypass', 'on', true)`); err != nil {
		t.Fatalf("set bypass: %v", err)
	}
	fn(tx)
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}
}

func mustExec(t *testing.T, tx pgx.Tx, sql string, args ...any) {
	t.Helper()
	if _, err := tx.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec %q: %v", strings.SplitN(sql, "\n", 2)[0], err)
	}
}

func seedConfirmFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupConfirmFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []string{itBizA, itBizB} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Shop', $3, 'verified')
			`, biz, planID, "it-"+biz[:8])
		}
		mustExec(t, tx, `insert into customers (customer_id, display_name) values ($1, 'IT Customer')`, itCustA)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'IT Design', 'it-design', 'active')
		`, itDesignA, itBizA)
		mustExec(t, tx, `
			insert into stage_templates (stage_id, business_id, name, colour, flow, sequence)
			values ($1, $2, 'Order placed', 'red', 'ready_made', 1)
		`, itStage1, itBizA)

		// Two draft orders in business A: one for the failed->success scenario,
		// one for the happy/idempotent scenario. Both with their initiated payment.
		for _, o := range []struct{ order, pay, ref string }{
			{itOrderFail, itPayFail, itRefFail},
			{itOrderOK, itPayOK, itRefOK},
		} {
			mustExec(t, tx, `
				insert into orders (order_id, business_id, customer_id, design_id,
					order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status)
				values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', $5, 0, 'draft')
			`, o.order, itBizA, itCustA, itDesignA, itAmount)
			mustExec(t, tx, `
				insert into payments (payment_id, business_id, order_id, purpose, amount_minor,
					currency, provider_reference, status, through_platform, commission_minor)
				values ($1, $2, $3, 'standard_full', $4, 'GHS', $5, 'initiated', true, 500)
			`, o.pay, itBizA, o.order, itAmount, o.ref)
		}
		for _, promo := range []struct {
			promotion  string
			redemption string
			order      string
			code       string
		}{
			{itPromoFail, itRedFail, itOrderFail, "ITFAIL10"},
			{itPromoOK, itRedOK, itOrderOK, "ITOK10"},
		} {
			mustExec(t, tx, `
				insert into promotions (
					promotion_id, business_id, code, title, description,
					discount_type, discount_value, funding_source, scope, status
				)
				values ($1, $2, $3, 'IT Promo', '', 'fixed', 5000, 'business', 'store', 'active')
			`, promo.promotion, itBizA, promo.code)
			mustExec(t, tx, `
				insert into promotion_redemptions (
					promotion_redemption_id, promotion_id, business_id, order_id,
					customer_id, discount_minor, status
				)
				values ($1, $2, $3, $4, $5, 5000, 'pending')
			`, promo.redemption, promo.promotion, itBizA, promo.order, itCustA)
		}
	})
}

func cleanupConfirmFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference = any($1)`,
			[]string{itRefFail, itRefOK, itRefCross})
		// Businesses cascade to their payments, orders, stage_events, designs, stages.
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{itBizA, itBizB})
		mustExec(t, tx, `delete from customers where customer_id = $1`, itCustA)
	})
}

type orderState struct {
	status     string
	settled    int64
	stageIsSet bool
}

func readPaymentStatus(t *testing.T, pool *pgxpool.Pool, ref string) string {
	t.Helper()
	var status string
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(),
			`select status from payments where provider_reference = $1`, ref).Scan(&status); err != nil {
			t.Fatalf("read payment %s: %v", ref, err)
		}
	})
	return status
}

func readOrderState(t *testing.T, pool *pgxpool.Pool, orderID string) orderState {
	t.Helper()
	var st orderState
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(),
			`select status, settled_minor, current_stage_id is not null
			 from orders where order_id = $1`, orderID).Scan(&st.status, &st.settled, &st.stageIsSet); err != nil {
			t.Fatalf("read order %s: %v", orderID, err)
		}
	})
	return st
}

func readPromotionRedemptionStatus(t *testing.T, pool *pgxpool.Pool, redemptionID string) (string, bool) {
	t.Helper()
	var status string
	var redeemed bool
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select status, redeemed_at is not null
			from promotion_redemptions
			where promotion_redemption_id = $1
		`, redemptionID).Scan(&status, &redeemed); err != nil {
			t.Fatalf("read promotion redemption %s: %v", redemptionID, err)
		}
	})
	return status, redeemed
}

// TestConfirmFromProviderFailedThenSuccessDoesNotSettle is the finding-1
// regression: a charge.failed then a charge.success for the same payment must
// never settle the order, because the success update moves zero rows.
func TestConfirmFromProviderFailedThenSuccessDoesNotSettle(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)

	repo := NewPaymentRepository(pool)
	ctx := context.Background()

	if _, err := repo.ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "it_fail_evt", EventType: "charge.failed", ProviderReference: itRefFail, Succeeded: false,
	}); err != nil {
		t.Fatalf("confirm failed event: %v", err)
	}
	if _, err := repo.ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "it_succ_evt", EventType: "charge.success", ProviderReference: itRefFail, Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm success event: %v", err)
	}

	if got := readPaymentStatus(t, pool, itRefFail); got != "failed" {
		t.Fatalf("payment must stay failed after late success, got %q", got)
	}
	order := readOrderState(t, pool, itOrderFail)
	if order.status != "draft" || order.settled != 0 || order.stageIsSet {
		t.Fatalf("order must not settle on a non-succeeded payment, got %+v", order)
	}
	status, redeemed := readPromotionRedemptionStatus(t, pool, itRedFail)
	if status != "void" || redeemed {
		t.Fatalf("failed payment must void pending promotion redemption, status=%q redeemed=%v", status, redeemed)
	}
}

// TestConfirmFromProviderSuccessConfirmsAndIsIdempotent covers the happy path
// and the dedup: a success confirms the order at its first stage and settles
// the amount once, and a re-delivery changes nothing.
func TestConfirmFromProviderSuccessConfirmsAndIsIdempotent(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)

	repo := NewPaymentRepository(pool)
	ctx := context.Background()
	event := ports.ConfirmPaymentInput{
		EventSignature: "it_ok_evt", EventType: "charge.success", ProviderReference: itRefOK, Succeeded: true,
	}

	res, err := repo.ConfirmFromProvider(ctx, event)
	if err != nil {
		t.Fatalf("confirm success: %v", err)
	}
	if !res.PaymentFound || res.BusinessID != common.ID(itBizA) {
		t.Fatalf("unexpected result: %+v", res)
	}
	if got := readPaymentStatus(t, pool, itRefOK); got != "succeeded" {
		t.Fatalf("payment should be succeeded, got %q", got)
	}
	order := readOrderState(t, pool, itOrderOK)
	if order.status != "confirmed" || order.settled != itAmount || !order.stageIsSet {
		t.Fatalf("order should be confirmed and settled once, got %+v", order)
	}

	// Re-deliver the exact same event: dedup makes it a no-op.
	res2, err := repo.ConfirmFromProvider(ctx, event)
	if err != nil {
		t.Fatalf("redeliver: %v", err)
	}
	if !res2.AlreadyProcessed {
		t.Fatalf("redelivery should report AlreadyProcessed, got %+v", res2)
	}
	if order := readOrderState(t, pool, itOrderOK); order.settled != itAmount {
		t.Fatalf("settled amount must not double, got %d", order.settled)
	}
	status, redeemed := readPromotionRedemptionStatus(t, pool, itRedOK)
	if status != "applied" || !redeemed {
		t.Fatalf("successful payment must apply pending promotion redemption, status=%q redeemed=%v", status, redeemed)
	}
}

// TestPaymentOrderCrossTenantRejected is the finding-3 backstop: even with RLS
// bypassed, the database refuses a payment whose order belongs to another
// business, because of the composite (order_id, business_id) foreign key.
func TestPaymentOrderCrossTenantRejected(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)

	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.bypass', 'on', true)`); err != nil {
		t.Fatalf("set bypass: %v", err)
	}

	// Business B claims business A's order — must be rejected by the FK.
	_, err = tx.Exec(ctx, `
		insert into payments (payment_id, business_id, order_id, purpose, amount_minor,
			currency, provider_reference, status, through_platform, commission_minor)
		values ($1, $2, $3, 'standard_full', $4, 'GHS', $5, 'initiated', true, 500)
	`, itPayCross, itBizB, itOrderFail, itAmount, itRefCross)
	if err == nil {
		t.Fatal("expected the composite FK to reject a cross-tenant order_id, but insert succeeded")
	}
	if !strings.Contains(err.Error(), "payments_order_same_business_fk") {
		t.Fatalf("expected payments_order_same_business_fk violation, got: %v", err)
	}
}
