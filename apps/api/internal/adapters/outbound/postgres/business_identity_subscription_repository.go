package postgres

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ListActivePlans returns the public-safe plan catalogue for the signup picker.
func (repo BusinessIdentityRepository) ListActivePlans(ctx context.Context) ([]ports.PublicPlanRecord, error) {
	rows, err := repo.pool.Query(ctx, `
		select code, name, monthly_fee_minor, yearly_fee_minor, commission_bps, design_limit,
			quarterly_first_minor, quarterly_renewal_minor, yearly_first_minor, yearly_renewal_minor
		from plans
		where is_active = true
		-- Order by real tier price, cheapest first (free, starter, growth, studio).
		-- NOT monthly_fee_minor: monthly billing isn't sold and that field is a
		-- nominal placeholder (starter & growth both GHS 1), which tied and flipped
		-- their order. yearly_first_minor is distinct and correctly tier-ordered.
		order by yearly_first_minor asc, monthly_fee_minor asc, code asc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := make([]ports.PublicPlanRecord, 0)
	for rows.Next() {
		var plan ports.PublicPlanRecord
		if err := rows.Scan(
			&plan.Code,
			&plan.Name,
			&plan.MonthlyFeeMinor,
			&plan.YearlyFeeMinor,
			&plan.CommissionBps,
			&plan.DesignLimit,
			&plan.QuarterlyFirstMinor,
			&plan.QuarterlyRenewalMinor,
			&plan.YearlyFirstMinor,
			&plan.YearlyRenewalMinor,
		); err != nil {
			return nil, err
		}
		plans = append(plans, plan)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return plans, nil
}

// GetPlanByCode resolves an active plan's identity + pricing by its code, for
// classifying and prorating a self-serve plan change. plans is a global, non-tenant
// table (no RLS), so a plain query applies. ErrNotFound when no active plan matches.
func (repo BusinessIdentityRepository) GetPlanByCode(ctx context.Context, code string) (ports.PlanPricingRecord, error) {
	var record ports.PlanPricingRecord
	if err := repo.pool.QueryRow(ctx, `
		select plan_id::text, code, monthly_fee_minor, quarterly_renewal_minor, yearly_renewal_minor
		from plans
		where code = $1 and is_active = true
	`, code).Scan(
		&record.PlanID,
		&record.Code,
		&record.MonthlyFeeMinor,
		&record.QuarterlyRenewalMinor,
		&record.YearlyRenewalMinor,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.PlanPricingRecord{}, ErrNotFound
		}
		return ports.PlanPricingRecord{}, err
	}
	return record, nil
}

// GetBusinessSubscription returns the tenant's subscription joined with its plan
// and owner email, powering the self-serve billing flow.
func (repo BusinessIdentityRepository) GetBusinessSubscription(
	ctx context.Context,
	businessID common.ID,
) (ports.BusinessSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// business_subscriptions is tenant-isolated (forced RLS), so the read must run
	// under the business's scope or the row is invisible.
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID.String()); err != nil {
		return ports.BusinessSubscriptionRecord{}, err
	}

	var record ports.BusinessSubscriptionRecord
	err = tx.QueryRow(ctx, `
		select
			s.subscription_id::text,
			s.business_id::text,
			b.name,
			coalesce((
				select email from business_users
				where business_id = b.business_id and role = 'owner' and is_active = true
				order by created_at asc
				limit 1
			), ''),
			p.code,
			p.monthly_fee_minor,
			s.status,
			s.billing_mode,
			s.provider_customer_ref,
			s.provider_subscription_ref,
			s.billing_cadence,
			s.first_purchase_consumed,
			p.quarterly_first_minor,
			p.quarterly_renewal_minor,
			p.yearly_first_minor,
			p.yearly_renewal_minor,
			s.current_period_start,
			s.current_period_end
		from business_subscriptions s
		join businesses b on b.business_id = s.business_id
		join plans p on p.plan_id = s.plan_id
		where s.business_id = $1
	`, businessID.String()).Scan(
		&record.SubscriptionID,
		&record.BusinessID,
		&record.BusinessName,
		&record.OwnerEmail,
		&record.PlanCode,
		&record.MonthlyFeeMinor,
		&record.Status,
		&record.BillingMode,
		&record.ProviderCustomerRef,
		&record.ProviderSubscriptionRef,
		&record.BillingCadence,
		&record.FirstPurchaseConsumed,
		&record.QuarterlyFirstMinor,
		&record.QuarterlyRenewalMinor,
		&record.YearlyFirstMinor,
		&record.YearlyRenewalMinor,
		&record.CurrentPeriodStart,
		&record.CurrentPeriodEnd,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessSubscriptionRecord{}, ErrNotFound
		}
		return ports.BusinessSubscriptionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessSubscriptionRecord{}, err
	}
	return record, nil
}

// ActivateRecurringBilling stores the verified Paystack customer + authorization
// codes and flips the subscription to recurring Paystack billing.
func (repo BusinessIdentityRepository) ActivateRecurringBilling(ctx context.Context, input ports.ActivateRecurringBillingInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// business_subscriptions is tenant-isolated (forced RLS); scope to the business
	// so the update actually matches its row.
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update business_subscriptions
		set billing_mode = 'recurring',
			provider = 'paystack',
			provider_customer_ref = $2,
			provider_subscription_ref = $3,
			provider_channel = $4,
			updated_at = now()
		where business_id = $1
	`, input.BusinessID.String(), input.ProviderCustomerRef, input.ProviderSubscriptionRef, input.ProviderChannel); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SetSubscriptionBillingCadence records the tenant's chosen billing cadence on
// their subscription when the authorization link is created, so the later verify
// step (driven by the Paystack callback, which carries only the payment
// reference) can read it back. It does not consume the first purchase or charge.
func (repo BusinessIdentityRepository) SetSubscriptionBillingCadence(ctx context.Context, businessID common.ID, cadence string) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// business_subscriptions is tenant-isolated (forced RLS); scope to the business
	// so the update matches its row. The CHECK on billing_cadence rejects anything
	// other than 'monthly'/'quarterly'/'yearly' at the database level.
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update business_subscriptions
		set billing_cadence = $2,
			updated_at = now()
		where business_id = $1
	`, businessID.String(), cadence); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RecordSubscriptionActivationPayment books the first recurring charge a tenant
// just paid at authorization time: it writes a paid invoice for the current
// period and flips the subscription to active with the next billing date set to
// the period end. It is tenant-scoped and idempotent against the charge webhook —
// the invoice is created already 'paid', and the webhook only advances
// 'issued'/'failed' invoices, so a redelivered charge.success is a no-op.
func (repo BusinessIdentityRepository) RecordSubscriptionActivationPayment(
	ctx context.Context,
	input ports.RecordSubscriptionActivationPaymentInput,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	var subscriptionID, planID string
	var periodStart, periodEnd time.Time
	if err := tx.QueryRow(ctx, `
		select subscription_id::text, plan_id::text, current_period_start, current_period_end
		from business_subscriptions where business_id = $1
	`, input.BusinessID.String()).Scan(&subscriptionID, &planID, &periodStart, &periodEnd); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	// Advance the paid period by the chosen cadence: quarterly = 3 months,
	// yearly = 12 months. This path is only reached with a cadence the service
	// already validated; for any other value keep the stored period end so we
	// never silently shorten a paid period (the DB CHECK is the final backstop).
	switch input.BillingCadence {
	case "quarterly":
		periodEnd = periodStart.AddDate(0, 3, 0)
	case "yearly":
		periodEnd = periodStart.AddDate(0, 12, 0)
	}

	// Idempotent on the charge ref: the activation ref is deterministic per period
	// (see PrepareSubscriptionActivationCharge), so a repeated verify re-uses it and
	// this insert no-ops rather than booking a second paid invoice. Gate the
	// subscription update on a fresh insert so a replay never re-bumps last_payment_at.
	tag, err := tx.Exec(ctx, `
		insert into business_subscription_invoices (
			invoice_id, subscription_id, business_id, plan_id,
			invoice_ref, provider_invoice_ref, status, billing_mode, provider,
			amount_minor, currency, period_start, period_end, due_at, paid_at
		)
		values (
			gen_random_uuid(), $1, $2, $3,
			$4, $4, 'paid', 'recurring', 'paystack',
			$5, $6, $7, $8, now(), now()
		)
		on conflict (invoice_ref) do nothing
	`, subscriptionID, input.BusinessID.String(), planID,
		input.ChargeRef, input.AmountMinor, input.Currency, periodStart, periodEnd)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		// Already recorded for this period — nothing more to do.
		return tx.Commit(ctx)
	}

	// Flip to active and record the first purchase: consume the one-time intro
	// (so cancel+resubscribe bills the full renewal figure next time), store the
	// chosen cadence, and advance the period + next_billing_at by that cadence.
	if _, err := tx.Exec(ctx, `
		update business_subscriptions
		set status = 'active',
			failed_payment_count = 0,
			grace_ends_at = null,
			cancel_at_period_end = false,
			billing_cadence = $4,
			first_purchase_consumed = true,
			last_invoice_ref = $2,
			last_payment_at = now(),
			current_period_end = $3,
			next_billing_at = $3,
			updated_at = now()
		where business_id = $1
	`, input.BusinessID.String(), input.ChargeRef, periodEnd, input.BillingCadence); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// PrepareSubscriptionActivationCharge returns the deterministic charge reference
// for the subscription's current period and whether a first charge is still due
// (no paid invoice already recorded for that period). Keying the ref on the
// subscription + cadence + period makes the first-period charge idempotent
// against retries and the verify-callback being hit twice: a repeated verify at
// the same cadence reuses the same ref, so Paystack dedupes the charge and the
// paid-invoice insert no-ops.
func (repo BusinessIdentityRepository) PrepareSubscriptionActivationCharge(
	ctx context.Context,
	businessID common.ID,
) (ports.SubscriptionActivationCharge, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.SubscriptionActivationCharge{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID.String()); err != nil {
		return ports.SubscriptionActivationCharge{}, err
	}

	var subscriptionID, billingCadence string
	var periodStart time.Time
	if err := tx.QueryRow(ctx, `
		select subscription_id::text, current_period_start, billing_cadence
		from business_subscriptions where business_id = $1
	`, businessID.String()).Scan(&subscriptionID, &periodStart, &billingCadence); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.SubscriptionActivationCharge{}, ErrNotFound
		}
		return ports.SubscriptionActivationCharge{}, err
	}

	ref := "xtsub_act_" + subscriptionID + "_" + billingCadence + "_" + strconv.FormatInt(periodStart.Unix(), 10)

	var alreadyPaid bool
	if err := tx.QueryRow(ctx, `
		select exists(
			select 1 from business_subscription_invoices
			where invoice_ref = $1 and status = 'paid'
		)
	`, ref).Scan(&alreadyPaid); err != nil {
		return ports.SubscriptionActivationCharge{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.SubscriptionActivationCharge{}, err
	}
	return ports.SubscriptionActivationCharge{Ref: ref, ShouldCharge: !alreadyPaid}, nil
}

// ApplyImmediatePlanUpgrade switches the tenant to a higher plan at once and, when
// a prorated difference is due, books it as a paid invoice. Everything runs in one
// tenant-scoped transaction so the switch and the invoice commit together.
//
// Idempotency mirrors the activation charge: the invoice insert is ON CONFLICT
// (invoice_ref) DO NOTHING keyed on the deterministic upgrade ref, and the plan
// switch is gated on that insert being fresh. A replayed upgrade therefore no-ops —
// the original committed transaction already switched the plan — so the card is
// never charged twice (Paystack also dedupes the same reference) and the plan is
// never re-switched. Switching also clears any parked pending downgrade, so an
// upgrade supersedes an earlier scheduled downgrade.
func (repo BusinessIdentityRepository) ApplyImmediatePlanUpgrade(ctx context.Context, input ports.ApplyImmediatePlanUpgradeInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// business_subscriptions + business_subscription_invoices are tenant-isolated
	// (forced RLS); the businesses row update is allowed under the same scope.
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	if input.AmountMinor > 0 {
		var subscriptionID string
		var periodStart, periodEnd time.Time
		if err := tx.QueryRow(ctx, `
			select subscription_id::text, current_period_start, current_period_end
			from business_subscriptions where business_id = $1
		`, input.BusinessID.String()).Scan(&subscriptionID, &periodStart, &periodEnd); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}

		// Book the prorated charge as a paid invoice for the remainder of the current
		// period, on the NEW plan. Idempotent on the deterministic upgrade ref.
		tag, err := tx.Exec(ctx, `
			insert into business_subscription_invoices (
				invoice_id, subscription_id, business_id, plan_id,
				invoice_ref, provider_invoice_ref, status, billing_mode, provider,
				amount_minor, currency, period_start, period_end, due_at, paid_at
			)
			values (
				gen_random_uuid(), $1, $2, $3,
				$4, $4, 'paid', 'recurring', 'paystack',
				$5, $6, $7, $8, now(), now()
			)
			on conflict (invoice_ref) do nothing
		`, subscriptionID, input.BusinessID.String(), input.NewPlanID.String(),
			input.ChargeRef, input.AmountMinor, input.Currency, periodStart, periodEnd)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			// Replay: the original transaction already booked this invoice and
			// switched the plan. Nothing more to do.
			return tx.Commit(ctx)
		}
	}

	// Switch the subscription to the new plan and clear any parked pending downgrade
	// (an upgrade supersedes it), then sync the business plan so entitlements move
	// immediately.
	if _, err := tx.Exec(ctx, `
		update business_subscriptions
		set plan_id = $2,
			pending_plan_id = null,
			pending_plan_effective_at = null,
			updated_at = now()
		where business_id = $1
	`, input.BusinessID.String(), input.NewPlanID.String()); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		update businesses
		set plan_id = $2, updated_at = now()
		where business_id = $1
	`, input.BusinessID.String(), input.NewPlanID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SchedulePlanDowngrade parks a pending plan change on the subscription to apply at
// EffectiveAt (the current period end). It does not refund, charge, or touch
// entitlements now — the tenant keeps their current plan until the renewal sweep
// applies the change via ApplyDuePlanChanges. Tenant-scoped.
func (repo BusinessIdentityRepository) SchedulePlanDowngrade(ctx context.Context, input ports.SchedulePlanDowngradeInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update business_subscriptions
		set pending_plan_id = $2,
			pending_plan_effective_at = $3,
			updated_at = now()
		where business_id = $1
	`, input.BusinessID.String(), input.NewPlanID.String(), input.EffectiveAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// ApplyDuePlanChanges applies every scheduled plan change whose effective time has
// arrived: it switches the subscription to the pending plan, clears the pending
// fields, and syncs the business plan (entitlements). It is cross-tenant (the
// recurring renewal sweep runs system-wide), so it runs under the RLS bypass, and
// idempotent (once applied, pending_plan_id is null so a re-run is a no-op). It
// returns the number of subscriptions changed.
//
// HANDOFF: this is the method the recurring renewal sweep (adminauth) must call so
// that scheduled downgrades take effect when a paid period ends. It is intentionally
// standalone and not wired into any auth flow — see the plan-change handoff note.
func (repo BusinessIdentityRepository) ApplyDuePlanChanges(ctx context.Context) (int, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return 0, err
	}

	var changed int
	if err := tx.QueryRow(ctx, `
		with due as (
			update business_subscriptions s
			set plan_id = s.pending_plan_id,
				pending_plan_id = null,
				pending_plan_effective_at = null,
				updated_at = now()
			where s.pending_plan_id is not null
				and s.pending_plan_effective_at is not null
				and s.pending_plan_effective_at <= now()
			returning s.business_id, s.plan_id
		),
		synced as (
			update businesses b
			set plan_id = d.plan_id, updated_at = now()
			from due d
			where b.business_id = d.business_id
			returning 1
		)
		select count(*)::int from due
	`).Scan(&changed); err != nil {
		return 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return changed, nil
}
