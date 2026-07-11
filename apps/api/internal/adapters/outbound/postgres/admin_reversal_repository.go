package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) ReverseAdminMoneyPayment(
	ctx context.Context,
	input ports.ReverseAdminMoneyPaymentInput,
) (ports.AdminMoneyReversalRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}

	var record ports.AdminMoneyReversalRecord
	var paymentStatus string
	var orderID pgtype.Text
	var paymentSettleMinor int64
	if err := tx.QueryRow(ctx, `
		select
			p.payment_id::text,
			p.provider_reference,
			p.business_id::text,
			coalesce(b.name, ''),
			p.order_id::text,
			p.status,
			coalesce(p.settle_amount_minor, p.amount_minor),
			now()
		from payments p
		join businesses b on b.business_id = p.business_id
		where p.provider_reference = $1
		for update of p
	`, input.ProviderReference).Scan(
		&record.PaymentID,
		&record.ProviderReference,
		&record.BusinessID,
		&record.BusinessName,
		&orderID,
		&paymentStatus,
		&paymentSettleMinor,
		&record.ReversedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminMoneyReversalRecord{}, ErrNotFound
		}
		return ports.AdminMoneyReversalRecord{}, err
	}
	record.OrderID = commonIDPtr(orderID)
	record.Reason = input.Reason

	if paymentStatus != "succeeded" && paymentStatus != "reversed" {
		return ports.AdminMoneyReversalRecord{}, authdomain.ErrInvalidInput
	}

	if paymentStatus == "succeeded" {
		tag, err := tx.Exec(ctx, `
			update payments
			set status = 'reversed',
				updated_at = now()
			where payment_id = $1::uuid
				and status = 'succeeded'
		`, record.PaymentID.String())
		if err != nil {
			return ports.AdminMoneyReversalRecord{}, err
		}
		record.PaymentReversed = tag.RowsAffected() > 0
	}

	if record.PaymentReversed && record.OrderID != nil {
		if err := tx.QueryRow(ctx, `
			with voided_redemptions as (
				update promotion_redemptions
				set status = 'void',
					updated_at = now()
				where business_id = $1::uuid
					and order_id = $2::uuid
					and status in ('pending', 'applied')
				returning 1
			),
			reversed_affiliates as (
				update affiliate_conversions
				set status = 'reversed',
					reversed_at = coalesce(reversed_at, now()),
					reversal_reason = $3,
					metadata = metadata || jsonb_build_object(
						'source', 'admin_payment_reversal',
						'reversed_by_admin_user_id', $4::text,
						'reversed_provider_reference', $5::text,
						'reversal_reason', $3::text,
						'reversed_at', now()
					),
					updated_at = now()
				where business_id = $1::uuid
					and order_id = $2::uuid
					and status <> 'reversed'
				returning 1
			),
			voided_referrals as (
				update referrals
				set status = 'void',
					updated_at = now(),
					metadata = metadata || jsonb_build_object(
						'source', 'admin_payment_reversal',
						'reversed_by_admin_user_id', $4::text,
						'reversed_provider_reference', $5::text,
						'reversal_reason', $3::text,
						'reversed_at', now()
					)
				where business_id = $1::uuid
					and order_id = $2::uuid
					and status in ('pending', 'qualified', 'rewarded')
				returning referral_id
			),
			voided_rewards as (
				update referral_rewards rr
				set status = 'void',
					updated_at = now(),
					metadata = metadata || jsonb_build_object(
						'source', 'admin_payment_reversal',
						'reversed_by_admin_user_id', $4::text,
						'reversed_provider_reference', $5::text,
						'reversal_reason', $3::text,
						'reversed_at', now()
					)
				from voided_referrals vf
				where rr.referral_id = vf.referral_id
					and rr.status <> 'void'
				returning rr.promotion_id
			),
			archived_generated_promotions as (
				update promotions p
				set status = 'archived',
					updated_by_admin_user_id = $4::uuid,
					updated_at = now()
				where p.promotion_id in (
						select promotion_id
						from voided_rewards
						where promotion_id is not null
					)
					and p.status <> 'archived'
				returning 1
			),
			-- Reflect the reversal on the ORDER so the ledger and the order's
			-- settlement agree: back the reversed payment's settled portion out of
			-- settled_minor (floored at 0). Order status/fulfilment is left for the
			-- operator to decide (goods may already be in production); a Paystack
			-- refund/clawback remains a manual step outside this bookkeeping action.
			reversed_order as (
				update orders
				set settled_minor = greatest(0, settled_minor - $6::bigint),
					updated_at = now()
				where business_id = $1::uuid and order_id = $2::uuid
				returning 1
			)
			select
				(select count(*)::int from voided_redemptions),
				(select count(*)::int from reversed_affiliates),
				(select count(*)::int from voided_referrals),
				(select count(*)::int from voided_rewards),
				(select count(*)::int from archived_generated_promotions),
				(select count(*)::int from reversed_order)
		`, record.BusinessID.String(),
			record.OrderID.String(),
			record.Reason,
			input.ActorAdminUser.String(),
			record.ProviderReference,
			paymentSettleMinor,
		).Scan(
			&record.PromotionRedemptionCount,
			&record.AffiliateConversionCount,
			&record.ReferralCount,
			&record.ReferralRewardCount,
			&record.GeneratedPromotionCount,
			new(int),
		); err != nil {
			return ports.AdminMoneyReversalRecord{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}

	return record, nil
}
