package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func scanAdminPromotionRecord(row pgx.Row) (ports.AdminPromotionRecord, error) {
	var record ports.AdminPromotionRecord
	var businessID pgtype.Text
	var targetCollectionID pgtype.Text
	var targetDesignID pgtype.Text
	var maxDiscountMinor pgtype.Int8
	var usageLimitGlobal pgtype.Int4
	var usageLimitPerCustomer pgtype.Int4
	var startsAt pgtype.Timestamptz
	var endsAt pgtype.Timestamptz
	if err := row.Scan(
		&record.PromotionID,
		&businessID,
		&record.BusinessName,
		&record.BusinessHandle,
		&record.Code,
		&record.Title,
		&record.Description,
		&record.DiscountType,
		&record.DiscountValue,
		&maxDiscountMinor,
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
		return ports.AdminPromotionRecord{}, err
	}
	if businessID.Valid {
		id := common.ID(businessID.String)
		record.BusinessID = &id
	}
	if targetCollectionID.Valid {
		id := common.ID(targetCollectionID.String)
		record.TargetCollectionID = &id
	}
	if targetDesignID.Valid {
		id := common.ID(targetDesignID.String)
		record.TargetDesignID = &id
	}
	record.MaxDiscountMinor = int8Ptr(maxDiscountMinor)
	record.UsageLimitGlobal = int4Ptr(usageLimitGlobal)
	record.UsageLimitPerCustomer = int4Ptr(usageLimitPerCustomer)
	record.StartsAt = timestamptzPtr(startsAt)
	record.EndsAt = timestamptzPtr(endsAt)
	return record, nil
}

func listAdminPromotionRedemptions(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminPromotionRedemptionRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			pr.promotion_redemption_id::text,
			pr.promotion_id::text,
			pr.business_id::text,
			pr.order_id::text,
			pr.customer_id::text,
			coalesce(c.display_name, ''),
			pr.discount_minor::bigint,
			pr.status,
			pr.redeemed_at,
			pr.created_at,
			pr.updated_at
		from (
			select
				pr.*,
				row_number() over (
					partition by pr.promotion_id
					order by pr.created_at desc, pr.promotion_redemption_id
				) as redemption_rank
			from promotion_redemptions pr
		) pr
		left join customers c on c.customer_id = pr.customer_id
		where pr.redemption_rank <= 5
		order by pr.promotion_id, pr.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	redemptions := map[common.ID][]ports.AdminPromotionRedemptionRecord{}
	for rows.Next() {
		record, err := scanAdminPromotionRedemptionRecord(rows)
		if err != nil {
			return nil, err
		}
		redemptions[record.PromotionID] = append(redemptions[record.PromotionID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return redemptions, nil
}

func scanAdminPromotionRedemptionRecord(row pgx.Row) (ports.AdminPromotionRedemptionRecord, error) {
	var record ports.AdminPromotionRedemptionRecord
	var orderID pgtype.Text
	var customerID pgtype.Text
	var redeemedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.PromotionRedemptionID,
		&record.PromotionID,
		&record.BusinessID,
		&orderID,
		&customerID,
		&record.CustomerName,
		&record.DiscountMinor,
		&record.Status,
		&redeemedAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminPromotionRedemptionRecord{}, err
	}
	record.OrderID = commonIDPtr(orderID)
	record.CustomerID = commonIDPtr(customerID)
	record.RedeemedAt = timestamptzPtr(redeemedAt)
	return record, nil
}

func adminPromotionsQuery() string {
	return adminPromotionSelect("promotions")
}

func adminPromotionSelect(source string) string {
	return `
		select
			p.promotion_id::text,
			p.business_id::text,
			coalesce(b.name, ''),
			coalesce(b.handle, ''),
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
		left join businesses b on b.business_id = p.business_id
		left join lateral (
			select
				count(*) filter (where pr.status = 'applied')::int as redemption_count,
				coalesce(sum(pr.discount_minor) filter (where pr.status = 'applied'), 0)::bigint as discount_redeemed_minor
			from promotion_redemptions pr
			where pr.promotion_id = p.promotion_id
		) r on true
	`
}

func promotionCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "promotions_active_code_unique_idx"
}

func nullableTextArg(value string) any {
	if value == "" {
		return nil
	}
	return value
}
func nullableTimeArg(value *time.Time) any {
	if value == nil {
		return nil
	}
	return *value
}
