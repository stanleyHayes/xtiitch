package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) ListAdminSupportTickets(ctx context.Context) ([]ports.AdminSupportTicketRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	records, err := queryAdminSupportTickets(ctx, tx, "")
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) UpdateAdminSupportTicket(
	ctx context.Context,
	input ports.UpdateAdminSupportTicketInput,
) (ports.AdminSupportTicketRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	current, err := queryAdminSupportTicket(ctx, tx, input.TicketKey)
	if err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		with desired_assignment as (
			select
				case
					when $5 = 'self' then $6::uuid
					when $5 = 'unassigned' then null
					else (
						select assigned_admin_user_id
						from admin_support_ticket_states
						where ticket_key = $1
					)
				end as assigned_admin_user_id
		)
		insert into admin_support_ticket_states (
			ticket_key,
			business_id,
			status,
			assigned_admin_user_id,
			note,
			updated_by_admin_user_id,
			updated_at
		)
		values ($1, $2, $3, (select assigned_admin_user_id from desired_assignment), $4, $6, now())
		on conflict (ticket_key) do update
		set business_id = excluded.business_id,
			status = excluded.status,
			assigned_admin_user_id = excluded.assigned_admin_user_id,
			note = excluded.note,
			updated_by_admin_user_id = excluded.updated_by_admin_user_id,
			updated_at = now()
	`, input.TicketKey,
		current.BusinessID.String(),
		input.Status,
		input.Note,
		input.Assignment,
		input.ActorAdminUser.String(),
	); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	record, err := queryAdminSupportTicket(ctx, tx, input.TicketKey)
	if err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	return record, nil
}

func queryAdminSupportTicket(
	ctx context.Context,
	tx pgx.Tx,
	ticketKey string,
) (ports.AdminSupportTicketRecord, error) {
	records, err := queryAdminSupportTickets(ctx, tx, ticketKey)
	if err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}
	if len(records) == 0 {
		return ports.AdminSupportTicketRecord{}, ErrNotFound
	}
	return records[0], nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func queryAdminSupportTickets(
	ctx context.Context,
	tx pgx.Tx,
	ticketKey string,
) ([]ports.AdminSupportTicketRecord, error) {
	rows, err := tx.Query(ctx, `
		with latest_stage_events as (
			select
				order_id,
				max(entered_at) as latest_stage_at
			from stage_events
			group by order_id
		),
		signals as (
			select
				'message_delivery:' || m.message_id::text as ticket_key,
				m.business_id,
				case
					when m.status = 'dead' then 'Customer message failed'
					else 'Customer message delayed'
				end as subject,
				b.name as business_name,
				case
					when m.status = 'dead' or m.attempts >= 3 then 'urgent'
					else 'normal'
				end as priority,
				'Message ' || m.kind || ' to ' || coalesce(nullif(m.recipient, ''), 'customer')
					|| ' is ' || m.status || ' after ' || m.attempts::text || ' attempt(s).'
					|| case
						when coalesce(nullif(m.last_error, ''), '') <> '' then ' Last error: ' || m.last_error
						else ''
					end as summary,
				'Notifications' as category,
				coalesce(m.available_at, m.created_at) as signal_at
			from outbound_messages m
			join businesses b on b.business_id = m.business_id
			where m.status = 'dead'
				or (
					m.status in ('pending', 'sending')
					and m.available_at <= now() - interval '15 minutes'
				)

			union all

			select
				'failed_payment:' || p.payment_id::text as ticket_key,
				p.business_id,
				'Customer payment needs follow-up' as subject,
				b.name as business_name,
				case
					when p.amount_minor >= 50000 then 'urgent'
					else 'normal'
				end as priority,
				'Payment ' || p.provider_reference || ' failed for '
					|| (p.amount_minor::numeric / 100)::text || ' GHS'
					|| case
						when p.order_id is not null then ' and is linked to an order.'
						when p.booking_id is not null then ' and is linked to a booking.'
						else '.'
					end as summary,
				'Payments' as category,
				p.updated_at as signal_at
			from payments p
			join businesses b on b.business_id = p.business_id
			where p.status = 'failed'
				and p.updated_at >= now() - interval '30 days'

			union all

			select
				'stuck_order:' || o.order_id::text as ticket_key,
				o.business_id,
				'Order progress update needed' as subject,
				b.name as business_name,
				case
					when coalesce(lse.latest_stage_at, o.updated_at) <= now() - interval '5 days' then 'urgent'
					else 'normal'
				end as priority,
				'Confirmed ' || o.order_type || ' order has not moved recently. Last production update: '
					|| to_char(coalesce(lse.latest_stage_at, o.updated_at), 'YYYY-MM-DD HH24:MI TZ') || '.'
					as summary,
				'Tracking' as category,
				coalesce(lse.latest_stage_at, o.updated_at) as signal_at
			from orders o
			join businesses b on b.business_id = o.business_id
			left join latest_stage_events lse on lse.order_id = o.order_id
			where o.status = 'confirmed'
				and coalesce(lse.latest_stage_at, o.updated_at) <= now() - interval '48 hours'

			union all

			select
				'overdue_booking:' || bk.booking_id::text as ticket_key,
				bk.business_id,
				'Home visit follow-up overdue' as subject,
				b.name as business_name,
				'urgent' as priority,
				'Booked home visit ended at ' || to_char(bk.slot_end, 'YYYY-MM-DD HH24:MI TZ')
					|| ' and still needs completion or reschedule.' as summary,
				'Visits' as category,
				bk.slot_end as signal_at
			from bookings bk
			join businesses b on b.business_id = bk.business_id
			where bk.status = 'booked'
				and bk.slot_end <= now() - interval '2 hours'

			union all

			select
				'handover_attention:' || h.handover_id::text as ticket_key,
				h.business_id,
				'Fulfilment handover needs follow-up' as subject,
				b.name as business_name,
				case
					when h.status = 'dispatched' and h.updated_at <= now() - interval '24 hours' then 'urgent'
					else 'normal'
				end as priority,
				'Handover is ' || h.status || ' via ' || h.method
					|| ' since ' || to_char(h.updated_at, 'YYYY-MM-DD HH24:MI TZ') || '.'
					as summary,
				'Handovers' as category,
				h.updated_at as signal_at
			from handovers h
			join businesses b on b.business_id = h.business_id
			where h.status in ('pending', 'dispatched')
				and h.updated_at <= now() - interval '24 hours'
		)
		select
			s.ticket_key,
			s.business_id::text,
			s.subject,
			s.business_name,
			s.priority,
			s.summary,
			s.category,
			coalesce(st.status, 'open') as status,
			coalesce(st.assigned_admin_user_id::text, ''),
			coalesce(assigned.email, ''),
			coalesce(assigned.display_name, ''),
			s.signal_at as created_at,
			coalesce(st.updated_at, s.signal_at, now()) as updated_at
		from signals s
		left join admin_support_ticket_states st on st.ticket_key = s.ticket_key
		left join admin_users assigned on assigned.admin_user_id = st.assigned_admin_user_id
		where ($1::text = '' or s.ticket_key = $1)
		order by
			case coalesce(st.status, 'open')
				when 'open' then 1
				else 2
			end,
			case s.priority
				when 'urgent' then 1
				else 2
			end,
			coalesce(st.updated_at, s.signal_at, now()) desc,
			s.business_name
		limit 100
	`, ticketKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminSupportTicketRecord{}
	for rows.Next() {
		record, err := scanAdminSupportTicketRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return records, nil
}

func scanAdminSupportTicketRecord(row pgx.Row) (ports.AdminSupportTicketRecord, error) {
	var record ports.AdminSupportTicketRecord
	if err := row.Scan(
		&record.TicketKey,
		&record.BusinessID,
		&record.Subject,
		&record.BusinessName,
		&record.Priority,
		&record.Summary,
		&record.Category,
		&record.Status,
		&record.AssignedAdminUserID,
		&record.AssignedAdminEmail,
		&record.AssignedAdminName,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}
	return record, nil
}
