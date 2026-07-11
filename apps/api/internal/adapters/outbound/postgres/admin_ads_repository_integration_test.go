package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestAdminAdCampaignPaymentIntentAndCreate(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAdCampaignPaymentFixture(t, pool)
	defer cleanupAdminAdCampaignPaymentFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	intent, err := repo.GetAdminAdCampaignPaymentIntent(ctx, common.ID(itAdminAdPayCampaign))
	if err != nil {
		t.Fatalf("get ad payment intent: %v", err)
	}
	if intent.OwnerEmail != "adpay-owner@example.com" ||
		intent.BudgetMinor != 60000 ||
		intent.DueMinor != 60000 ||
		intent.OpenPayment != nil {
		t.Fatalf("unexpected payment intent: %+v", intent)
	}

	payment, err := repo.CreateAdminAdCampaignPayment(ctx, ports.CreateAdminAdCampaignPaymentInput{
		PaymentID:         common.ID(itAdminAdPayPayment),
		CampaignID:        common.ID(itAdminAdPayCampaign),
		BusinessID:        common.ID(itAdminAdPayBiz),
		ProviderReference: "ps_ad_it_link",
		PaymentURL:        "https://paystack.test/pay/ps_ad_it_link",
		AmountMinor:       60000,
		Currency:          common.CurrencyGHS,
		ActorAdminUser:    common.ID(itAdminAdPayAdmin),
	})
	if err != nil {
		t.Fatalf("create ad campaign payment: %v", err)
	}
	if payment.Status != "initiated" ||
		payment.Provider != "paystack" ||
		payment.PaymentURL == "" {
		t.Fatalf("unexpected payment record: %+v", payment)
	}

	_, err = repo.CreateAdminAdCampaignPayment(ctx, ports.CreateAdminAdCampaignPaymentInput{
		PaymentID:         "99999999-4444-4444-4444-444444444442",
		CampaignID:        common.ID(itAdminAdPayCampaign),
		BusinessID:        common.ID(itAdminAdPayBiz),
		ProviderReference: "ps_ad_it_link_2",
		PaymentURL:        "https://paystack.test/pay/ps_ad_it_link_2",
		AmountMinor:       60000,
		Currency:          common.CurrencyGHS,
		ActorAdminUser:    common.ID(itAdminAdPayAdmin),
	})
	if !errors.Is(err, ports.ErrPaymentInFlight) {
		t.Fatalf("expected duplicate open link to be blocked, got %v", err)
	}

	intent, err = repo.GetAdminAdCampaignPaymentIntent(ctx, common.ID(itAdminAdPayCampaign))
	if err != nil {
		t.Fatalf("get ad payment intent after create: %v", err)
	}
	if intent.OpenPayment == nil ||
		intent.OpenPayment.ProviderReference != "ps_ad_it_link" {
		t.Fatalf("expected open payment in intent, got %+v", intent)
	}

	campaigns, err := repo.ListAdminAdCampaigns(ctx)
	if err != nil {
		t.Fatalf("list ad campaigns: %v", err)
	}
	var found ports.AdminAdCampaignRecord
	for _, campaign := range campaigns {
		if campaign.CampaignID == common.ID(itAdminAdPayCampaign) {
			found = campaign
			break
		}
	}
	if found.CampaignID.IsZero() ||
		len(found.RecentPayments) != 1 ||
		found.RecentPayments[0].PaymentID != common.ID(itAdminAdPayPayment) {
		t.Fatalf("expected listed campaign with payment history, got %+v", found)
	}
}

func seedAdminAdCampaignPaymentFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminAdCampaignPaymentFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-ad-pay@xtiitch.test', 'IT Ad Pay', 'hash', 'operator', true)
		`, itAdminAdPayAdmin)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values ($1, $2, 'IT Ad Pay Atelier', 'it-ad-pay-atelier', 'verified', 'active')
		`, itAdminAdPayBiz, planID)
		mustExec(t, tx, `
			insert into business_users (business_id, email, display_name, password_hash, role, is_active)
			values ($1, 'adpay-owner@example.com', 'Ad Pay Owner', 'hash', 'owner', true)
		`, itAdminAdPayBiz)
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
				starts_at,
				ends_at,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1,
				$2,
				'featured_business',
				'IT Paid Placement',
				'Integration paid placement.',
				'active',
				'flat_time',
				60000,
				now() - interval '1 day',
				now() + interval '7 days',
				$3,
				$3
			)
		`, itAdminAdPayCampaign, itAdminAdPayBiz, itAdminAdPayAdmin)
	})
}

func cleanupAdminAdCampaignPaymentFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminAdPayBiz)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminAdPayAdmin)
	})
}
