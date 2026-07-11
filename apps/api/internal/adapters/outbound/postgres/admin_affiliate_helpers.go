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

func scanAdminAffiliateRecord(row pgx.Row) (ports.AdminAffiliateRecord, error) {
	var record ports.AdminAffiliateRecord
	if err := row.Scan(
		&record.AffiliateID,
		&record.EntityType,
		&record.Code,
		&record.DisplayName,
		&record.ContactName,
		&record.Email,
		&record.Phone,
		&record.WebsiteURL,
		&record.CommissionModel,
		&record.CommissionRate,
		&record.CookieWindowDays,
		&record.PayoutMode,
		&record.PayoutReference,
		&record.Status,
		&record.Notes,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	return record, nil
}

func listAdminAffiliateConversions(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminAffiliateConversionRecord, error) {
	rows, err := tx.Query(ctx, `
		with ranked as (
			select
				affiliate_conversions.*,
				row_number() over (
					partition by affiliate_id
					order by updated_at desc, created_at desc
				) as rank
			from affiliate_conversions
		)
		select
			r.affiliate_conversion_id::text,
			r.affiliate_id::text,
			r.business_id::text,
			coalesce(b.name, '') as business_name,
			r.order_id::text,
			r.gross_minor,
			r.commission_minor,
			r.status,
			r.attribution_model,
			r.hold_until,
			r.created_at,
			r.updated_at
		from ranked r
		left join businesses b on b.business_id = r.business_id
		where r.rank <= 5
		order by r.affiliate_id, r.updated_at desc, r.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[common.ID][]ports.AdminAffiliateConversionRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateConversionRecord
		var holdUntil pgtype.Timestamptz
		if err := rows.Scan(
			&record.ConversionID,
			&record.AffiliateID,
			&record.BusinessID,
			&record.BusinessName,
			&record.OrderID,
			&record.GrossMinor,
			&record.CommissionMinor,
			&record.Status,
			&record.AttributionModel,
			&holdUntil,
			&record.CreatedAt,
			&record.UpdatedAt,
		); err != nil {
			return nil, err
		}
		record.HoldUntil = timestamptzPtr(holdUntil)
		out[record.AffiliateID] = append(out[record.AffiliateID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func listAdminAffiliatePayouts(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminAffiliatePayoutRecord, error) {
	rows, err := tx.Query(ctx, `
		with ranked as (
			select
				affiliate_payout_batches.*,
				row_number() over (
					partition by affiliate_id
					order by created_at desc, updated_at desc
				) as rank
			from affiliate_payout_batches
		)
		select
			r.payout_batch_id::text,
			r.affiliate_id::text,
			coalesce(a.display_name, '') as display_name,
			r.payout_mode,
			r.payout_reference,
			r.conversion_count,
			r.gross_minor,
			r.commission_minor,
			r.status,
			r.notes,
			r.created_at,
			r.updated_at
		from ranked r
		left join affiliates a on a.affiliate_id = r.affiliate_id
		where r.rank <= 3
		order by r.affiliate_id, r.created_at desc, r.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[common.ID][]ports.AdminAffiliatePayoutRecord{}
	for rows.Next() {
		record, err := scanAdminAffiliatePayoutRecord(rows)
		if err != nil {
			return nil, err
		}
		out[record.AffiliateID] = append(out[record.AffiliateID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func queryAdminAffiliateConversion(
	ctx context.Context,
	tx pgx.Tx,
	conversionID string,
) (ports.AdminAffiliateConversionRecord, error) {
	return scanAdminAffiliateConversionRecord(tx.QueryRow(ctx, `
		select
			ac.affiliate_conversion_id::text,
			ac.affiliate_id::text,
			ac.business_id::text,
			coalesce(b.name, '') as business_name,
			ac.order_id::text,
			ac.gross_minor,
			ac.commission_minor,
			ac.status,
			ac.attribution_model,
			ac.hold_until,
			ac.created_at,
			ac.updated_at
		from affiliate_conversions ac
		left join businesses b on b.business_id = ac.business_id
		where ac.affiliate_conversion_id = $1::uuid
	`, conversionID))
}

func scanAdminAffiliateConversionRecord(row pgx.Row) (ports.AdminAffiliateConversionRecord, error) {
	var record ports.AdminAffiliateConversionRecord
	var holdUntil pgtype.Timestamptz
	if err := row.Scan(
		&record.ConversionID,
		&record.AffiliateID,
		&record.BusinessID,
		&record.BusinessName,
		&record.OrderID,
		&record.GrossMinor,
		&record.CommissionMinor,
		&record.Status,
		&record.AttributionModel,
		&holdUntil,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateConversionRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateConversionRecord{}, err
	}
	record.HoldUntil = timestamptzPtr(holdUntil)
	return record, nil
}

func scanAdminAffiliatePayoutRecord(row pgx.Row) (ports.AdminAffiliatePayoutRecord, error) {
	var record ports.AdminAffiliatePayoutRecord
	if err := row.Scan(
		&record.PayoutBatchID,
		&record.AffiliateID,
		&record.DisplayName,
		&record.PayoutMode,
		&record.PayoutReference,
		&record.ConversionCount,
		&record.GrossMinor,
		&record.CommissionMinor,
		&record.Status,
		&record.Notes,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliatePayoutRecord{}, ErrNotFound
		}
		return ports.AdminAffiliatePayoutRecord{}, err
	}
	return record, nil
}

func validAffiliateConversionTransition(from string, to string) bool {
	if from == to {
		return true
	}
	switch from {
	case "pending":
		return to == "approved" || to == "reversed"
	case "approved":
		return to == "settled" || to == "reversed"
	default:
		return false
	}
}

func adminAffiliatesQuery() string {
	return adminAffiliateSelect("affiliates")
}

func adminAffiliateSelect(source string) string {
	return `
		select
			a.affiliate_id::text,
			a.entity_type,
			a.code,
			a.display_name,
			a.contact_name,
			a.email,
			a.phone,
			a.website_url,
			a.commission_model,
			a.commission_rate::bigint,
			a.cookie_window_days::int,
			a.payout_mode,
			a.payout_reference,
			a.status,
			a.notes,
			a.created_at,
			a.updated_at
		from ` + source + ` a
	`
}

func affiliateCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "affiliates_code_unique_idx"
}
