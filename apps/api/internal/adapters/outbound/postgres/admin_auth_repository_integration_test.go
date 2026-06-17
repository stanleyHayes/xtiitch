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
	itAdminAffAdmin      = "77777777-7777-7777-7777-777777777772"
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

func cleanupAdminPromotionRedemptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminPromoBiz)
		mustExec(t, tx, `delete from customers where customer_id = any($1)`,
			[]string{itAdminPromoCustA, itAdminPromoCustB})
	})
}
