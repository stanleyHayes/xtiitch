package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// RecordDesignView bumps the §14.1 design view counter (000107). It runs under
// the RESOLVED business's tenant scope (the public design read already resolved
// the design to its store, so this is a normal tenant write, not a bypass).
// The application treats it as best-effort: a counter failure must never fail
// a storefront page.
func (repo StorefrontRepository) RecordDesignView(ctx context.Context, scope common.TenantScope, designID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update designs
		set view_count = view_count + 1
		where design_id = $1 and business_id = $2
	`, designID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
