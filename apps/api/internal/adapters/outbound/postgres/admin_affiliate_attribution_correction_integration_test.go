package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestCorrectAdminAffiliateAttributionPreservesHistoryAndChangesFutureOwner(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)
	const targetID = "83838383-1111-4111-8111-111111111111"
	const signupID = "83838383-2222-4222-8222-222222222222"
	defer inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from affiliate_signups where affiliate_signup_id=$1`, signupID)
		mustExec(t, tx, `delete from affiliates where affiliate_id=$1`, targetID)
	})
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `insert into affiliates(affiliate_id,code,display_name,commission_model,commission_rate,status,target_scope) values($1,'TARGETAFF','Target Affiliate','percentage',2000,'active','platform')`, targetID)
		mustExec(t, tx, `insert into affiliate_signups(affiliate_signup_id,affiliate_id,subject_type,business_id,code,status) values($1,$2,'business',$3,'ITAFFILIATE','qualified')`, signupID, itAdminAffAffiliate, itAdminAffBiz)
	})
	record, err := NewAdminAuthRepository(pool).CorrectAdminAffiliateAttribution(context.Background(), ports.CorrectAdminAffiliateAttributionInput{
		BusinessID: common.ID(itAdminAffBiz), AffiliateID: common.ID(targetID),
		Reason: "duplicate attribution", ActorAdminUser: common.ID(itAdminAffAdmin),
	})
	if err != nil {
		t.Fatal(err)
	}
	if record.PreviousAffiliateID != common.ID(itAdminAffAffiliate) || record.AffiliateID != common.ID(targetID) {
		t.Fatalf("unexpected correction: %+v", record)
	}
	inBypass(t, pool, func(tx pgx.Tx) {
		var historical string
		if err := tx.QueryRow(context.Background(), `select affiliate_id::text from affiliate_conversions where affiliate_conversion_id=$1`, itAdminAffConversion).Scan(&historical); err != nil {
			t.Fatal(err)
		}
		if historical != itAdminAffAffiliate {
			t.Fatalf("historical conversion changed owner: %s", historical)
		}
	})
}
