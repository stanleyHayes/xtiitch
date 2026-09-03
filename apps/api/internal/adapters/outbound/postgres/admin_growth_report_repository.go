package postgres

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) GetAdminGrowthReport(
	ctx context.Context,
	from time.Time,
	to time.Time,
) (ports.AdminGrowthReportRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminGrowthReportRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminGrowthReportRecord{}, err
	}
	var record ports.AdminGrowthReportRecord
	err = tx.QueryRow(ctx, `
		with clicks as (
			select count(*)::bigint as count from affiliate_clicks
			where clicked_at >= $1 and clicked_at < $2
		),
		signups as (
			select
				count(*) filter (where subject_type = 'customer')::bigint as customers,
				count(*) filter (where subject_type = 'business')::bigint as businesses
			from affiliate_signups
			where status = 'qualified' and qualified_at >= $1 and qualified_at < $2
		),
		conversions as (
			select
				count(*) filter (where conversion_type = 'purchase')::bigint as purchases,
				count(*) filter (where conversion_type = 'subscription_payment')::bigint as plans,
				coalesce(sum(gross_minor), 0)::bigint as gross,
				coalesce(sum(commission_minor) filter (where status = 'pending'), 0)::bigint as pending,
				coalesce(sum(commission_minor) filter (where status = 'approved'), 0)::bigint as approved,
				coalesce(sum(commission_minor) filter (where status = 'settled'), 0)::bigint as settled,
				coalesce(sum(commission_minor) filter (where status = 'reversed'), 0)::bigint as reversed
			from affiliate_conversions
			where created_at >= $1 and created_at < $2
		),
		store_discounts as (
			select coalesce(sum(discount_minor), 0)::bigint as total
			from promotion_redemptions
			where status = 'applied' and redeemed_at >= $1 and redeemed_at < $2
		),
		plan_discounts as (
			select coalesce(sum(discount_minor), 0)::bigint as total
			from subscription_discount_redemptions
			where status = 'applied' and applied_at >= $1 and applied_at < $2
		),
		payouts as (
			select count(*)::bigint as count,
				coalesce(sum(commission_minor), 0)::bigint as total
			from affiliate_payout_batches
			where status = 'settled' and created_at >= $1 and created_at < $2
		)
		select clicks.count, signups.customers, signups.businesses,
			conversions.purchases, conversions.plans, conversions.gross,
			store_discounts.total, plan_discounts.total,
			conversions.pending, conversions.approved, conversions.settled,
			conversions.reversed, payouts.count, payouts.total
		from clicks, signups, conversions, store_discounts, plan_discounts, payouts
	`, from, to).Scan(
		&record.ClickCount, &record.CustomerSignupCount,
		&record.BusinessSignupCount, &record.PurchaseConversionCount,
		&record.PaidPlanConversionCount, &record.GrossEligibleMinor,
		&record.StoreDiscountMinor, &record.PaidPlanDiscountMinor,
		&record.PendingCommissionMinor, &record.ApprovedCommissionMinor,
		&record.SettledCommissionMinor, &record.ReversedCommissionMinor,
		&record.PayoutBatchCount, &record.PayoutCommissionMinor,
	)
	if err != nil {
		return ports.AdminGrowthReportRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminGrowthReportRecord{}, err
	}
	return record, nil
}
