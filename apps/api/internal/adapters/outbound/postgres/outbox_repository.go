package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

type NotificationRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) NotificationRepository {
	return NotificationRepository{pool: pool}
}

func (repo NotificationRepository) ListMessages(ctx context.Context, scope common.TenantScope) ([]ports.MessageSummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select message_id, channel, kind, recipient, status, attempts, created_at
		from outbound_messages
		where business_id = $1
		order by created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []ports.MessageSummary
	for rows.Next() {
		var s ports.MessageSummary
		if err := rows.Scan(&s.MessageID, &s.Channel, &s.Kind, &s.Recipient, &s.Status, &s.Attempts, &s.CreatedAt); err != nil {
			return nil, err
		}
		summaries = append(summaries, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return summaries, nil
}

// enqueueOrderNotification records, in the caller's transaction, the intent to
// message an order's customer about a lifecycle event. It runs alongside the
// state change it announces, so the message is durable and consistent with that
// change. The recipient is the order's customer phone; the dedup key makes a
// repeated enqueue (redelivered webhook, retried transaction) a no-op. Producers
// in this package call it from inside the confirming/fulfilling transaction.
func enqueueOrderNotification(ctx context.Context, tx pgx.Tx, businessID, orderID string, kind notification.Kind) error {
	_, err := tx.Exec(ctx, `
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select gen_random_uuid(), o.business_id, $3, $4, coalesce(c.phone, ''),
			jsonb_build_object('order_id', o.order_id::text, 'design', coalesce(d.title, '')), $5
		from orders o
		join customers c on c.customer_id = o.customer_id
		left join designs d on d.design_id = o.design_id
		where o.order_id = $1 and o.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, orderID, businessID, string(notification.ChannelWhatsApp), string(kind), notification.DedupKey(kind, orderID))
	return err
}
