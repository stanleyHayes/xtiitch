package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
				rc.owner_business_id,
				coalesce(owner_customer.email, '') as owner_email,
				regexp_replace(coalesce(owner_customer.phone, ''), '\D', '', 'g') as owner_phone
			from referral_codes rc
			join referral_programmes rp
				on rp.referral_programme_id = rc.referral_programme_id
			left join customers owner_customer
				on owner_customer.customer_id = rc.owner_customer_id
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
				or (
					active_code.owner_customer_id <> $5::uuid
					and not (
						nullif($7::text, '') is not null
						and lower(active_code.owner_email) = lower($7::text)
					)
					and not (
						nullif(regexp_replace($8::text, '\D', '', 'g'), '') is not null
						and active_code.owner_phone = regexp_replace($8::text, '\D', '', 'g')
					)
				)
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
		input.RefereeEmail,
		input.RefereePhone,
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
