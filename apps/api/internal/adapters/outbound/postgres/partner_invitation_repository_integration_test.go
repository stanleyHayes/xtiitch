package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestCreatePartnerInvitationReusesPendingInviteWithoutFinancialRelationship(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)
	defer inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from partner_invitations where inviter_affiliate_id=$1`, itAdminAffAffiliate)
	})

	repo := NewAffiliateAuthRepository(pool)
	first, err := repo.CreatePartnerInvitation(context.Background(), ports.CreatePartnerInvitationInput{
		InvitationID: "91919191-1111-4111-8111-111111111111", InviterAffiliateID: common.ID(itAdminAffAffiliate),
		InviteCode: "invite-one", InviteeEmail: "friend@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	second, err := repo.CreatePartnerInvitation(context.Background(), ports.CreatePartnerInvitationInput{
		InvitationID: "91919191-2222-4222-8222-222222222222", InviterAffiliateID: common.ID(itAdminAffAffiliate),
		InviteCode: "invite-two", InviteeEmail: "friend@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.InvitationID != second.InvitationID || second.InviteCode != "invite-one" {
		t.Fatalf("expected pending invite reuse, first=%+v second=%+v", first, second)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var columns int
		if err := tx.QueryRow(context.Background(), `select count(*) from information_schema.columns where table_name='partner_invitations' and column_name in ('commission_minor','reward_minor','parent_affiliate_id')`).Scan(&columns); err != nil {
			t.Fatal(err)
		}
		if columns != 0 {
			t.Fatalf("partner invitations must not carry financial/downline fields, found %d", columns)
		}
	})
}

func TestInvitedAffiliateSignupMarksInvitationAccepted(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)
	defer inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from partner_invitations where inviter_affiliate_id=$1`, itAdminAffAffiliate)
		mustExec(t, tx, `update affiliates set source_application_id=null where affiliate_id='92929292-2222-4222-8222-222222222222'`)
		mustExec(t, tx, `update affiliate_applications set status='withdrawn',affiliate_id=null where affiliate_application_id='92929292-1111-4111-8111-111111111111'`)
		mustExec(t, tx, `delete from affiliates where affiliate_id='92929292-2222-4222-8222-222222222222'`)
		mustExec(t, tx, `delete from affiliate_applications where affiliate_application_id='92929292-1111-4111-8111-111111111111'`)
	})

	invitationRepo := NewAffiliateAuthRepository(pool)
	_, err := invitationRepo.CreatePartnerInvitation(context.Background(), ports.CreatePartnerInvitationInput{
		InvitationID: "92929292-0000-4000-8000-000000000000", InviterAffiliateID: common.ID(itAdminAffAffiliate),
		InviteCode: "email-bound-invite", InviteeEmail: "invited@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}

	applicationRepo := NewAffiliateRepository(pool)
	_, err = applicationRepo.SubmitAffiliateApplication(context.Background(), ports.SubmitAffiliateApplicationInput{
		ApplicationID: "92929292-1111-4111-8111-111111111111", AffiliateID: "92929292-2222-4222-8222-222222222222",
		AffiliateAccountID: "92929292-3333-4333-8333-333333333333", ActivationTokenID: "92929292-4444-4444-8444-444444444444",
		ActivationTokenHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ActivationTokenExpiresAt: time.Now().Add(time.Hour), ApplicantType: "person",
		DisplayName: "Invited Affiliate", ContactName: "Invited Affiliate", Email: "invited@example.com", Phone: "+233200000000",
		RequestedCode: "INVITED-AFFILIATE", PromotionChannels: []string{"email"}, ConsentAt: time.Now(), InviteCode: "email-bound-invite",
	})
	if err != nil {
		t.Fatal(err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var acceptedID string
		var acceptedAt time.Time
		if err := tx.QueryRow(context.Background(), `select accepted_affiliate_id::text,accepted_at from partner_invitations where invite_code='email-bound-invite'`).Scan(&acceptedID, &acceptedAt); err != nil {
			t.Fatal(err)
		}
		if acceptedID != "92929292-2222-4222-8222-222222222222" || acceptedAt.IsZero() {
			t.Fatalf("invitation was not accepted: id=%q at=%v", acceptedID, acceptedAt)
		}
	})
}
