package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// SubscriptionDiscountRepository backs discount-code redemption at subscription
// checkout. Discount codes are global/admin objects (no tenant RLS), so the code
// lookup and the cross-tenant redemption counts run under the RLS bypass; the
// redemption rows themselves are tenant-isolated (forced RLS) and are read and
// written under the business's scope.
type SubscriptionDiscountRepository struct {
	pool *pgxpool.Pool
}

func NewSubscriptionDiscountRepository(pool *pgxpool.Pool) SubscriptionDiscountRepository {
	return SubscriptionDiscountRepository{pool: pool}
}

// FindActiveDiscountCodeByCode resolves an active, non-archived discount code by
// its (already normalized/upper-cased) code string. Codes are global, so the
// lookup runs under the bypass. Returns ErrNotFound when no active code matches.
func (repo SubscriptionDiscountRepository) FindActiveDiscountCodeByCode(ctx context.Context, code string) (ports.SubscriptionDiscountCode, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.SubscriptionDiscountCode{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.SubscriptionDiscountCode{}, err
	}

	var record ports.SubscriptionDiscountCode
	var maxRedemptionsTotal pgtype.Int4
	var validFrom pgtype.Timestamptz
	var validUntil pgtype.Timestamptz
	if err := tx.QueryRow(ctx, `
		select
			discount_code_id::text,
			code,
			discount_type,
			discount_value::int,
			eligible_plans,
			eligible_cadences,
			first_purchase_only,
			max_redemptions_total,
			max_per_account::int,
			valid_from,
			valid_until
		from subscription_discount_codes
		where code = $1 and active = true and archived_at is null
	`, code).Scan(
		&record.DiscountCodeID,
		&record.Code,
		&record.DiscountType,
		&record.DiscountValue,
		&record.EligiblePlans,
		&record.EligibleCadences,
		&record.FirstPurchaseOnly,
		&maxRedemptionsTotal,
		&record.MaxPerAccount,
		&validFrom,
		&validUntil,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.SubscriptionDiscountCode{}, ports.ErrNotFound
		}
		return ports.SubscriptionDiscountCode{}, err
	}
	record.MaxRedemptionsTotal = int4Ptr(maxRedemptionsTotal)
	record.ValidFrom = timestamptzPtr(validFrom)
	record.ValidUntil = timestamptzPtr(validUntil)
	if record.EligiblePlans == nil {
		record.EligiblePlans = []string{}
	}
	if record.EligibleCadences == nil {
		record.EligibleCadences = []string{}
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.SubscriptionDiscountCode{}, err
	}
	return record, nil
}

// CountAppliedRedemptions returns the total number of APPLIED redemptions for a
// code across all tenants, for the max_redemptions_total cap. Runs under the
// bypass so it sees every tenant's redemptions.
func (repo SubscriptionDiscountRepository) CountAppliedRedemptions(ctx context.Context, discountCodeID common.ID) (int, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return 0, err
	}

	var count int
	if err := tx.QueryRow(ctx, `
		select count(*)::int
		from subscription_discount_redemptions
		where discount_code_id = $1 and status = 'applied'
	`, discountCodeID.String()).Scan(&count); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return count, nil
}

// CountAppliedRedemptionsForAccount returns the number of APPLIED redemptions a
// single business has made against a code, for the max_per_account cap. Runs
// under the bypass (it filters by business_id explicitly) so the pre-checkout
// validation does not depend on a tenant scope being set.
func (repo SubscriptionDiscountRepository) CountAppliedRedemptionsForAccount(ctx context.Context, discountCodeID common.ID, businessID common.ID) (int, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return 0, err
	}

	var count int
	if err := tx.QueryRow(ctx, `
		select count(*)::int
		from subscription_discount_redemptions
		where discount_code_id = $1 and business_id = $2 and status = 'applied'
	`, discountCodeID.String(), businessID.String()).Scan(&count); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return count, nil
}

