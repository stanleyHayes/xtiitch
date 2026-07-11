package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminSubscriptionDiscountCodes(
	ctx context.Context,
) ([]ports.AdminSubscriptionDiscountCodeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	records, err := listAdminSubscriptionDiscountCodes(ctx, tx)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

func (repo AdminAuthRepository) CreateAdminSubscriptionDiscountCode(
	ctx context.Context,
	input ports.CreateAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	record, err := scanAdminSubscriptionDiscountCodeRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into subscription_discount_codes (
				discount_code_id,
				code,
				discount_type,
				discount_value,
				eligible_plans,
				eligible_cadences,
				first_purchase_only,
				max_redemptions_total,
				max_per_account,
				valid_from,
				valid_until,
				active,
				owner_name,
				batch_label,
				stackable,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid, $2, $3, $4, $5::text[], $6::text[], $7, $8, $9,
				$10, $11, $12, $13, $14, $15, $16::uuid, $16::uuid
			)
			returning *
		)
		`+adminSubscriptionDiscountCodeSelect("inserted")+`
	`, input.DiscountCodeID.String(),
		input.Code,
		input.DiscountType,
		input.DiscountValue,
		input.EligiblePlans,
		input.EligibleCadences,
		input.FirstPurchaseOnly,
		nullableIntArg(input.MaxRedemptionsTotal),
		input.MaxPerAccount,
		nullableTimeArg(input.ValidFrom),
		nullableTimeArg(input.ValidUntil),
		input.Active,
		input.OwnerName,
		input.BatchLabel,
		input.Stackable,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if subscriptionDiscountCodeTaken(err) || adminEntitlementInvalid(err) {
			return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminSubscriptionDiscountCode(
	ctx context.Context,
	input ports.UpdateAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	record, err := scanAdminSubscriptionDiscountCodeRecord(tx.QueryRow(ctx, `
		with updated as (
			update subscription_discount_codes
			set code = $2,
				discount_type = $3,
				discount_value = $4,
				eligible_plans = $5::text[],
				eligible_cadences = $6::text[],
				first_purchase_only = $7,
				max_redemptions_total = $8,
				max_per_account = $9,
				valid_from = $10,
				valid_until = $11,
				active = $12,
				owner_name = $13,
				batch_label = $14,
				stackable = $15,
				updated_by_admin_user_id = $16::uuid,
				archived_at = case when $12 then null else coalesce(archived_at, now()) end,
				updated_at = now()
			where discount_code_id = $1::uuid
			returning *
		)
		`+adminSubscriptionDiscountCodeSelect("updated")+`
	`, input.DiscountCodeID.String(),
		input.Code,
		input.DiscountType,
		input.DiscountValue,
		input.EligiblePlans,
		input.EligibleCadences,
		input.FirstPurchaseOnly,
		nullableIntArg(input.MaxRedemptionsTotal),
		input.MaxPerAccount,
		nullableTimeArg(input.ValidFrom),
		nullableTimeArg(input.ValidUntil),
		input.Active,
		input.OwnerName,
		input.BatchLabel,
		input.Stackable,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionDiscountCodeRecord{}, ErrNotFound
		}
		if subscriptionDiscountCodeTaken(err) || adminEntitlementInvalid(err) {
			return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	redemptionsByCode, err := listAdminSubscriptionDiscountRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	record.RecentRedemptions = redemptionsByCode[record.DiscountCodeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminSubscriptionDiscountCode(
	ctx context.Context,
	input ports.ArchiveAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	record, err := scanAdminSubscriptionDiscountCodeRecord(tx.QueryRow(ctx, `
		with updated as (
			update subscription_discount_codes
			set active = false,
				archived_at = coalesce(archived_at, now()),
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where discount_code_id = $1::uuid
			returning *
		)
		`+adminSubscriptionDiscountCodeSelect("updated")+`
	`, input.DiscountCodeID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionDiscountCodeRecord{}, ErrNotFound
		}
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	redemptionsByCode, err := listAdminSubscriptionDiscountRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	record.RecentRedemptions = redemptionsByCode[record.DiscountCodeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	return record, nil
}

func listAdminSubscriptionDiscountCodes(
	ctx context.Context,
	tx pgx.Tx,
) ([]ports.AdminSubscriptionDiscountCodeRecord, error) {
	rows, err := tx.Query(ctx, adminSubscriptionDiscountCodesQuery()+`
		order by c.active desc, c.updated_at desc, c.created_at desc
		limit 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminSubscriptionDiscountCodeRecord{}
	for rows.Next() {
		record, err := scanAdminSubscriptionDiscountCodeRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	redemptionsByCode, err := listAdminSubscriptionDiscountRedemptions(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentRedemptions = redemptionsByCode[records[index].DiscountCodeID]
	}
	return records, nil
}

func adminSubscriptionDiscountCodesQuery() string {
	return adminSubscriptionDiscountCodeSelect("subscription_discount_codes")
}

func adminSubscriptionDiscountCodeSelect(source string) string {
	return `
		select
			c.discount_code_id::text,
			c.code,
			c.discount_type,
			c.discount_value::int,
			c.eligible_plans,
			c.eligible_cadences,
			c.first_purchase_only,
			c.max_redemptions_total,
			c.max_per_account::int,
			c.valid_from,
			c.valid_until,
			c.active,
			c.owner_name,
			c.batch_label,
			c.stackable,
			c.archived_at,
			coalesce(r.redemption_count, 0)::int,
			coalesce(r.applied_count, 0)::int,
			coalesce(r.discount_minor, 0)::bigint,
			c.created_at,
			c.updated_at
		from ` + source + ` c
		left join lateral (
			select
				count(*)::int as redemption_count,
				count(*) filter (where status = 'applied')::int as applied_count,
				coalesce(sum(discount_minor) filter (where status = 'applied'), 0)::bigint as discount_minor
			from subscription_discount_redemptions r
			where r.discount_code_id = c.discount_code_id
		) r on true
	`
}

func scanAdminSubscriptionDiscountCodeRecord(row pgx.Row) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	var record ports.AdminSubscriptionDiscountCodeRecord
	var maxRedemptionsTotal pgtype.Int4
	var validFrom pgtype.Timestamptz
	var validUntil pgtype.Timestamptz
	var archivedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.DiscountCodeID,
		&record.Code,
		&record.DiscountType,
		&record.DiscountValue,
		&record.EligiblePlans,
		&record.EligibleCadences,
		&record.FirstPurchaseOnly,
		&maxRedemptionsTotal,
		&record.MaxPerAccount,
		&validFrom,
		&validUntil,
		&record.Active,
		&record.OwnerName,
		&record.BatchLabel,
		&record.Stackable,
		&archivedAt,
		&record.RedemptionCount,
		&record.AppliedCount,
		&record.DiscountMinor,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	record.MaxRedemptionsTotal = int4Ptr(maxRedemptionsTotal)
	record.ValidFrom = timestamptzPtr(validFrom)
	record.ValidUntil = timestamptzPtr(validUntil)
	record.ArchivedAt = timestamptzPtr(archivedAt)
	if record.EligiblePlans == nil {
		record.EligiblePlans = []string{}
	}
	if record.EligibleCadences == nil {
		record.EligibleCadences = []string{}
	}
	record.RecentRedemptions = []ports.AdminSubscriptionDiscountRedemptionRecord{}
	return record, nil
}

