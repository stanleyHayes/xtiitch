package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// adminBusinessActivitySQL unions every per-business event source §11.3 lists
// into one feed shape: (category, event_type, occurred_at, summary, actor,
// ref_id, amount_minor). amount_minor is NULL except on money rows; actor is
// the platform side responsible where recorded (empty where unknowable — e.g.
// stage entries do not store who moved the order).
//
// Timestamps per source: orders/stage entries use their own created/entered
// stamps; a confirmed payment uses updated_at (the moment it flipped to
// succeeded); payouts prefer settled_at; everything else uses created_at.
//
// Every text/timestamp expression is coalesced so a sparse unverified tenant
// (missing purpose/method/status/subaccount/submitted_at) cannot NULL a UNION
// arm and fail the whole feed scan.
const adminBusinessActivitySQL = `
	select category, event_type, occurred_at, summary, actor, ref_id, amount_minor
	from (
		select
			'orders' as category,
			'order_created' as event_type,
			o.created_at as occurred_at,
			coalesce(initcap(o.order_type), 'Order')
				|| ' order placed · status '
				|| coalesce(o.status, 'unknown') as summary,
			'customer' as actor,
			o.order_id::text as ref_id,
			o.agreed_total_minor as amount_minor
		from orders o
		where o.business_id::text = $1

		union all

		select
			'orders',
			'order_stage_entered',
			se.entered_at,
			'Order moved to stage "' || coalesce(st.name, 'unknown') || '"',
			'',
			se.order_id::text,
			null
		from stage_events se
		left join stage_templates st on st.stage_id = se.stage_id
		where se.business_id::text = $1

		union all

		select
			'payments',
			'payment_confirmed',
			p.updated_at,
			'Payment confirmed · '
				|| coalesce(p.purpose, 'unknown')
				|| ' · '
				|| coalesce(p.method, 'unknown'),
			'customer',
			p.payment_id::text,
			p.amount_minor
		from payments p
		where p.business_id::text = $1 and p.status = 'succeeded'

		union all

		select
			'billing',
			coalesce(e.event_type, 'billing_event'),
			e.created_at,
			coalesce(e.summary, 'Subscription billing event'),
			case when e.actor_admin_user_id is not null then 'admin' else 'system' end,
			e.subscription_event_id::text,
			null
		from business_subscription_events e
		where e.business_id::text = $1

		union all

		select
			'payouts',
			'payout_recorded',
			coalesce(s.settled_at, s.created_at),
			'Payout '
				|| coalesce(s.status, 'unknown')
				|| ' · subaccount '
				|| coalesce(nullif(s.subaccount_code, ''), 'none'),
			'system',
			s.settlement_id::text,
			s.amount_minor
		from paystack_settlements s
		where s.business_id::text = $1

		union all

		select
			'verification',
			'verification_submitted',
			coalesce(d.submitted_at, d.created_at, d.updated_at),
			'Identity documents submitted'
				|| case when coalesce(d.full_legal_name, '') = ''
					then ''
					else ' for ' || d.full_legal_name
				end,
			'owner',
			d.business_id::text,
			null
		from business_identity_documents d
		where d.business_id::text = $1

		union all

		select
			'admin',
			'admin_action',
			a.created_at,
			coalesce(a.action, 'admin') || ' — ' || coalesce(a.summary, 'Operator action'),
			'admin',
			a.audit_event_id::text,
			null
		from admin_audit_events a
		where a.target_type = 'business' and a.target_id = $1

		union all

		select
			'takings',
			'manual_taking_recorded',
			coalesce(m.taken_at, m.created_at),
			'Manual taking recorded · '
				|| coalesce(m.method, 'unknown')
				|| ' · '
				|| coalesce(nullif(m.what_for, ''), 'unspecified'),
			'owner',
			m.taking_id::text,
			m.amount_minor
		from manual_takings m
		where m.business_id::text = $1
	) feed
	where ($2 = '' or feed.category = $2)
		and feed.occurred_at is not null
	order by feed.occurred_at desc, feed.ref_id desc
	limit $3 offset $4
`

//nolint:funlen // one feed query + its scan loop; splitting obscures the shape
func (repo AdminAuthRepository) ListAdminBusinessActivity(
	ctx context.Context,
	input ports.ListAdminBusinessActivityInput,
) ([]ports.AdminBusinessActivityRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// The feed unions platform tables (admin_audit_events) with tenant tables, so
	// it runs with the cross-tenant bypass like the other admin reads.
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	businessID := input.BusinessID.String()
	if businessID == "" {
		return nil, ErrNotFound
	}

	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists(select 1 from businesses where business_id::text = $1)
	`, businessID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}

	rows, err := tx.Query(ctx, adminBusinessActivitySQL,
		businessID,
		input.Category,
		input.Limit,
		input.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminBusinessActivityRecord{}
	for rows.Next() {
		record, ok := scanBusinessActivityRow(rows)
		if !ok {
			// Skip a malformed arm rather than failing the whole tenant feed —
			// unverified/pending stores often have sparse related rows.
			continue
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

type activityRowScanner interface {
	Scan(dest ...any) error
}

func scanBusinessActivityRow(row activityRowScanner) (ports.AdminBusinessActivityRecord, bool) {
	var (
		record     ports.AdminBusinessActivityRecord
		occurredAt pgtype.Timestamptz
		summary    pgtype.Text
		actor      pgtype.Text
		amount     pgtype.Int8
	)
	if err := row.Scan(
		&record.Category,
		&record.EventType,
		&occurredAt,
		&summary,
		&actor,
		&record.RefID,
		&amount,
	); err != nil {
		return ports.AdminBusinessActivityRecord{}, false
	}
	if !occurredAt.Valid || occurredAt.Time.IsZero() {
		return ports.AdminBusinessActivityRecord{}, false
	}
	record.OccurredAt = occurredAt.Time
	if summary.Valid {
		record.Summary = summary.String
	}
	if record.Summary == "" {
		record.Summary = "Activity recorded"
	}
	if actor.Valid {
		record.Actor = actor.String
	}
	if amount.Valid {
		value := amount.Int64
		record.AmountMinor = &value
	}
	return record, true
}