// CreateRedemption inserts a tenant-scoped redemption row and returns its id. At
// checkout the row is written 'pending' (the discount captured before the card is
// charged); it is transitioned to 'applied' by MarkRedemptionApplied only once the
// activation charge settles, so an abandoned checkout never consumes a slot
// against the max_redemptions_total / max_per_account caps (those count 'applied').
func (repo SubscriptionDiscountRepository) CreateRedemption(ctx context.Context, scope common.TenantScope, input ports.CreateDiscountRedemptionInput) (common.ID, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return "", err
	}

	status := input.Status
	if status == "" {
		status = "pending"
	}
	var subscriptionID any
	if !input.SubscriptionID.IsZero() {
		subscriptionID = input.SubscriptionID.String()
	}

	var redemptionID string
	if err := tx.QueryRow(ctx, `
		insert into subscription_discount_redemptions (
			discount_code_id, business_id, subscription_id,
			account_key, plan_code, cadence, discount_minor, status,
			applied_at
		)
		values (
			$1, $2, $3,
			$4, $5, $6, $7, $8,
			case when $8 = 'applied' then now() else null end
		)
		returning redemption_id::text
	`,
		input.DiscountCodeID.String(),
		input.BusinessID.String(),
		subscriptionID,
		input.AccountKey,
		input.PlanCode,
		input.Cadence,
		input.DiscountMinor,
		status,
	).Scan(&redemptionID); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return common.ID(redemptionID), nil
}

// recentPendingWindow bounds how long an un-applied ('pending') redemption from an
// in-flight checkout counts against the caps. It must comfortably exceed the
// pending→settle window so a genuine concurrent checkout is caught, while letting
// an abandoned checkout's slot free up afterwards.
const recentPendingWindow = "1 hour"

// CreateRedemptionWithinCaps enforces the caps and inserts the 'pending' redemption
// atomically, serialized by an advisory lock on the code so two concurrent
// checkouts of the same limited code cannot both pass the cap check. It counts
// APPLIED redemptions plus recent PENDING ones (an in-flight checkout has only a
// pending row until its payment settles), closing the pending→settle race.
func (repo SubscriptionDiscountRepository) CreateRedemptionWithinCaps(ctx context.Context, scope common.TenantScope, input ports.CreateDiscountRedemptionInput, maxPerAccount int, maxTotal *int) (common.ID, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	// Bypass: the total cap counts across tenants and the insert supplies its own
	// business_id, so RLS scoping is unnecessary here and would hide other tenants'
	// redemptions from the total count.
	if err := setTenantBypass(ctx, tx); err != nil {
		return "", err
	}

	// Serialize all concurrent redemptions of THIS code for the rest of the txn.
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext($1)::bigint)`, input.DiscountCodeID.String()); err != nil {
		return "", err
	}

	countedStatuses := `(status = 'applied' or (status = 'pending' and created_at > now() - interval '` + recentPendingWindow + `'))`

	var perAccount int
	if err := tx.QueryRow(ctx, `
		select count(*)::int from subscription_discount_redemptions
		where discount_code_id = $1 and business_id = $2 and `+countedStatuses,
		input.DiscountCodeID.String(), input.BusinessID.String()).Scan(&perAccount); err != nil {
		return "", err
	}
	if perAccount >= maxPerAccount {
		return "", ports.ErrDiscountRedemptionCapReached
	}
	if maxTotal != nil {
		var total int
		if err := tx.QueryRow(ctx, `
			select count(*)::int from subscription_discount_redemptions
			where discount_code_id = $1 and `+countedStatuses,
			input.DiscountCodeID.String()).Scan(&total); err != nil {
			return "", err
		}
		if total >= *maxTotal {
			return "", ports.ErrDiscountRedemptionCapReached
		}
	}

	status := input.Status
	if status == "" {
		status = "pending"
	}
	var subscriptionID any
	if !input.SubscriptionID.IsZero() {
		subscriptionID = input.SubscriptionID.String()
	}
	var redemptionID string
	if err := tx.QueryRow(ctx, `
		insert into subscription_discount_redemptions (
			discount_code_id, business_id, subscription_id,
			account_key, plan_code, cadence, discount_minor, status,
			applied_at
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8,
			case when $8 = 'applied' then now() else null end)
		returning redemption_id::text
	`, input.DiscountCodeID.String(), input.BusinessID.String(), subscriptionID,
		input.AccountKey, input.PlanCode, input.Cadence, input.DiscountMinor, status,
	).Scan(&redemptionID); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return common.ID(redemptionID), nil
}

// FindPendingRedemption returns the latest still-'pending' redemption for a
// subscription — the discount captured at checkout — joined with its code so the
// verify step can apply it without a second lookup. Returns ErrNotFound when the
// subscription has no pending discount. Tenant-scoped (RLS).
func (repo SubscriptionDiscountRepository) FindPendingRedemption(ctx context.Context, scope common.TenantScope, subscriptionID common.ID) (ports.PendingDiscountRedemption, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.PendingDiscountRedemption{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.PendingDiscountRedemption{}, err
	}

	var record ports.PendingDiscountRedemption
	if err := tx.QueryRow(ctx, `
		select
			r.redemption_id::text,
			r.discount_code_id::text,
			c.discount_type,
			c.discount_value::int,
			r.plan_code,
			r.cadence,
			r.discount_minor
		from subscription_discount_redemptions r
		join subscription_discount_codes c on c.discount_code_id = r.discount_code_id
		where r.subscription_id = $1 and r.status = 'pending'
		order by r.created_at desc
		limit 1
	`, subscriptionID.String()).Scan(
		&record.RedemptionID,
		&record.DiscountCodeID,
		&record.DiscountType,
		&record.DiscountValue,
		&record.PlanCode,
		&record.Cadence,
		&record.DiscountMinor,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.PendingDiscountRedemption{}, ports.ErrNotFound
		}
		return ports.PendingDiscountRedemption{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.PendingDiscountRedemption{}, err
	}
	return record, nil
}

// MarkRedemptionApplied transitions a pending redemption to 'applied', stamping
// the final discount amount and applied_at. It is idempotent: it only touches a
// row still in 'pending', so a replayed verify (double callback) that finds the
// row already applied is a no-op. Tenant-scoped (RLS).
func (repo SubscriptionDiscountRepository) MarkRedemptionApplied(ctx context.Context, scope common.TenantScope, input ports.MarkDiscountRedemptionAppliedInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update subscription_discount_redemptions
		set status = 'applied',
			discount_minor = $2,
			applied_at = now(),
			updated_at = now()
		where redemption_id = $1 and status = 'pending'
	`, input.RedemptionID.String(), input.DiscountMinor); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ActivateFreePeriodBilling activates a subscription on a free-period code: no
