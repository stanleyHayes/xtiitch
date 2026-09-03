package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

//nolint:funlen // long by construction: one large SQL statement plus its row scan. Splitting it would hide the query from its mapping, not simplify it.
func (repo AffiliateRepository) ReserveFirstPaidPlanAttribution(
	ctx context.Context,
	input ports.ReserveFirstPaidPlanAttributionInput,
) (ports.AffiliatePlanAttributionReservation, error) {
	if input.ReservationID.IsZero() || input.BusinessID.IsZero() ||
		input.SubscriptionID.IsZero() || input.GrossMinor <= 0 ||
		strings.TrimSpace(input.PaymentReference) == "" {
		return ports.AffiliatePlanAttributionReservation{}, ports.ErrNotFound
	}
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliatePlanAttributionReservation{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliatePlanAttributionReservation{}, err
	}

	var record ports.AffiliatePlanAttributionReservation
	var clickID pgtype.Text
	err = tx.QueryRow(ctx, `
		with eligible as (
			select
				a.affiliate_id,
				s.affiliate_click_id,
				a.affiliate_programme_id,
				settings.commission_bps,
				settings.maturity_days as hold_days
			from affiliate_signups s
			join affiliates a on a.affiliate_id = s.affiliate_id
			join affiliate_programmes p
				on p.affiliate_programme_id = a.affiliate_programme_id
			cross join partner_programme_settings settings
			where s.subject_type = 'business'
				and s.business_id = $2::uuid
				and s.status = 'qualified'
				and a.status = 'active'
				and a.owner_business_id is null
				and a.target_scope = 'platform'
				and settings.commission_bps > 0
				and p.owner_type = 'platform'
				and p.status = 'active'
				and now() >= settings.recurring_effective_at
			order by s.qualified_at desc
			limit 1
		),
		inserted as (
			insert into affiliate_plan_attribution_reservations (
				reservation_id, affiliate_id, affiliate_click_id,
				affiliate_programme_id, business_id, subscription_id,
				payment_reference, gross_minor, commission_minor,
				commission_rate, hold_days, metadata
			)
			select
				$1::uuid, affiliate_id, affiliate_click_id,
				affiliate_programme_id, $2::uuid, $3::uuid, $4, $5::bigint,
				least(
					$5::bigint,
					($5::bigint * commission_bps::bigint) / 10000
				),
				commission_bps, hold_days,
				jsonb_build_object('source', 'subscription_payment')
			from eligible
			on conflict (payment_reference) do nothing
			returning *
		),
		selected as (
			select * from inserted
			union all
			select existing.*
			from affiliate_plan_attribution_reservations existing
			where existing.payment_reference = $4
				and existing.business_id = $2::uuid
			limit 1
		)
		select
			reservation_id::text, affiliate_id::text,
			affiliate_click_id::text, affiliate_programme_id::text,
			business_id::text, subscription_id::text, payment_reference,
			gross_minor, commission_minor, commission_rate::int, hold_days::int
		from selected
	`, input.ReservationID.String(), input.BusinessID.String(),
		input.SubscriptionID.String(), strings.TrimSpace(input.PaymentReference),
		input.GrossMinor).Scan(
		&record.ReservationID, &record.AffiliateID, &clickID,
		&record.ProgrammeID, &record.BusinessID, &record.SubscriptionID,
		&record.PaymentReference, &record.GrossMinor, &record.CommissionMinor,
		&record.CommissionRate, &record.HoldDays,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliatePlanAttributionReservation{}, ports.ErrNotFound
		}
		return ports.AffiliatePlanAttributionReservation{}, err
	}
	if clickID.Valid {
		value := common.ID(clickID.String)
		record.AffiliateClickID = &value
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliatePlanAttributionReservation{}, err
	}
	return record, nil
}

