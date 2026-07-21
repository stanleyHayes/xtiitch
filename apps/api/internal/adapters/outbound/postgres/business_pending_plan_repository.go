package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// SetPendingPlanUpgrade parks an upgrade's target plan on the subscription as
// PAYMENT-PENDING: pending_plan_id with a NULL pending_plan_effective_at (the
// shape migration 000118 admits). It touches nothing else — entitlements keep
// resolving from the current paid-up plan until the payment is verified and
// ApplyImmediatePlanUpgrade applies the switch (clearing the pending fields).
// Tenant-scoped.
func (repo BusinessIdentityRepository) SetPendingPlanUpgrade(ctx context.Context, businessID common.ID, planID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID.String()); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update business_subscriptions
		set pending_plan_id = $2,
			pending_plan_effective_at = null,
			updated_at = now()
		where business_id = $1
	`, businessID.String(), planID.String())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}
