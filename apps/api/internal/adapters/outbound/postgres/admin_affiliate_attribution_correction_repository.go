package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) CorrectAdminAffiliateAttribution(ctx context.Context, input ports.CorrectAdminAffiliateAttributionInput) (ports.AdminAffiliateAttributionCorrectionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateAttributionCorrectionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateAttributionCorrectionRecord{}, err
	}
	var record ports.AdminAffiliateAttributionCorrectionRecord
	err = tx.QueryRow(ctx, `
		with target as (
			select affiliate_id, code from affiliates
			where affiliate_id=$2::uuid and status='active' and owner_business_id is null and target_scope='platform'
		), corrected as (
			update affiliate_signups signup set
				affiliate_id=target.affiliate_id, code=target.code, attribution_model='manual',
				status='qualified', disqualified_at=null, disqualification_reason='',
				metadata=signup.metadata || jsonb_build_object('previous_affiliate_id', signup.affiliate_id::text, 'correction_reason', $3::text, 'corrected_by_admin_user_id', $4::text),
				updated_at=now()
			from target where signup.business_id=$1::uuid
			returning signup.affiliate_signup_id, signup.business_id, signup.affiliate_id,
				(metadata->>'previous_affiliate_id')::uuid as previous_affiliate_id, signup.updated_at
		)
		select corrected.affiliate_signup_id::text, corrected.business_id::text, corrected.affiliate_id::text,
			corrected.previous_affiliate_id::text, business.handle, target.code, $3::text, corrected.updated_at
		from corrected join businesses business on business.business_id=corrected.business_id cross join target
	`, input.BusinessID.String(), input.AffiliateID.String(), input.Reason, input.ActorAdminUser.String()).Scan(
		&record.SignupID, &record.BusinessID, &record.AffiliateID, &record.PreviousAffiliateID,
		&record.BusinessHandle, &record.AffiliateCode, &record.Reason, &record.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.AdminAffiliateAttributionCorrectionRecord{}, ports.ErrNotFound
	}
	if err != nil {
		return ports.AdminAffiliateAttributionCorrectionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateAttributionCorrectionRecord{}, err
	}
	return record, nil
}
