package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func seedSubscriptionInvoiceFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupSubscriptionInvoiceFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []struct {
			id     string
			handle string
		}{
			{itSubBizPaid, "it-sub-paid"},
			{itSubBizFailed, "it-sub-failed"},
		} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT Subscription Shop', $3, 'verified')
			`, biz.id, planID, biz.handle)
		}

		for _, sub := range []struct {
			id       string
			business string
			failed   int
		}{
			{itSubPaid, itSubBizPaid, 1},
			{itSubFailed, itSubBizFailed, 0},
		} {
			mustExec(t, tx, `
				insert into business_subscriptions (
					subscription_id,
					business_id,
					plan_id,
					status,
					billing_mode,
					provider,
					current_period_start,
					current_period_end,
					failed_payment_count,
					next_billing_at
				)
				values (
					$1,
					$2,
					$3,
					'past_due',
					'payment_link',
					'paystack',
					now() - interval '1 month',
					now(),
					$4,
					now()
				)
			`, sub.id, sub.business, planID, sub.failed)
		}

		for _, invoice := range []struct {
			id           string
			subscription string
			business     string
			ref          string
			providerRef  string
		}{
			{itSubInvoicePaid, itSubPaid, itSubBizPaid, itSubInvRefPaid, itSubRefPaid},
			{itSubInvoiceFailed, itSubFailed, itSubBizFailed, itSubInvRefFailed, itSubRefFailed},
		} {
			mustExec(t, tx, `
				insert into business_subscription_invoices (
					invoice_id,
					subscription_id,
					business_id,
					plan_id,
					invoice_ref,
					status,
					billing_mode,
					provider,
					provider_invoice_ref,
					amount_minor,
					currency,
					period_start,
					period_end,
					due_at
				)
				values (
					$1,
					$2,
					$3,
					$4,
					$5,
					'issued',
					'payment_link',
					'paystack',
					$6,
					5000,
					'GHS',
					now(),
					now() + interval '1 month',
					now()
				)
			`, invoice.id, invoice.subscription, invoice.business, planID, invoice.ref, invoice.providerRef)
		}
	})
}

func cleanupSubscriptionInvoiceFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference = any($1)`,
			[]string{itSubRefPaid, itSubRefFailed})
		mustExec(t, tx, `delete from businesses where business_id = any($1)`,
			[]string{itSubBizPaid, itSubBizFailed})
	})
}

type subscriptionInvoiceState struct {
	invoiceStatus      string
	subscriptionStatus string
	failedCount        int
	lastInvoiceRef     string
	lastPaymentAtSet   bool
	graceEndsAtSet     bool
}