//nolint:funlen // long by construction: one large SQL statement plus its row scan. Splitting it would hide the query from its mapping, not simplify it.
func (repo AffiliateRepository) FinalizeFirstPaidPlanAttribution(
	ctx context.Context,
	input ports.FinalizeFirstPaidPlanAttributionInput,
) (ports.AffiliatePlanConversionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliatePlanConversionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliatePlanConversionRecord{}, err
	}
	var record ports.AffiliatePlanConversionRecord
	err = tx.QueryRow(ctx, `
		with reservation as (
			update affiliate_plan_attribution_reservations
			set status = 'converted', converted_at = coalesce(converted_at, now()),
				updated_at = now()
			where business_id = $2::uuid
				and subscription_id = $3::uuid
				and payment_reference = $4
				and status in ('pending', 'converted')
			returning *
		),
		inserted as (
			insert into affiliate_conversions (
				affiliate_conversion_id, affiliate_id, affiliate_click_id,
				affiliate_programme_id, programme_owner_type, funding_source,
				business_id, conversion_type, subscription_id,
				payment_reference, gross_minor, commission_minor,
				commission_model, commission_rate, attribution_model,
				status, hold_until, metadata
			)
			select
				$1::uuid, affiliate_id, affiliate_click_id,
				affiliate_programme_id, 'platform', 'platform',
				business_id, 'subscription_payment', subscription_id,
				payment_reference, gross_minor, commission_minor,
				'percentage', commission_rate, 'last_click', 'pending',
				now() + make_interval(days => hold_days),
				metadata || jsonb_build_object(
					'reservation_id', reservation_id::text,
					'source', 'verified_subscription_payment'
				)
			from reservation
			on conflict (payment_reference)
				where conversion_type = 'subscription_payment'
				do nothing
			returning *, true as created
		),
		selected as (
			select
				affiliate_conversion_id, affiliate_id,
				affiliate_programme_id, business_id, subscription_id,
				payment_reference, gross_minor, commission_minor,
				status, created
			from inserted
			union all
			select
				existing.affiliate_conversion_id, existing.affiliate_id,
				existing.affiliate_programme_id, existing.business_id,
				existing.subscription_id, existing.payment_reference,
				existing.gross_minor, existing.commission_minor,
				existing.status, false
			from affiliate_conversions existing
			where existing.payment_reference = $4
				and existing.conversion_type = 'subscription_payment'
			limit 1
		),
		voided as (
			update affiliate_plan_attribution_reservations
			set status = 'void', voided_at = now(), updated_at = now(),
				metadata = metadata || jsonb_build_object(
					'void_reason', 'another_payment_attempt_converted'
				)
			where subscription_id = $3::uuid
				and status = 'pending'
				and payment_reference <> $4
			returning reservation_id
		)
		select
			affiliate_conversion_id::text, affiliate_id::text,
			affiliate_programme_id::text, business_id::text,
			subscription_id::text, payment_reference, gross_minor,
			commission_minor, status, created
		from selected
	`, input.ConversionID.String(), input.BusinessID.String(),
		input.SubscriptionID.String(), strings.TrimSpace(input.PaymentReference)).Scan(
		&record.ConversionID, &record.AffiliateID, &record.ProgrammeID,
		&record.BusinessID, &record.SubscriptionID, &record.PaymentReference,
		&record.GrossMinor, &record.CommissionMinor, &record.Status,
		&record.Created,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliatePlanConversionRecord{}, ports.ErrNotFound
		}
		return ports.AffiliatePlanConversionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliatePlanConversionRecord{}, err
	}
	return record, nil
}

