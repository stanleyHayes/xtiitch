package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

func seedAdminPromotionRedemptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminPromotionRedemptionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
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

func cleanupAdminPromotionRedemptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminPromoBiz)
		mustExec(t, tx, `delete from customers where customer_id = any($1)`,
			[]string{itAdminPromoCustA, itAdminPromoCustB})
	})
}
