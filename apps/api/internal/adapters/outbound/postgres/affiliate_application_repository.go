package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

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
	err = tx.QueryRow(ctx, `
		with application as (
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
			select * from affiliate_programmes
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
				programme.default_purchase_commission_bps,
				programme.default_purchase_commission_bps,
				programme.default_first_paid_plan_commission_bps,
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
		), approved as (
			update affiliate_applications
			set status = 'approved', affiliate_id = inserted_affiliate.affiliate_id,
				reviewed_at = now(), review_note = 'Automatically approved using the active default programme.',
				metadata = metadata || jsonb_build_object('approval_mode', 'self_service'), updated_at = now()
			from inserted_affiliate, inserted_token
			where affiliate_applications.affiliate_application_id = inserted_affiliate.source_application_id
			returning affiliate_applications.*
		)
		select
			affiliate_application_id::text,
			display_name,
			email,
			requested_code,
			status,
			created_at
		from approved
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
		(pgErr.ConstraintName == "affiliate_applications_pending_code_unique_idx" ||
			pgErr.ConstraintName == "affiliates_code_unique_idx" ||
			pgErr.ConstraintName == "affiliate_accounts_email_unique_idx")
}
