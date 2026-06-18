package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itAdminSubBiz   = "66666666-6666-6666-6666-666666666661"
	itAdminSubAdmin = "77777777-7777-7777-7777-777777777771"

	itAdminPromoBiz   = "66666666-6666-6666-6666-666666666662"
	itAdminPromo      = "88888888-8888-8888-8888-888888888881"
	itAdminPromoRedA  = "99999999-9999-9999-9999-999999999981"
	itAdminPromoRedB  = "99999999-9999-9999-9999-999999999982"
	itAdminPromoCustA = "aaaaaaaa-9999-9999-9999-999999999981"
	itAdminPromoCustB = "aaaaaaaa-9999-9999-9999-999999999982"

	itAdminAffBiz        = "66666666-6666-6666-6666-666666666663"
	itAdminAffCust       = "aaaaaaaa-9999-9999-9999-999999999983"
	itAdminAffDesign     = "bbbbbbbb-9999-9999-9999-999999999981"
	itAdminAffOrder      = "cccccccc-9999-9999-9999-999999999981"
	itAdminAffAffiliate  = "dddddddd-9999-9999-9999-999999999981"
	itAdminAffConversion = "eeeeeeee-9999-9999-9999-999999999981"
	itAdminAffPayout     = "ffffffff-9999-9999-9999-999999999981"
	itAdminAffAdmin      = "77777777-7777-7777-7777-777777777772"

	itAdminRefRewardBiz       = "66666666-5555-5555-5555-555555555551"
	itAdminRefRewardReferrer  = "aaaaaaaa-5555-5555-5555-555555555551"
	itAdminRefRewardReferee   = "aaaaaaaa-5555-5555-5555-555555555552"
	itAdminRefRewardDesign    = "bbbbbbbb-5555-5555-5555-555555555551"
	itAdminRefRewardOrder     = "cccccccc-5555-5555-5555-555555555551"
	itAdminRefRewardProgramme = "dddddddd-5555-5555-5555-555555555551"
	itAdminRefRewardCode      = "eeeeeeee-5555-5555-5555-555555555551"
	itAdminRefRewardReferral  = "ffffffff-5555-5555-5555-555555555551"
	itAdminRefRewardAdmin     = "77777777-7777-7777-7777-777777777773"

	itAdminRefCodeBiz       = "66666666-3333-3333-3333-333333333331"
	itAdminRefCodeProgramme = "dddddddd-3333-3333-3333-333333333331"
	itAdminRefCode          = "eeeeeeee-3333-3333-3333-333333333331"
	itAdminRefCodeAdmin     = "77777777-3333-3333-3333-333333333331"

	itAdminAdPayBiz      = "66666666-4444-4444-4444-444444444441"
	itAdminAdPayAdmin    = "77777777-4444-4444-4444-444444444441"
	itAdminAdPayCampaign = "88888888-4444-4444-4444-444444444441"
	itAdminAdPayPayment  = "99999999-4444-4444-4444-444444444441"
)

func TestUpdateAdminSubscriptionStoresProviderReferences(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminSubscriptionFixture(t, pool)
	defer cleanupAdminSubscriptionFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	record, err := repo.UpdateAdminSubscription(ctx, ports.UpdateAdminSubscriptionInput{
		BusinessID:              common.ID(itAdminSubBiz),
		Status:                  "active",
		BillingMode:             "recurring",
		ProviderCustomerRef:     "CUS_IT_RECUR",
		ProviderSubscriptionRef: "SUB_IT_RECUR",
		ActorAdminUser:          common.ID(itAdminSubAdmin),
		Reason:                  "Attach Paystack recurring authorization.",
	})
	if err != nil {
		t.Fatalf("update recurring subscription refs: %v", err)
	}
	if record.Provider != "paystack" ||
		record.ProviderCustomerRef != "CUS_IT_RECUR" ||
		record.ProviderSubscriptionRef != "SUB_IT_RECUR" {
		t.Fatalf("expected Paystack refs on subscription response, got %+v", record)
	}

	record, err = repo.UpdateAdminSubscription(ctx, ports.UpdateAdminSubscriptionInput{
		BusinessID:     common.ID(itAdminSubBiz),
		Status:         "active",
		BillingMode:    "manual",
		ActorAdminUser: common.ID(itAdminSubAdmin),
		Reason:         "Return to manual billing.",
	})
	if err != nil {
		t.Fatalf("clear recurring subscription refs: %v", err)
	}
	if record.Provider != "manual" ||
		record.ProviderCustomerRef != "" ||
		record.ProviderSubscriptionRef != "" {
		t.Fatalf("manual billing should clear Paystack refs, got %+v", record)
	}
}

