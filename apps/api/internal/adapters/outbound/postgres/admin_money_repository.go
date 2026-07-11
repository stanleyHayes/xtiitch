package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) GetAdminMoneyRails(ctx context.Context) (ports.AdminMoneyRailsRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}

	webhookRows, err := tx.Query(ctx, `
		with event_attempts as (
			select
				provider_reference,
				count(*)::int as attempts,
				max(processed_at) as received_at,
				max(event_type) as event_type
			from payment_provider_events
			group by provider_reference
		)
		select
			coalesce(p.payment_id::text, 'provider-' || md5(e.provider_reference)) as id,
			e.provider_reference,
			coalesce(b.name, 'Unmatched provider event') as business_name,
			case
				when r.created_at is not null then 'replayed'
				when p.status = 'reversed' then 'reversed'
				when p.status = 'succeeded' and e.attempts > 1 then 'replayed'
				when p.status = 'succeeded' then 'verified'
				else 'failed'
			end as status,
			coalesce(p.purpose, e.event_type, 'unknown') as purpose,
			coalesce(p.amount_minor, 0)::bigint as amount_minor,
			e.attempts,
			e.received_at,
			case
				when r.created_at is not null then 'Operator replay request queued: ' || r.reason
				when p.payment_id is null then 'Provider event did not map to a payment record.'
				when p.status = 'reversed' then 'Payment was reversed after refund or dispute review.'
				when p.status = 'succeeded' and e.attempts > 1 then 'Multiple provider deliveries reconciled safely against the payment ledger.'
				when p.status = 'succeeded' then 'Signature verified and payment marked succeeded.'
				when p.status = 'failed' then 'Signature verified and payment marked failed.'
				else 'Provider event is recorded; payment remains under review.'
			end as note
		from event_attempts e
		left join payments p on p.provider_reference = e.provider_reference
		left join businesses b on b.business_id = p.business_id
		left join lateral (
			select reason, created_at
			from admin_money_replay_requests r
			where r.provider_reference = e.provider_reference
				and r.status = 'queued'
			order by r.created_at desc
			limit 1
		) r on true
		order by e.received_at desc
		limit 50
	`)
	if err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	defer webhookRows.Close()

	record := ports.AdminMoneyRailsRecord{
		WebhookEvents: []ports.AdminMoneyWebhookEventRecord{},
		PayoutReviews: []ports.AdminMoneyPayoutReviewRecord{},
		UpdatedAt:     time.Now().UTC(),
	}
	for webhookRows.Next() {
		var event ports.AdminMoneyWebhookEventRecord
		if err := webhookRows.Scan(
			&event.ID,
			&event.ProviderReference,
			&event.BusinessName,
			&event.Status,
			&event.Purpose,
			&event.AmountMinor,
			&event.Attempts,
			&event.ReceivedAt,
			&event.Note,
		); err != nil {
			return ports.AdminMoneyRailsRecord{}, err
		}
		record.WebhookEvents = append(record.WebhookEvents, event)
	}
	if err := webhookRows.Err(); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	webhookRows.Close()

	payoutRows, err := tx.Query(ctx, `
		with money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as succeeded_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				count(*) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				)::int as failed_30d,
				count(*) filter (where status = 'initiated')::int as initiated_count,
				max(updated_at) as last_payment_at
			from payments
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
		where
			coalesce(b.settlement_provider_subaccount, '') <> ''
			or b.verification_status = 'verified'
			or b.operational_status = 'suspended'
			or coalesce(h.is_active, false)
			or coalesce(ms.succeeded_minor, 0) > 0
			or coalesce(ms.failed_30d, 0) > 0
			or coalesce(ms.initiated_count, 0) > 0
		order by
			case
				when coalesce(h.is_active, false) then 1
				when b.operational_status = 'suspended'
					or b.verification_status = 'rejected' then 1
				when coalesce(b.settlement_provider_subaccount, '') = ''
					or b.verification_status <> 'verified'
					or coalesce(ms.failed_30d, 0) > 0
					or coalesce(ms.initiated_count, 0) > 0 then 2
				else 3
			end,
			coalesce(ms.last_payment_at, b.updated_at) desc,
			b.created_at desc
		limit 100
	`)
	if err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	defer payoutRows.Close()

	for payoutRows.Next() {
		var review ports.AdminMoneyPayoutReviewRecord
		var holdUpdatedAt time.Time
		if err := payoutRows.Scan(
			&review.ID,
			&review.BusinessName,
			&review.SubaccountRef,
			&review.Status,
			&review.SettlementMinor,
			&review.CommissionMinor,
			&review.NextAction,
			&review.HoldActive,
			&review.HoldReason,
			&holdUpdatedAt,
		); err != nil {
			return ports.AdminMoneyRailsRecord{}, err
		}
		if review.HoldActive {
			review.HoldUpdatedAt = &holdUpdatedAt
		}
		record.PayoutReviews = append(record.PayoutReviews, review)
	}
	if err := payoutRows.Err(); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) QueueAdminMoneyReplay(
	ctx context.Context,
	input ports.QueueAdminMoneyReplayInput,
) (ports.AdminMoneyReplayRequestRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	var paymentID string
	var businessName string
	if err := tx.QueryRow(ctx, `
		with candidate as (
			select $1::text as provider_reference
			where exists (
				select 1 from payments where provider_reference = $1
			)
			or exists (
				select 1 from payment_provider_events where provider_reference = $1
			)
		)
		select
			coalesce(p.payment_id::text, ''),
			coalesce(b.name, 'Unmatched provider event')
		from candidate c
		left join payments p on p.provider_reference = c.provider_reference
		left join businesses b on b.business_id = p.business_id
		limit 1
	`, input.ProviderReference).Scan(&paymentID, &businessName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminMoneyReplayRequestRecord{}, ErrNotFound
		}
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	var record ports.AdminMoneyReplayRequestRecord
	if err := tx.QueryRow(ctx, `
		insert into admin_money_replay_requests (
			replay_request_id,
			provider_reference,
			payment_id,
			requested_by_admin_user_id,
			reason,
			status
		)
		values ($1, $2, nullif($3, '')::uuid, $4, $5, 'queued')
		returning
			replay_request_id::text,
			provider_reference,
			coalesce(payment_id::text, ''),
			$6::text,
			reason,
			status,
			created_at
	`, input.ReplayRequestID.String(),
		input.ProviderReference,
		paymentID,
		input.RequestedByUserID.String(),
		input.Reason,
		businessName,
	).Scan(
		&record.ReplayRequestID,
		&record.ProviderReference,
		&record.PaymentID,
		&record.BusinessName,
		&record.Reason,
		&record.Status,
		&record.CreatedAt,
	); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	return record, nil
}
