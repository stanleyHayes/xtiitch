package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// setTenantScope binds the transaction to one business so row-level security
// constrains every subsequent tenant-scoped query to it.
func setTenantScope(ctx context.Context, tx pgx.Tx, scope common.TenantScope) error {
	_, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, scope.BusinessID.String())
	return err
}

func rollbackCatalogueUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}

// setTenantBypass turns on the transaction-local row-level-security bypass. It
// is for the few legitimately cross-tenant credential lookups only (login by
// handle, refresh by token hash, webhook lookup by provider reference), where
// the tenant is not yet known. Every other access must instead set the tenant
// scope; a query that does neither fails closed under the hardened policies.
func setTenantBypass(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `select set_config('xtiitch.bypass', 'on', true)`)
	return err
}

// clearTenantBypass turns the bypass back off within the same transaction. A
// cross-tenant lookup must narrow to a single tenant the moment it learns which
// one it is, so that the writes that follow run under real row-level security
// (the policy is `bypass = 'on' OR business_id = …`, so leaving bypass on would
// let those writes touch any tenant's rows). Pair it with setTenantScope.
func clearTenantBypass(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `select set_config('xtiitch.bypass', 'off', true)`)
	return err
}
