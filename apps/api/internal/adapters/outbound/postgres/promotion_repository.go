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

func (repo PromotionRepository) ReservePromotion(
	ctx context.Context,
	scope common.TenantScope,
	input ports.ReservePromotionInput,
) (ports.PromotionRedemption, error) {
	if input.RedemptionID.IsZero() || input.OrderID.IsZero() || input.CustomerID.IsZero() ||
		input.BusinessID.IsZero() || input.SubtotalMinor <= 0 || input.Code == "" {
		return ports.PromotionRedemption{}, ports.ErrPromotionUnavailable
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.PromotionRedemption{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.PromotionRedemption{}, err
	}

	candidate, err := findPromotionForCheckout(ctx, tx, input)
	if err != nil {
		return ports.PromotionRedemption{}, err
	}
	if err := promotionUsageAvailable(ctx, tx, candidate, input.CustomerID); err != nil {
		return ports.PromotionRedemption{}, err
	}

	discount := promotionDiscount(candidate, input.SubtotalMinor)
	if discount <= 0 || discount >= input.SubtotalMinor {
		return ports.PromotionRedemption{}, ports.ErrPromotionUnavailable
	}

	if _, err := tx.Exec(ctx, `
		insert into promotion_redemptions (
			promotion_redemption_id,
			promotion_id,
			business_id,
			order_id,
			customer_id,
			discount_minor,
			status
		)
		values ($1, $2, $3, $4, $5, $6, 'pending')
	`, input.RedemptionID.String(), candidate.promotionID, input.BusinessID.String(),
		input.OrderID.String(), input.CustomerID.String(), discount); err != nil {
		return ports.PromotionRedemption{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.PromotionRedemption{}, err
	}

	return ports.PromotionRedemption{
		RedemptionID:  input.RedemptionID,
		PromotionID:   common.ID(candidate.promotionID),
		BusinessID:    input.BusinessID,
		OrderID:       input.OrderID,
		CustomerID:    input.CustomerID,
		Code:          candidate.code,
		DiscountMinor: discount,
		FundingSource: candidate.fundingSource,
		SubtotalMinor: input.SubtotalMinor,
	}, nil
}

func (repo PromotionRepository) VoidPendingPromotionRedemptions(
	ctx context.Context,
	scope common.TenantScope,
	orderID common.ID,
) error {
	if orderID.IsZero() {
		return nil
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update promotion_redemptions
		set status = 'void', updated_at = now()
		where business_id = $1 and order_id = $2 and status = 'pending'
	`, scope.BusinessID.String(), orderID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

type checkoutPromotion struct {
	promotionID           string
	code                  string
	discountType          string
	discountValue         int64
	maxDiscountMinor      sql.NullInt64
	usageLimitGlobal      sql.NullInt32
	usageLimitPerCustomer sql.NullInt32
	fundingSource         string
}

func findPromotionForCheckout(ctx context.Context, tx pgx.Tx, input ports.ReservePromotionInput) (checkoutPromotion, error) {
	var promotion checkoutPromotion
	err := tx.QueryRow(ctx, `
		select
			promotion_id::text,
			coalesce(code, ''),
			discount_type,
			discount_value,
			max_discount_minor,
			usage_limit_global,
			usage_limit_per_customer,
			funding_source
		from promotions
		where code is not null
			and lower(code) = lower($1)
			and status = 'active'
			and scope = 'store'
			and (business_id = $2 or business_id is null)
			and min_spend_minor <= $3
			and (starts_at is null or starts_at <= now())
			and (ends_at is null or ends_at > now())
		order by (business_id is not null) desc, created_at desc
		limit 1
		for update
	`, input.Code, input.BusinessID.String(), input.SubtotalMinor).Scan(
		&promotion.promotionID,
		&promotion.code,
		&promotion.discountType,
		&promotion.discountValue,
		&promotion.maxDiscountMinor,
		&promotion.usageLimitGlobal,
		&promotion.usageLimitPerCustomer,
		&promotion.fundingSource,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return checkoutPromotion{}, ports.ErrPromotionUnavailable
	}
	if err != nil {
		return checkoutPromotion{}, err
	}
	return promotion, nil
}

func promotionUsageAvailable(ctx context.Context, tx pgx.Tx, promotion checkoutPromotion, customerID common.ID) error {
	if promotion.usageLimitGlobal.Valid {
		var used int
		if err := tx.QueryRow(ctx, `
			select count(*)::int
			from promotion_redemptions
			where promotion_id = $1::uuid and status in ('pending', 'applied')
		`, promotion.promotionID).Scan(&used); err != nil {
			return err
		}
		if used >= int(promotion.usageLimitGlobal.Int32) {
			return ports.ErrPromotionUnavailable
		}
	}

	if promotion.usageLimitPerCustomer.Valid {
		var used int
		if err := tx.QueryRow(ctx, `
			select count(*)::int
			from promotion_redemptions
			where promotion_id = $1::uuid and customer_id = $2::uuid
				and status in ('pending', 'applied')
		`, promotion.promotionID, customerID.String()).Scan(&used); err != nil {
			return err
		}
		if used >= int(promotion.usageLimitPerCustomer.Int32) {
			return ports.ErrPromotionUnavailable
		}
	}

	return nil
}

func promotionDiscount(promotion checkoutPromotion, subtotalMinor int64) int64 {
	switch promotion.discountType {
	case "percentage":
		discount := subtotalMinor * promotion.discountValue / 10000
		if promotion.maxDiscountMinor.Valid && discount > promotion.maxDiscountMinor.Int64 {
			return promotion.maxDiscountMinor.Int64
		}
		return discount
	case "fixed":
		if promotion.discountValue > subtotalMinor {
			return subtotalMinor
		}
		return promotion.discountValue
	default:
		return 0
	}
}
