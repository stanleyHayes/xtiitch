package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminAdCampaigns(ctx context.Context) ([]ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminAdCampaignsQuery()+`
		order by
			case c.status
				when 'pending_review' then 1
				when 'active' then 2
				when 'paused' then 3
				when 'completed' then 4
				else 5
			end,
			c.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAdCampaignRecord{}
	for rows.Next() {
		record, err := scanAdminAdCampaignRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	paymentsByCampaign, err := listAdminAdCampaignPayments(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentPayments = paymentsByCampaign[records[index].CampaignID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminAdCampaign(
	ctx context.Context,
	input ports.CreateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := scanAdminAdCampaignRecord(tx.QueryRow(ctx, `
		with eligible_business as (
			select business_id
			from businesses b
			where b.business_id = $2::uuid
				and b.verification_status = 'verified'
				and b.operational_status = 'active'
				and (
					$3 <> 'promoted_design'
					or exists (
						select 1
						from designs d
						where d.business_id = b.business_id
							and d.design_id::text = $4
							and d.status = 'active'
					)
				)
		),
		inserted as (
			insert into ad_campaigns (
				campaign_id,
				advertiser_business_id,
				placement_type,
				target_ref_id,
				headline,
				description,
				status,
				pricing_model,
				budget_minor,
				daily_cap_minor,
				starts_at,
				ends_at,
				reviewed_by_admin_user_id,
				review_note,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			select
				$1::uuid,
				eligible_business.business_id,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				$11,
				$12,
				case when $7 in ('active', 'paused', 'completed') then $13::uuid else null end,
				$14,
				$13::uuid,
				$13::uuid
			from eligible_business
			returning *
		)
		`+adminAdCampaignSelect("inserted")+`
	`, input.CampaignID.String(),
		input.BusinessID.String(),
		input.PlacementType,
		input.TargetRefID,
		input.Headline,
		input.Description,
		input.Status,
		input.PricingModel,
		input.BudgetMinor,
		nullableInt64Arg(input.DailyCapMinor),
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
		input.ReviewNote,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignRecord{}, err
	}
	record.RecentPayments, err = listAdminAdCampaignPaymentsForCampaign(ctx, tx, record.CampaignID)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) UpdateAdminAdCampaign(
	ctx context.Context,
	input ports.UpdateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := scanAdminAdCampaignRecord(tx.QueryRow(ctx, `
		with eligible_business as (
			select business_id
			from businesses b
			where b.business_id = $2::uuid
				and b.verification_status = 'verified'
				and b.operational_status = 'active'
				and (
					$3 <> 'promoted_design'
					or exists (
						select 1
						from designs d
						where d.business_id = b.business_id
							and d.design_id::text = $4
							and d.status = 'active'
					)
				)
		),
		updated as (
			update ad_campaigns c
			set advertiser_business_id = eligible_business.business_id,
				placement_type = $3,
				target_ref_id = $4,
				headline = $5,
				description = $6,
				status = $7,
				pricing_model = $8,
				budget_minor = $9,
				daily_cap_minor = $10,
				starts_at = $11,
				ends_at = $12,
				reviewed_by_admin_user_id = case
					when $7 in ('active', 'paused', 'completed') then $13::uuid
					else c.reviewed_by_admin_user_id
				end,
				review_note = $14,
				updated_by_admin_user_id = $13::uuid,
				updated_at = now()
			from eligible_business
			where c.campaign_id = $1::uuid
				and c.status <> 'archived'
			returning c.*
		)
		`+adminAdCampaignSelect("updated")+`
	`, input.CampaignID.String(),
		input.BusinessID.String(),
		input.PlacementType,
		input.TargetRefID,
		input.Headline,
		input.Description,
		input.Status,
		input.PricingModel,
		input.BudgetMinor,
		nullableInt64Arg(input.DailyCapMinor),
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
		input.ReviewNote,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignRecord{}, err
	}
	record.RecentPayments, err = listAdminAdCampaignPaymentsForCampaign(ctx, tx, record.CampaignID)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminAdCampaign(
	ctx context.Context,
	input ports.ArchiveAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := scanAdminAdCampaignRecord(tx.QueryRow(ctx, `
		with updated as (
			update ad_campaigns
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where campaign_id = $1::uuid
			returning *
		)
		`+adminAdCampaignSelect("updated")+`
	`, input.CampaignID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignRecord{}, err
	}
	record.RecentPayments, err = listAdminAdCampaignPaymentsForCampaign(ctx, tx, record.CampaignID)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) GetAdminAdCampaignPaymentIntent(
	ctx context.Context,
	campaignID common.ID,
) (ports.AdminAdCampaignPaymentIntentRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}

	var intent ports.AdminAdCampaignPaymentIntentRecord
	var openPaymentID pgtype.Text
	var openProvider pgtype.Text
	var openProviderReference pgtype.Text
	var openPaymentURL pgtype.Text
	var openCurrency pgtype.Text
	var openStatus pgtype.Text
	var openFailureReason pgtype.Text
	var openAmountMinor pgtype.Int8
	var openCreatedAt pgtype.Timestamptz
	var openUpdatedAt pgtype.Timestamptz
	var openPaidAt pgtype.Timestamptz
	var openFailedAt pgtype.Timestamptz
	err = tx.QueryRow(ctx, `
		with paid as (
			select
				campaign_id,
				coalesce(sum(amount_minor) filter (where status = 'paid'), 0)::bigint as paid_minor
			from ad_campaign_payments
			group by campaign_id
		)
		select
			c.campaign_id::text,
			c.advertiser_business_id::text,
			b.name,
			coalesce(owner.email, ''),
			c.headline,
			c.budget_minor::bigint,
			coalesce(paid.paid_minor, 0)::bigint,
			greatest(c.budget_minor - coalesce(paid.paid_minor, 0), 0)::bigint,
			open_payment.payment_id::text,
			open_payment.provider,
			open_payment.provider_reference,
			open_payment.payment_url,
			open_payment.amount_minor,
			open_payment.currency,
			open_payment.status,
			open_payment.paid_at,
			open_payment.failed_at,
			open_payment.failure_reason,
			open_payment.created_at,
			open_payment.updated_at
		from ad_campaigns c
		join businesses b on b.business_id = c.advertiser_business_id
		left join paid on paid.campaign_id = c.campaign_id
		left join lateral (
			select u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		left join lateral (
			select *
			from ad_campaign_payments ap
			where ap.campaign_id = c.campaign_id and ap.status = 'initiated'
			order by ap.created_at desc
			limit 1
		) open_payment on true
		where c.campaign_id = $1::uuid
			and c.status <> 'archived'
	`, campaignID.String()).Scan(
		&intent.CampaignID,
		&intent.BusinessID,
		&intent.BusinessName,
		&intent.OwnerEmail,
		&intent.Headline,
		&intent.BudgetMinor,
		&intent.PaidMinor,
		&intent.DueMinor,
		&openPaymentID,
		&openProvider,
		&openProviderReference,
		&openPaymentURL,
		&openAmountMinor,
		&openCurrency,
		&openStatus,
		&openPaidAt,
		&openFailedAt,
		&openFailureReason,
		&openCreatedAt,
		&openUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignPaymentIntentRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}
	if openPaymentID.Valid {
		intent.OpenPayment = &ports.AdminAdCampaignPaymentRecord{
			PaymentID:         common.ID(openPaymentID.String),
			CampaignID:        intent.CampaignID,
			BusinessID:        intent.BusinessID,
			Provider:          openProvider.String,
			ProviderReference: openProviderReference.String,
			PaymentURL:        openPaymentURL.String,
			AmountMinor:       openAmountMinor.Int64,
			Currency:          openCurrency.String,
			Status:            openStatus.String,
			PaidAt:            timestamptzPtr(openPaidAt),
			FailedAt:          timestamptzPtr(openFailedAt),
			FailureReason:     openFailureReason.String,
			CreatedAt:         openCreatedAt.Time,
			UpdatedAt:         openUpdatedAt.Time,
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}

	return intent, nil
}

func (repo AdminAuthRepository) CreateAdminAdCampaignPayment(
	ctx context.Context,
	input ports.CreateAdminAdCampaignPaymentInput,
) (ports.AdminAdCampaignPaymentRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}

	payment, err := scanAdminAdCampaignPaymentRecord(tx.QueryRow(ctx, `
		with eligible_campaign as (
			select c.campaign_id, c.advertiser_business_id
			from ad_campaigns c
			where c.campaign_id = $2::uuid
				and c.advertiser_business_id = $3::uuid
				and c.status <> 'archived'
		),
		inserted as (
			insert into ad_campaign_payments (
				payment_id,
				campaign_id,
				advertiser_business_id,
				provider,
				provider_reference,
				payment_url,
				amount_minor,
				currency,
				status,
				requested_by_admin_user_id
			)
			select
				$1::uuid,
				eligible_campaign.campaign_id,
				eligible_campaign.advertiser_business_id,
				'paystack',
				$4,
				$5,
				$6,
				$7,
				'initiated',
				$8::uuid
			from eligible_campaign
			returning *
		)
		`+adminAdCampaignPaymentSelect("inserted")+`
	`, input.PaymentID.String(),
		input.CampaignID.String(),
		input.BusinessID.String(),
		input.ProviderReference,
		input.PaymentURL,
		input.AmountMinor,
		input.Currency,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignPaymentRecord{}, ErrNotFound
		}
		if isOpenAdCampaignPayment(err) {
			return ports.AdminAdCampaignPaymentRecord{}, ports.ErrPaymentInFlight
		}
		return ports.AdminAdCampaignPaymentRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}

	return payment, nil
}