// card is charged, a zero-amount already-'paid' invoice is booked on the
// deterministic activation ref (so the charge webhook and any re-verify are
// no-ops), and next_billing_at is set to now + freeMonths, after which the normal
// recurring renewal charge resumes. Idempotent on the invoice ref. Tenant-scoped.
func (repo SubscriptionDiscountRepository) ActivateFreePeriodBilling(ctx context.Context, scope common.TenantScope, input ports.ActivateFreePeriodInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	var subscriptionID, planID string
	if err := tx.QueryRow(ctx, `
		select subscription_id::text, plan_id::text
		from business_subscriptions where business_id = $1
	`, input.BusinessID.String()).Scan(&subscriptionID, &planID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	// Book a zero, already-paid invoice for the free window. Keyed on the
	// deterministic activation ref: a repeated verify reuses the same ref and this
	// insert no-ops rather than granting a second free period.
	tag, err := tx.Exec(ctx, `
		insert into business_subscription_invoices (
			invoice_id, subscription_id, business_id, plan_id,
			invoice_ref, provider_invoice_ref, status, billing_mode, provider,
			amount_minor, currency, period_start, period_end, due_at, paid_at
		)
		values (
			gen_random_uuid(), $1, $2, $3,
			$4, $4, 'paid', 'recurring', 'paystack',
			0, $5, now(), now() + make_interval(months => $6), now(), now()
		)
		on conflict (invoice_ref) do nothing
	`, subscriptionID, input.BusinessID.String(), planID,
		input.ChargeRef, input.Currency, input.FreeMonths)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		// Already activated for this free period — nothing more to do.
		return tx.Commit(ctx)
	}

	// Flip to active, consume the one-time first purchase (so a later
	// cancel+resubscribe bills the full renewal figure), and schedule the next
	// billing at the end of the free window.
	if _, err := tx.Exec(ctx, `
		update business_subscriptions
		set status = 'active',
			failed_payment_count = 0,
			grace_ends_at = null,
			cancel_at_period_end = false,
			first_purchase_consumed = true,
			last_invoice_ref = $2,
			last_payment_at = now(),
			current_period_end = now() + make_interval(months => $3),
			next_billing_at = now() + make_interval(months => $3),
			updated_at = now()
		where business_id = $1
	`, input.BusinessID.String(), input.ChargeRef, input.FreeMonths); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
