package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const itAdminAffAutomaticPayout = "ffffffff-9999-4999-8999-999999999983"
const itAdminAffAdjustment = "eeeeeeee-9999-4999-8999-999999999984"

func TestListAdminAffiliatesQualifiesJoinedSortColumns(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	records, err := NewAdminAuthRepository(pool).ListAdminAffiliates(context.Background())
	if err != nil {
		t.Fatalf("list admin affiliates: %v", err)
	}
	for _, record := range records {
		if record.AffiliateID == common.ID(itAdminAffAffiliate) {
			return
		}
	}
	t.Fatalf("expected seeded affiliate %s in admin list", itAdminAffAffiliate)
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

	adjustment, err := repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "reversed",
		Reason:         "Post-payout reversal.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("create settled conversion adjustment: %v", err)
	}
	if adjustment.ConversionType != "adjustment" || adjustment.Status != "approved" || adjustment.CommissionMinor != -2500 {
		t.Fatalf("expected approved negative adjustment, got %+v", adjustment)
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

func TestAdminAffiliateReadModelIncludesCompleteHistoryAndInvitations(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `insert into affiliate_conversions(
			affiliate_id,affiliate_programme_id,programme_owner_type,funding_source,business_id,
			conversion_type,gross_minor,commission_minor,commission_model,commission_rate,
			attribution_model,status,approved_at,source_conversion_id,adjustment_event_signature)
		select affiliate_id,affiliate_programme_id,programme_owner_type,funding_source,business_id,
			'adjustment',-1,-1,commission_model,commission_rate,attribution_model,'approved',now(),affiliate_conversion_id,
			'admin-history-' || series::text
		from affiliate_conversions cross join generate_series(1,6) series
		where affiliate_conversion_id=$1`, itAdminAffConversion)
		mustExec(t, tx, `insert into partner_invitations(partner_invitation_id,inviter_affiliate_id,invite_code,invitee_email)
			values('78787878-1111-4111-8111-111111111111',$1,'admin-history-invite','invitee@example.com')`, itAdminAffAffiliate)
	})

	records, err := NewAdminAuthRepository(pool).ListAdminAffiliateAttribution(context.Background())
	if err != nil {
		t.Fatalf("list Affiliate operations history: %v", err)
	}
	for _, record := range records {
		if record.AffiliateID != common.ID(itAdminAffAffiliate) {
			continue
		}
		if len(record.RecentConversions) != 7 {
			t.Fatalf("expected complete seven-row commission history, got %d", len(record.RecentConversions))
		}
		if len(record.Invitations) != 1 || record.Invitations[0].InviteeEmail != "invitee@example.com" {
			t.Fatalf("expected invitation monitoring row, got %+v", record.Invitations)
		}
		return
	}
	t.Fatal("expected Affiliate read model")
}

func TestAffiliateSettlementHoldBlocksManualAndAutomaticPayoutsUntilReleased(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	now := time.Now().UTC()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update affiliate_conversions set hold_until=$2 where affiliate_conversion_id=$1`, itAdminAffConversion, now.Add(-time.Hour))
		mustExec(t, tx, `insert into affiliate_payout_profiles(affiliate_id,payout_method,account_name,provider_name,account_identifier_encrypted,account_identifier_last4,status,provider_recipient_ref)
			values($1,'mobile_money','IT Affiliate','MTN','encrypted','0000','verified','RCP_IT_AFF_HOLD')`, itAdminAffAffiliate)
		mustExec(t, tx, `insert into admin_settlement_review_holds(business_id,reason,placed_by_admin_user_id)
			values($1,'Affiliate commission under review',$2)`, itAdminAffBiz, itAdminAffAdmin)
	})

	repo := NewAdminAuthRepository(pool)
	_, err := repo.CreateAdminAffiliatePayout(context.Background(), ports.CreateAdminAffiliatePayoutInput{
		PayoutBatchID: itAdminAffPayout, AffiliateID: itAdminAffAffiliate,
		PayoutReference: "TRF_IT_AFF_HOLD", Notes: "Must remain held.", ActorAdminUser: itAdminAffAdmin,
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected active settlement hold to block manual payout, got %v", err)
	}
	if _, claimed, err := repo.ClaimDueAffiliatePayout(context.Background(), common.ID(itAdminAffAutomaticPayout), now); err != nil {
		t.Fatalf("claim held automatic payout: %v", err)
	} else if claimed {
		t.Fatal("expected active settlement hold to block automatic payout")
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update admin_settlement_review_holds set is_active=false,released_by_admin_user_id=$2,released_at=$3,updated_at=$3 where business_id=$1`, itAdminAffBiz, itAdminAffAdmin, now)
	})
	dispatch, claimed, err := repo.ClaimDueAffiliatePayout(context.Background(), common.ID(itAdminAffAutomaticPayout), now)
	if err != nil {
		t.Fatalf("claim released automatic payout: %v", err)
	}
	if !claimed || dispatch.AmountMinor != 2500 || dispatch.AffiliateID != common.ID(itAdminAffAffiliate) {
		t.Fatalf("expected released commission to become claimable, got claimed=%v dispatch=%+v", claimed, dispatch)
	}
}

