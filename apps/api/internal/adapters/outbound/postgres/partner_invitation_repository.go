package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AffiliateAuthRepository) CreatePartnerInvitation(ctx context.Context, input ports.CreatePartnerInvitationInput) (ports.PartnerInvitationRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.PartnerInvitationRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err = setTenantBypass(ctx, tx); err != nil {
		return ports.PartnerInvitationRecord{}, err
	}
	var record ports.PartnerInvitationRecord
	err = tx.QueryRow(ctx, `
		insert into partner_invitations(partner_invitation_id,inviter_affiliate_id,invite_code,invitee_email)
		select $1::uuid,a.affiliate_id,$3,$4 from affiliates a
		where a.affiliate_id=$2::uuid and a.status<>'archived'
		  and not exists(select 1 from affiliate_accounts where lower(email)=lower($4))
		on conflict (inviter_affiliate_id, lower(invitee_email)) where accepted_at is null
		do update set invitee_email=excluded.invitee_email
		returning partner_invitation_id::text,invitee_email,invite_code,created_at
	`, input.InvitationID, input.InviterAffiliateID, input.InviteCode, input.InviteeEmail).Scan(&record.InvitationID, &record.InviteeEmail, &record.InviteCode, &record.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		var accountExists bool
		if queryErr := tx.QueryRow(ctx, `select exists(select 1 from affiliate_accounts where lower(email)=lower($1))`, input.InviteeEmail).Scan(&accountExists); queryErr != nil {
			return ports.PartnerInvitationRecord{}, queryErr
		}
		if accountExists {
			return ports.PartnerInvitationRecord{}, ports.ErrAffiliateEmailTaken
		}
		return ports.PartnerInvitationRecord{}, ports.ErrNotFound
	}
	if err != nil {
		return ports.PartnerInvitationRecord{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return ports.PartnerInvitationRecord{}, err
	}
	return record, nil
}