func (repo AffiliateRepository) VoidFirstPaidPlanAttribution(
	ctx context.Context,
	businessID common.ID,
	paymentReference string,
	reason string,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		update affiliate_plan_attribution_reservations
		set status = 'void', voided_at = now(), updated_at = now(),
			metadata = metadata || jsonb_build_object('void_reason', $3)
		where business_id = $1::uuid
			and payment_reference = $2
			and status = 'pending'
	`, businessID.String(), strings.TrimSpace(paymentReference),
		strings.TrimSpace(reason))
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

//nolint:gocognit,gocyclo,funlen // branch-per-field normalisation; flattening it into helpers would scatter one validation rule across several functions.
func (repo AffiliateRepository) ApplyFirstPaidPlanProviderEvent(
	ctx context.Context,
	input ports.ApplyFirstPaidPlanProviderEventInput,
) error {
	reference := strings.TrimSpace(input.PaymentReference)
	if reference == "" {
		return nil
	}
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if input.Succeeded {
		var businessID, subscriptionID common.ID
		err := tx.QueryRow(ctx, `
			select business_id::text, subscription_id::text
			from affiliate_plan_attribution_reservations
			where payment_reference = $1
		`, reference).Scan(&businessID, &subscriptionID)
		if errors.Is(err, pgx.ErrNoRows) {
			return tx.Commit(ctx)
		}
		if err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		_, err = repo.FinalizeFirstPaidPlanAttribution(
			ctx,
			ports.FinalizeFirstPaidPlanAttributionInput{
				ConversionID:     input.ConversionID,
				BusinessID:       businessID,
				SubscriptionID:   subscriptionID,
				PaymentReference: reference,
			},
		)
		if errors.Is(err, ports.ErrNotFound) {
			return nil
		}
		return err
	}

	reason := strings.ToLower(strings.TrimSpace(input.EventType))
	reversal := strings.Contains(reason, "revers") ||
		strings.Contains(reason, "refund") ||
		strings.Contains(reason, "chargeback") ||
		strings.Contains(reason, "dispute")
	if reversal {
		eventSignature := strings.TrimSpace(input.EventSignature)
		if eventSignature == "" {
			eventSignature = "affiliate-adjustment:" + reason + ":" + reference
		}
		_, err = tx.Exec(ctx, `
			with source as (
				select conversion.*,
					coalesce((select sum(-adjustment.gross_minor)
						from affiliate_conversions adjustment
						where adjustment.source_conversion_id=conversion.affiliate_conversion_id
						  and adjustment.conversion_type='adjustment'
						  and adjustment.status <> 'reversed'),0)::bigint as refunded_minor,
					coalesce((select sum(-adjustment.commission_minor)
						from affiliate_conversions adjustment
						where adjustment.source_conversion_id=conversion.affiliate_conversion_id
						  and adjustment.conversion_type='adjustment'
						  and adjustment.status <> 'reversed'),0)::bigint as debited_minor
				from affiliate_conversions conversion
				where conversion.conversion_type='subscription_payment'
				  and conversion.payment_reference=$1
				  and conversion.status <> 'reversed'
				for update of conversion
			), amounts as (
				select source.*,
					least(greatest(case when $3::bigint > 0 then $3::bigint else gross_minor end,0),
						greatest(gross_minor-refunded_minor,0))::bigint as refund_minor
				from source
			), calculated as (
				select amounts.*,
					least(greatest(commission_minor-debited_minor,0),
						case when refund_minor = greatest(gross_minor-refunded_minor,0)
							then greatest(commission_minor-debited_minor,0)
							else greatest(1,(commission_minor*refund_minor)/gross_minor)
						end)::bigint as debit_minor
				from amounts
			), reversed_source as (
				update affiliate_conversions conversion
				set status='reversed', reversed_at=coalesce(conversion.reversed_at,now()),
					reversal_reason=$2,
					metadata=conversion.metadata || jsonb_build_object(
						'provider_reversal_event',$2::text,
						'provider_reversal_signature',$4::text,
						'refunded_minor',calculated.refund_minor
					), updated_at=now()
				from calculated
				where conversion.affiliate_conversion_id=calculated.affiliate_conversion_id
				  and calculated.status in ('pending','approved')
				  and calculated.refunded_minor=0
				  and calculated.refund_minor >= calculated.gross_minor
				returning conversion.affiliate_conversion_id
			)
			insert into affiliate_conversions(
				affiliate_conversion_id,affiliate_id,affiliate_programme_id,
				programme_owner_type,funding_source,business_id,conversion_type,
				gross_minor,commission_minor,commission_model,commission_rate,
				attribution_model,status,hold_until,approved_at,source_conversion_id,
				adjustment_event_signature,reversal_reason,metadata
			)
			select $5::uuid,affiliate_id,affiliate_programme_id,
				programme_owner_type,funding_source,business_id,'adjustment',
				-refund_minor,-debit_minor,commission_model,commission_rate,
				attribution_model,case when status='pending' then 'pending' else 'approved' end,
				hold_until,case when status='pending' then null else now() end,
				affiliate_conversion_id,$4,$2,
				jsonb_build_object('source','provider_refund_adjustment',
					'event_type',$2::text,'refund_minor',refund_minor,
					'source_payment_reference',$1::text)
			from calculated
			where refund_minor > 0 and debit_minor > 0
			  and not exists(select 1 from reversed_source)
			on conflict (adjustment_event_signature)
				where conversion_type='adjustment' do nothing
		`, reference, reason, input.AmountMinor, eventSignature, input.ConversionID.String())
	} else {
		_, err = tx.Exec(ctx, `
			update affiliate_plan_attribution_reservations
			set status = 'void', voided_at = coalesce(voided_at, now()),
				metadata = metadata || jsonb_build_object(
					'void_reason', $2
				),
				updated_at = now()
			where payment_reference = $1
				and status = 'pending'
		`, reference, reason)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
