package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliateRepository struct {
	pool *pgxpool.Pool
}

func NewAffiliateRepository(pool *pgxpool.Pool) AffiliateRepository {
	return AffiliateRepository{pool: pool}
}

func (repo AffiliateRepository) RecordAffiliateClick(
	ctx context.Context,
	input ports.RecordAffiliateClickInput,
) (ports.AffiliateClickRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateClickRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateClickRecord{}, err
	}

	var record ports.AffiliateClickRecord
	if err := tx.QueryRow(ctx, `
		with active_affiliate as (
			select affiliate_id, code
			from affiliates
			where lower(code) = lower($2)
				and status = 'active'
			limit 1
		),
		inserted as (
			insert into affiliate_clicks (
				affiliate_click_id,
				affiliate_id,
				visitor_id,
				landing_url,
				referrer_url,
				user_agent,
				ip_hash,
				metadata
			)
			select
				$1::uuid,
				active_affiliate.affiliate_id,
				$3,
				$4,
				$5,
				$6,
				$7,
				jsonb_build_object('source', 'public_api')
			from active_affiliate
			returning affiliate_click_id, affiliate_id, clicked_at
		)
		select
			inserted.affiliate_click_id::text,
			inserted.affiliate_id::text,
			active_affiliate.code,
			inserted.clicked_at
		from inserted
		join active_affiliate on active_affiliate.affiliate_id = inserted.affiliate_id
	`, input.ClickID.String(),
		input.Code,
		input.VisitorID,
		input.LandingURL,
		input.ReferrerURL,
		input.UserAgent,
		input.IPHash,
	).Scan(&record.ClickID, &record.AffiliateID, &record.Code, &record.ClickedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateClickRecord{}, ErrNotFound
		}
		return ports.AffiliateClickRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateClickRecord{}, err
	}

	return record, nil
}

