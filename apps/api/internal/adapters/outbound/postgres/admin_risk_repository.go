package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) ListAdminRiskReviews(ctx context.Context) ([]ports.AdminRiskReviewRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	records, err := queryAdminRiskReviews(ctx, tx, "")
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) SetAdminRiskReviewStatus(
	ctx context.Context,
	input ports.SetAdminRiskReviewStatusInput,
) (ports.AdminRiskReviewRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	current, err := queryAdminRiskReview(ctx, tx, input.ReviewKey)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into admin_risk_review_states (
			review_key,
			business_id,
			status,
			reason,
			updated_by_admin_user_id,
			updated_at
		)
		values ($1, $2, $3, $4, $5, now())
		on conflict (review_key) do update
		set business_id = excluded.business_id,
			status = excluded.status,
			reason = excluded.reason,
			updated_by_admin_user_id = excluded.updated_by_admin_user_id,
			updated_at = now()
	`, input.ReviewKey,
		current.BusinessID.String(),
		input.Status,
		input.Reason,
		input.ActorAdminUser.String(),
	); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	record, err := queryAdminRiskReview(ctx, tx, input.ReviewKey)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	return record, nil
}

func queryAdminRiskReview(
	ctx context.Context,
	tx pgx.Tx,
	reviewKey string,
) (ports.AdminRiskReviewRecord, error) {
	records, err := queryAdminRiskReviews(ctx, tx, reviewKey)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}
	if len(records) == 0 {
		return ports.AdminRiskReviewRecord{}, ErrNotFound
	}
	return records[0], nil
}

func queryAdminRiskReviews(
	ctx context.Context,
	tx pgx.Tx,
	reviewKey string,
) ([]ports.AdminRiskReviewRecord, error) {
	rows, err := tx.Query(ctx, `
		with payment_stats as (
			select
				business_id,
				count(*) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				)::int as failed_30d,
				max(updated_at) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				) as failed_at
			from payments
			group by business_id
		),
		replay_stats as (
			select
				p.business_id,
				count(*)::int as queued_replays,
				max(r.created_at) as replay_at
			from admin_money_replay_requests r
			join payments p on p.provider_reference = r.provider_reference
			where r.status = 'queued'
			group by p.business_id
		),
		active_holds as (
			select
				business_id,
				reason,
				updated_at
			from admin_settlement_review_holds
			where is_active
		),
		signals as (
			select
				'payment_failures:' || b.business_id::text as review_key,
				b.business_id,
				'Payment failure spike' as title,
				b.name as business_name,
				case
					when coalesce(ps.failed_30d, 0) >= 3
						or coalesce(rs.queued_replays, 0) > 0 then 'high'
					else 'medium'
				end as level,
				coalesce(ps.failed_30d, 0)::text
					|| ' failed payment(s) in the last 30 days'
					|| case
						when coalesce(rs.queued_replays, 0) > 0
							then '; ' || rs.queued_replays::text || ' replay request(s) queued.'
						else '.'
					end as reason,
				'Money rails' as owner,
				greatest(
					coalesce(ps.failed_at, b.updated_at),
					coalesce(rs.replay_at, b.updated_at),
					b.updated_at
				) as signal_at
			from businesses b
			join payment_stats ps on ps.business_id = b.business_id
			left join replay_stats rs on rs.business_id = b.business_id
			where coalesce(ps.failed_30d, 0) > 0

			union all

			select
				'settlement_hold:' || b.business_id::text as review_key,
				b.business_id,
				'Settlement review hold' as title,
				b.name as business_name,
				'high' as level,
				'Operator hold is active: ' || h.reason as reason,
				'Money rails' as owner,
				h.updated_at as signal_at
			from businesses b
			join active_holds h on h.business_id = b.business_id

			union all

			select
				'suspended_business:' || b.business_id::text as review_key,
				b.business_id,
				'Business suspended' as title,
				b.name as business_name,
				'high' as level,
				coalesce(nullif(b.suspension_reason, ''), 'Business is suspended and needs operator review.') as reason,
				'Trust review' as owner,
				coalesce(b.suspended_at, b.updated_at) as signal_at
			from businesses b
			where b.operational_status = 'suspended'

			union all

			select
				'rejected_verification:' || b.business_id::text as review_key,
				b.business_id,
				'Rejected verification' as title,
				b.name as business_name,
				'high' as level,
				'Business verification is rejected; review owner and settlement evidence before reinstatement.' as reason,
				'Verification' as owner,
				b.updated_at as signal_at
			from businesses b
			where b.verification_status = 'rejected'

			union all

			select
				'missing_subaccount:' || b.business_id::text as review_key,
				b.business_id,
				'Payout subaccount missing' as title,
				b.name as business_name,
				'medium' as level,
				'Business is verified but has no settlement subaccount configured.' as reason,
				'Payments setup' as owner,
				b.updated_at as signal_at
			from businesses b
			where b.verification_status = 'verified'
				and coalesce(b.settlement_provider_subaccount, '') = ''
		)
		select
			s.review_key,
			s.business_id::text,
			s.title,
			s.business_name,
			s.level,
			s.reason,
			s.owner,
			coalesce(st.status, 'open') as status,
			coalesce(st.updated_at, s.signal_at, now()) as updated_at
		from signals s
		left join admin_risk_review_states st on st.review_key = s.review_key
		where ($1::text = '' or s.review_key = $1)
		order by
			case coalesce(st.status, 'open')
				when 'open' then 1
				else 2
			end,
			case s.level
				when 'high' then 1
				when 'medium' then 2
				else 3
			end,
			coalesce(st.updated_at, s.signal_at, now()) desc,
			s.business_name
		limit 100
	`, reviewKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminRiskReviewRecord{}
	for rows.Next() {
		record, err := scanAdminRiskReviewRecord(rows)
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

func scanAdminRiskReviewRecord(row pgx.Row) (ports.AdminRiskReviewRecord, error) {
	var record ports.AdminRiskReviewRecord
	if err := row.Scan(
		&record.ReviewKey,
		&record.BusinessID,
		&record.Title,
		&record.BusinessName,
		&record.Level,
		&record.Reason,
		&record.Owner,
		&record.Status,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}
	return record, nil
}
