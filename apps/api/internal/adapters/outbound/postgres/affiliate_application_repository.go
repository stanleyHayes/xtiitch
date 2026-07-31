package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AffiliateRepository) SubmitAffiliateApplication(
	ctx context.Context,
	input ports.SubmitAffiliateApplicationInput,
) (ports.AffiliateApplicationRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}

	var record ports.AffiliateApplicationRecord
	err = tx.QueryRow(ctx, `
		insert into affiliate_applications (
			affiliate_application_id,
			applicant_type,
			display_name,
			contact_name,
			email,
			phone,
			website_url,
			requested_code,
			audience_summary,
			promotion_channels,
			consent_at,
			metadata
		)
		select
			$1::uuid,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10::text[],
			$11,
			jsonb_build_object(
				'ip_hash', $12::text,
				'user_agent', $13::text,
				'source', 'public_api'
			)
		where not exists (
			select 1
			from affiliates
			where lower(code) = lower($8)
				and status <> 'archived'
		)
		on conflict (lower(email)) where status = 'pending_review'
		do update set updated_at = affiliate_applications.updated_at
		returning
			affiliate_application_id::text,
			display_name,
			email,
			requested_code,
			status,
			created_at
	`,
		input.ApplicationID.String(),
		input.ApplicantType,
		input.DisplayName,
		input.ContactName,
		input.Email,
		input.Phone,
		input.WebsiteURL,
		input.RequestedCode,
		input.AudienceSummary,
		input.PromotionChannels,
		input.ConsentAt,
		input.IPHash,
		input.UserAgent,
	).Scan(
		&record.ApplicationID,
		&record.DisplayName,
		&record.Email,
		&record.RequestedCode,
		&record.Status,
		&record.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || isAffiliateApplicationCodeConflict(err) {
			return ports.AffiliateApplicationRecord{}, ports.ErrAffiliateCodeTaken
		}
		return ports.AffiliateApplicationRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}
	return record, nil
}

func isAffiliateApplicationCodeConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgUniqueViolation &&
		pgErr.ConstraintName == "affiliate_applications_pending_code_unique_idx"
}
