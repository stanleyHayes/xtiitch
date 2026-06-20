package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// BusinessAddonRepository reads and writes the business_addons entitlement table
// (paid add-ons a business buys separately from its plan, e.g. the AI Assistant).
type BusinessAddonRepository struct {
	pool *pgxpool.Pool
}

func NewBusinessAddonRepository(pool *pgxpool.Pool) BusinessAddonRepository {
	return BusinessAddonRepository{pool: pool}
}

// HasActiveAddon reports whether the authenticated business has the named add-on
// active. It runs tenant-scoped under row-level security: the transaction is
// bound to the caller's business, so the lookup can only ever see that business's
// own rows. A missing row means "not active".
func (repo BusinessAddonRepository) HasActiveAddon(ctx context.Context, scope common.TenantScope, addon string) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return false, err
	}

	var active bool
	if err := tx.QueryRow(ctx, `
		select exists (
			select 1 from business_addons
			where business_id = $1 and addon = $2 and active = true
		)
	`, scope.BusinessID.String(), addon).Scan(&active); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return active, nil
}

// GetAddonStatus returns the authenticated business's own view of one add-on:
// whether it is active, how it was activated (billing_status), and when it next
// renews. Runs tenant-scoped (RLS). A missing row means the add-on has never
// been touched for this business (billing_status "none").
func (repo BusinessAddonRepository) GetAddonStatus(ctx context.Context, scope common.TenantScope, addon string) (ports.AddonStatus, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AddonStatus{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.AddonStatus{}, err
	}

	status := ports.AddonStatus{Addon: addon}
	var nextChargeAt *time.Time
	err = tx.QueryRow(ctx, `
		select active, billing_status, amount_minor, currency, next_charge_at
		from business_addons
		where business_id = $1 and addon = $2
	`, scope.BusinessID.String(), addon).Scan(
		&status.Active, &status.BillingStatus, &status.AmountMinor, &status.Currency, &nextChargeAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		if err := tx.Commit(ctx); err != nil {
			return ports.AddonStatus{}, err
		}
		return ports.AddonStatus{Addon: addon, BillingStatus: "none"}, nil
	}
	if err != nil {
		return ports.AddonStatus{}, err
	}
	status.NextChargeAt = nextChargeAt
	if err := tx.Commit(ctx); err != nil {
		return ports.AddonStatus{}, err
	}
	return status, nil
}

// GetBusinessOwnerEmail returns the authenticated business's owner email,
// tenant-scoped under RLS (so it can only ever read the caller's own users).
// Used as the Paystack customer email for add-on checkout. Returns "" when the
// business has no active owner.
func (repo BusinessAddonRepository) GetBusinessOwnerEmail(ctx context.Context, scope common.TenantScope) (string, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return "", err
	}

	var email string
	if err := tx.QueryRow(ctx, `
		select coalesce((
			select email from business_users
			where business_id = $1 and role = 'owner' and is_active = true
			order by created_at asc
			limit 1
		), '')
	`, scope.BusinessID.String()).Scan(&email); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return email, nil
}

