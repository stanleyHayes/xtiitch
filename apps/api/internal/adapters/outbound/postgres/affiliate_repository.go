package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
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
