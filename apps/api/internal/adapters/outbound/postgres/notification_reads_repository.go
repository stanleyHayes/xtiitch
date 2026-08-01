package postgres

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// Per-operator read state for the dashboard's message list, so a new order can
// raise a badge rather than sit silently in a log nobody opens.

// CountUnreadOwnerAlerts counts owner-directed alerts recorded since this
// operator last opened the messages view.
//
// Only new_order_owner counts. The outbox also carries customer-bound messages
// (order confirmations, stage updates), and badging an owner for a message sent
// to somebody else would train her to ignore the badge.
//
// An operator with no read row yet counts zero rather than everything: the row
// is created on first read with last_read_at = now, and until then coalesce
// falls back to now() so history does not arrive as unread.
func (repo NotificationRepository) CountUnreadOwnerAlerts(
	ctx context.Context,
	scope common.TenantScope,
	userID common.ID,
) (int, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return 0, err
	}

	var unread int
	if err := tx.QueryRow(ctx, `
		select count(*)
		from outbound_messages m
		where m.business_id = $1
			and m.kind = $3
			and m.created_at > coalesce(
				(
					select r.last_read_at
					from business_notification_reads r
					where r.business_user_id = $2
				),
				now()
			)
	`, scope.BusinessID.String(), userID.String(), string(notification.KindNewOrderOwner)).
		Scan(&unread); err != nil {
		return 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return unread, nil
}

// MarkNotificationsRead moves this operator's read marker forward. Idempotent —
// opening the view twice is normal, not an error.
func (repo NotificationRepository) MarkNotificationsRead(
	ctx context.Context,
	scope common.TenantScope,
	userID common.ID,
	now time.Time,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_notification_reads (business_user_id, business_id, last_read_at, updated_at)
		values ($1, $2, $3, $3)
		on conflict (business_user_id) do update
			set last_read_at = excluded.last_read_at,
				updated_at = excluded.updated_at
	`, userID.String(), scope.BusinessID.String(), now); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
