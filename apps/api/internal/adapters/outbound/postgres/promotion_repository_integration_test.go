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
	prBizA            = "88888888-0000-0000-0000-000000000001"
	prBizB            = "88888888-0000-0000-0000-000000000002"
	prCustA           = "88888888-0000-0000-0000-000000000011"
	prCustB           = "88888888-0000-0000-0000-000000000012"
	prCollectionA     = "88888888-0000-0000-0000-000000000020"
	prDesignA         = "88888888-0000-0000-0000-000000000021"
	prDesignB         = "88888888-0000-0000-0000-000000000022"
	prOrderA          = "88888888-0000-0000-0000-000000000031"
	prOrderB          = "88888888-0000-0000-0000-000000000032"
	prOrderC          = "88888888-0000-0000-0000-000000000033"
	prPromoA          = "88888888-0000-0000-0000-000000000041"
	prPromoCollection = "88888888-0000-0000-0000-000000000042"
	prPromoDesign     = "88888888-0000-0000-0000-000000000043"
	prRedA            = "88888888-0000-0000-0000-000000000051"
	prRedB            = "88888888-0000-0000-0000-000000000052"
	prRedC            = "88888888-0000-0000-0000-000000000053"
	prRedD            = "88888888-0000-0000-0000-000000000054"
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
			insert into collections (collection_id, business_id, name, handle, status)
			values ($1, $2, 'Promo Collection', 'promo-collection', 'active')
		`, prCollectionA, prBizA)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'Other Promo Design', 'other-promo-design', 'active')
		`, prDesignB, prBizA)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, collection_id, title, handle, status)
			values ($1, $2, $3, 'Promo Design', 'promo-design', 'active')
		`, prDesignA, prBizA, prCollectionA)
		for _, order := range []struct {
			orderID    string
			customerID string
			designID   string
		}{
			{prOrderA, prCustA, prDesignA},
			{prOrderB, prCustB, prDesignA},
			{prOrderC, prCustB, prDesignB},
		} {
			mustExec(t, tx, `
				insert into orders (
					order_id, business_id, customer_id, design_id,
					order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status
				)
				values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 50000, 0, 'draft')
			`, order.orderID, prBizA, order.customerID, order.designID)
		}
		mustExec(t, tx, `
			insert into promotions (
				promotion_id, business_id, code, title, description,
				discount_type, discount_value, usage_limit_global,
				funding_source, scope, status
			)
			values ($1, $2, 'SAVE10', 'Save ten', '', 'fixed', 5000, 1, 'business', 'store', 'active')
		`, prPromoA, prBizA)
		mustExec(t, tx, `
			insert into promotions (
				promotion_id, business_id, code, title, description,
				discount_type, discount_value, funding_source, scope,
				target_collection_id, status
			)
			values ($1, $2, 'COLLECT10', 'Collection ten', '', 'fixed', 4000, 'business', 'collection', $3, 'active')
		`, prPromoCollection, prBizA, prCollectionA)
		mustExec(t, tx, `
			insert into promotions (
				promotion_id, business_id, code, title, description,
				discount_type, discount_value, funding_source, scope,
				target_design_id, status
			)
			values ($1, $2, 'DESIGN10', 'Design ten', '', 'fixed', 3000, 'business', 'design', $3, 'active')
		`, prPromoDesign, prBizA, prDesignA)
	})
}

func cleanupPromotionReserveFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{prBizA, prBizB})
		mustExec(t, tx, `delete from customers where customer_id = any($1)`, []string{prCustA, prCustB})
	})
}

func TestReservePromotionMatchesCollectionAndDesignTargets(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedPromotionReserveFixtures(t, pool)
	defer cleanupPromotionReserveFixtures(t, pool)

	repo := NewPromotionRepository(pool)
	ctx := context.Background()

	collectionRedemption, err := repo.ReservePromotion(ctx, prScope(), ports.ReservePromotionInput{
		RedemptionID:  common.ID(prRedA),
		BusinessID:    common.ID(prBizA),
		OrderID:       common.ID(prOrderA),
		CustomerID:    common.ID(prCustA),
		DesignID:      common.ID(prDesignA),
		Code:          "collect10",
		SubtotalMinor: 50000,
	})
	if err != nil {
		t.Fatalf("reserve collection promotion: %v", err)
	}
	if collectionRedemption.PromotionID != common.ID(prPromoCollection) ||
		collectionRedemption.DiscountMinor != 4000 {
		t.Fatalf("unexpected collection redemption: %+v", collectionRedemption)
	}

	_, err = repo.ReservePromotion(ctx, prScope(), ports.ReservePromotionInput{
		RedemptionID:  common.ID(prRedB),
		BusinessID:    common.ID(prBizA),
		OrderID:       common.ID(prOrderC),
		CustomerID:    common.ID(prCustB),
		DesignID:      common.ID(prDesignB),
		Code:          "COLLECT10",
		SubtotalMinor: 50000,
	})
	if !errors.Is(err, ports.ErrPromotionUnavailable) {
		t.Fatalf("expected collection promotion to reject another design, got %v", err)
	}

	designRedemption, err := repo.ReservePromotion(ctx, prScope(), ports.ReservePromotionInput{
		RedemptionID:  common.ID(prRedC),
		BusinessID:    common.ID(prBizA),
		OrderID:       common.ID(prOrderB),
		CustomerID:    common.ID(prCustB),
		DesignID:      common.ID(prDesignA),
		Code:          "DESIGN10",
		SubtotalMinor: 50000,
	})
	if err != nil {
		t.Fatalf("reserve design promotion: %v", err)
	}
	if designRedemption.PromotionID != common.ID(prPromoDesign) ||
		designRedemption.DiscountMinor != 3000 {
		t.Fatalf("unexpected design redemption: %+v", designRedemption)
	}

	_, err = repo.ReservePromotion(ctx, prScope(), ports.ReservePromotionInput{
		RedemptionID:  common.ID(prRedD),
		BusinessID:    common.ID(prBizA),
		OrderID:       common.ID(prOrderC),
		CustomerID:    common.ID(prCustB),
		DesignID:      common.ID(prDesignB),
		Code:          "DESIGN10",
		SubtotalMinor: 50000,
	})
	if !errors.Is(err, ports.ErrPromotionUnavailable) {
		t.Fatalf("expected design promotion to reject another design, got %v", err)
	}
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
