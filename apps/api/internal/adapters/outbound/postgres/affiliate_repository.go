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