func TestListAdminPromotionsIncludesRecentRedemptions(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminPromotionRedemptionFixture(t, pool)
	defer cleanupAdminPromotionRedemptionFixture(t, pool)

	records, err := NewAdminAuthRepository(pool).ListAdminPromotions(context.Background())
	if err != nil {
		t.Fatalf("list admin promotions: %v", err)
	}

	var found ports.AdminPromotionRecord
	for _, record := range records {
		if record.PromotionID == common.ID(itAdminPromo) {
			found = record
			break
		}
	}
	if found.PromotionID.IsZero() {
		t.Fatal("expected seeded promotion in admin list")
	}
	if found.RedemptionCount != 1 || found.DiscountRedeemedMinor != 1500 {
		t.Fatalf("expected applied redemption aggregate, got %+v", found)
	}
	if len(found.RecentRedemptions) != 2 {
		t.Fatalf("expected two recent redemptions, got %+v", found.RecentRedemptions)
	}
	if found.RecentRedemptions[0].Status != "pending" ||
		found.RecentRedemptions[0].CustomerName != "Kojo Pending" ||
		found.RecentRedemptions[0].DiscountMinor != 750 {
		t.Fatalf("expected newest pending redemption first, got %+v", found.RecentRedemptions[0])
	}
	if found.RecentRedemptions[1].Status != "applied" ||
		found.RecentRedemptions[1].CustomerName != "Ama Applied" ||
		found.RecentRedemptions[1].RedeemedAt == nil {
		t.Fatalf("expected applied redemption with redeemed timestamp, got %+v", found.RecentRedemptions[1])
	}
}

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

func TestUpdateAdminAffiliateConversionStatusPersistsTransition(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	approved, err := repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "approved",
		Reason:         "Integration approval.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("approve affiliate conversion: %v", err)
	}
	if approved.Status != "approved" || approved.CommissionMinor != 2500 {
		t.Fatalf("expected approved conversion, got %+v", approved)
	}

	settled, err := repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "settled",
		Reason:         "Integration settlement.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("settle affiliate conversion: %v", err)
	}
	if settled.Status != "settled" {
		t.Fatalf("expected settled conversion, got %+v", settled)
	}

	_, err = repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "reversed",
		Reason:         "Too late.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected settled conversion to be terminal, got %v", err)
	}
}

