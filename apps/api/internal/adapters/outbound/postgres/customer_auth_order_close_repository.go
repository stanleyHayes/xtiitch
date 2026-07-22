package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// CloseCustomerDraftOrder stamps a customer's awaiting-payment order closed.
// Cart orders close as one basket, preventing a remaining line from trying to
// re-charge an incomplete checkout group. A repeat close is idempotent.
func (repo CustomerAuthRepository) CloseCustomerDraftOrder(
	ctx context.Context,
	customerID common.ID,
	orderID common.ID,
	at time.Time,
) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return false, err
	}

	var businessID string
	var groupID sql.NullString
	err = tx.QueryRow(ctx, `
		select business_id::text, checkout_group_id::text
		from orders
		where order_id = $1 and customer_id = $2 and status = 'draft'
		for update
	`, orderID.String(), customerID.String()).Scan(&businessID, &groupID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, commitOrErr(ctx, tx)
	}
	if err != nil {
		return false, err
	}

	if groupID.Valid {
		_, err = tx.Exec(ctx, `
			update orders set closed_at = coalesce(closed_at, $4), updated_at = now()
			where business_id = $1 and customer_id = $2
				and checkout_group_id = $3 and status = 'draft'
		`, businessID, customerID.String(), groupID.String, at)
	} else {
		_, err = tx.Exec(ctx, `
			update orders set closed_at = coalesce(closed_at, $3), updated_at = now()
			where order_id = $1 and customer_id = $2 and status = 'draft'
		`, orderID.String(), customerID.String(), at)
	}
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}
