package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itAdminReverseBiz         = "66666666-2222-2222-2222-222222222221"
	itAdminReverseAdmin       = "77777777-2222-2222-2222-222222222221"
	itAdminReverseCustomer    = "aaaaaaaa-2222-2222-2222-222222222221"
	itAdminReverseDesign      = "bbbbbbbb-2222-2222-2222-222222222221"
	itAdminReverseOrder       = "cccccccc-2222-2222-2222-222222222221"
	itAdminReversePayment     = "dddddddd-2222-2222-2222-222222222221"
	itAdminReversePromotion   = "eeeeeeee-2222-2222-2222-222222222221"
	itAdminReverseRedemption  = "ffffffff-2222-2222-2222-222222222221"
	itAdminReverseAffiliate   = "99999999-2222-2222-2222-222222222221"
	itAdminReverseConversion  = "99999999-2222-2222-2222-222222222222"
	itAdminReverseProgramme   = "99999999-2222-2222-2222-222222222223"
	itAdminReverseCode        = "99999999-2222-2222-2222-222222222224"
	itAdminReverseReferral    = "99999999-2222-2222-2222-222222222225"
	itAdminReverseRewardA     = "99999999-2222-2222-2222-222222222226"
	itAdminReverseRewardB     = "99999999-2222-2222-2222-222222222227"
	itAdminReverseRewardPromo = "99999999-2222-2222-2222-222222222228"
	itAdminReverseProviderRef = "xt_reverse_it"
)

func TestReverseAdminMoneyPaymentVoidsGrowthLedgers(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminMoneyReversalFixture(t, pool)
	defer cleanupAdminMoneyReversalFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	record, err := repo.ReverseAdminMoneyPayment(ctx, ports.ReverseAdminMoneyPaymentInput{
		ProviderReference: itAdminReverseProviderRef,
		ActorAdminUser:    common.ID(itAdminReverseAdmin),
		Reason:            "Provider refund confirmed.",
	})
	if err != nil {
		t.Fatalf("reverse admin payment: %v", err)
	}
	if !record.PaymentReversed ||
		record.PaymentID != common.ID(itAdminReversePayment) ||
		record.OrderID == nil ||
		*record.OrderID != common.ID(itAdminReverseOrder) ||
		record.PromotionRedemptionCount != 1 ||
		record.AffiliateConversionCount != 1 ||
		record.ReferralCount != 1 ||
		record.ReferralRewardCount != 2 ||
		record.GeneratedPromotionCount != 1 {
		t.Fatalf("unexpected reversal record: %+v", record)
	}

	var paymentStatus, redemptionStatus, conversionStatus, referralStatus, rewardStatus, rewardPromotionStatus string
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(ctx, `
			select status
			from payments
			where payment_id = $1
		`, itAdminReversePayment).Scan(&paymentStatus); err != nil {
			t.Fatalf("read payment status: %v", err)
		}
		if err := tx.QueryRow(ctx, `
			select status
			from promotion_redemptions
			where promotion_redemption_id = $1
		`, itAdminReverseRedemption).Scan(&redemptionStatus); err != nil {
			t.Fatalf("read redemption status: %v", err)
		}
		if err := tx.QueryRow(ctx, `
			select status
			from affiliate_conversions
			where affiliate_conversion_id = $1
		`, itAdminReverseConversion).Scan(&conversionStatus); err != nil {
			t.Fatalf("read conversion status: %v", err)
		}
		if err := tx.QueryRow(ctx, `
			select status
			from referrals
			where referral_id = $1
		`, itAdminReverseReferral).Scan(&referralStatus); err != nil {
			t.Fatalf("read referral status: %v", err)
		}
		if err := tx.QueryRow(ctx, `
			select status
			from referral_rewards
			where referral_reward_id = $1
		`, itAdminReverseRewardA).Scan(&rewardStatus); err != nil {
			t.Fatalf("read reward status: %v", err)
		}
		if err := tx.QueryRow(ctx, `
			select status
			from promotions
			where promotion_id = $1
		`, itAdminReverseRewardPromo).Scan(&rewardPromotionStatus); err != nil {
			t.Fatalf("read reward promo status: %v", err)
		}
	})
	if paymentStatus != "reversed" ||
		redemptionStatus != "void" ||
		conversionStatus != "reversed" ||
		referralStatus != "void" ||
		rewardStatus != "void" ||
		rewardPromotionStatus != "archived" {
		t.Fatalf(
			"expected reversed/void statuses, got payment=%s redemption=%s conversion=%s referral=%s reward=%s promo=%s",
			paymentStatus,
			redemptionStatus,
			conversionStatus,
			referralStatus,
			rewardStatus,
			rewardPromotionStatus,
		)
	}

	again, err := repo.ReverseAdminMoneyPayment(ctx, ports.ReverseAdminMoneyPaymentInput{
		ProviderReference: itAdminReverseProviderRef,
		ActorAdminUser:    common.ID(itAdminReverseAdmin),
		Reason:            "Second operator check.",
	})
	if err != nil {
		t.Fatalf("reverse already reversed payment: %v", err)
	}
	if again.PaymentReversed ||
		again.PromotionRedemptionCount != 0 ||
		again.AffiliateConversionCount != 0 ||
		again.ReferralCount != 0 ||
		again.ReferralRewardCount != 0 ||
		again.GeneratedPromotionCount != 0 {
		t.Fatalf("expected idempotent reversal, got %+v", again)
	}
}

func seedAdminMoneyReversalFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminMoneyReversalFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-reversals@xtiitch.test', 'IT Reversals', 'hash', 'operator', true)
		`, itAdminReverseAdmin)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values ($1, $2, 'IT Reversal Shop', 'it-reversal-shop', 'verified', 'active')
		`, itAdminReverseBiz, planID)
		mustExec(t, tx, `
			insert into customers (customer_id, display_name)
			values ($1, 'IT Reversal Customer')
		`, itAdminReverseCustomer)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'Reversal Design', 'reversal-design', 'active')
		`, itAdminReverseDesign, itAdminReverseBiz)
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
			values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 40000, 40000, 'confirmed')
		`, itAdminReverseOrder, itAdminReverseBiz, itAdminReverseCustomer, itAdminReverseDesign)
		mustExec(t, tx, `
			insert into payments (
				payment_id,
				business_id,
				order_id,
				purpose,
				amount_minor,
				currency,
				method,
				provider_reference,
				status,
				commission_minor
			)
			values ($1, $2, $3, 'standard_full', 40000, 'GHS', 'momo', $4, 'succeeded', 1200)
		`, itAdminReversePayment, itAdminReverseBiz, itAdminReverseOrder, itAdminReverseProviderRef)
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
			values
				($1, $2, 'ITREV10', 'IT Reversal Promo', 'Reversal promo.', 'fixed', 1000, 'business', 'store', 'active'),
				($3, $2, null, 'IT Reversal Reward', 'Referral reward voucher.', 'fixed', 500, 'business', 'store', 'active')
		`, itAdminReversePromotion, itAdminReverseBiz, itAdminReverseRewardPromo)
		mustExec(t, tx, `
			insert into promotion_redemptions (
				promotion_redemption_id,
				promotion_id,
				business_id,
				order_id,
				customer_id,
				discount_minor,
				status,
				redeemed_at
			)
			values ($1, $2, $3, $4, $5, 1000, 'applied', now())
		`, itAdminReverseRedemption, itAdminReversePromotion, itAdminReverseBiz, itAdminReverseOrder, itAdminReverseCustomer)
		mustExec(t, tx, `
			insert into affiliates (
				affiliate_id,
				code,
				display_name,
				commission_model,
				commission_rate,
				status
			)
			values ($1, 'ITREVAFF', 'IT Reversal Affiliate', 'percentage', 1000, 'active')
		`, itAdminReverseAffiliate)
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
				status,
				approved_at
			)
			values ($1, $2, $3, $4, 40000, 4000, 'percentage', 1000, 'approved', now())
		`, itAdminReverseConversion, itAdminReverseAffiliate, itAdminReverseBiz, itAdminReverseOrder)
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
			values ($1, 'IT Reversal Referral', 'ITREVREF', 'customers', 'voucher', 'voucher', 'fixed', 500, 1000, 0, 'active')
		`, itAdminReverseProgramme)
		mustExec(t, tx, `
			insert into referral_codes (
				referral_code_id,
				referral_programme_id,
				business_id,
				owner_type,
				owner_business_id,
				code,
				status
			)
			values ($1, $2, $3, 'business', $3, 'ITREVREFAMA', 'active')
		`, itAdminReverseCode, itAdminReverseProgramme, itAdminReverseBiz)
		mustExec(t, tx, `
			insert into referrals (
				referral_id,
				referral_programme_id,
				referral_code_id,
				business_id,
				order_id,
				referee_customer_id,
				referrer_business_id,
				gross_minor,
				status,
				qualified_at,
				rewarded_at
			)
			values ($1, $2, $3, $4, $5, $6, $4, 40000, 'rewarded', now(), now())
		`, itAdminReverseReferral, itAdminReverseProgramme, itAdminReverseCode,
			itAdminReverseBiz, itAdminReverseOrder, itAdminReverseCustomer)
		mustExec(t, tx, `
			insert into referral_rewards (
				referral_reward_id,
				referral_id,
				business_id,
				beneficiary_type,
				beneficiary_customer_id,
				beneficiary_business_id,
				reward_kind,
				promotion_id,
				status,
				available_at,
				issued_at
			)
			values
				($1, $3, $4, 'referee', $5, null, 'voucher', $6, 'issued', now(), now()),
				($2, $3, $4, 'referrer', null, $4, 'commission_rebate', null, 'issued', now(), now())
		`, itAdminReverseRewardA, itAdminReverseRewardB, itAdminReverseReferral,
			itAdminReverseBiz, itAdminReverseCustomer, itAdminReverseRewardPromo)
	})
}

func cleanupAdminMoneyReversalFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from referral_rewards where referral_id = $1`, itAdminReverseReferral)
		mustExec(t, tx, `delete from referrals where referral_id = $1`, itAdminReverseReferral)
		mustExec(t, tx, `delete from referral_codes where referral_code_id = $1`, itAdminReverseCode)
		mustExec(t, tx, `delete from referral_programmes where referral_programme_id = $1`, itAdminReverseProgramme)
		mustExec(t, tx, `delete from affiliate_conversions where affiliate_conversion_id = $1`, itAdminReverseConversion)
		mustExec(t, tx, `delete from affiliates where affiliate_id = $1`, itAdminReverseAffiliate)
		mustExec(t, tx, `delete from promotion_redemptions where promotion_redemption_id = $1`, itAdminReverseRedemption)
		mustExec(t, tx, `delete from promotions where promotion_id = any($1)`,
			[]string{itAdminReversePromotion, itAdminReverseRewardPromo})
		mustExec(t, tx, `delete from payments where payment_id = $1`, itAdminReversePayment)
		mustExec(t, tx, `delete from orders where order_id = $1`, itAdminReverseOrder)
		mustExec(t, tx, `delete from designs where design_id = $1`, itAdminReverseDesign)
		mustExec(t, tx, `delete from customers where customer_id = $1`, itAdminReverseCustomer)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminReverseBiz)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminReverseAdmin)
	})
}
