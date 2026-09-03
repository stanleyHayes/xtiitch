package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func TestUpdateDefaultAffiliateProgrammeConfiguresCommissionMaturityAndMilestones(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	const adminID = "94949494-1111-4111-8111-111111111111"
	defer inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `update partner_milestones set threshold=10,title='First major win',reward_description='Configured reward and achievement recognition.',status='active' where threshold=12`)
		mustExec(t, tx, `update affiliate_programmes set default_first_paid_plan_commission_bps=2000,hold_days=14 where owner_type='platform' and is_default`)
		mustExec(t, tx, `delete from admin_users where admin_user_id=$1`, adminID)
	})
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `insert into admin_users(admin_user_id,email,display_name,password_hash,role,is_active) values($1,'milestones-it@xtiitch.test','Milestones IT','hash','operator',true)`, adminID)
	})

	repo := NewAdminAuthRepository(pool)
	programmes, err := repo.ListAdminAffiliateProgrammes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var programme ports.AdminAffiliateProgrammeRecord
	for _, candidate := range programmes {
		if candidate.OwnerType == "platform" && candidate.IsDefault {
			programme = candidate
			break
		}
	}
	if programme.AffiliateProgrammeID.IsZero() || len(programme.Milestones) != 5 {
		t.Fatalf("expected default programme and five milestones, got %+v", programme)
	}
	milestones := append([]ports.AdminPartnerMilestoneRecord(nil), programme.Milestones...)
	milestones[0].Threshold = 12
	milestones[0].Title = "Configured first win"
	milestones[0].RewardDescription = "Operator-approved merchandise reward."

	updated, err := repo.UpdateAdminAffiliateProgramme(context.Background(), ports.UpdateAdminAffiliateProgrammeInput{
		AffiliateProgrammeID: programme.AffiliateProgrammeID,
		Name:                 programme.Name, Description: programme.Description, Status: programme.Status,
		DefaultPurchaseCommissionBPS: 0, DefaultFirstPaidPlanCommissionBPS: 2100,
		CookieWindowDays: programme.CookieWindowDays, HoldDays: 21,
		PayoutMode: programme.PayoutMode, MinimumPayoutMinor: programme.MinimumPayoutMinor,
		AllowedTargetScope: programme.AllowedTargetScope, ActorAdminUser: adminID,
		Milestones: milestones,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Milestones[0].Threshold != 12 || updated.Milestones[0].RewardDescription != "Operator-approved merchandise reward." {
		t.Fatalf("milestone update was not returned: %+v", updated.Milestones[0])
	}
	inBypass(t, pool, func(tx pgx.Tx) {
		var commissionBPS, maturityDays int
		if err := tx.QueryRow(context.Background(), `select commission_bps,maturity_days from partner_programme_settings limit 1`).Scan(&commissionBPS, &maturityDays); err != nil {
			t.Fatal(err)
		}
		if commissionBPS != 2100 || maturityDays != 21 {
			t.Fatalf("programme settings did not synchronize: commission=%d maturity=%d", commissionBPS, maturityDays)
		}
	})
}
