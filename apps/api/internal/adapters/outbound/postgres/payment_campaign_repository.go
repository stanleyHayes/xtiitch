package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func reconcileAdCampaignPaymentFromProvider(
	ctx context.Context,
	tx pgx.Tx,
	input ports.ConfirmPaymentInput,
) (adCampaignPaymentProviderMatch, bool, error) {
	payment, found, err := lookupAdCampaignPaymentByProviderReference(ctx, tx, input.ProviderReference)
	if err != nil || !found {
		return adCampaignPaymentProviderMatch{}, found, err
	}

	if input.Succeeded {
		if payment.status != "initiated" {
			return payment, true, nil
		}
		return payment, true, markAdCampaignPaymentPaidFromProvider(ctx, tx, payment, input)
	}

	if payment.status != "initiated" {
		return payment, true, nil
	}
	return payment, true, markAdCampaignPaymentFailedFromProvider(ctx, tx, payment, input)
}

func lookupAdCampaignPaymentByProviderReference(
	ctx context.Context,
	tx pgx.Tx,
	providerReference string,
) (adCampaignPaymentProviderMatch, bool, error) {
	var payment adCampaignPaymentProviderMatch
	err := tx.QueryRow(ctx, `
		select
			ap.payment_id::text,
			ap.campaign_id::text,
			ap.advertiser_business_id::text,
			c.headline,
			ap.status,
			ap.amount_minor::bigint
		from ad_campaign_payments ap
		join ad_campaigns c on c.campaign_id = ap.campaign_id
			and c.advertiser_business_id = ap.advertiser_business_id
		where ap.provider = 'paystack'
			and ap.provider_reference = $1
		order by ap.created_at desc
		limit 1
	`, providerReference).Scan(
		&payment.paymentID,
		&payment.campaignID,
		&payment.businessID,
		&payment.headline,
		&payment.status,
		&payment.amountMinor,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return adCampaignPaymentProviderMatch{}, false, nil
	}
	if err != nil {
		return adCampaignPaymentProviderMatch{}, false, err
	}
	return payment, true, nil
}

func markAdCampaignPaymentPaidFromProvider(
	ctx context.Context,
	tx pgx.Tx,
	payment adCampaignPaymentProviderMatch,
	input ports.ConfirmPaymentInput,
) error {
	tag, err := tx.Exec(ctx, `
		with paid_payment as (
			update ad_campaign_payments ap
			set
				status = 'paid',
				paid_at = coalesce(ap.paid_at, now()),
				failed_at = null,
				failure_reason = '',
				updated_at = now()
			where ap.payment_id = $1::uuid
				and ap.advertiser_business_id = $2::uuid
				and ap.status = 'initiated'
			returning ap.*
		),
		updated_campaign as (
			update ad_campaigns c
			set
				spend_to_date_minor = least(c.budget_minor, c.spend_to_date_minor + p.amount_minor),
				updated_at = now()
			from paid_payment p
			where c.campaign_id = p.campaign_id
				and c.advertiser_business_id = p.advertiser_business_id
			returning c.campaign_id
		)
		select 1 from updated_campaign
	`, payment.paymentID, payment.businessID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	_, err = tx.Exec(ctx, `
		insert into admin_audit_events (
			audit_event_id,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata
		)
		values (
			gen_random_uuid(),
			'Paystack confirmed sponsored placement payment',
			'ad_campaign',
			$1::text,
			$2::text,
			'Paystack webhook marked sponsored placement budget paid.',
			'info',
			jsonb_build_object(
				'payment_id', $3::text,
				'business_id', $4::text,
				'provider_reference', $5::text,
				'event_type', $6::text,
				'amount_minor', $7::bigint,
				'source', 'paystack_webhook'
			)
		)
	`, payment.campaignID, payment.headline, payment.paymentID, payment.businessID, input.ProviderReference, input.EventType, payment.amountMinor)
	return err
}

func markAdCampaignPaymentFailedFromProvider(
	ctx context.Context,
	tx pgx.Tx,
	payment adCampaignPaymentProviderMatch,
	input ports.ConfirmPaymentInput,
) error {
	reason := adCampaignPaymentFailureReason(input)
	tag, err := tx.Exec(ctx, `
		update ad_campaign_payments ap
		set
			status = 'failed',
			failed_at = coalesce(ap.failed_at, now()),
			failure_reason = $3,
			updated_at = now()
		where ap.payment_id = $1::uuid
			and ap.advertiser_business_id = $2::uuid
			and ap.status = 'initiated'
	`, payment.paymentID, payment.businessID, reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	_, err = tx.Exec(ctx, `
		insert into admin_audit_events (
			audit_event_id,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata
		)
		values (
			gen_random_uuid(),
			'Paystack rejected sponsored placement payment',
			'ad_campaign',
			$1::text,
			$2::text,
			$3::text,
			'warning',
			jsonb_build_object(
				'payment_id', $4::text,
				'business_id', $5::text,
				'provider_reference', $6::text,
				'event_type', $7::text,
				'amount_minor', $8::bigint,
				'source', 'paystack_webhook',
				'reason', $3::text
			)
		)
	`, payment.campaignID, payment.headline, reason, payment.paymentID, payment.businessID, input.ProviderReference, input.EventType, payment.amountMinor)
	return err
}

func adCampaignPaymentFailureReason(input ports.ConfirmPaymentInput) string {
	if input.EventType == "" {
		return "Paystack webhook reported sponsored placement payment failure."
	}
	return "Paystack webhook reported " + input.EventType + "."
}
