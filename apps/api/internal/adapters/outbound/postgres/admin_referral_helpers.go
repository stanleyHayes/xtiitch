package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func scanAdminReferralProgrammeRecord(row pgx.Row) (ports.AdminReferralProgrammeRecord, error) {
	var record ports.AdminReferralProgrammeRecord
	var maxRewardMinor pgtype.Int8
	var startsAt pgtype.Timestamptz
	var endsAt pgtype.Timestamptz
	if err := row.Scan(
		&record.ProgrammeID,
		&record.Title,
		&record.CodePrefix,
		&record.Audience,
		&record.ReferrerRewardKind,
		&record.RefereeRewardKind,
		&record.RewardType,
		&record.RewardValue,
		&maxRewardMinor,
		&record.QualifyingOrderMinMinor,
		&record.RewardHoldDays,
		&record.Status,
		&startsAt,
		&endsAt,
		&record.Notes,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.MaxRewardMinor = int8Ptr(maxRewardMinor)
	record.StartsAt = timestamptzPtr(startsAt)
	record.EndsAt = timestamptzPtr(endsAt)
	return record, nil
}

func scanAdminReferralCodeRecord(row pgx.Row) (ports.AdminReferralCodeRecord, error) {
	var record ports.AdminReferralCodeRecord
	var businessID pgtype.Text
	var ownerBusinessID pgtype.Text
	var ownerCustomerID pgtype.Text
	if err := row.Scan(
		&record.ReferralCodeID,
		&record.ProgrammeID,
		&businessID,
		&record.BusinessName,
		&record.BusinessHandle,
		&record.OwnerType,
		&ownerBusinessID,
		&ownerCustomerID,
		&record.OwnerLabel,
		&record.Code,
		&record.Status,
		&record.ReferralCount,
		&record.QualifiedCount,
		&record.RewardedCount,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}
	record.BusinessID = commonIDPtr(businessID)
	record.OwnerBusinessID = commonIDPtr(ownerBusinessID)
	record.OwnerCustomerID = commonIDPtr(ownerCustomerID)
	return record, nil
}

func listAdminReferralCodes(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminReferralCodeRecord, error) {
	rows, err := tx.Query(ctx, `
		with ranked as (
			select
				referral_codes.*,
				row_number() over (
					partition by referral_programme_id
					order by updated_at desc, created_at desc
				) as rank
			from referral_codes
		)
		`+adminReferralCodeSelect("ranked")+`
		where rc.rank <= 5
		order by rc.referral_programme_id, rc.updated_at desc, rc.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAdminReferralCodeRows(rows)
}

func listAdminReferralCodesForProgramme(
	ctx context.Context,
	tx pgx.Tx,
	programmeID common.ID,
) (map[common.ID][]ports.AdminReferralCodeRecord, error) {
	rows, err := tx.Query(ctx, adminReferralCodeSelect("referral_codes")+`
		where rc.referral_programme_id = $1::uuid
		order by rc.updated_at desc, rc.created_at desc
		limit 5
	`, programmeID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAdminReferralCodeRows(rows)
}

func scanAdminReferralCodeRows(rows pgx.Rows) (map[common.ID][]ports.AdminReferralCodeRecord, error) {
	out := map[common.ID][]ports.AdminReferralCodeRecord{}
	for rows.Next() {
		record, err := scanAdminReferralCodeRecord(rows)
		if err != nil {
			return nil, err
		}
		out[record.ProgrammeID] = append(out[record.ProgrammeID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func adminReferralProgrammesQuery() string {
	return adminReferralProgrammeSelect("referral_programmes")
}

func adminReferralProgrammeSelect(source string) string {
	return `
		select
			r.referral_programme_id::text,
			r.title,
			r.code_prefix,
			r.audience,
			r.referrer_reward_kind,
			r.referee_reward_kind,
			r.reward_type,
			r.reward_value::bigint,
			r.max_reward_minor,
			r.qualifying_order_min_minor::bigint,
			r.reward_hold_days::int,
			r.status,
			r.starts_at,
			r.ends_at,
			r.notes,
			r.created_at,
			r.updated_at
		from ` + source + ` r
	`
}

func adminReferralCodeSelect(source string) string {
	return `
		select
			rc.referral_code_id::text,
			rc.referral_programme_id::text,
			rc.business_id::text,
			coalesce(b.name, '') as business_name,
			coalesce(b.handle, '') as business_handle,
			rc.owner_type,
			rc.owner_business_id::text,
			rc.owner_customer_id::text,
			case
				when rc.owner_type = 'business' then coalesce(owner_business.name, 'Business referral')
				when rc.owner_type = 'customer' then coalesce(c.display_name, c.email, 'Customer referral')
				else 'Platform'
			end as owner_label,
			rc.code,
			rc.status,
			coalesce(stats.referral_count, 0)::int,
			coalesce(stats.qualified_count, 0)::int,
			coalesce(stats.rewarded_count, 0)::int,
			rc.created_at,
			rc.updated_at
		from ` + source + ` rc
		left join businesses b on b.business_id = rc.business_id
		left join businesses owner_business on owner_business.business_id = rc.owner_business_id
		left join customers c on c.customer_id = rc.owner_customer_id
		left join (
			select
				referral_code_id,
				count(*)::int as referral_count,
				count(*) filter (where status in ('qualified', 'rewarded'))::int as qualified_count,
				count(*) filter (where status = 'rewarded')::int as rewarded_count
			from referrals
			group by referral_code_id
		) stats on stats.referral_code_id = rc.referral_code_id
	`
}

func referralProgrammeCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "referral_programmes_code_prefix_unique_idx"
}

func referralCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "referral_codes_code_unique_idx"
}
