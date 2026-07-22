package postgres

import "context"

// ApplyDuePlanChanges applies scheduled downgrades after their paid period,
// then synchronizes the business plan that drives entitlements. The operation
// is cross-tenant and idempotent.
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
