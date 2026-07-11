package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

func (repo AdminAuthRepository) ListAdminPromotions(ctx context.Context) ([]ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminPromotionsQuery()+`
		order by
			case p.status when 'active' then 1 when 'paused' then 2 else 3 end,
			p.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminPromotionRecord{}
	for rows.Next() {
		record, err := scanAdminPromotionRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentRedemptions = redemptionsByPromotion[records[index].PromotionID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminPromotion(
	ctx context.Context,
	input ports.CreateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := scanAdminPromotionRecord(tx.QueryRow(ctx, `
		with inserted as (
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
				target_collection_id,
				target_design_id,
				status,
				starts_at,
				ends_at,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid,
				$2::uuid,
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
				$16,
				$17,
				$18,
				$19::uuid,
				$19::uuid
			)
			returning *
		)
		`+adminPromotionSelect("inserted")+`
	`, input.PromotionID.String(),
		nullableIDArg(input.BusinessID),
		nullableTextArg(input.Code),
		input.Title,
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		nullableInt64Arg(input.MaxDiscountMinor),
		input.MinSpendMinor,
		nullableIntArg(input.UsageLimitGlobal),
		nullableIntArg(input.UsageLimitPerCustomer),
		input.FundingSource,
		input.Scope,
		nullableIDArg(input.TargetCollectionID),
		nullableIDArg(input.TargetDesignID),
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if promotionCodeTaken(err) {
			return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPromotionRecord{}, ErrNotFound
		}
		return ports.AdminPromotionRecord{}, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	record.RecentRedemptions = redemptionsByPromotion[record.PromotionID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminPromotion(
	ctx context.Context,
	input ports.UpdateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := scanAdminPromotionRecord(tx.QueryRow(ctx, `
		with updated as (
			update promotions
			set business_id = $2::uuid,
				code = $3,
				title = $4,
				description = $5,
				discount_type = $6,
				discount_value = $7,
				max_discount_minor = $8,
				min_spend_minor = $9,
				usage_limit_global = $10,
				usage_limit_per_customer = $11,
				funding_source = $12,
				scope = $13,
				target_collection_id = $14,
				target_design_id = $15,
				status = $16,
				starts_at = $17,
				ends_at = $18,
				updated_by_admin_user_id = $19::uuid,
				updated_at = now()
			where promotion_id = $1::uuid
			returning *
		)
		`+adminPromotionSelect("updated")+`
	`, input.PromotionID.String(),
		nullableIDArg(input.BusinessID),
		nullableTextArg(input.Code),
		input.Title,
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		nullableInt64Arg(input.MaxDiscountMinor),
		input.MinSpendMinor,
		nullableIntArg(input.UsageLimitGlobal),
		nullableIntArg(input.UsageLimitPerCustomer),
		input.FundingSource,
		input.Scope,
		nullableIDArg(input.TargetCollectionID),
		nullableIDArg(input.TargetDesignID),
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if promotionCodeTaken(err) {
			return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPromotionRecord{}, ErrNotFound
		}
		return ports.AdminPromotionRecord{}, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	record.RecentRedemptions = redemptionsByPromotion[record.PromotionID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminPromotion(
	ctx context.Context,
	input ports.ArchiveAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := scanAdminPromotionRecord(tx.QueryRow(ctx, `
		with updated as (
			update promotions
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where promotion_id = $1::uuid
			returning *
		)
		`+adminPromotionSelect("updated")+`
	`, input.PromotionID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPromotionRecord{}, ErrNotFound
		}
		return ports.AdminPromotionRecord{}, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	record.RecentRedemptions = redemptionsByPromotion[record.PromotionID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}
