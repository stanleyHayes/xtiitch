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

const (
	prBizA    = "88888888-0000-0000-0000-000000000001"
	prBizB    = "88888888-0000-0000-0000-000000000002"
	prCustA   = "88888888-0000-0000-0000-000000000011"
	prCustB   = "88888888-0000-0000-0000-000000000012"
	prDesignA = "88888888-0000-0000-0000-000000000021"
	prOrderA  = "88888888-0000-0000-0000-000000000031"
	prOrderB  = "88888888-0000-0000-0000-000000000032"
	prPromoA  = "88888888-0000-0000-0000-000000000041"
	prRedA    = "88888888-0000-0000-0000-000000000051"
	prRedB    = "88888888-0000-0000-0000-000000000052"
)

func prScope() common.TenantScope {
	return common.TenantScope{BusinessID: common.ID(prBizA)}
}

func seedPromotionReserveFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupPromotionReserveFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []string{prBizA, prBizB} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'Promo Shop', $3, 'verified')
			`, biz, planID, "it-pr-"+biz[len(biz)-4:])
		}
		mustExec(t, tx, `
			insert into customers (customer_id, display_name, email)
			values ($1, 'Promo Customer A', 'promo-a@example.com'),
				($2, 'Promo Customer B', 'promo-b@example.com')
		`, prCustA, prCustB)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'Promo Design', 'promo-design', 'active')
		`, prDesignA, prBizA)
		for _, order := range []struct {
			orderID    string
			customerID string
		}{
			{prOrderA, prCustA},
			{prOrderB, prCustB},
		} {
			mustExec(t, tx, `
				insert into orders (
					order_id, business_id, customer_id, design_id,
					order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status
				)
				values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 50000, 0, 'draft')
			`, order.orderID, prBizA, order.customerID, prDesignA)
		}
		mustExec(t, tx, `
			insert into promotions (
				promotion_id, business_id, code, title, description,
				discount_type, discount_value, usage_limit_global,
				funding_source, scope, status
			)
			values ($1, $2, 'SAVE10', 'Save ten', '', 'fixed', 5000, 1, 'business', 'store', 'active')
		`, prPromoA, prBizA)
	})
}

func cleanupPromotionReserveFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{prBizA, prBizB})
		mustExec(t, tx, `delete from customers where customer_id = any($1)`, []string{prCustA, prCustB})
	})
}

func TestReservePromotionAppliesDiscountAndCountsPendingLimit(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedPromotionReserveFixtures(t, pool)
	defer cleanupPromotionReserveFixtures(t, pool)

	repo := NewPromotionRepository(pool)
	ctx := context.Background()

	redemption, err := repo.ReservePromotion(ctx, prScope(), ports.ReservePromotionInput{
		RedemptionID:  common.ID(prRedA),
		BusinessID:    common.ID(prBizA),
		OrderID:       common.ID(prOrderA),
		CustomerID:    common.ID(prCustA),
		DesignID:      common.ID(prDesignA),
		Code:          "save10",
		SubtotalMinor: 50000,
	})
	if err != nil {
		t.Fatalf("reserve promotion: %v", err)
	}
	if redemption.PromotionID != common.ID(prPromoA) ||
		redemption.DiscountMinor != 5000 ||
		redemption.FundingSource != "business" {
		t.Fatalf("unexpected redemption: %+v", redemption)
	}

	_, err = repo.ReservePromotion(ctx, prScope(), ports.ReservePromotionInput{
		RedemptionID:  common.ID(prRedB),
		BusinessID:    common.ID(prBizA),
		OrderID:       common.ID(prOrderB),
		CustomerID:    common.ID(prCustB),
		DesignID:      common.ID(prDesignA),
		Code:          "SAVE10",
		SubtotalMinor: 50000,
	})
	if !errors.Is(err, ports.ErrPromotionUnavailable) {
		t.Fatalf("expected usage limit to count pending redemption, got %v", err)
	}
}
