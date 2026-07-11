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

func scanAdminAdCampaignRecord(row pgx.Row) (ports.AdminAdCampaignRecord, error) {
	var record ports.AdminAdCampaignRecord
	var dailyCapMinor pgtype.Int8
	if err := row.Scan(
		&record.CampaignID,
		&record.BusinessID,
		&record.BusinessName,
		&record.BusinessHandle,
		&record.PlacementType,
		&record.TargetRefID,
		&record.TargetLabel,
		&record.Headline,
		&record.Description,
		&record.Status,
		&record.PricingModel,
		&record.BudgetMinor,
		&record.SpendMinor,
		&dailyCapMinor,
		&record.StartsAt,
		&record.EndsAt,
		&record.ImpressionCount,
		&record.ClickCount,
		&record.ClickRateBPS,
		&record.ReviewNote,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	record.DailyCapMinor = int8Ptr(dailyCapMinor)
	return record, nil
}

func scanAdminAdCampaignPaymentRecord(row pgx.Row) (ports.AdminAdCampaignPaymentRecord, error) {
	var record ports.AdminAdCampaignPaymentRecord
	var paidAt pgtype.Timestamptz
	var failedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.PaymentID,
		&record.CampaignID,
		&record.BusinessID,
		&record.Provider,
		&record.ProviderReference,
		&record.PaymentURL,
		&record.AmountMinor,
		&record.Currency,
		&record.Status,
		&paidAt,
		&failedAt,
		&record.FailureReason,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}
	record.PaidAt = timestamptzPtr(paidAt)
	record.FailedAt = timestamptzPtr(failedAt)
	return record, nil
}

func adminAdCampaignsQuery() string {
	return adminAdCampaignSelect("ad_campaigns")
}

func adminAdCampaignSelect(source string) string {
	return `
		select
			c.campaign_id::text,
			c.advertiser_business_id::text,
			b.name,
			b.handle,
			c.placement_type,
			c.target_ref_id,
			case
				when c.placement_type = 'promoted_design' then coalesce(d.title, c.target_ref_id)
				when c.placement_type = 'homepage_hero' then b.name || ' homepage hero'
				else b.name
			end as target_label,
			c.headline,
			c.description,
			c.status,
			c.pricing_model,
			c.budget_minor::bigint,
			c.spend_to_date_minor::bigint,
			c.daily_cap_minor,
			c.starts_at,
			c.ends_at,
			coalesce(e.impression_count, 0)::int,
			coalesce(e.click_count, 0)::int,
			case
				when coalesce(e.impression_count, 0) = 0 then 0
				else round((coalesce(e.click_count, 0)::numeric / e.impression_count::numeric) * 10000)::int
			end as click_rate_bps,
			c.review_note,
			c.created_at,
			c.updated_at
		from ` + source + ` c
		join businesses b on b.business_id = c.advertiser_business_id
		left join designs d on d.business_id = c.advertiser_business_id
			and d.design_id::text = c.target_ref_id
		left join lateral (
			select
				count(*) filter (where event_type = 'impression')::int as impression_count,
				count(*) filter (where event_type = 'click')::int as click_count
			from ad_events e
			where e.campaign_id = c.campaign_id
		) e on true
	`
}

func adminAdCampaignPaymentSelect(source string) string {
	return `
		select
			ap.payment_id::text,
			ap.campaign_id::text,
			ap.advertiser_business_id::text,
			ap.provider,
			ap.provider_reference,
			ap.payment_url,
			ap.amount_minor::bigint,
			ap.currency,
			ap.status,
			ap.paid_at,
			ap.failed_at,
			ap.failure_reason,
			ap.created_at,
			ap.updated_at
		from ` + source + ` ap
	`
}

func listAdminAdCampaignPayments(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminAdCampaignPaymentRecord, error) {
	rows, err := tx.Query(ctx, adminAdCampaignPaymentSelect("ad_campaign_payments")+`
		order by ap.created_at desc
		limit 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	payments := map[common.ID][]ports.AdminAdCampaignPaymentRecord{}
	for rows.Next() {
		record, err := scanAdminAdCampaignPaymentRecord(rows)
		if err != nil {
			return nil, err
		}
		payments[record.CampaignID] = append(payments[record.CampaignID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func listAdminAdCampaignPaymentsForCampaign(
	ctx context.Context,
	tx pgx.Tx,
	campaignID common.ID,
) ([]ports.AdminAdCampaignPaymentRecord, error) {
	rows, err := tx.Query(ctx, adminAdCampaignPaymentSelect("ad_campaign_payments")+`
		where ap.campaign_id = $1::uuid
		order by ap.created_at desc
		limit 10
	`, campaignID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAdCampaignPaymentRecord{}
	for rows.Next() {
		record, err := scanAdminAdCampaignPaymentRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return records, nil
}

func isOpenAdCampaignPayment(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "ad_campaign_payments_one_open_idx"
}
