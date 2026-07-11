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

func seedAdminAffiliateConversionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminAffiliateConversionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
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
