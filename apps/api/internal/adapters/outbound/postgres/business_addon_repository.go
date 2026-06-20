package postgres

import (
	"context"

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

// SetBusinessAddon upserts a single tenant's add-on entitlement by business id.
// This is an admin/billing operation (the tenant is not the caller), so it runs
// under the RLS bypass. activated_at is stamped the first time the add-on goes
// active and left untouched otherwise.
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
