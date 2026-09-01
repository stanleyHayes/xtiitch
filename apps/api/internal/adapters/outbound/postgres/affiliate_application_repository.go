package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AffiliateRepository) AffiliateCodeExists(ctx context.Context, code string) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return false, err
	}
	var exists bool
	err = tx.QueryRow(ctx, `
		select exists (
			-- The unique index reserves codes across every affiliate status,
			-- including archived records, so availability must do the same.
			select 1 from affiliates where lower(code) = lower($1)
			union all
			select 1 from affiliate_applications
			where lower(requested_code) = lower($1) and status = 'pending_review'
		)
	`, code).Scan(&exists)
	return exists, err
}

//nolint:funlen // long by construction: one large SQL statement plus its row scan. Splitting it would hide the query from its mapping, not simplify it.
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
	row := tx.QueryRow(ctx, `
		with settings as (
			select commission_bps, maturity_days
			from partner_programme_settings
			where settings_id and registration_open
		), application as (
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
		from settings
		where not exists (
			select 1
			from affiliates
			where lower(code) = lower($8)
		)
		on conflict (lower(email)) where status = 'pending_review'
		do update set
			applicant_type = excluded.applicant_type,
			display_name = excluded.display_name,
			contact_name = excluded.contact_name,
			phone = excluded.phone,
			website_url = excluded.website_url,
			requested_code = excluded.requested_code,
			audience_summary = excluded.audience_summary,
			promotion_channels = excluded.promotion_channels,
			consent_at = excluded.consent_at,
			metadata = excluded.metadata,
			updated_at = now()
		returning *
		), programme as (
			select programme.*, settings.commission_bps, settings.maturity_days
			from affiliate_programmes programme cross join settings
			where owner_type = 'platform' and is_default and status = 'active'
			limit 1
		), inserted_affiliate as (
			insert into affiliates (
				affiliate_id, entity_type, code, display_name, contact_name,
				email, phone, website_url, commission_model, commission_rate,
				purchase_commission_bps, first_paid_plan_commission_bps,
				cookie_window_days, payout_mode, status, notes,
				affiliate_programme_id, source_application_id
			)
			select $14::uuid, application.applicant_type, application.requested_code,
				application.display_name, application.contact_name, application.email,
				application.phone, application.website_url, 'percentage',
				programme.commission_bps,
				0,
				programme.commission_bps,
				programme.cookie_window_days, programme.payout_mode, 'active',
				concat('Self-service affiliate signup ', application.affiliate_application_id::text),
				programme.affiliate_programme_id, application.affiliate_application_id
			from application cross join programme
			returning affiliate_id, source_application_id
		), inserted_account as (
			insert into affiliate_accounts (affiliate_account_id, affiliate_id, email, status, invite_sent_at)
			select $15::uuid, inserted_affiliate.affiliate_id, application.email, 'invited', now()
			from inserted_affiliate cross join application
			returning affiliate_account_id
		), inserted_token as (
			insert into affiliate_activation_tokens (
				affiliate_activation_token_id, affiliate_account_id, token_hash, expires_at
			)
			select $16::uuid, affiliate_account_id, $17, $18 from inserted_account
			returning affiliate_activation_token_id
		)
		select
			application.affiliate_application_id::text,
			application.display_name,
			application.email,
			application.requested_code,
			application.status,
			application.created_at,
			inserted_affiliate.affiliate_id::text
		from application
		cross join inserted_affiliate
		cross join inserted_token
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
		input.AffiliateID.String(),
		input.AffiliateAccountID.String(),
		input.ActivationTokenID.String(),
		input.ActivationTokenHash,
		input.ActivationTokenExpiresAt,
	)
	var affiliateID string
	err = row.Scan(
		&record.ApplicationID,
		&record.DisplayName,
		&record.Email,
		&record.RequestedCode,
		&record.Status,
		&record.CreatedAt,
		&affiliateID,
	)
	if err != nil {
		if isAffiliateApplicationEmailConflict(err) {
			return ports.AffiliateApplicationRecord{}, ports.ErrAffiliateEmailTaken
		}
		if errors.Is(err, pgx.ErrNoRows) || isAffiliateApplicationCodeConflict(err) {
			return ports.AffiliateApplicationRecord{}, ports.ErrAffiliateCodeTaken
		}
		return ports.AffiliateApplicationRecord{}, err
	}

	commandTag, err := tx.Exec(ctx, `
		update affiliate_applications
		set status = 'approved', affiliate_id = $2::uuid,
			reviewed_at = now(),
			review_note = 'Automatically approved using the active default programme.',
			metadata = metadata || jsonb_build_object('approval_mode', 'self_service'),
			updated_at = now()
		where affiliate_application_id = $1::uuid
	`, record.ApplicationID.String(), affiliateID)
	if err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}
	if commandTag.RowsAffected() != 1 {
		return ports.AffiliateApplicationRecord{}, pgx.ErrNoRows
	}
	record.Status = "approved"

	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}
	return record, nil
}

func isAffiliateApplicationCodeConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgUniqueViolation &&
		(pgErr.ConstraintName == "affiliate_applications_pending_code_unique_idx" ||
			pgErr.ConstraintName == "affiliates_code_unique_idx")
}

func isAffiliateApplicationEmailConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation &&
		pgErr.ConstraintName == "affiliate_accounts_email_unique_idx"
}