func readSubscriptionInvoiceState(t *testing.T, pool *pgxpool.Pool, invoiceID string) subscriptionInvoiceState {
	t.Helper()
	var state subscriptionInvoiceState
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select
				i.status,
				s.status,
				s.failed_payment_count,
				s.last_invoice_ref,
				s.last_payment_at is not null,
				s.grace_ends_at is not null
			from business_subscription_invoices i
			join business_subscriptions s on s.subscription_id = i.subscription_id
			where i.invoice_id = $1
		`, invoiceID).Scan(
			&state.invoiceStatus,
			&state.subscriptionStatus,
			&state.failedCount,
			&state.lastInvoiceRef,
			&state.lastPaymentAtSet,
			&state.graceEndsAtSet,
		); err != nil {
			t.Fatalf("read subscription invoice %s: %v", invoiceID, err)
		}
	})
	return state
}

func countSubscriptionEvents(t *testing.T, pool *pgxpool.Pool, subscriptionID, eventType string) int {
	t.Helper()
	var count int
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select count(*)::int
			from business_subscription_events
			where subscription_id = $1 and event_type = $2
		`, subscriptionID, eventType).Scan(&count); err != nil {
			t.Fatalf("count subscription events %s/%s: %v", subscriptionID, eventType, err)
		}
	})
	return count
}
func TestConfirmFromProviderReconcilesSubscriptionInvoiceWebhooks(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedSubscriptionInvoiceFixtures(t, pool)
	defer cleanupSubscriptionInvoiceFixtures(t, pool)

	repo := NewPaymentRepository(pool)
	ctx := context.Background()
	success := ports.ConfirmPaymentInput{
		EventSignature:    "it_sub_paid_evt",
		EventType:         "charge.success",
		ProviderReference: itSubRefPaid,
		Succeeded:         true,
	}

	res, err := repo.ConfirmFromProvider(ctx, success)
	if err != nil {
		t.Fatalf("confirm subscription invoice success: %v", err)
	}
	if res.PaymentFound || !res.SubscriptionInvoiceFound || res.BusinessID != common.ID(itSubBizPaid) {
		t.Fatalf("expected subscription invoice match, got %+v", res)
	}
	paid := readSubscriptionInvoiceState(t, pool, itSubInvoicePaid)
	if paid.invoiceStatus != "paid" || paid.subscriptionStatus != "active" || paid.failedCount != 0 ||
		paid.lastInvoiceRef != itSubInvRefPaid || !paid.lastPaymentAtSet || paid.graceEndsAtSet {
		t.Fatalf("success should activate paid subscription invoice, got %+v", paid)
	}
	if got := countSubscriptionEvents(t, pool, itSubPaid, "subscription.invoice_paid"); got != 1 {
		t.Fatalf("expected one paid event, got %d", got)
	}

	redelivered, err := repo.ConfirmFromProvider(ctx, success)
	if err != nil {
		t.Fatalf("redeliver subscription invoice success: %v", err)
	}
	if !redelivered.AlreadyProcessed {
		t.Fatalf("redelivery should report AlreadyProcessed, got %+v", redelivered)
	}
	if got := countSubscriptionEvents(t, pool, itSubPaid, "subscription.invoice_paid"); got != 1 {
		t.Fatalf("redelivery must not duplicate paid events, got %d", got)
	}

	failure := ports.ConfirmPaymentInput{
		EventSignature:    "it_sub_failed_evt",
		EventType:         "charge.failed",
		ProviderReference: itSubRefFailed,
		Succeeded:         false,
	}
	res, err = repo.ConfirmFromProvider(ctx, failure)
	if err != nil {
		t.Fatalf("confirm subscription invoice failure: %v", err)
	}
	if res.PaymentFound || !res.SubscriptionInvoiceFound || res.BusinessID != common.ID(itSubBizFailed) {
		t.Fatalf("expected failed subscription invoice match, got %+v", res)
	}
	failed := readSubscriptionInvoiceState(t, pool, itSubInvoiceFailed)
	if failed.invoiceStatus != "failed" || failed.subscriptionStatus != "past_due" || failed.failedCount != 1 ||
		failed.lastInvoiceRef != itSubInvRefFailed || failed.lastPaymentAtSet || failed.graceEndsAtSet {
		t.Fatalf("failure should move subscription invoice into past_due, got %+v", failed)
	}
	if got := countSubscriptionEvents(t, pool, itSubFailed, "subscription.invoice_failed"); got != 1 {
		t.Fatalf("expected one failed event, got %d", got)
	}

	recovery := ports.ConfirmPaymentInput{
		EventSignature:    "it_sub_recovered_evt",
		EventType:         "charge.success",
		ProviderReference: itSubRefFailed,
		Succeeded:         true,
	}
	if _, err = repo.ConfirmFromProvider(ctx, recovery); err != nil {
		t.Fatalf("confirm subscription invoice recovery: %v", err)
	}
	recovered := readSubscriptionInvoiceState(t, pool, itSubInvoiceFailed)
	if recovered.invoiceStatus != "paid" || recovered.subscriptionStatus != "active" || recovered.failedCount != 0 ||
		recovered.lastInvoiceRef != itSubInvRefFailed || !recovered.lastPaymentAtSet || recovered.graceEndsAtSet {
		t.Fatalf("recovery success should reactivate subscription, got %+v", recovered)
	}
	if got := countSubscriptionEvents(t, pool, itSubFailed, "subscription.invoice_paid"); got != 1 {
		t.Fatalf("expected one recovery paid event, got %d", got)
	}
}