func TestCreateAdminAffiliatePayoutSettlesApprovedConversions(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	if _, err := repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "approved",
		Reason:         "Ready for payout.",
		ActorAdminUser: itAdminAffAdmin,
	}); err != nil {
		t.Fatalf("approve affiliate conversion: %v", err)
	}

	payout, err := repo.CreateAdminAffiliatePayout(ctx, ports.CreateAdminAffiliatePayoutInput{
		PayoutBatchID:   itAdminAffPayout,
		AffiliateID:     itAdminAffAffiliate,
		PayoutReference: "TRF_IT_AFF",
		Notes:           "Integration payout reconciliation.",
		ActorAdminUser:  itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("create affiliate payout: %v", err)
	}
	if payout.PayoutBatchID != common.ID(itAdminAffPayout) ||
		payout.AffiliateID != common.ID(itAdminAffAffiliate) ||
		payout.PayoutReference != "TRF_IT_AFF" ||
		payout.ConversionCount != 1 ||
		payout.CommissionMinor != 2500 ||
		payout.Status != "settled" {
		t.Fatalf("unexpected affiliate payout: %+v", payout)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var status string
		var payoutBatchID string
		var payoutReference string
		if err := tx.QueryRow(context.Background(), `
			select
				status,
				payout_batch_id::text,
				metadata->>'payout_reference'
			from affiliate_conversions
			where affiliate_conversion_id = $1
		`, itAdminAffConversion).Scan(&status, &payoutBatchID, &payoutReference); err != nil {
			t.Fatalf("read affiliate conversion payout state: %v", err)
		}
		if status != "settled" ||
			payoutBatchID != itAdminAffPayout ||
			payoutReference != "TRF_IT_AFF" {
			t.Fatalf("expected settled conversion linked to payout, status=%q batch=%q ref=%q",
				status, payoutBatchID, payoutReference)
		}
	})

	records, err := repo.ListAdminAffiliateAttribution(ctx)
	if err != nil {
		t.Fatalf("list affiliate attribution: %v", err)
	}
	var found ports.AdminAffiliateAttributionRecord
	for _, record := range records {
		if record.AffiliateID == common.ID(itAdminAffAffiliate) {
			found = record
			break
		}
	}
	if found.AffiliateID.IsZero() ||
		len(found.RecentPayouts) != 1 ||
		found.RecentPayouts[0].PayoutBatchID != common.ID(itAdminAffPayout) {
		t.Fatalf("expected payout in attribution read model, got %+v", found)
	}

	_, err = repo.CreateAdminAffiliatePayout(ctx, ports.CreateAdminAffiliatePayoutInput{
		PayoutBatchID:   "ffffffff-9999-9999-9999-999999999982",
		AffiliateID:     itAdminAffAffiliate,
		PayoutReference: "TRF_EMPTY",
		Notes:           "No approved rows remain.",
		ActorAdminUser:  itAdminAffAdmin,
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected no approved conversions after payout, got %v", err)
	}
}

func TestIssueAdminReferralRewardsCreatesVoucherRewardsOnce(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminReferralRewardFixture(t, pool)
	defer cleanupAdminReferralRewardFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	issued, err := repo.IssueAdminReferralRewards(ctx, ports.IssueAdminReferralRewardsInput{
		ActorAdminUser: itAdminRefRewardAdmin,
		Limit:          10,
	})
	if err != nil {
		t.Fatalf("issue referral rewards: %v", err)
	}
	if issued.ReferralCount != 1 ||
		issued.RewardCount != 2 ||
		issued.VoucherCount != 2 ||
		issued.CommissionRebateCount != 0 ||
		issued.TotalRewardMinor != 10000 ||
		issued.IssuedAt.IsZero() {
		t.Fatalf("unexpected issue result: %+v", issued)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var referralStatus string
		var rewarded bool
		if err := tx.QueryRow(context.Background(), `
			select status, rewarded_at is not null
			from referrals
			where referral_id = $1
		`, itAdminRefRewardReferral).Scan(&referralStatus, &rewarded); err != nil {
			t.Fatalf("read referral reward status: %v", err)
		}
		if referralStatus != "rewarded" || !rewarded {
			t.Fatalf("expected referral to be rewarded, status=%q rewarded=%v", referralStatus, rewarded)
		}

		var rewardCount int
		var voucherCount int
		var promotionCount int
		var singleUseCount int
		if err := tx.QueryRow(context.Background(), `
			select
				count(*)::int,
				count(*) filter (where rr.reward_kind = 'voucher' and rr.status = 'issued')::int,
				count(p.promotion_id)::int,
				count(*) filter (
					where p.usage_limit_global = 1
						and p.usage_limit_per_customer = 1
						and p.funding_source = 'business'
						and p.scope = 'store'
				)::int
			from referral_rewards rr
			left join promotions p on p.promotion_id = rr.promotion_id
			where rr.referral_id = $1
		`, itAdminRefRewardReferral).Scan(&rewardCount, &voucherCount, &promotionCount, &singleUseCount); err != nil {
			t.Fatalf("read referral rewards: %v", err)
		}
		if rewardCount != 2 || voucherCount != 2 || promotionCount != 2 || singleUseCount != 2 {
			t.Fatalf("expected two issued single-use voucher rewards, rewards=%d vouchers=%d promotions=%d singleUse=%d",
				rewardCount, voucherCount, promotionCount, singleUseCount)
		}

		var metadataSource string
		if err := tx.QueryRow(context.Background(), `
			select metadata->>'source'
			from referral_rewards
			where referral_id = $1
			order by beneficiary_type
			limit 1
		`, itAdminRefRewardReferral).Scan(&metadataSource); err != nil {
			t.Fatalf("read reward metadata: %v", err)
		}
		if metadataSource != "admin_reward_issue" {
			t.Fatalf("expected reward metadata source, got %q", metadataSource)
		}
	})

	again, err := repo.IssueAdminReferralRewards(ctx, ports.IssueAdminReferralRewardsInput{
		ActorAdminUser: itAdminRefRewardAdmin,
		Limit:          10,
	})
	if err != nil {
		t.Fatalf("issue referral rewards again: %v", err)
	}
	if again.RewardCount != 0 || again.ReferralCount != 0 {
		t.Fatalf("reward issuing should be idempotent, got %+v", again)
	}
}

