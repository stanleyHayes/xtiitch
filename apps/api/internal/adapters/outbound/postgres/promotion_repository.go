package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type PromotionRepository struct {
	pool *pgxpool.Pool
}

func NewPromotionRepository(pool *pgxpool.Pool) PromotionRepository {
	return PromotionRepository{pool: pool}
}

func (repo PromotionRepository) ListBusinessPromotions(
	ctx context.Context,
	scope common.TenantScope,
) ([]ports.BusinessPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, businessPromotionSelect("promotions")+`
		where p.business_id = $1
		order by
			case p.status when 'active' then 0 when 'paused' then 1 else 2 end,
			p.updated_at desc,
			p.created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.BusinessPromotionRecord{}
	for rows.Next() {
		record, err := scanBusinessPromotionRecord(rows)
		if err != nil {
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

func (repo PromotionRepository) CreateBusinessPromotion(
	ctx context.Context,
	scope common.TenantScope,
	input ports.BusinessPromotionInput,
) (ports.BusinessPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}

	record, err := scanBusinessPromotionRecord(tx.QueryRow(ctx, `
		with target_ok as (
			select $2::uuid as business_id
			where (
				$12 = 'store'
				or (
					$12 = 'collection'
					and exists (
						select 1 from collections c
						where c.collection_id = $13::uuid
							and c.business_id = $2::uuid
							and c.status = 'active'
					)
				)
				or (
					$12 = 'design'
					and exists (
						select 1 from designs d
						where d.design_id = $14::uuid
							and d.business_id = $2::uuid
							and d.status = 'active'
					)
				)
			)
		),
		inserted as (
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
				ends_at
			)
			select
				$1::uuid,
				target_ok.business_id,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				$11,
				'business',
				$12,
				$13,
				$14,
				$15,
				$16,
				$17
			from target_ok
			returning *
		)
		`+businessPromotionSelect("inserted")+`
	`, input.PromotionID.String(),
		scope.BusinessID.String(),
		input.Code,
		input.Title,
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		nullableInt64Arg(input.MaxDiscountMinor),
		input.MinSpendMinor,
		nullableIntArg(input.UsageLimitGlobal),
		nullableIntArg(input.UsageLimitPerCustomer),
		input.Scope,
		nullableIDArg(input.TargetCollectionID),
		nullableIDArg(input.TargetDesignID),
		input.Status,
		input.StartsAt,
		input.EndsAt,
	))
	if err != nil {
		if promotionCodeTaken(err) {
			return ports.BusinessPromotionRecord{}, ports.ErrPromotionCodeTaken
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessPromotionRecord{}, ports.ErrNotFound
		}
		return ports.BusinessPromotionRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	return record, nil
}

func (repo PromotionRepository) UpdateBusinessPromotion(
	ctx context.Context,
	scope common.TenantScope,
	input ports.BusinessPromotionInput,
) (ports.BusinessPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}

	record, err := scanBusinessPromotionRecord(tx.QueryRow(ctx, `
		with target_ok as (
			select $2::uuid as business_id
			where (
				$12 = 'store'
				or (
					$12 = 'collection'
					and exists (
						select 1 from collections c
						where c.collection_id = $13::uuid
							and c.business_id = $2::uuid
							and c.status = 'active'
					)
				)
				or (
					$12 = 'design'
					and exists (
						select 1 from designs d
						where d.design_id = $14::uuid
							and d.business_id = $2::uuid
							and d.status = 'active'
					)
				)
			)
		),
		updated as (
			update promotions p
			set code = $3,
				title = $4,
				description = $5,
				discount_type = $6,
				discount_value = $7,
				max_discount_minor = $8,
				min_spend_minor = $9,
				usage_limit_global = $10,
				usage_limit_per_customer = $11,
				funding_source = 'business',
				scope = $12,
				target_collection_id = $13,
				target_design_id = $14,
				status = $15,
				starts_at = $16,
				ends_at = $17,
				updated_at = now()
			from target_ok
			where p.promotion_id = $1::uuid
				and p.business_id = target_ok.business_id
				and p.status <> 'archived'
			returning p.*
		)
		`+businessPromotionSelect("updated")+`
	`, input.PromotionID.String(),
		scope.BusinessID.String(),
		input.Code,
		input.Title,
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		nullableInt64Arg(input.MaxDiscountMinor),
		input.MinSpendMinor,
		nullableIntArg(input.UsageLimitGlobal),
		nullableIntArg(input.UsageLimitPerCustomer),
		input.Scope,
		nullableIDArg(input.TargetCollectionID),
		nullableIDArg(input.TargetDesignID),
		input.Status,
		input.StartsAt,
		input.EndsAt,
	))
	if err != nil {
		if promotionCodeTaken(err) {
			return ports.BusinessPromotionRecord{}, ports.ErrPromotionCodeTaken
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessPromotionRecord{}, ports.ErrNotFound
		}
		return ports.BusinessPromotionRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	return record, nil
}

func (repo PromotionRepository) ArchiveBusinessPromotion(
	ctx context.Context,
	scope common.TenantScope,
	promotionID common.ID,
) (ports.BusinessPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}

	record, err := scanBusinessPromotionRecord(tx.QueryRow(ctx, `
		with updated as (
			update promotions
			set status = 'archived',
				updated_at = now()
			where promotion_id = $1::uuid
				and business_id = $2::uuid
			returning *
		)
		`+businessPromotionSelect("updated")+`
	`, promotionID.String(), scope.BusinessID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessPromotionRecord{}, ports.ErrNotFound
		}
		return ports.BusinessPromotionRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	return record, nil
}
func businessPromotionSelect(source string) string {
	return `
		select
			p.promotion_id::text,
			p.business_id::text,
			coalesce(p.code, ''),
			p.title,
			p.description,
			p.discount_type,
			p.discount_value::bigint,
			p.max_discount_minor,
			p.min_spend_minor::bigint,
			p.usage_limit_global,
			p.usage_limit_per_customer,
			p.funding_source,
			p.scope,
			p.target_collection_id::text,
			p.target_design_id::text,
			p.status,
			p.starts_at,
			p.ends_at,
			coalesce(r.redemption_count, 0)::int,
			coalesce(r.discount_redeemed_minor, 0)::bigint,
			p.created_at,
			p.updated_at
		from ` + source + ` p
		left join lateral (
			select
				count(*) filter (where pr.status = 'applied')::int as redemption_count,
				coalesce(sum(pr.discount_minor) filter (where pr.status = 'applied'), 0)::bigint as discount_redeemed_minor
			from promotion_redemptions pr
			where pr.promotion_id = p.promotion_id
		) r on true
	`
}

func scanBusinessPromotionRecord(row pgx.Row) (ports.BusinessPromotionRecord, error) {
	var record ports.BusinessPromotionRecord
	var maxDiscount sql.NullInt64
	var usageLimitGlobal sql.NullInt32
	var usageLimitPerCustomer sql.NullInt32
	var targetCollectionID sql.NullString
	var targetDesignID sql.NullString
	var startsAt sql.NullTime
	var endsAt sql.NullTime

	if err := row.Scan(
		&record.PromotionID,
		&record.BusinessID,
		&record.Code,
		&record.Title,
		&record.Description,
		&record.DiscountType,
		&record.DiscountValue,
		&maxDiscount,
		&record.MinSpendMinor,
		&usageLimitGlobal,
		&usageLimitPerCustomer,
		&record.FundingSource,
		&record.Scope,
		&targetCollectionID,
		&targetDesignID,
		&record.Status,
		&startsAt,
		&endsAt,
		&record.RedemptionCount,
		&record.DiscountRedeemedMinor,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	if maxDiscount.Valid {
		record.MaxDiscountMinor = &maxDiscount.Int64
	}
	if usageLimitGlobal.Valid {
		value := int(usageLimitGlobal.Int32)
		record.UsageLimitGlobal = &value
	}
	if usageLimitPerCustomer.Valid {
		value := int(usageLimitPerCustomer.Int32)
		record.UsageLimitPerCustomer = &value
	}
	if targetCollectionID.Valid {
		value := common.ID(targetCollectionID.String)
		record.TargetCollectionID = &value
	}
	if targetDesignID.Valid {
		value := common.ID(targetDesignID.String)
		record.TargetDesignID = &value
	}
	if startsAt.Valid {
		record.StartsAt = &startsAt.Time
	}
	if endsAt.Valid {
		record.EndsAt = &endsAt.Time
	}
	return record, nil
}
