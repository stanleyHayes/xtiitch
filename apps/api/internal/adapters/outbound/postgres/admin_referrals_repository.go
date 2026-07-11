package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

func (repo AdminAuthRepository) ListAdminReferralProgrammes(ctx context.Context) ([]ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminReferralProgrammesQuery()+`
		order by
			case status when 'draft' then 1 when 'active' then 2 when 'paused' then 3 else 4 end,
			updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminReferralProgrammeRecord{}
	for rows.Next() {
		record, err := scanAdminReferralProgrammeRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	codesByProgramme, err := listAdminReferralCodes(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentCodes = codesByProgramme[records[index].ProgrammeID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminReferralProgramme(
	ctx context.Context,
	input ports.CreateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := scanAdminReferralProgrammeRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into referral_programmes (
				referral_programme_id,
				title,
				code_prefix,
				audience,
				referrer_reward_kind,
				referee_reward_kind,
				reward_type,
				reward_value,
				max_reward_minor,
				qualifying_order_min_minor,
				reward_hold_days,
				status,
				starts_at,
				ends_at,
				notes,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid,
				$2,
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
				$13,
				$14,
				$15,
				$16::uuid,
				$16::uuid
			)
			returning *
		)
		`+adminReferralProgrammeSelect("inserted")+`
	`, input.ProgrammeID.String(),
		input.Title,
		input.CodePrefix,
		input.Audience,
		input.ReferrerRewardKind,
		input.RefereeRewardKind,
		input.RewardType,
		input.RewardValue,
		nullableInt64Arg(input.MaxRewardMinor),
		input.QualifyingOrderMinMinor,
		input.RewardHoldDays,
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if referralProgrammeCodeTaken(err) {
			return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminReferralProgrammeRecord{}, err
	}

	codesByProgramme, err := listAdminReferralCodesForProgramme(ctx, tx, record.ProgrammeID)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.RecentCodes = codesByProgramme[record.ProgrammeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminReferralProgramme(
	ctx context.Context,
	input ports.UpdateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := scanAdminReferralProgrammeRecord(tx.QueryRow(ctx, `
		with updated as (
			update referral_programmes
			set title = $2,
				code_prefix = $3,
				audience = $4,
				referrer_reward_kind = $5,
				referee_reward_kind = $6,
				reward_type = $7,
				reward_value = $8,
				max_reward_minor = $9,
				qualifying_order_min_minor = $10,
				reward_hold_days = $11,
				status = $12,
				starts_at = $13,
				ends_at = $14,
				notes = $15,
				updated_by_admin_user_id = $16::uuid,
				updated_at = now()
			where referral_programme_id = $1::uuid
				and status <> 'archived'
			returning *
		)
		`+adminReferralProgrammeSelect("updated")+`
	`, input.ProgrammeID.String(),
		input.Title,
		input.CodePrefix,
		input.Audience,
		input.ReferrerRewardKind,
		input.RefereeRewardKind,
		input.RewardType,
		input.RewardValue,
		nullableInt64Arg(input.MaxRewardMinor),
		input.QualifyingOrderMinMinor,
		input.RewardHoldDays,
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if referralProgrammeCodeTaken(err) {
			return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminReferralProgrammeRecord{}, ErrNotFound
		}
		return ports.AdminReferralProgrammeRecord{}, err
	}

	codesByProgramme, err := listAdminReferralCodesForProgramme(ctx, tx, record.ProgrammeID)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.RecentCodes = codesByProgramme[record.ProgrammeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminReferralProgramme(
	ctx context.Context,
	input ports.ArchiveAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := scanAdminReferralProgrammeRecord(tx.QueryRow(ctx, `
		with updated as (
			update referral_programmes
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where referral_programme_id = $1::uuid
			returning *
		)
		`+adminReferralProgrammeSelect("updated")+`
	`, input.ProgrammeID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminReferralProgrammeRecord{}, ErrNotFound
		}
		return ports.AdminReferralProgrammeRecord{}, err
	}

	codesByProgramme, err := listAdminReferralCodesForProgramme(ctx, tx, record.ProgrammeID)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.RecentCodes = codesByProgramme[record.ProgrammeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminReferralCode(
	ctx context.Context,
	input ports.CreateAdminReferralCodeInput,
) (ports.AdminReferralCodeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}

	record, err := scanAdminReferralCodeRecord(tx.QueryRow(ctx, `
		with programme as (
			select referral_programme_id
			from referral_programmes
			where referral_programme_id = $2::uuid
				and status = 'active'
		),
		owner_context as (
			select
				null::uuid as business_id
			where $3 = 'platform'
			union all
			select
				b.business_id
			from businesses b
			where $3 = 'business'
				and b.business_id = $4::uuid
				and b.verification_status = 'verified'
				and b.operational_status = 'active'
		),
		inserted as (
			insert into referral_codes (
				referral_code_id,
				referral_programme_id,
				business_id,
				owner_type,
				owner_business_id,
				code,
				status,
				metadata
			)
			select
				$1::uuid,
				programme.referral_programme_id,
				owner_context.business_id,
				$3,
				case when $3 = 'business' then owner_context.business_id else null end,
				$5,
				$6,
				jsonb_build_object(
					'source',
					'admin_issue',
					'issued_by_admin_user_id',
					$7::text
				)
			from programme
			cross join owner_context
			returning *
		)
		`+adminReferralCodeSelect("inserted")+`
	`, input.ReferralCodeID.String(),
		input.ProgrammeID.String(),
		input.OwnerType,
		nullableIDArg(input.BusinessID),
		input.Code,
		input.Status,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if referralCodeTaken(err) {
			return ports.AdminReferralCodeRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminReferralCodeRecord{}, ErrNotFound
		}
		return ports.AdminReferralCodeRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) IssueAdminReferralRewards(
	ctx context.Context,
	input ports.IssueAdminReferralRewardsInput,
) (ports.AdminReferralRewardIssueRecord, error) {
	limit := input.Limit
	if limit <= 0 {
		limit = 50
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	var record ports.AdminReferralRewardIssueRecord
	err = tx.QueryRow(ctx, `
		with due_referrals as (
			select
				r.referral_id,
				r.referral_programme_id,
				r.business_id,
				r.referee_customer_id,
				r.referrer_customer_id,
				r.referrer_business_id,
				rp.title,
				rp.code_prefix,
				rp.referrer_reward_kind,
				rp.referee_reward_kind,
				rp.reward_type,
				rp.reward_value,
				rp.max_reward_minor
			from referrals r
			join referral_programmes rp
				on rp.referral_programme_id = r.referral_programme_id
			where r.status = 'qualified'
				and r.qualified_at is not null
				and r.qualified_at <= now() - (rp.reward_hold_days::text || ' days')::interval
				and not exists (
					select 1
					from referral_rewards rw
					where rw.referral_id = r.referral_id
				)
			order by r.qualified_at, r.referral_id
			limit $2
			for update of r skip locked
		),
		reward_candidates as (
			select
				referral_id,
				business_id,
				'referrer'::text as beneficiary_type,
				referrer_reward_kind as reward_kind,
				referrer_customer_id as beneficiary_customer_id,
				referrer_business_id as beneficiary_business_id,
				title,
				code_prefix,
				reward_type,
				reward_value,
				max_reward_minor
			from due_referrals
			where referrer_reward_kind <> 'none'
			union all
			select
				referral_id,
				business_id,
				'referee'::text as beneficiary_type,
				referee_reward_kind as reward_kind,
				referee_customer_id as beneficiary_customer_id,
				null::uuid as beneficiary_business_id,
				title,
				code_prefix,
				reward_type,
				reward_value,
				max_reward_minor
			from due_referrals
			where referee_reward_kind <> 'none'
		),
		valid_candidates as (
			select
				*,
				upper(
					left(regexp_replace(code_prefix, '[^A-Za-z0-9_-]', '', 'g'), 12)
					|| '-' || substr(referral_id::text, 1, 8)
					|| '-' || case beneficiary_type when 'referrer' then 'R' else 'E' end
				) as voucher_code
			from reward_candidates
			where (
				reward_kind = 'voucher'
				and beneficiary_customer_id is not null
			)
			or (
				reward_kind = 'commission_rebate'
				and beneficiary_business_id is not null
			)
		),
		voucher_promotions as (
			insert into promotions (
				promotion_id,
				business_id,
				code,
				title,
				description,
				discount_type,
				discount_value,
				max_discount_minor,
				min_spend_minor,
				usage_limit_global,
				usage_limit_per_customer,
				funding_source,
				scope,
				status,
				starts_at,
				ends_at
			)
			select
				gen_random_uuid(),
				business_id,
				voucher_code,
				'Referral reward: ' || title,
				'Single-use referral reward voucher.',
				reward_type,
				reward_value,
				case when reward_type = 'percentage' then max_reward_minor else null end,
				0,
				1,
				1,
				'business',
				'store',
				'active',
				now(),
				now() + interval '90 days'
			from valid_candidates
			where reward_kind = 'voucher'
			returning promotion_id, code
		),
		inserted_rewards as (
			insert into referral_rewards (
				referral_reward_id,
				referral_id,
				business_id,
				beneficiary_type,
				beneficiary_customer_id,
				beneficiary_business_id,
				reward_kind,
				promotion_id,
				status,
				available_at,
				issued_at,
				metadata
			)
			select
				gen_random_uuid(),
				c.referral_id,
				c.business_id,
				c.beneficiary_type,
				c.beneficiary_customer_id,
				c.beneficiary_business_id,
				c.reward_kind,
				vp.promotion_id,
				case when c.reward_kind = 'voucher' then 'issued' else 'pending' end,
				now(),
				case when c.reward_kind = 'voucher' then now() else null end,
				jsonb_build_object(
					'source', 'admin_reward_issue',
					'issued_by_admin_user_id', $1::text,
					'voucher_code', coalesce(vp.code, ''),
					'reward_type', c.reward_type,
					'reward_value', c.reward_value::text
				)
			from valid_candidates c
			left join voucher_promotions vp on vp.code = c.voucher_code
			where c.reward_kind <> 'voucher'
				or vp.promotion_id is not null
			on conflict (referral_id, beneficiary_type) do nothing
			returning
				referral_id,
				reward_kind,
				metadata->>'reward_type' as reward_type,
				(metadata->>'reward_value')::bigint as reward_value
		),
		rewarded_referrals as (
			update referrals r
			set status = 'rewarded',
				rewarded_at = coalesce(rewarded_at, now()),
				updated_at = now()
			where r.referral_id in (
				select distinct referral_id from inserted_rewards
			)
			returning r.referral_id
		)
		select
			coalesce((select count(*)::int from rewarded_referrals), 0),
			coalesce((select count(*)::int from inserted_rewards), 0),
			coalesce((select count(*)::int from inserted_rewards where reward_kind = 'voucher'), 0),
			coalesce((select count(*)::int from inserted_rewards where reward_kind = 'commission_rebate'), 0),
			coalesce((
				select sum(case when reward_type = 'fixed' then reward_value else 0 end)::bigint
				from inserted_rewards
			), 0),
			now()
	`, input.ActorAdminUser.String(), limit).Scan(
		&record.ReferralCount,
		&record.RewardCount,
		&record.VoucherCount,
		&record.CommissionRebateCount,
		&record.TotalRewardMinor,
		&record.IssuedAt,
	)
	if err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	return record, nil
}
