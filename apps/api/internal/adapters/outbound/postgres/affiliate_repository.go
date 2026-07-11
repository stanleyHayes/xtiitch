package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
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
