package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) SetAdminSettlementReviewHold(
	ctx context.Context,
	input ports.SetAdminSettlementReviewHoldInput,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists (
			select 1 from businesses where business_id = $1
		)
	`, input.BusinessID.String()).Scan(&exists); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}
	if !exists {
		return ports.AdminMoneyPayoutReviewRecord{}, ErrNotFound
	}

	if input.Hold {
		if _, err := tx.Exec(ctx, `
			insert into admin_settlement_review_holds (
				business_id,
				is_active,
				reason,
				placed_by_admin_user_id,
				placed_at,
				released_by_admin_user_id,
				released_at,
				updated_at
			)
			values ($1, true, $2, $3, now(), null, null, now())
			on conflict (business_id) do update
			set is_active = true,
				reason = excluded.reason,
				placed_by_admin_user_id = excluded.placed_by_admin_user_id,
				placed_at = now(),
				released_by_admin_user_id = null,
				released_at = null,
				updated_at = now()
		`, input.BusinessID.String(), input.Reason, input.ActorAdminUser.String()); err != nil {
			return ports.AdminMoneyPayoutReviewRecord{}, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			update admin_settlement_review_holds
			set is_active = false,
				reason = $2,
				released_by_admin_user_id = $3,
				released_at = now(),
				updated_at = now()
			where business_id = $1
		`, input.BusinessID.String(), input.Reason, input.ActorAdminUser.String()); err != nil {
			return ports.AdminMoneyPayoutReviewRecord{}, err
		}
	}

	record, err := queryAdminMoneyPayoutReview(ctx, tx, input.BusinessID.String())
	if err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	return record, nil
}

func queryAdminMoneyPayoutReview(
	ctx context.Context,
	tx pgx.Tx,
	businessID string,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	var record ports.AdminMoneyPayoutReviewRecord
	var holdUpdatedAt time.Time
	if err := tx.QueryRow(ctx, `
		with money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as succeeded_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				count(*) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				)::int as failed_30d,
				count(*) filter (where status = 'initiated')::int as initiated_count
			from payments
			where business_id = $1
			group by business_id
		)
		select
			b.business_id::text,
			b.name,
			coalesce(b.settlement_provider_subaccount, ''),
			case
				when coalesce(h.is_active, false) then 'blocked'
				when b.operational_status = 'suspended'
					or b.verification_status = 'rejected' then 'blocked'
				when coalesce(b.settlement_provider_subaccount, '') = ''
					or b.verification_status <> 'verified'
					or coalesce(ms.failed_30d, 0) > 0
					or coalesce(ms.initiated_count, 0) > 0 then 'review'
				else 'ready'
			end as status,
			greatest(coalesce(ms.succeeded_minor, 0) - coalesce(ms.commission_minor, 0), 0)::bigint as settlement_minor,
			coalesce(ms.commission_minor, 0)::bigint as commission_minor,
			case
				when coalesce(h.is_active, false) then 'Operator settlement review hold: ' || h.reason
				when b.operational_status = 'suspended' then 'Keep settlement on hold while the business is suspended.'
				when b.verification_status = 'rejected' then 'Do not enable settlement until business verification is restored.'
				when coalesce(b.settlement_provider_subaccount, '') = '' then 'Connect and verify the Paystack subaccount before settlement.'
				when b.verification_status <> 'verified' then 'Wait for business verification before enabling payment settlement.'
				when coalesce(ms.failed_30d, 0) > 0 then 'Review failed payments before account or payout changes.'
				when coalesce(ms.initiated_count, 0) > 0 then 'Watch pending payments until provider confirmation arrives.'
				else 'No action needed; split settlement is healthy.'
			end as next_action,
			coalesce(h.is_active, false) as hold_active,
			coalesce(h.reason, '') as hold_reason,
			coalesce(h.updated_at, b.updated_at) as hold_updated_at
		from businesses b
		left join money_stats ms on ms.business_id = b.business_id
		left join admin_settlement_review_holds h on h.business_id = b.business_id and h.is_active
		where b.business_id = $1
	`, businessID).Scan(
		&record.ID,
		&record.BusinessName,
		&record.SubaccountRef,
		&record.Status,
		&record.SettlementMinor,
		&record.CommissionMinor,
		&record.NextAction,
		&record.HoldActive,
		&record.HoldReason,
		&holdUpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminMoneyPayoutReviewRecord{}, ErrNotFound
		}
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	if record.HoldActive {
		record.HoldUpdatedAt = &holdUpdatedAt
	}

	return record, nil
}