func (repo AffiliateRepository) ListActiveSponsoredPlacements(
	ctx context.Context,
	input ports.ListActiveSponsoredPlacementsInput,
) ([]ports.SponsoredPlacementRecord, error) {
	limit := input.Limit
	if limit <= 0 {
		limit = 6
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select
			c.campaign_id::text,
			c.advertiser_business_id::text,
			b.name,
			b.handle,
			c.placement_type,
			case
				when c.placement_type = 'promoted_design' then coalesce(target_design.title, c.headline)
				when c.placement_type = 'homepage_hero' then b.name || ' homepage hero'
				else b.name
			end as target_label,
			c.headline,
			c.description,
			b.handle as store_handle,
			case when c.placement_type = 'promoted_design' then coalesce(target_design.handle, '') else '' end as design_handle,
			coalesce(
				nullif(target_design.images[1], ''),
				nullif(featured_design.images[1], ''),
				''
			) as image_url,
			c.starts_at,
			c.ends_at
		from ad_campaigns c
		join businesses b on b.business_id = c.advertiser_business_id
		left join designs target_design
			on target_design.business_id = c.advertiser_business_id
			and target_design.design_id::text = c.target_ref_id
			and target_design.status = 'active'
		left join lateral (
			select images
			from designs d
			where d.business_id = c.advertiser_business_id
				and d.status = 'active'
				and cardinality(d.images) > 0
			order by d.sequence, d.created_at desc
			limit 1
		) featured_design on true
		where c.status = 'active'
			and c.starts_at <= now()
			and c.ends_at > now()
			and b.verification_status = 'verified'
			and b.operational_status = 'active'
			and (
				c.placement_type <> 'promoted_design'
				or target_design.design_id is not null
			)
		order by
			case c.placement_type
				when 'homepage_hero' then 0
				when 'promoted_design' then 1
				else 2
			end,
			c.updated_at desc,
			c.campaign_id
		limit $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.SponsoredPlacementRecord{}
	for rows.Next() {
		var record ports.SponsoredPlacementRecord
		if err := rows.Scan(
			&record.CampaignID,
			&record.BusinessID,
			&record.BusinessName,
			&record.BusinessHandle,
			&record.PlacementType,
			&record.TargetLabel,
			&record.Headline,
			&record.Description,
			&record.StoreHandle,
			&record.DesignHandle,
			&record.ImageURL,
			&record.StartsAt,
			&record.EndsAt,
		); err != nil {
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

func (repo AffiliateRepository) RecordSponsoredAdEvent(
	ctx context.Context,
	input ports.RecordSponsoredAdEventInput,
) (ports.SponsoredAdEventRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.SponsoredAdEventRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.SponsoredAdEventRecord{}, err
	}

	var record ports.SponsoredAdEventRecord
	if err := tx.QueryRow(ctx, `
		with active_campaign as (
			select c.campaign_id, c.advertiser_business_id
			from ad_campaigns c
			join businesses b on b.business_id = c.advertiser_business_id
			left join designs d
				on d.business_id = c.advertiser_business_id
				and d.design_id::text = c.target_ref_id
				and d.status = 'active'
			where c.campaign_id = $2::uuid
				and c.status = 'active'
				and c.starts_at <= now()
				and c.ends_at > now()
				and b.verification_status = 'verified'
				and b.operational_status = 'active'
				and (
					c.placement_type <> 'promoted_design'
					or d.design_id is not null
				)
			limit 1
		),
		existing as (
			select
				e.ad_event_id,
				e.campaign_id,
				e.event_type,
				e.occurred_at,
				true as deduped
			from ad_events e
			join active_campaign on active_campaign.campaign_id = e.campaign_id
			where e.event_type = $3
				and e.visitor_id = $4
				and e.occurred_at >= now() - interval '6 hours'
			order by e.occurred_at desc
			limit 1
		),
		inserted as (
			insert into ad_events (
				ad_event_id,
				campaign_id,
				advertiser_business_id,
				event_type,
				visitor_id,
				metadata
			)
			select
				$1::uuid,
				active_campaign.campaign_id,
				active_campaign.advertiser_business_id,
				$3,
				$4,
				jsonb_build_object(
					'page_url', $5::text,
					'referrer_url', $6::text,
					'user_agent', $7::text,
					'ip_hash', $8::text,
					'source', 'public_marketing'
				)
			from active_campaign
			where not exists (select 1 from existing)
			returning ad_event_id, campaign_id, event_type, occurred_at, false as deduped
		)
		select ad_event_id::text, campaign_id::text, event_type, occurred_at, deduped
		from inserted
		union all
		select ad_event_id::text, campaign_id::text, event_type, occurred_at, deduped
		from existing
		limit 1
	`, input.EventID.String(),
		input.CampaignID.String(),
		input.EventType,
		input.VisitorID,
		input.PageURL,
		input.ReferrerURL,
		input.UserAgent,
		input.IPHash,
	).Scan(
		&record.EventID,
		&record.CampaignID,
		&record.EventType,
		&record.OccurredAt,
		&record.Deduped,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.SponsoredAdEventRecord{}, ports.ErrNotFound
		}
		return ports.SponsoredAdEventRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.SponsoredAdEventRecord{}, err
	}

	return record, nil
}

func (repo AffiliateRepository) ReserveAffiliateAttribution(
	ctx context.Context,
	scope common.TenantScope,
	input ports.ReserveAffiliateAttributionInput,
) (ports.AffiliateAttributionReservation, error) {
	if input.GrossMinor <= 0 || input.Code == "" || input.OrderID.IsZero() || scope.BusinessID.IsZero() {
		return ports.AffiliateAttributionReservation{}, ports.ErrNotFound
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateAttributionReservation{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateAttributionReservation{}, err
	}

	var clickID *common.ID
	if !input.ClickID.IsZero() {
		clickID = &input.ClickID
	}

	var record ports.AffiliateAttributionReservation
	var affiliateClickID pgtype.Text
	if err := tx.QueryRow(ctx, `
		with active_affiliate as (
			select
				affiliate_id,
				commission_model,
				commission_rate,
				cookie_window_days
			from affiliates
			where lower(code) = lower($2)
				and status = 'active'
			limit 1
		),
		selected_click as (
			select c.affiliate_click_id
			from affiliate_clicks c
			join active_affiliate a on a.affiliate_id = c.affiliate_id
			where c.clicked_at >= now() - (a.cookie_window_days::text || ' days')::interval
				and (
					($3::uuid is not null and c.affiliate_click_id = $3::uuid)
					or ($4 <> '' and c.visitor_id = $4)
				)
			order by
				case when $3::uuid is not null and c.affiliate_click_id = $3::uuid then 0 else 1 end,
				c.clicked_at desc
			limit 1
		),
		inserted as (
			insert into affiliate_attribution_reservations (
				reservation_id,
				affiliate_id,
				affiliate_click_id,
				business_id,
				order_id,
				gross_minor,
				commission_minor,
				commission_model,
				commission_rate,
				attribution_model,
				status,
				metadata
			)
			select
				$1::uuid,
				a.affiliate_id,
				selected_click.affiliate_click_id,
				$5::uuid,
				$6::uuid,
				$7,
				case
					when a.commission_model = 'percentage' then least($7, ($7 * a.commission_rate) / 10000)
					else least($7, a.commission_rate)
				end,
				a.commission_model,
				a.commission_rate,
				'last_click',
				'pending',
				jsonb_build_object('source', 'checkout')
			from active_affiliate a
			join selected_click on true
			on conflict (order_id) do update
			set updated_at = now()
			returning *
		)
		select
			reservation_id::text,
			affiliate_id::text,
			affiliate_click_id::text,
			business_id::text,
			order_id::text,
			gross_minor,
			commission_minor
		from inserted
	`, input.ReservationID.String(),
		input.Code,
		nullableIDArg(clickID),
		input.VisitorID,
		scope.BusinessID.String(),
		input.OrderID.String(),
		input.GrossMinor,
	).Scan(
		&record.ReservationID,
		&record.AffiliateID,
		&affiliateClickID,
		&record.BusinessID,
		&record.OrderID,
		&record.GrossMinor,
		&record.CommissionMinor,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateAttributionReservation{}, ports.ErrNotFound
		}
		return ports.AffiliateAttributionReservation{}, err
	}
	if affiliateClickID.Valid {
		id := common.ID(affiliateClickID.String)
		record.AffiliateClickID = &id
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateAttributionReservation{}, err
	}

	return record, nil
}

func (repo AffiliateRepository) ResolveReferralCode(
	ctx context.Context,
	input ports.ResolveReferralCodeInput,
) (ports.ReferralCodeRecord, error) {
	if input.Code == "" {
		return ports.ReferralCodeRecord{}, ports.ErrNotFound
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.ReferralCodeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.ReferralCodeRecord{}, err
	}

	record, err := scanReferralCodeRecord(tx.QueryRow(ctx, referralCodeSelect()+`
		where lower(rc.code) = lower($1)
			and rc.status = 'active'
			and rp.status = 'active'
			and (rp.starts_at is null or rp.starts_at <= now())
			and (rp.ends_at is null or rp.ends_at > now())
		limit 1
	`, input.Code))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.ReferralCodeRecord{}, ports.ErrNotFound
		}
		return ports.ReferralCodeRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.ReferralCodeRecord{}, err
	}
	return record, nil
}

