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
			jsonb_build_object('order_id', o.order_id::text, 'design', coalesce(d.title, ''), 'store', b.name), $5
		from orders o
		join businesses b on b.business_id = o.business_id
		join customers c on c.customer_id = o.customer_id
		left join designs d on d.design_id = o.design_id
		where o.order_id = $1 and o.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, orderID, businessID, string(notification.ChannelSMS), string(kind), notification.DedupKey(kind, orderID))
	return err
}

// enqueueStageAdvanceNotification records, in the caller's transaction, the
// intent to tell an order's customer it moved to a new production stage. The
// stage name/colour come from the stage template the order just entered so the
// transport can compose per-stage wording. Deduped per (order, stage), so each
// transition fires once. Recipient is the order's customer phone.
func enqueueStageAdvanceNotification(ctx context.Context, tx pgx.Tx, businessID, orderID, stageID string) error {
	kind := notification.KindOrderStageAdvanced
	_, err := tx.Exec(ctx, `
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select gen_random_uuid(), o.business_id, $4, $5, coalesce(c.phone, ''),
			jsonb_build_object(
				'order_id', o.order_id::text,
				'stage', coalesce(st.name, ''),
				'stage_colour', coalesce(st.colour, ''),
				'stage_sequence', st.sequence,
				'design', coalesce(d.title, ''),
				'store', b.name
			), $6
		from orders o
		join businesses b on b.business_id = o.business_id
		join customers c on c.customer_id = o.customer_id
		join stage_templates st on st.stage_id = $3 and st.business_id = o.business_id
		left join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		where o.order_id = $1 and o.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, orderID, businessID, stageID, string(notification.ChannelSMS), string(kind),
		notification.DedupKey(kind, notification.StageAdvanceReference(orderID, stageID)))
	return err
}

// enqueueOwnerNewOrderNotification alerts the store owner (by SMS) that a new
// order arrived, so they can action it — recipient is the owner's phone. The
// LATERAL join only yields a row when an owner phone is on file, so no message is
// enqueued (and nothing fails downstream) when the owner has not set a phone.
func enqueueOwnerNewOrderNotification(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	kind := notification.KindNewOrderOwner
	_, err := tx.Exec(ctx, `
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select gen_random_uuid(), o.business_id, $3, $4, bu.phone,
			jsonb_build_object(
				'order_id', o.order_id::text,
				'design', coalesce(d.title, ''),
				'customer', coalesce(c.display_name, ''),
				'amount_minor', o.agreed_total_minor
			), $5
		from orders o
		join customers c on c.customer_id = o.customer_id
		left join designs d on d.design_id = o.design_id
		join lateral (
			select phone from business_users
			where business_id = o.business_id and role = 'owner'
				and phone is not null and phone <> ''
			order by created_at asc
			limit 1
		) bu on true
		where o.order_id = $1 and o.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, orderID, businessID, string(notification.ChannelSMS), string(kind), notification.DedupKey(kind, orderID))
	return err
}

// How many devices one order will notify. A business has as many devices as it
// has staff with the app installed, so this is far above any real figure; it
// exists so a runaway client that registered token after token cannot make a
// payment transaction fan out without bound. Least-recently-used devices are
// the ones dropped, and only past this limit.
const ownerPushDeviceLimit = 50

