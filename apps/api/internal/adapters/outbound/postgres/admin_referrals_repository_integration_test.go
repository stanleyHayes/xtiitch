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

func seedAdminReferralRewardFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminReferralRewardFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
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

func seedAdminReferralCodeFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminReferralCodeFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
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

func cleanupAdminReferralCodeFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from referral_programmes where referral_programme_id = $1`, itAdminRefCodeProgramme)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminRefCodeBiz)
	})
}