func listAdminSubscriptionDiscountRedemptions(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminSubscriptionDiscountRedemptionRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			r.discount_code_id::text,
			r.redemption_id::text,
			r.business_id::text,
			coalesce(b.name, ''),
			r.plan_code,
			r.cadence,
			r.account_key,
			r.status,
			r.discount_minor,
			r.created_at,
			r.applied_at
		from subscription_discount_redemptions r
		left join businesses b on b.business_id = r.business_id
		order by r.discount_code_id, r.created_at desc
		limit 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	redemptions := map[common.ID][]ports.AdminSubscriptionDiscountRedemptionRecord{}
	for rows.Next() {
		var discountCodeID common.ID
		var record ports.AdminSubscriptionDiscountRedemptionRecord
		var appliedAt pgtype.Timestamptz
		if err := rows.Scan(
			&discountCodeID,
			&record.RedemptionID,
			&record.BusinessID,
			&record.BusinessName,
			&record.PlanCode,
			&record.Cadence,
			&record.AccountKey,
			&record.Status,
			&record.DiscountMinor,
			&record.CreatedAt,
			&appliedAt,
		); err != nil {
			return nil, err
		}
		record.AppliedAt = timestamptzPtr(appliedAt)
		if len(redemptions[discountCodeID]) < 5 {
			redemptions[discountCodeID] = append(redemptions[discountCodeID], record)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return redemptions, nil
}

func subscriptionDiscountCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "subscription_discount_codes_code_key"
}
