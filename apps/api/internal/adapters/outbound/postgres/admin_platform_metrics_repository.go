package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) GetAdminPlatformMetrics(ctx context.Context) (ports.AdminPlatformMetricsRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}

	var record ports.AdminPlatformMetricsRecord
	if err := tx.QueryRow(ctx, `
		with business_stats as (
			select
				count(*)::int as total_businesses,
				count(*) filter (where operational_status = 'active')::int as active_businesses,
				count(*) filter (where operational_status = 'suspended')::int as suspended_businesses,
				count(*) filter (
					where operational_status = 'active'
						and verification_status in ('unverified', 'pending')
				)::int as pending_verifications
			from businesses
		),
		payment_stats as (
			select
				coalesce(sum(amount_minor) filter (
					where status = 'succeeded'
						and created_at >= date_trunc('month', now())
				), 0)::bigint as gmv_month_minor,
				coalesce(sum(commission_minor) filter (
					where status = 'succeeded'
						and created_at >= date_trunc('month', now())
				), 0)::bigint as platform_revenue_month_minor,
				count(*) filter (
					where status in ('succeeded', 'failed')
						and created_at >= now() - interval '30 days'
				)::int as total_payments_30d,
				count(*) filter (
					where status = 'failed'
						and created_at >= now() - interval '30 days'
				)::int as failed_payments_30d
			from payments
		)
		select
			p.gmv_month_minor,
			p.platform_revenue_month_minor,
			b.active_businesses,
			b.total_businesses,
			b.pending_verifications,
			b.suspended_businesses,
			case
				when p.total_payments_30d = 0 then 10000
				else round(((p.total_payments_30d - p.failed_payments_30d)::numeric / p.total_payments_30d::numeric) * 10000)::int
			end as payment_health_bps,
			p.failed_payments_30d,
			p.total_payments_30d,
			now()
		from business_stats b
		cross join payment_stats p
	`).Scan(
		&record.GMVMonthMinor,
		&record.PlatformRevenueMonthMinor,
		&record.ActiveBusinesses,
		&record.TotalBusinesses,
		&record.PendingVerifications,
		&record.SuspendedBusinesses,
		&record.PaymentHealthBPS,
		&record.FailedPayments30d,
		&record.TotalPayments30d,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}

	return record, nil
}