func TestAutomaticAffiliatePayoutNetsApprovedNegativeAdjustments(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	now := time.Now().UTC()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update affiliate_conversions set status='approved',approved_at=$2 where affiliate_conversion_id=$1`, itAdminAffConversion, now)
		mustExec(t, tx, `insert into affiliate_conversions(
			affiliate_conversion_id,affiliate_id,affiliate_programme_id,programme_owner_type,
			funding_source,business_id,conversion_type,gross_minor,commission_minor,
			commission_model,commission_rate,attribution_model,status,approved_at,
			source_conversion_id,adjustment_event_signature,reversal_reason)
			select $1,affiliate_id,affiliate_programme_id,programme_owner_type,funding_source,
				business_id,'adjustment',-10000,-1000,commission_model,commission_rate,
				attribution_model,'approved',$3,affiliate_conversion_id,'it:net-adjustment','Partial refund'
			from affiliate_conversions where affiliate_conversion_id=$2`, itAdminAffAdjustment, itAdminAffConversion, now)
		mustExec(t, tx, `insert into affiliate_payout_profiles(affiliate_id,payout_method,account_name,provider_name,account_identifier_encrypted,account_identifier_last4,status,provider_recipient_ref)
			values($1,'mobile_money','IT Affiliate','MTN','encrypted','0000','verified','RCP_IT_AFF_NET')`, itAdminAffAffiliate)
	})

	dispatch, claimed, err := NewAdminAuthRepository(pool).ClaimDueAffiliatePayout(
		context.Background(), common.ID(itAdminAffAutomaticPayout), now,
	)
	if err != nil {
		t.Fatalf("claim net Affiliate payout: %v", err)
	}
	if !claimed || dispatch.AmountMinor != 1500 {
		t.Fatalf("expected GHS 15.00 net payout, got claimed=%v dispatch=%+v", claimed, dispatch)
	}
	inBypass(t, pool, func(tx pgx.Tx) {
		var linked int
		if err := tx.QueryRow(context.Background(), `select count(*)::int from affiliate_conversions where payout_batch_id=$1`, itAdminAffAutomaticPayout).Scan(&linked); err != nil {
			t.Fatalf("count netted payout rows: %v", err)
		}
		if linked != 2 {
			t.Fatalf("expected source commission and adjustment in one payout, got %d rows", linked)
		}
	})
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
		mustExec(t, tx, `delete from affiliate_payout_batches where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from affiliate_portal_audit_events where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from partner_milestone_achievements where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from partner_invitations where inviter_affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from affiliate_conversions where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from affiliate_attribution_reservations where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from affiliate_clicks where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from admin_audit_events where actor_admin_user_id = $1`, itAdminAffAdmin)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminAffBiz)
		mustExec(t, tx, `delete from affiliates where affiliate_id = $1`, itAdminAffAffiliate)
		mustExec(t, tx, `delete from customers where customer_id = $1`, itAdminAffCust)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminAffAdmin)
	})
}

// Item 4: an individual suspicious commission can be held and released without
// losing the status it carried beforehand, and a held commission must never be
// picked up by a manual or automatic payout while the hold stands.
func TestAffiliateCommissionHoldPausesPayoutAndReleaseRestoresPriorStatus(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	approved, err := repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "approved",
		Reason:         "Matured for payout.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("approve affiliate conversion: %v", err)
	}
	if approved.Status != "approved" {
		t.Fatalf("expected approved conversion, got %+v", approved)
	}

	held, err := repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "held",
		Reason:         "Suspicious referral pattern under review.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("hold affiliate commission: %v", err)
	}
	if held.Status != "held" || held.PreHoldStatus != "approved" {
		t.Fatalf("expected held conversion restoring to approved, got %+v", held)
	}
	if held.HoldReason != "Suspicious referral pattern under review." || held.HoldPlacedAt == nil {
		t.Fatalf("expected recorded hold reason and timestamp, got %+v", held)
	}
	if held.CommissionMinor != approved.CommissionMinor {
		t.Fatalf("hold must not change the commission amount, got %d", held.CommissionMinor)
	}

	if _, err := repo.CreateAdminAffiliatePayout(ctx, ports.CreateAdminAffiliatePayoutInput{
		PayoutBatchID: itAdminAffPayout, AffiliateID: itAdminAffAffiliate,
		PayoutReference: "TRF_IT_AFF_COMMISSION_HOLD", Notes: "Must skip the held commission.",
		ActorAdminUser: itAdminAffAdmin,
	}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected held commission to leave nothing payable, got %v", err)
	}

	released, err := repo.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   itAdminAffConversion,
		Status:         "released",
		Reason:         "Review cleared the referral.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("release affiliate commission hold: %v", err)
	}
	if released.Status != "approved" {
		t.Fatalf("expected release to restore the pre-hold status, got %+v", released)
	}
	if released.PreHoldStatus != "" || released.HoldReason != "" || released.HoldReleasedAt == nil {
		t.Fatalf("expected cleared hold state with a release timestamp, got %+v", released)
	}

	payout, err := repo.CreateAdminAffiliatePayout(ctx, ports.CreateAdminAffiliatePayoutInput{
		PayoutBatchID: itAdminAffPayout, AffiliateID: itAdminAffAffiliate,
		PayoutReference: "TRF_IT_AFF_COMMISSION_RELEASED", Notes: "Released commission is payable.",
		ActorAdminUser: itAdminAffAdmin,
	})
	if err != nil {
		t.Fatalf("pay out released commission: %v", err)
	}
	if payout.CommissionMinor != approved.CommissionMinor || payout.ConversionCount != 1 {
		t.Fatalf("expected the released commission to settle once, got %+v", payout)
	}
}
