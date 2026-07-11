package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func seedAdCampaignPaymentWebhookFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdCampaignPaymentWebhookFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Ad Webhook Shop', 'it-ad-webhook-shop', 'verified')
		`, itAdWebhookBiz, planID)
		mustExec(t, tx, `
			insert into ad_campaigns (
				campaign_id,
				advertiser_business_id,
				placement_type,
				headline,
				description,
				status,
				pricing_model,
				budget_minor,
				spend_to_date_minor,
				starts_at,
				ends_at
			)
			values (
				$1,
				$2,
				'featured_business',
				'IT Webhook Placement',
				'Webhook paid placement.',
				'active',
				'flat_time',
				60000,
				5000,
				now() - interval '1 day',
				now() + interval '7 days'
			)
		`, itAdWebhookCampaign, itAdWebhookBiz)
		mustExec(t, tx, `
			insert into ad_campaign_payments (
				payment_id,
				campaign_id,
				advertiser_business_id,
				provider,
				provider_reference,
				payment_url,
				amount_minor,
				currency,
				status
			)
			values ($1, $2, $3, 'paystack', $4, 'https://paystack.test/pay/ps_ad_it_success', 55000, 'GHS', 'initiated')
		`, itAdWebhookPayment, itAdWebhookCampaign, itAdWebhookBiz, itAdWebhookRef)
	})
}

func cleanupAdCampaignPaymentWebhookFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from payment_provider_events where provider_reference = $1`, itAdWebhookRef)
		mustExec(t, tx, `delete from admin_audit_events where metadata->>'provider_reference' = $1`, itAdWebhookRef)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdWebhookBiz)
	})
}

type adCampaignPaymentState struct {
	paymentStatus string
	paidAtSet     bool
	failedAtSet   bool
	spendMinor    int64
	auditCount    int
}

func readAdCampaignPaymentState(t *testing.T, pool *pgxpool.Pool) adCampaignPaymentState {
	t.Helper()
	var state adCampaignPaymentState
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select
				ap.status,
				ap.paid_at is not null,
				ap.failed_at is not null,
				c.spend_to_date_minor::bigint,
				(
					select count(*)::int
					from admin_audit_events ae
					where ae.metadata->>'provider_reference' = $3
				) as audit_count
			from ad_campaign_payments ap
			join ad_campaigns c on c.campaign_id = ap.campaign_id
				and c.advertiser_business_id = ap.advertiser_business_id
			where ap.payment_id = $1
				and ap.advertiser_business_id = $2
		`, itAdWebhookPayment, itAdWebhookBiz, itAdWebhookRef).Scan(
			&state.paymentStatus,
			&state.paidAtSet,
			&state.failedAtSet,
			&state.spendMinor,
			&state.auditCount,
		); err != nil {
			t.Fatalf("read ad campaign payment state: %v", err)
		}
	})
	return state
}
func TestConfirmFromProviderReconcilesAdCampaignPaymentWebhook(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdCampaignPaymentWebhookFixture(t, pool)
	defer cleanupAdCampaignPaymentWebhookFixture(t, pool)

	repo := NewPaymentRepository(pool)
	ctx := context.Background()
	event := ports.ConfirmPaymentInput{
		EventSignature:    "it_ad_paid_evt",
		EventType:         "charge.success",
		ProviderReference: itAdWebhookRef,
		Succeeded:         true,
	}

	res, err := repo.ConfirmFromProvider(ctx, event)
	if err != nil {
		t.Fatalf("confirm ad campaign payment success: %v", err)
	}
	if res.PaymentFound || res.SubscriptionInvoiceFound || !res.AdCampaignPaymentFound ||
		res.BusinessID != common.ID(itAdWebhookBiz) {
		t.Fatalf("expected ad campaign payment match, got %+v", res)
	}
	state := readAdCampaignPaymentState(t, pool)
	if state.paymentStatus != "paid" ||
		!state.paidAtSet ||
		state.failedAtSet ||
		state.spendMinor != 60000 ||
		state.auditCount != 1 {
		t.Fatalf("success should pay ad campaign budget exactly once, got %+v", state)
	}

	redelivered, err := repo.ConfirmFromProvider(ctx, event)
	if err != nil {
		t.Fatalf("redeliver ad campaign payment success: %v", err)
	}
	if !redelivered.AlreadyProcessed {
		t.Fatalf("redelivery should report AlreadyProcessed, got %+v", redelivered)
	}
	state = readAdCampaignPaymentState(t, pool)
	if state.auditCount != 1 || state.spendMinor != 60000 {
		t.Fatalf("redelivery must not duplicate spend or audit, got %+v", state)
	}
}