// SetBusinessAddon upserts a single tenant's add-on entitlement by business id.
// This is an admin operation (the tenant is not the caller), so it runs under the
// RLS bypass. activated_at is stamped the first time the add-on goes active and
// left untouched otherwise. It does not touch the billing columns, so an
// admin-granted add-on stays billing_status 'manual' (no money, never swept).
func (repo BusinessAddonRepository) SetBusinessAddon(ctx context.Context, input ports.SetBusinessAddonInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_addons (business_id, addon, active, activated_at, updated_at)
		values ($1, $2, $3, case when $3 then now() else null end, now())
		on conflict (business_id, addon) do update
		set active = excluded.active,
			activated_at = case
				when excluded.active and business_addons.activated_at is null then now()
				else business_addons.activated_at
			end,
			updated_at = now()
	`, input.BusinessID.String(), input.Addon, input.Active); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// UpsertAddonBilling records the Paystack billing state for a paid add-on after a
// checkout (the authorization the renewal sweep will charge each month). It is a
// billing operation targeting a tenant by id, so it runs under the RLS bypass.
func (repo BusinessAddonRepository) UpsertAddonBilling(ctx context.Context, input ports.UpsertAddonBillingInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_addons (
			business_id, addon, active, activated_at,
			authorization_ref, customer_ref, amount_minor, currency,
			billing_status, next_charge_at, last_charged_at, last_reference, updated_at
		)
		values ($1, $2, $3, case when $3 then now() else null end,
			$4, $5, $6, $7, $8, $9, $10, $11, now())
		on conflict (business_id, addon) do update
		set active = excluded.active,
			activated_at = case
				when excluded.active and business_addons.activated_at is null then now()
				else business_addons.activated_at
			end,
			authorization_ref = excluded.authorization_ref,
			customer_ref = excluded.customer_ref,
			amount_minor = excluded.amount_minor,
			currency = excluded.currency,
			billing_status = excluded.billing_status,
			next_charge_at = excluded.next_charge_at,
			last_charged_at = coalesce(excluded.last_charged_at, business_addons.last_charged_at),
			last_reference = coalesce(excluded.last_reference, business_addons.last_reference),
			updated_at = now()
	`,
		input.BusinessID.String(), input.Addon, input.Active,
		input.AuthorizationRef, input.CustomerRef, input.AmountMinor, input.Currency,
		input.BillingStatus, input.NextChargeAt, input.LastChargedAt, input.LastReference,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RecordAddonRenewal records the outcome of a renewal charge from the recurring
// sweep. Success extends next_charge_at and keeps the add-on active; failure
// marks it past_due and revokes access (active = false) until the business pays
// again. RLS bypass (targets a tenant by id).
func (repo BusinessAddonRepository) RecordAddonRenewal(ctx context.Context, input ports.RecordAddonRenewalInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if input.Success {
		if _, err := tx.Exec(ctx, `
			update business_addons
			set active = true, billing_status = 'active',
				last_charged_at = $3, last_reference = $4, next_charge_at = $5, updated_at = now()
			where business_id = $1 and addon = $2
		`, input.BusinessID.String(), input.Addon, input.ChargedAt, input.Reference, input.NextChargeAt); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			update business_addons
			set active = false, billing_status = 'past_due',
				last_reference = $3, next_charge_at = $4, updated_at = now()
			where business_id = $1 and addon = $2
		`, input.BusinessID.String(), input.Addon, input.Reference, input.NextChargeAt); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ListAddonChargesDue returns paid, active add-ons whose next renewal charge is
// due (next_charge_at <= now). The owner email is joined in so the sweep can
// charge the stored Paystack authorization. RLS bypass (cross-tenant billing job).
func (repo BusinessAddonRepository) ListAddonChargesDue(ctx context.Context, now time.Time, limit int) ([]ports.AddonChargeDue, error) {
	if limit <= 0 {
		limit = 100
	}
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select a.business_id::text, a.addon,
			coalesce(a.authorization_ref, ''), coalesce(a.customer_ref, ''),
			coalesce((
				select email from business_users
				where business_id = a.business_id and role = 'owner' and is_active = true
				order by created_at asc
				limit 1
			), ''),
			a.amount_minor, a.currency
		from business_addons a
		where a.active = true
			and a.billing_status = 'active'
			and a.next_charge_at is not null
			and a.next_charge_at <= $1
			and a.authorization_ref is not null
			and a.authorization_ref <> ''
		order by a.next_charge_at asc
		limit $2
	`, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var due []ports.AddonChargeDue
	for rows.Next() {
		var d ports.AddonChargeDue
		if err := rows.Scan(
			&d.BusinessID, &d.Addon, &d.AuthorizationRef, &d.CustomerRef,
			&d.CustomerEmail, &d.AmountMinor, &d.Currency,
		); err != nil {
			return nil, err
		}
		due = append(due, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return due, nil
}
