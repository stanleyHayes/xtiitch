package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// SetBusinessAddonInput upserts one business's add-on entitlement. Used by the
// admin flip (and, later, the add-on billing flow) to turn a paid add-on on or
// off for a single tenant.
type SetBusinessAddonInput struct {
	BusinessID common.ID
	Addon      string
	Active     bool
}

// BusinessAddonRepository reads and writes business_addons entitlements.
//
// HasActiveAddon answers "does *this* business have the add-on?" and MUST run
// tenant-scoped (RLS), so the answer can only ever concern the authenticated
// business. SetBusinessAddon is an admin/billing operation that targets a tenant
// by id and runs under the RLS bypass.
type BusinessAddonRepository interface {
	HasActiveAddon(ctx context.Context, scope common.TenantScope, addon string) (bool, error)
	SetBusinessAddon(ctx context.Context, input SetBusinessAddonInput) error
}
