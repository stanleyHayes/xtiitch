package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo PromotionRepository) VoidPendingPromotionRedemptions(
	ctx context.Context,
	scope common.TenantScope,
	orderID common.ID,
) error {
	if orderID.IsZero() {
		return nil
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update promotion_redemptions
		set status = 'void', updated_at = now()
		where business_id = $1 and order_id = $2 and status = 'pending'
	`, scope.BusinessID.String(), orderID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
