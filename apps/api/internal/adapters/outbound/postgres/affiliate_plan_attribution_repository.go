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
				a.first_paid_plan_commission_bps,
				p.hold_days
			from affiliate_signups s
			join affiliates a on a.affiliate_id = s.affiliate_id
			join affiliate_programmes p
				on p.affiliate_programme_id = a.affiliate_programme_id
			join affiliate_clicks c
				on c.affiliate_click_id = s.affiliate_click_id
			where s.subject_type = 'business'
				and s.business_id = $2::uuid
				and s.status = 'qualified'
				and a.status = 'active'
				and a.owner_business_id is null
				and a.target_scope = 'platform'
				and a.first_paid_plan_commission_bps > 0
				and p.owner_type = 'platform'
				and p.status = 'active'
				and c.clicked_at >=
					now() - make_interval(days => a.cookie_window_days)
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
				affiliate_programme_id, $2::uuid, $3::uuid, $4, $5,
				least($5, ($5 * first_paid_plan_commission_bps) / 10000),
				first_paid_plan_commission_bps, hold_days,
				jsonb_build_object('source', 'subscription_checkout')
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
				business_id, 'paid_plan_signup', subscription_id,
				payment_reference, gross_minor, commission_minor,
				'percentage', commission_rate, 'last_click', 'pending',
				now() + make_interval(days => hold_days),
				metadata || jsonb_build_object(
					'reservation_id', reservation_id::text,
					'source', 'verified_subscription_payment'
				)
			from reservation
			on conflict (subscription_id)
				where conversion_type = 'paid_plan_signup'
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
			where existing.subscription_id = $3::uuid
				and existing.conversion_type = 'paid_plan_signup'
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
		_, err = tx.Exec(ctx, `
			update affiliate_conversions
			set status = 'reversed',
				reversed_at = coalesce(reversed_at, now()),
				reversal_reason = $2,
				metadata = metadata || jsonb_build_object(
					'provider_reversal_event', $2
				),
				updated_at = now()
			where conversion_type = 'paid_plan_signup'
				and payment_reference = $1
				and status <> 'reversed'
		`, reference, reason)
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