func TestCreateAdminReferralCodeReturnsRecentProgrammeCode(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminReferralCodeFixture(t, pool)
	defer cleanupAdminReferralCodeFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()
	businessID := common.ID(itAdminRefCodeBiz)

	code, err := repo.CreateAdminReferralCode(ctx, ports.CreateAdminReferralCodeInput{
		ReferralCodeID: common.ID(itAdminRefCode),
		ProgrammeID:    common.ID(itAdminRefCodeProgramme),
		BusinessID:     &businessID,
		OwnerType:      "business",
		Code:           "ITCODEAMA",
		Status:         "active",
		ActorAdminUser: common.ID(itAdminRefCodeAdmin),
	})
	if err != nil {
		t.Fatalf("create referral code: %v", err)
	}
	if code.BusinessID == nil ||
		*code.BusinessID != businessID ||
		code.OwnerBusinessID == nil ||
		*code.OwnerBusinessID != businessID ||
		code.OwnerLabel != "IT Referral Code Shop" ||
		code.BusinessName != "IT Referral Code Shop" ||
		code.BusinessHandle != "it-referral-code-shop" ||
		code.Code != "ITCODEAMA" ||
		code.Status != "active" {
		t.Fatalf("unexpected referral code record: %+v", code)
	}

	programmes, err := repo.ListAdminReferralProgrammes(ctx)
	if err != nil {
		t.Fatalf("list referral programmes: %v", err)
	}
	var found ports.AdminReferralProgrammeRecord
	for _, programme := range programmes {
		if programme.ProgrammeID == common.ID(itAdminRefCodeProgramme) {
			found = programme
			break
		}
	}
	if found.ProgrammeID.IsZero() {
		t.Fatal("expected seeded referral programme in admin list")
	}
	if len(found.RecentCodes) != 1 ||
		found.RecentCodes[0].ReferralCodeID != common.ID(itAdminRefCode) ||
		found.RecentCodes[0].OwnerLabel != "IT Referral Code Shop" {
		t.Fatalf("expected recent issued code on programme, got %+v", found.RecentCodes)
	}

	_, err = repo.CreateAdminReferralCode(ctx, ports.CreateAdminReferralCodeInput{
		ReferralCodeID: "eeeeeeee-3333-3333-3333-333333333332",
		ProgrammeID:    common.ID(itAdminRefCodeProgramme),
		BusinessID:     &businessID,
		OwnerType:      "business",
		Code:           "ITCODEAMA",
		Status:         "active",
		ActorAdminUser: common.ID(itAdminRefCodeAdmin),
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected duplicate code to be invalid, got %v", err)
	}
}

func seedAdminSubscriptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminSubscriptionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'standard' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-subscriptions@xtiitch.test', 'IT Subscriptions', 'hash', 'operator', true)
		`, itAdminSubAdmin)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Subscription Admin Shop', 'it-sub-admin-shop', 'verified')
		`, itAdminSubBiz, planID)
	})
}

func seedAdminPromotionRedemptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminPromotionRedemptionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'standard' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Promo Admin Shop', 'it-promo-admin-shop', 'verified')
		`, itAdminPromoBiz, planID)
		mustExec(t, tx, `
			insert into customers (customer_id, display_name)
			values ($1, 'Ama Applied'), ($2, 'Kojo Pending')
		`, itAdminPromoCustA, itAdminPromoCustB)
		mustExec(t, tx, `
			insert into promotions (
				promotion_id,
				business_id,
				code,
				title,
				description,
				discount_type,
				discount_value,
				funding_source,
				scope,
				status
			)
			values ($1, $2, 'ITPROMO10', 'IT Promo', 'Integration promotion', 'fixed', 1500, 'business', 'store', 'active')
		`, itAdminPromo, itAdminPromoBiz)
		mustExec(t, tx, `
			insert into promotion_redemptions (
				promotion_redemption_id,
				promotion_id,
				business_id,
				customer_id,
				discount_minor,
				status,
				redeemed_at,
				created_at
			)
			values
				($1, $2, $3, $4, 1500, 'applied', now() - interval '1 hour', now() - interval '1 hour'),
				($5, $2, $3, $6, 750, 'pending', null, now())
		`, itAdminPromoRedA, itAdminPromo, itAdminPromoBiz, itAdminPromoCustA, itAdminPromoRedB, itAdminPromoCustB)
	})
}

func seedAdminAffiliateConversionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminAffiliateConversionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'standard' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-affiliates@xtiitch.test', 'IT Affiliates', 'hash', 'operator', true)
		`, itAdminAffAdmin)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Affiliate Admin Shop', 'it-affiliate-admin-shop', 'verified')
		`, itAdminAffBiz, planID)
		mustExec(t, tx, `
			insert into customers (customer_id, display_name)
			values ($1, 'Affiliate Customer')
		`, itAdminAffCust)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'Affiliate Design', 'affiliate-design', 'active')
		`, itAdminAffDesign, itAdminAffBiz)
		mustExec(t, tx, `
			insert into orders (
				order_id,
				business_id,
				customer_id,
				design_id,
				order_type,
				size_mode,
				flow,
				channel,
				agreed_total_minor,
				settled_minor,
				status
			)
			values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 25000, 25000, 'confirmed')
		`, itAdminAffOrder, itAdminAffBiz, itAdminAffCust, itAdminAffDesign)
		mustExec(t, tx, `
			insert into affiliates (
				affiliate_id,
				code,
				display_name,
				commission_model,
				commission_rate,
				status
			)
			values ($1, 'ITAFFILIATE', 'IT Affiliate', 'percentage', 1000, 'active')
		`, itAdminAffAffiliate)
		mustExec(t, tx, `
			insert into affiliate_conversions (
				affiliate_conversion_id,
				affiliate_id,
				business_id,
				order_id,
				gross_minor,
				commission_minor,
				commission_model,
				commission_rate,
				status
			)
			values ($1, $2, $3, $4, 25000, 2500, 'percentage', 1000, 'pending')
		`, itAdminAffConversion, itAdminAffAffiliate, itAdminAffBiz, itAdminAffOrder)
	})
}

func seedAdminReferralRewardFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminReferralRewardFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'standard' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-referral-rewards@xtiitch.test', 'IT Referral Rewards', 'hash', 'operator', true)
		`, itAdminRefRewardAdmin)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Referral Reward Shop', 'it-referral-reward-shop', 'verified')
		`, itAdminRefRewardBiz, planID)
		mustExec(t, tx, `
			insert into customers (customer_id, display_name)
			values
				($1, 'Referral Referrer'),
				($2, 'Referral Referee')
		`, itAdminRefRewardReferrer, itAdminRefRewardReferee)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'Referral Reward Design', 'referral-reward-design', 'active')
		`, itAdminRefRewardDesign, itAdminRefRewardBiz)
		mustExec(t, tx, `
			insert into orders (
				order_id,
				business_id,
				customer_id,
				design_id,
				order_type,
				size_mode,
				flow,
				channel,
				agreed_total_minor,
				settled_minor,
				status
			)
			values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 50000, 50000, 'confirmed')
		`, itAdminRefRewardOrder, itAdminRefRewardBiz, itAdminRefRewardReferee, itAdminRefRewardDesign)
		mustExec(t, tx, `
			insert into referral_programmes (
				referral_programme_id,
				title,
				code_prefix,
				audience,
				referrer_reward_kind,
				referee_reward_kind,
				reward_type,
				reward_value,
				qualifying_order_min_minor,
				reward_hold_days,
				status
			)
			values ($1, 'IT Reward Programme', 'ITREWARD', 'customers', 'voucher', 'voucher', 'fixed', 5000, 10000, 0, 'active')
		`, itAdminRefRewardProgramme)
		mustExec(t, tx, `
			insert into referral_codes (
				referral_code_id,
				referral_programme_id,
				owner_type,
				owner_customer_id,
				code,
				status
			)
			values ($1, $2, 'customer', $3, 'ITREWARDAMA', 'active')
		`, itAdminRefRewardCode, itAdminRefRewardProgramme, itAdminRefRewardReferrer)
		mustExec(t, tx, `
			insert into referrals (
				referral_id,
				referral_programme_id,
				referral_code_id,
				business_id,
				order_id,
				referee_customer_id,
				referrer_customer_id,
				gross_minor,
				status,
				qualified_at,
				metadata
			)
			values ($1, $2, $3, $4, $5, $6, $7, 50000, 'qualified', now() - interval '1 day', '{"source":"integration"}')
		`, itAdminRefRewardReferral, itAdminRefRewardProgramme, itAdminRefRewardCode,
			itAdminRefRewardBiz, itAdminRefRewardOrder, itAdminRefRewardReferee, itAdminRefRewardReferrer)
	})
}

func seedAdminReferralCodeFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminReferralCodeFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'standard' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values ($1, $2, 'IT Referral Code Shop', 'it-referral-code-shop', 'verified', 'active')
		`, itAdminRefCodeBiz, planID)
		mustExec(t, tx, `
			insert into referral_programmes (
				referral_programme_id,
				title,
				code_prefix,
				audience,
				referrer_reward_kind,
				referee_reward_kind,
				reward_type,
				reward_value,
				qualifying_order_min_minor,
				reward_hold_days,
				status
			)
			values ($1, 'IT Code Programme', 'ITCODE', 'businesses', 'commission_rebate', 'none', 'fixed', 2500, 10000, 14, 'active')
		`, itAdminRefCodeProgramme)
	})
}

func seedAdminAdCampaignPaymentFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminAdCampaignPaymentFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'standard' limit 1`).Scan(&planID); err != nil {
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

func cleanupAdminSubscriptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminSubBiz)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminSubAdmin)
	})
}

func cleanupAdminAffiliateConversionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from admin_audit_events where actor_admin_user_id = $1`, itAdminAffAdmin)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminAffBiz)
		mustExec(t, tx, `delete from affiliates where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from customers where customer_id = $1`, itAdminAffCust)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminAffAdmin)
	})
}

func cleanupAdminReferralRewardFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from admin_audit_events where actor_admin_user_id = $1`, itAdminRefRewardAdmin)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminRefRewardBiz)
		mustExec(t, tx, `delete from referral_programmes where referral_programme_id = $1`, itAdminRefRewardProgramme)
		mustExec(t, tx, `delete from customers where customer_id = any($1)`,
			[]string{itAdminRefRewardReferrer, itAdminRefRewardReferee})
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminRefRewardAdmin)
	})
}

func cleanupAdminReferralCodeFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from referral_programmes where referral_programme_id = $1`, itAdminRefCodeProgramme)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminRefCodeBiz)
	})
}

func cleanupAdminAdCampaignPaymentFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminAdPayBiz)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminAdPayAdmin)
	})
}

func cleanupAdminPromotionRedemptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminPromoBiz)
		mustExec(t, tx, `delete from customers where customer_id = any($1)`,
			[]string{itAdminPromoCustA, itAdminPromoCustB})
	})
}
