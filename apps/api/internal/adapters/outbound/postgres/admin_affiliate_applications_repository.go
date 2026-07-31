package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminAffiliateApplications(
	ctx context.Context,
) ([]ports.AdminAffiliateApplicationRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminAffiliateApplicationsQuery()+`
		order by
			case a.status when 'pending_review' then 1 else 2 end,
			a.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateApplicationRecord{}
	for rows.Next() {
		record, err := scanAdminAffiliateApplication(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

func (repo AdminAuthRepository) DecideAdminAffiliateApplication(
	ctx context.Context,
	input ports.DecideAdminAffiliateApplicationInput,
) (ports.AdminAffiliateApplicationRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}

	var record ports.AdminAffiliateApplicationRecord
	if input.Decision == "approved" {
		record, err = approveAdminAffiliateApplication(ctx, tx, input)
	} else {
		record, err = rejectAdminAffiliateApplication(ctx, tx, input)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateApplicationRecord{}, ErrNotFound
		}
		if affiliateCodeTaken(err) || affiliateAccountEmailTaken(err) {
			return ports.AdminAffiliateApplicationRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminAffiliateApplicationRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}
	return record, nil
}

func approveAdminAffiliateApplication(
	ctx context.Context,
	tx pgx.Tx,
	input ports.DecideAdminAffiliateApplicationInput,
) (ports.AdminAffiliateApplicationRecord, error) {
	return scanAdminAffiliateApplication(tx.QueryRow(ctx, `
		with application as (
			select *
			from affiliate_applications
			where affiliate_application_id = $1::uuid
				and status = 'pending_review'
			for update
		),
		inserted_affiliate as (
			insert into affiliates (
				affiliate_id, entity_type, code, display_name, contact_name,
				email, phone, website_url, commission_model, commission_rate,
				purchase_commission_bps, first_paid_plan_commission_bps,
				cookie_window_days, payout_mode, status, notes,
				created_by_admin_user_id, updated_by_admin_user_id
			)
			select
				$2::uuid, applicant_type, requested_code, display_name, contact_name,
				email, phone, website_url, 'percentage', $3,
				$3, $4, $5, $6, 'active',
				concat('Approved affiliate application ', affiliate_application_id::text),
				$10::uuid, $10::uuid
			from application
			returning affiliate_id
		),
		inserted_account as (
			insert into affiliate_accounts (
				affiliate_account_id, affiliate_id, email, status
			)
			select $7::uuid, affiliate_id, application.email, 'invited'
			from inserted_affiliate
			join application on true
			returning affiliate_account_id
		),
		inserted_token as (
			insert into affiliate_activation_tokens (
				affiliate_activation_token_id, affiliate_account_id,
				token_hash, expires_at
			)
			select $8::uuid, affiliate_account_id, $9, $11
			from inserted_account
			returning affiliate_activation_token_id
		),
		updated as (
			update affiliate_applications a
			set status = 'approved',
				affiliate_id = inserted_affiliate.affiliate_id,
				reviewed_by_admin_user_id = $10::uuid,
				reviewed_at = now(),
				review_note = $12,
				updated_at = now()
			from inserted_affiliate, inserted_token
			where a.affiliate_application_id = $1::uuid
			returning a.*
		)
		`+adminAffiliateApplicationSelect("updated")+`
	`,
		input.ApplicationID.String(),
		input.AffiliateID.String(),
		input.PurchaseCommissionBPS,
		input.FirstPaidPlanCommissionBPS,
		input.CookieWindowDays,
		input.PayoutMode,
		input.AffiliateAccountID.String(),
		input.ActivationTokenID.String(),
		input.ActivationTokenHash,
		input.ActorAdminUser.String(),
		input.ActivationTokenExpiresAt,
		input.ReviewNote,
	))
}

func rejectAdminAffiliateApplication(
	ctx context.Context,
	tx pgx.Tx,
	input ports.DecideAdminAffiliateApplicationInput,
) (ports.AdminAffiliateApplicationRecord, error) {
	return scanAdminAffiliateApplication(tx.QueryRow(ctx, `
		with updated as (
			update affiliate_applications
			set status = 'rejected',
				reviewed_by_admin_user_id = $2::uuid,
				reviewed_at = now(),
				review_note = $3,
				updated_at = now()
			where affiliate_application_id = $1::uuid
				and status = 'pending_review'
			returning *
		)
		`+adminAffiliateApplicationSelect("updated")+`
	`, input.ApplicationID.String(), input.ActorAdminUser.String(), input.ReviewNote))
}

func adminAffiliateApplicationsQuery() string {
	return adminAffiliateApplicationSelect("affiliate_applications")
}

func adminAffiliateApplicationSelect(source string) string {
	return `
		select
			a.affiliate_application_id::text,
			a.applicant_type,
			a.display_name,
			a.contact_name,
			a.email,
			a.phone,
			a.website_url,
			a.requested_code,
			a.audience_summary,
			a.promotion_channels,
			a.status,
			coalesce(a.affiliate_id::text, ''),
			a.review_note,
			a.reviewed_at,
			a.created_at,
			a.updated_at
		from ` + source + ` a
	`
}

func scanAdminAffiliateApplication(row pgx.Row) (ports.AdminAffiliateApplicationRecord, error) {
	var record ports.AdminAffiliateApplicationRecord
	var affiliateID string
	var reviewedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.ApplicationID,
		&record.ApplicantType,
		&record.DisplayName,
		&record.ContactName,
		&record.Email,
		&record.Phone,
		&record.WebsiteURL,
		&record.RequestedCode,
		&record.AudienceSummary,
		&record.PromotionChannels,
		&record.Status,
		&affiliateID,
		&record.ReviewNote,
		&reviewedAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}
	if affiliateID != "" {
		id := common.ID(affiliateID)
		record.AffiliateID = &id
	}
	record.ReviewedAt = timestamptzPtr(reviewedAt)
	return record, nil
}
