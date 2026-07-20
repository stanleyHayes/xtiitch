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
	prCollectionB     = "88888888-0000-0000-0000-000000000023"
	prDesignA         = "88888888-0000-0000-0000-000000000021"
	prDesignB         = "88888888-0000-0000-0000-000000000022"
	prOrderA          = "88888888-0000-0000-0000-000000000031"
	prOrderB          = "88888888-0000-0000-0000-000000000032"
	prOrderC          = "88888888-0000-0000-0000-000000000033"
	prPromoA          = "88888888-0000-0000-0000-000000000041"
	prPromoCollection = "88888888-0000-0000-0000-000000000042"
	prPromoDesign     = "88888888-0000-0000-0000-000000000043"
	prPromoBusiness   = "88888888-0000-0000-0000-000000000044"
	prPromoDuplicate  = "88888888-0000-0000-0000-000000000045"
	prPromoCross      = "88888888-0000-0000-0000-000000000046"
	prPromoContact    = "88888888-0000-0000-0000-000000000047"
	prRedA            = "88888888-0000-0000-0000-000000000051"
	prRedB            = "88888888-0000-0000-0000-000000000052"
	prRedC            = "88888888-0000-0000-0000-000000000053"
	prRedD            = "88888888-0000-0000-0000-000000000054"
	prRedContactA     = "88888888-0000-0000-0000-000000000055"
	prRedContactB     = "88888888-0000-0000-0000-000000000056"
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
			insert into customers (customer_id, display_name, email, phone)
			values ($1, 'Promo Customer A', 'promo-a@example.com', '(024) 123-4567'),
				($2, 'Promo Customer B', 'promo-b@example.com', '0249990000')
		`, prCustA, prCustB)
		mustExec(t, tx, `
			insert into collections (collection_id, business_id, name, handle, status)
			values ($1, $2, 'Promo Collection', 'promo-collection', 'active')
		`, prCollectionA, prBizA)
		mustExec(t, tx, `
			insert into collections (collection_id, business_id, name, handle, status)
			values ($1, $2, 'Other Promo Collection', 'other-promo-collection', 'active')
		`, prCollectionB, prBizB)
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

func TestBusinessPromotionManagementScopesTargetsAndArchives(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedPromotionReserveFixtures(t, pool)
	defer cleanupPromotionReserveFixtures(t, pool)

	repo := NewPromotionRepository(pool)
	ctx := context.Background()
	maxDiscount := int64(15000)
	globalLimit := 25
	perCustomerLimit := 1
	collectionID := common.ID(prCollectionA)

	created, err := repo.CreateBusinessPromotion(ctx, prScope(), ports.BusinessPromotionInput{
		PromotionID:           common.ID(prPromoBusiness),
		Code:                  "DASH20",
		Title:                 "Dashboard promo",
		Description:           "Twenty percent off selected collection",
		DiscountType:          "percentage",
		DiscountValue:         2000,
		MaxDiscountMinor:      &maxDiscount,
		MinSpendMinor:         30000,
		UsageLimitGlobal:      &globalLimit,
		UsageLimitPerCustomer: &perCustomerLimit,
		Scope:                 "collection",
		TargetCollectionID:    &collectionID,
		Status:                "active",
	})
	if err != nil {
		t.Fatalf("create business promotion: %v", err)
	}
	if created.BusinessID != common.ID(prBizA) ||
		created.FundingSource != "business" ||
		created.Scope != "collection" ||
		created.TargetCollectionID == nil ||
		*created.TargetCollectionID != collectionID {
		t.Fatalf("unexpected created business promotion: %+v", created)
	}

	records, err := repo.ListBusinessPromotions(ctx, prScope())
	if err != nil {
		t.Fatalf("list business promotions: %v", err)
	}
	if !businessPromotionExists(records, common.ID(prPromoBusiness), "DASH20", "active") {
		t.Fatalf("expected created promotion in tenant list, got %+v", records)
	}

	_, err = repo.CreateBusinessPromotion(ctx, prScope(), ports.BusinessPromotionInput{
		PromotionID:        common.ID(prPromoDuplicate),
		Code:               "DASH20",
		Title:              "Duplicate promo",
		DiscountType:       "fixed",
		DiscountValue:      5000,
		MinSpendMinor:      0,
		Scope:              "store",
		Status:             "active",
		TargetDesignID:     nil,
		TargetCollectionID: nil,
	})
	if !errors.Is(err, ports.ErrPromotionCodeTaken) {
		t.Fatalf("expected duplicate code rejection, got %v", err)
	}

	crossTenantCollectionID := common.ID(prCollectionB)
	_, err = repo.CreateBusinessPromotion(ctx, prScope(), ports.BusinessPromotionInput{
		PromotionID:        common.ID(prPromoCross),
		Code:               "CROSS20",
		Title:              "Cross tenant promo",
		DiscountType:       "fixed",
		DiscountValue:      5000,
		MinSpendMinor:      0,
		Scope:              "collection",
		TargetCollectionID: &crossTenantCollectionID,
		Status:             "active",
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected cross-tenant collection rejection, got %v", err)
	}

	designID := common.ID(prDesignA)
	updated, err := repo.UpdateBusinessPromotion(ctx, prScope(), ports.BusinessPromotionInput{
		PromotionID:    common.ID(prPromoBusiness),
		Code:           "DASH25",
		Title:          "Dashboard design promo",
		Description:    "A focused design discount",
		DiscountType:   "fixed",
		DiscountValue:  7500,
		MinSpendMinor:  10000,
		Scope:          "design",
		TargetDesignID: &designID,
		Status:         "paused",
	})
	if err != nil {
		t.Fatalf("update business promotion: %v", err)
	}
	if updated.Code != "DASH25" ||
		updated.Status != "paused" ||
		updated.Scope != "design" ||
		updated.TargetDesignID == nil ||
		*updated.TargetDesignID != designID ||
		updated.TargetCollectionID != nil {
		t.Fatalf("unexpected updated promotion: %+v", updated)
	}

	archived, err := repo.ArchiveBusinessPromotion(ctx, prScope(), common.ID(prPromoBusiness))
	if err != nil {
		t.Fatalf("archive business promotion: %v", err)
	}
	if archived.Status != "archived" {
		t.Fatalf("expected archived status, got %+v", archived)
	}
}

func businessPromotionExists(
	records []ports.BusinessPromotionRecord,
	promotionID common.ID,
	code string,
	status string,
) bool {
	for _, record := range records {
		if record.PromotionID == promotionID &&
			record.Code == code &&
			record.Status == status {
			return true
		}
	}
	return false
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

func TestReservePromotionCountsContactMatchedCustomers(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedPromotionReserveFixtures(t, pool)
	defer cleanupPromotionReserveFixtures(t, pool)

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into promotions (
				promotion_id, business_id, code, title, description,
				discount_type, discount_value, usage_limit_per_customer,
				funding_source, scope, status
			)
			values ($1, $2, 'PHONEONCE', 'Phone once', '', 'fixed', 5000, 1, 'business', 'store', 'active')
		`, prPromoContact, prBizA)
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
			-- 'applied' rows must carry redeemed_at (promotion_redemptions_check,
			-- 000024) — an applied redemption is by definition a completed one.
			values ($1, $2, $3, $4, $5, 5000, 'applied', now())
		`, prRedContactA, prPromoContact, prBizA, prOrderA, prCustA)
	})

	_, err := NewPromotionRepository(pool).ReservePromotion(context.Background(), prScope(), ports.ReservePromotionInput{
		RedemptionID:  common.ID(prRedContactB),
		BusinessID:    common.ID(prBizA),
		OrderID:       common.ID(prOrderB),
		CustomerID:    common.ID(prCustB),
		CustomerEmail: "fresh@example.com",
		CustomerPhone: "0241234567",
		DesignID:      common.ID(prDesignA),
		Code:          "PHONEONCE",
		SubtotalMinor: 50000,
	})
	if !errors.Is(err, ports.ErrPromotionUnavailable) {
		t.Fatalf("expected phone-matched customer limit to reject redemption, got %v", err)
	}
}