// enqueueOwnerNewOrderPushNotifications records, in the caller's transaction,
// the intent to push a new-order alert to every device the business has
// registered. It runs alongside the SMS enqueue: the SMS reaches the owner
// wherever she is, the push reaches the app she actually works in.
//
// One row per device rather than one row per order, because delivery is
// per-token: a failure against one dead phone must not hold up or retry the
// copy going to a working one. The dedup key therefore carries the token as
// well as the order (see OwnerPushReference), so a redelivered webhook still
// dedupes while every device keeps its own message.
//
// The tokens are read first and the keys built in Go so the dedup key comes
// from the same DedupKey/OwnerPushReference pair every other producer uses,
// rather than being re-assembled in SQL where it could silently drift.
func enqueueOwnerNewOrderPushNotifications(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	kind := notification.KindNewOrderOwnerPush

	rows, err := tx.Query(ctx, `
		select token
		from push_device_tokens
		where business_id = $1
		order by last_seen_at desc
		limit $2
	`, businessID, ownerPushDeviceLimit)
	if err != nil {
		return err
	}
	defer rows.Close()

	var tokens, dedupKeys []string
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			return err
		}
		tokens = append(tokens, token)
		dedupKeys = append(dedupKeys, notification.DedupKey(kind, notification.OwnerPushReference(orderID, token)))
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()
	if len(tokens) == 0 {
		// Nobody has the app installed for this business. Not an error — the SMS
		// and the email still went out.
		return nil
	}

	// Payload matches the SMS row's exactly, so both channels render from one
	// vocabulary and the worker needs no push-specific lookup.
	_, err = tx.Exec(ctx, `
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select gen_random_uuid(), o.business_id, $3, $4, device.token,
			jsonb_build_object(
				'order_id', o.order_id::text,
				'design', coalesce(d.title, ''),
				'customer', coalesce(c.display_name, ''),
				'amount_minor', o.agreed_total_minor
			), device.dedup_key
		from orders o
		join customers c on c.customer_id = o.customer_id
		left join designs d on d.design_id = o.design_id
		cross join unnest($5::text[], $6::text[]) as device(token, dedup_key)
		where o.order_id = $1 and o.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, orderID, businessID, string(notification.ChannelPush), string(kind), tokens, dedupKeys)
	return err
}

func enqueueBookingNotification(ctx context.Context, tx pgx.Tx, businessID, bookingID string, kind notification.Kind) error {
	_, err := tx.Exec(ctx, `
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select gen_random_uuid(), b.business_id, $3, $4, coalesce(c.phone, ''),
			jsonb_build_object(
				'booking_id', b.booking_id::text,
				'order_id', b.order_id::text,
				'slot_start', b.slot_start,
				'slot_end', b.slot_end,
				'address', coalesce(b.address, ''),
				'design', coalesce(d.title, '')
			), $5
		from bookings b
		join customers c on c.customer_id = b.customer_id
		left join orders o on o.order_id = b.order_id and o.business_id = b.business_id
		left join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		where b.booking_id = $1 and b.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, bookingID, businessID, string(notification.ChannelSMS), string(kind), notification.DedupKey(kind, bookingID))
	return err
}

func enqueueBalancePaymentNotification(ctx context.Context, tx pgx.Tx, businessID, orderID, paymentID string, amountMinor int64) error {
	kind := notification.KindBalancePaid
	_, err := tx.Exec(ctx, `
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select gen_random_uuid(), o.business_id, $4, $5, coalesce(c.phone, ''),
			jsonb_build_object(
				'order_id', o.order_id::text,
				'payment_id', $3::text,
				'amount_minor', $6::bigint,
				'design', coalesce(d.title, '')
			), $7
		from orders o
		join customers c on c.customer_id = o.customer_id
		left join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		where o.order_id = $1 and o.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, orderID, businessID, paymentID, string(notification.ChannelSMS), string(kind), amountMinor, notification.DedupKey(kind, paymentID))
	return err
}

func enqueueHandoverNotification(ctx context.Context, tx pgx.Tx, businessID, handoverID string, kind notification.Kind) error {
	_, err := tx.Exec(ctx, `
		insert into outbound_messages (message_id, business_id, channel, kind, recipient, payload, dedup_key)
		select gen_random_uuid(), h.business_id, $3, $4, coalesce(nullif(h.recipient_phone, ''), c.phone, ''),
			jsonb_build_object(
				'handover_id', h.handover_id::text,
				'order_id', h.order_id::text,
				'method', h.method,
				'status', h.status,
				'courier', coalesce(h.courier, ''),
				'design', coalesce(d.title, '')
			), $5
		from handovers h
		left join orders o on o.order_id = h.order_id and o.business_id = h.business_id
		left join customers c on c.customer_id = o.customer_id
		left join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		where h.handover_id = $1 and h.business_id = $2
		on conflict (business_id, dedup_key) do nothing
	`, handoverID, businessID, string(notification.ChannelSMS), string(kind), notification.DedupKey(kind, handoverID))
	return err
}
