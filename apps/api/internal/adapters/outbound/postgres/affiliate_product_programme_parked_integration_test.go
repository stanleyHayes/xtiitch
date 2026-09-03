package postgres

import (
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestBusinessProductAffiliateRecordsRemainPersistedButParked(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)

	programmeID := "95959595-1111-4111-8111-111111111111"
	affiliateID := "95959595-2222-4222-8222-222222222222"
	defer inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from affiliates where affiliate_id=$1`, affiliateID)
		mustExec(t, tx, `delete from affiliate_programmes where affiliate_programme_id=$1`, programmeID)
	})

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `insert into affiliate_programmes(
			affiliate_programme_id,owner_type,business_id,name,status,
			default_purchase_commission_bps,default_first_paid_plan_commission_bps,
			allowed_target_scope)
			values($1,'business',$2,'Future product programme','active',1500,2000,'product')`,
			programmeID, itAdminAffBiz)
		mustExec(t, tx, `insert into affiliates(
			affiliate_id,affiliate_programme_id,owner_business_id,code,display_name,
			commission_model,commission_rate,purchase_commission_bps,
			first_paid_plan_commission_bps,status,target_scope)
			values($1,$2,$3,'PARKEDPRODUCT','Parked Product Affiliate',
			'percentage',1500,1500,2000,'active','product')`,
			affiliateID, programmeID, itAdminAffBiz)

		var programmeStatus string
		var purchaseBPS, planBPS int
		if err := tx.QueryRow(t.Context(), `select status,default_purchase_commission_bps,
			default_first_paid_plan_commission_bps from affiliate_programmes
			where affiliate_programme_id=$1`, programmeID).Scan(&programmeStatus, &purchaseBPS, &planBPS); err != nil {
			t.Fatal(err)
		}
		if programmeStatus != "paused" || purchaseBPS != 0 || planBPS != 0 {
			t.Fatalf("business programme was not parked: status=%s purchase=%d plan=%d", programmeStatus, purchaseBPS, planBPS)
		}

		var affiliateStatus string
		var rate int64
		if err := tx.QueryRow(t.Context(), `select status,commission_rate,purchase_commission_bps,
			first_paid_plan_commission_bps from affiliates where affiliate_id=$1`, affiliateID).
			Scan(&affiliateStatus, &rate, &purchaseBPS, &planBPS); err != nil {
			t.Fatal(err)
		}
		if affiliateStatus != "paused" || rate != 0 || purchaseBPS != 0 || planBPS != 0 {
			t.Fatalf("business affiliate was not parked: status=%s rate=%d purchase=%d plan=%d", affiliateStatus, rate, purchaseBPS, planBPS)
		}
	})
}
