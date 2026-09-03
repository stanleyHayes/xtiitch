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
	var ownerBusinessID pgtype.Text
	var targetRefID pgtype.Text
	if err := row.Scan(
		&record.AffiliateID,
		&record.AffiliateProgrammeID,
		&record.ProgrammeName,
		&record.OwnerType,
		&ownerBusinessID,
		&record.OwnerBusinessName,
		&record.EntityType,
		&record.Code,
		&record.DisplayName,
		&record.ContactName,
		&record.Email,
		&record.Phone,
		&record.Region,
		&record.WebsiteURL,
		&record.CommissionModel,
		&record.CommissionRate,
		&record.PurchaseCommissionBPS,
		&record.FirstPaidPlanCommissionBPS,
		&record.CookieWindowDays,
		&record.PayoutMode,
		&record.PayoutReference,
		&record.Status,
		&record.Notes,
		&record.TargetScope,
		&targetRefID,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	if ownerBusinessID.Valid {
		value := common.ID(ownerBusinessID.String)
		record.OwnerBusinessID = &value
	}
	if targetRefID.Valid {
		value := common.ID(targetRefID.String)
		record.TargetRefID = &value
	}
	return record, nil
}

func listAdminAffiliateConversions(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminAffiliateConversionRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			r.affiliate_conversion_id::text,
			r.affiliate_id::text,
			r.business_id::text,
			coalesce(b.name, '') as business_name,
			coalesce(b.handle, '') as business_handle,
			r.conversion_type,
			coalesce(r.order_id::text, ''),
			coalesce(r.subscription_id::text, ''),
			r.payment_reference,
			coalesce(r.payout_batch_id::text, ''),
			r.gross_minor,
			r.commission_minor,
			r.status,
			r.attribution_model,
			r.hold_until,
			r.hold_reason,
			coalesce(r.pre_hold_status, ''),
			r.hold_placed_at,
			r.hold_released_at,
			r.created_at,
			r.updated_at
		from affiliate_conversions r
		left join businesses b on b.business_id = r.business_id
		order by r.affiliate_id, r.updated_at desc, r.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[common.ID][]ports.AdminAffiliateConversionRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateConversionRecord
		var holdUntil, holdPlacedAt, holdReleasedAt pgtype.Timestamptz
		if err := rows.Scan(
			&record.ConversionID,
			&record.AffiliateID,
			&record.BusinessID,
			&record.BusinessName,
			&record.BusinessHandle,
			&record.ConversionType,
			&record.OrderID,
			&record.SubscriptionID,
			&record.PaymentReference,
			&record.PayoutBatchID,
			&record.GrossMinor,
			&record.CommissionMinor,
			&record.Status,
			&record.AttributionModel,
			&holdUntil,
			&record.HoldReason,
			&record.PreHoldStatus,
			&holdPlacedAt,
			&holdReleasedAt,
			&record.CreatedAt,
			&record.UpdatedAt,
		); err != nil {
			return nil, err
		}
		record.HoldUntil = timestamptzPtr(holdUntil)
		record.HoldPlacedAt = timestamptzPtr(holdPlacedAt)
		record.HoldReleasedAt = timestamptzPtr(holdReleasedAt)
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
		from affiliate_payout_batches r
		left join affiliates a on a.affiliate_id = r.affiliate_id
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
			coalesce(b.handle, '') as business_handle,
			ac.conversion_type,
			coalesce(ac.order_id::text, ''),
			coalesce(ac.subscription_id::text, ''),
			ac.payment_reference,
			coalesce(ac.payout_batch_id::text, ''),
			ac.gross_minor,
			ac.commission_minor,
			ac.status,
			ac.attribution_model,
			ac.hold_until,
			ac.hold_reason,
			coalesce(ac.pre_hold_status, ''),
			ac.hold_placed_at,
			ac.hold_released_at,
			ac.created_at,
			ac.updated_at
		from affiliate_conversions ac
		left join businesses b on b.business_id = ac.business_id
		where ac.affiliate_conversion_id = $1::uuid
	`, conversionID))
}

func scanAdminAffiliateConversionRecord(row pgx.Row) (ports.AdminAffiliateConversionRecord, error) {
	var record ports.AdminAffiliateConversionRecord
	var holdUntil, holdPlacedAt, holdReleasedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.ConversionID,
		&record.AffiliateID,
		&record.BusinessID,
		&record.BusinessName,
		&record.BusinessHandle,
		&record.ConversionType,
		&record.OrderID,
		&record.SubscriptionID,
		&record.PaymentReference,
		&record.PayoutBatchID,
		&record.GrossMinor,
		&record.CommissionMinor,
		&record.Status,
		&record.AttributionModel,
		&holdUntil,
		&record.HoldReason,
		&record.PreHoldStatus,
		&holdPlacedAt,
		&holdReleasedAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateConversionRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateConversionRecord{}, err
	}
	record.HoldUntil = timestamptzPtr(holdUntil)
	record.HoldPlacedAt = timestamptzPtr(holdPlacedAt)
	record.HoldReleasedAt = timestamptzPtr(holdReleasedAt)
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
		return to == "approved" || to == "reversed" || to == "held"
	case "approved":
		return to == "settled" || to == "reversed" || to == "held"
	case "settled":
		return to == "reversed"
	case "held":
		// A held commission can only be released back to the status it carried
		// before the hold, or reversed outright once the review concludes.
		return to == "released" || to == "reversed"
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
			a.affiliate_programme_id::text,
			ap.name,
			ap.owner_type,
			a.owner_business_id::text,
			coalesce(owner_business.name, ''),
			a.entity_type,
			a.code,
			a.display_name,
			a.contact_name,
			a.email,
			a.phone,
			a.region,
			a.website_url,
			a.commission_model,
			a.commission_rate::bigint,
			a.purchase_commission_bps::int,
			a.first_paid_plan_commission_bps::int,
			a.cookie_window_days::int,
			a.payout_mode,
			a.payout_reference,
			a.status,
			a.notes,
			a.target_scope,
			a.target_ref_id::text,
			a.created_at,
			a.updated_at
		from ` + source + ` a
		join affiliate_programmes ap
			on ap.affiliate_programme_id = a.affiliate_programme_id
		left join businesses owner_business
			on owner_business.business_id = a.owner_business_id
	`
}

func affiliateCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgUniqueViolation &&
		(pgErr.ConstraintName == "affiliates_code_unique_idx" ||
			pgErr.ConstraintName == "growth_codes_pkey")
}

func affiliateAccountEmailTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgUniqueViolation &&
		pgErr.ConstraintName == "affiliate_accounts_email_unique_idx"
}
