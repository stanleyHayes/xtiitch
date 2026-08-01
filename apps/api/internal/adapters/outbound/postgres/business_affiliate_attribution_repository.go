package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

//nolint:funlen // long by construction: one large SQL statement plus its row scan. Splitting it would hide the query from its mapping, not simplify it.
func (repo BusinessAffiliateRepository) ListBusinessAffiliateAttribution(
	ctx context.Context,
	scope common.TenantScope,
) ([]ports.BusinessAffiliateAttributionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
		with clicks as (
			select affiliate_id, count(*)::bigint as count,
				max(clicked_at) as last_at
			from affiliate_clicks
			group by affiliate_id
		),
		signups as (
			select affiliate_id,
				count(*) filter (where status = 'qualified')::bigint as count,
				max(qualified_at) as last_at
			from affiliate_signups
			group by affiliate_id
		),
		conversions as (
			select affiliate_id, count(*)::bigint as count,
				coalesce(sum(gross_minor), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor), 0)::bigint as commission_minor,
				max(updated_at) as last_at
			from affiliate_conversions
			where business_id = $1::uuid
			group by affiliate_id
		)
		select
			a.affiliate_id::text, a.code, a.display_name,
			coalesce(clicks.count, 0)::bigint,
			coalesce(signups.count, 0)::bigint,
			coalesce(conversions.count, 0)::bigint,
			coalesce(conversions.gross_minor, 0)::bigint,
			coalesce(conversions.commission_minor, 0)::bigint,
			nullif(greatest(
				coalesce(clicks.last_at, 'epoch'::timestamptz),
				coalesce(signups.last_at, 'epoch'::timestamptz),
				coalesce(conversions.last_at, 'epoch'::timestamptz)
			), 'epoch'::timestamptz)
		from affiliates a
		left join clicks on clicks.affiliate_id = a.affiliate_id
		left join signups on signups.affiliate_id = a.affiliate_id
		left join conversions on conversions.affiliate_id = a.affiliate_id
		where a.owner_business_id = $1::uuid
		order by
			coalesce(conversions.count, 0) desc,
			coalesce(clicks.count, 0) desc,
			a.updated_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.BusinessAffiliateAttributionRecord{}
	for rows.Next() {
		var record ports.BusinessAffiliateAttributionRecord
		var lastActivity pgtype.Timestamptz
		if err := rows.Scan(
			&record.AffiliateID, &record.Code, &record.DisplayName,
			&record.ClickCount, &record.SignupCount, &record.ConversionCount,
			&record.GrossMinor, &record.CommissionMinor, &lastActivity,
		); err != nil {
			return nil, err
		}
		if lastActivity.Valid {
			value := lastActivity.Time
			record.LastActivityAt = &value
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
