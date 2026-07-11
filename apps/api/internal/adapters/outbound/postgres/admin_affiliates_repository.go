package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

func (repo AdminAuthRepository) ListAdminAffiliates(ctx context.Context) ([]ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminAffiliatesQuery()+`
		order by
			case status when 'pending_review' then 1 when 'active' then 2 when 'paused' then 3 else 4 end,
			updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateRecord{}
	for rows.Next() {
		record, err := scanAdminAffiliateRecord(rows)
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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) ListAdminAffiliateAttribution(ctx context.Context) ([]ports.AdminAffiliateAttributionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		with click_stats as (
			select
				affiliate_id,
				count(*)::bigint as click_count,
				max(clicked_at) as last_clicked_at
			from affiliate_clicks
			group by affiliate_id
		),
		conversion_stats as (
			select
				affiliate_id,
				count(*)::bigint as conversion_count,
				count(*) filter (where status = 'pending')::bigint as pending_count,
				count(*) filter (where status = 'approved')::bigint as approved_count,
				count(*) filter (where status = 'settled')::bigint as settled_count,
				count(*) filter (where status = 'reversed')::bigint as reversed_count,
				coalesce(sum(gross_minor), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor), 0)::bigint as commission_minor,
				max(updated_at) as last_conversion_at
			from affiliate_conversions
			group by affiliate_id
		)
		select
			a.affiliate_id::text,
			a.code,
			a.display_name,
			coalesce(click_stats.click_count, 0)::bigint,
			coalesce(conversion_stats.conversion_count, 0)::bigint,
			coalesce(conversion_stats.pending_count, 0)::bigint,
			coalesce(conversion_stats.approved_count, 0)::bigint,
			coalesce(conversion_stats.settled_count, 0)::bigint,
			coalesce(conversion_stats.reversed_count, 0)::bigint,
			coalesce(conversion_stats.gross_minor, 0)::bigint,
			coalesce(conversion_stats.commission_minor, 0)::bigint,
			greatest(
				a.updated_at,
				coalesce(click_stats.last_clicked_at, 'epoch'::timestamptz),
				coalesce(conversion_stats.last_conversion_at, 'epoch'::timestamptz)
			)
		from affiliates a
		left join click_stats on click_stats.affiliate_id = a.affiliate_id
		left join conversion_stats on conversion_stats.affiliate_id = a.affiliate_id
		order by
			coalesce(conversion_stats.conversion_count, 0) desc,
			coalesce(click_stats.click_count, 0) desc,
			a.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateAttributionRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateAttributionRecord
		var lastActivityAt time.Time
		if err := rows.Scan(
			&record.AffiliateID,
			&record.Code,
			&record.DisplayName,
			&record.ClickCount,
			&record.ConversionCount,
			&record.PendingConversionCount,
			&record.ApprovedConversionCount,
			&record.SettledConversionCount,
			&record.ReversedConversionCount,
			&record.GrossMinor,
			&record.CommissionMinor,
			&lastActivityAt,
		); err != nil {
			return nil, err
		}
		record.LastActivityAt = &lastActivityAt
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	conversions, err := listAdminAffiliateConversions(ctx, tx)
	if err != nil {
		return nil, err
	}
	payouts, err := listAdminAffiliatePayouts(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentConversions = conversions[records[index].AffiliateID]
		records[index].RecentPayouts = payouts[records[index].AffiliateID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) UpdateAdminAffiliateConversionStatus(
	ctx context.Context,
	input ports.UpdateAdminAffiliateConversionStatusInput,
) (ports.AdminAffiliateConversionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	current, err := queryAdminAffiliateConversion(ctx, tx, input.ConversionID.String())
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	if !validAffiliateConversionTransition(current.Status, input.Status) {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
	}

	if _, err := tx.Exec(ctx, `
		update affiliate_conversions
		set status = $2,
			approved_at = case
				when $2 = 'approved' then coalesce(approved_at, now())
				else approved_at
			end,
			settled_at = case
				when $2 = 'settled' then coalesce(settled_at, now())
				else settled_at
			end,
			reversed_at = case
				when $2 = 'reversed' then coalesce(reversed_at, now())
				else reversed_at
			end,
			reversal_reason = case
				when $2 = 'reversed' then $3
				else reversal_reason
			end,
			metadata = metadata || jsonb_build_object(
				'admin_status_note', $3::text,
				'admin_status_by', $4::text,
				'admin_status_at', now()
			),
			updated_at = now()
		where affiliate_conversion_id = $1::uuid
	`, input.ConversionID.String(), input.Status, input.Reason, input.ActorAdminUser.String()); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	record, err := queryAdminAffiliateConversion(ctx, tx, input.ConversionID.String())
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminAffiliatePayout(
	ctx context.Context,
	input ports.CreateAdminAffiliatePayoutInput,
) (ports.AdminAffiliatePayoutRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	record, err := scanAdminAffiliatePayoutRecord(tx.QueryRow(ctx, `
		with affiliate as (
			select
				affiliate_id,
				display_name,
				payout_mode,
				payout_reference
			from affiliates
			where affiliate_id = $2::uuid
				and status <> 'archived'
		),
		eligible as (
			select
				affiliate_conversion_id,
				gross_minor,
				commission_minor
			from affiliate_conversions
			where affiliate_id = $2::uuid
				and status = 'approved'
			order by approved_at nulls last, updated_at, affiliate_conversion_id
			for update
		),
		totals as (
			select
				count(*)::int as conversion_count,
				coalesce(sum(gross_minor), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor), 0)::bigint as commission_minor
			from eligible
			having count(*) > 0
		),
		inserted as (
			insert into affiliate_payout_batches (
				payout_batch_id,
				affiliate_id,
				payout_mode,
				payout_reference,
				conversion_count,
				gross_minor,
				commission_minor,
				status,
				notes,
				created_by_admin_user_id
			)
			select
				$1::uuid,
				affiliate.affiliate_id,
				affiliate.payout_mode,
				coalesce(nullif($3::text, ''), affiliate.payout_reference),
				totals.conversion_count,
				totals.gross_minor,
				totals.commission_minor,
				'settled',
				$4::text,
				$5::uuid
			from affiliate
			join totals on true
			returning *
		),
		updated as (
			update affiliate_conversions ac
			set status = 'settled',
				settled_at = coalesce(settled_at, now()),
				payout_batch_id = (select payout_batch_id from inserted),
				metadata = metadata || jsonb_build_object(
					'payout_batch_id', (select payout_batch_id::text from inserted),
					'payout_reference', (select payout_reference from inserted),
					'payout_reconciled_by', $5::text,
					'payout_reconciled_at', now(),
					'payout_note', $4::text
				),
				updated_at = now()
			from eligible
			where ac.affiliate_conversion_id = eligible.affiliate_conversion_id
			returning 1
		)
		select
			inserted.payout_batch_id::text,
			inserted.affiliate_id::text,
			affiliate.display_name,
			inserted.payout_mode,
			inserted.payout_reference,
			inserted.conversion_count,
			inserted.gross_minor,
			inserted.commission_minor,
			inserted.status,
			inserted.notes,
			inserted.created_at,
			inserted.updated_at
		from inserted
		join affiliate on affiliate.affiliate_id = inserted.affiliate_id
	`, input.PayoutBatchID.String(),
		input.AffiliateID.String(),
		input.PayoutReference,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminAffiliate(
	ctx context.Context,
	input ports.CreateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into affiliates (
				affiliate_id,
				entity_type,
				code,
				display_name,
				contact_name,
				email,
				phone,
				website_url,
				commission_model,
				commission_rate,
				cookie_window_days,
				payout_mode,
				payout_reference,
				status,
				notes,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid,
				$2,
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
				$16::uuid,
				$16::uuid
			)
			returning *
		)
		`+adminAffiliateSelect("inserted")+`
	`, input.AffiliateID.String(),
		input.EntityType,
		input.Code,
		input.DisplayName,
		input.ContactName,
		input.Email,
		input.Phone,
		input.WebsiteURL,
		input.CommissionModel,
		input.CommissionRate,
		input.CookieWindowDays,
		input.PayoutMode,
		input.PayoutReference,
		input.Status,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminAffiliate(
	ctx context.Context,
	input ports.UpdateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with updated as (
			update affiliates
			set entity_type = $2,
				code = $3,
				display_name = $4,
				contact_name = $5,
				email = $6,
				phone = $7,
				website_url = $8,
				commission_model = $9,
				commission_rate = $10,
				cookie_window_days = $11,
				payout_mode = $12,
				payout_reference = $13,
				status = $14,
				notes = $15,
				updated_by_admin_user_id = $16::uuid,
				updated_at = now()
			where affiliate_id = $1::uuid
				and status <> 'archived'
			returning *
		)
		`+adminAffiliateSelect("updated")+`
	`, input.AffiliateID.String(),
		input.EntityType,
		input.Code,
		input.DisplayName,
		input.ContactName,
		input.Email,
		input.Phone,
		input.WebsiteURL,
		input.CommissionModel,
		input.CommissionRate,
		input.CookieWindowDays,
		input.PayoutMode,
		input.PayoutReference,
		input.Status,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminAffiliate(
	ctx context.Context,
	input ports.ArchiveAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with updated as (
			update affiliates
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where affiliate_id = $1::uuid
			returning *
		)
		`+adminAffiliateSelect("updated")+`
	`, input.AffiliateID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}