func (repo AffiliateRepository) ReserveReferralAttribution(
	ctx context.Context,
	scope common.TenantScope,
	input ports.ReserveReferralAttributionInput,
) (ports.ReferralAttributionReservation, error) {
	if input.GrossMinor <= 0 || input.Code == "" || input.OrderID.IsZero() ||
		input.RefereeCustomerID.IsZero() || scope.BusinessID.IsZero() {
		return ports.ReferralAttributionReservation{}, ports.ErrNotFound
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.ReferralAttributionReservation{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.ReferralAttributionReservation{}, err
	}

	var record ports.ReferralAttributionReservation
	err = tx.QueryRow(ctx, `
		with active_code as (
			select
				rc.referral_code_id,
				rc.referral_programme_id,
				rc.owner_customer_id,
				rc.owner_business_id
			from referral_codes rc
			join referral_programmes rp
				on rp.referral_programme_id = rc.referral_programme_id
			where lower(rc.code) = lower($2)
				and rc.status = 'active'
				and rp.status = 'active'
				and (rp.starts_at is null or rp.starts_at <= now())
				and (rp.ends_at is null or rp.ends_at > now())
				and rp.qualifying_order_min_minor <= $6
				and (
					rc.business_id is null
					or rc.business_id = $3::uuid
				)
			limit 1
		),
		inserted as (
			insert into referrals (
				referral_id,
				referral_programme_id,
				referral_code_id,
				business_id,
				order_id,
				referee_customer_id,
				referrer_customer_id,
				referrer_business_id,
				gross_minor,
				status,
				metadata
			)
			select
				$1::uuid,
				active_code.referral_programme_id,
				active_code.referral_code_id,
				$3::uuid,
				$4::uuid,
				$5::uuid,
				active_code.owner_customer_id,
				active_code.owner_business_id,
				$6,
				'pending',
				jsonb_build_object('source', 'checkout')
			from active_code
			where active_code.owner_customer_id is null
				or active_code.owner_customer_id <> $5::uuid
			on conflict (order_id) do update
			set updated_at = now()
			returning *
		)
		select
			referral_id::text,
			referral_programme_id::text,
			referral_code_id::text,
			business_id::text,
			order_id::text,
			referee_customer_id::text,
			gross_minor,
			status
		from inserted
	`, input.ReferralID.String(),
		input.Code,
		scope.BusinessID.String(),
		input.OrderID.String(),
		input.RefereeCustomerID.String(),
		input.GrossMinor,
	).Scan(
		&record.ReferralID,
		&record.ReferralProgrammeID,
		&record.ReferralCodeID,
		&record.BusinessID,
		&record.OrderID,
		&record.RefereeCustomerID,
		&record.GrossMinor,
		&record.Status,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || referralUnavailable(err) {
			return ports.ReferralAttributionReservation{}, ports.ErrNotFound
		}
		return ports.ReferralAttributionReservation{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.ReferralAttributionReservation{}, err
	}
	return record, nil
}

func referralCodeSelect() string {
	return `
		select
			rc.referral_code_id::text,
			rc.referral_programme_id::text,
			rc.business_id::text,
			rc.owner_type,
			rc.owner_customer_id::text,
			rc.owner_business_id::text,
			rc.code,
			rp.title,
			rp.audience,
			rp.referrer_reward_kind,
			rp.referee_reward_kind,
			rp.reward_type,
			rp.reward_value::bigint,
			rp.max_reward_minor,
			rp.qualifying_order_min_minor::bigint,
			rp.reward_hold_days::int,
			rp.starts_at,
			rp.ends_at,
			rc.status
		from referral_codes rc
		join referral_programmes rp on rp.referral_programme_id = rc.referral_programme_id
	`
}

func scanReferralCodeRecord(row pgx.Row) (ports.ReferralCodeRecord, error) {
	var record ports.ReferralCodeRecord
	var businessID sql.NullString
	var ownerCustomerID sql.NullString
	var ownerBusinessID sql.NullString
	var maxRewardMinor sql.NullInt64
	var startsAt sql.NullTime
	var endsAt sql.NullTime

	if err := row.Scan(
		&record.ReferralCodeID,
		&record.ReferralProgrammeID,
		&businessID,
		&record.OwnerType,
		&ownerCustomerID,
		&ownerBusinessID,
		&record.Code,
		&record.Title,
		&record.Audience,
		&record.ReferrerRewardKind,
		&record.RefereeRewardKind,
		&record.RewardType,
		&record.RewardValue,
		&maxRewardMinor,
		&record.QualifyingOrderMinor,
		&record.RewardHoldDays,
		&startsAt,
		&endsAt,
		&record.Status,
	); err != nil {
		return ports.ReferralCodeRecord{}, err
	}
	if businessID.Valid {
		value := common.ID(businessID.String)
		record.BusinessID = &value
	}
	if ownerCustomerID.Valid {
		value := common.ID(ownerCustomerID.String)
		record.OwnerCustomerID = &value
	}
	if ownerBusinessID.Valid {
		value := common.ID(ownerBusinessID.String)
		record.OwnerBusinessID = &value
	}
	if maxRewardMinor.Valid {
		record.MaxRewardMinor = &maxRewardMinor.Int64
	}
	if startsAt.Valid {
		record.StartsAt = &startsAt.Time
	}
	if endsAt.Valid {
		record.EndsAt = &endsAt.Time
	}
	return record, nil
}

func referralUnavailable(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != pgUniqueViolation {
		return false
	}
	return pgErr.ConstraintName == "referrals_referee_once_idx"
}
