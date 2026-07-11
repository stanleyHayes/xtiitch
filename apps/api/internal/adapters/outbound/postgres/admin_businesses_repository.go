package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminBusinesses(ctx context.Context) ([]ports.AdminBusinessRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		with order_stats as (
			select
				business_id,
				count(*)::int as orders_count,
				max(updated_at) as last_order_at
			from orders
			group by business_id
		),
		money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as gmv_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				max(updated_at) filter (where status = 'succeeded') as last_payment_at
			from payments
			group by business_id
		)
		select
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.display_name, ''),
			coalesce(owner.email, ''),
			p.name,
			p.code,
			b.verification_status,
			b.operational_status,
			coalesce(b.settlement_provider_subaccount, ''),
			coalesce(os.orders_count, 0),
			coalesce(ms.gmv_minor, 0),
			coalesce(ms.commission_minor, 0),
			greatest(
				b.updated_at,
				coalesce(os.last_order_at, b.updated_at),
				coalesce(ms.last_payment_at, b.updated_at)
			) as last_active_at,
			b.created_at,
			b.updated_at,
			coalesce(b.suspension_reason, ''),
			coalesce(b.suspended_at, b.updated_at),
			coalesce(b.suspended_by_admin_user_id::text, '')
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join order_stats os on os.business_id = b.business_id
		left join money_stats ms on ms.business_id = b.business_id
		left join lateral (
			select u.display_name, u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		order by
			case b.operational_status
				when 'suspended' then 1
				else 2
			end,
			last_active_at desc,
			b.created_at desc
		limit 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminBusinessRecord{}
	for rows.Next() {
		record, err := scanAdminBusinessRecord(rows)
		if err != nil {
			return nil, err
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

func (repo AdminAuthRepository) UpdateAdminBusinessStatus(
	ctx context.Context,
	input ports.UpdateAdminBusinessStatusInput,
) (ports.AdminBusinessRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminBusinessRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminBusinessRecord{}, err
	}

	record, err := scanAdminBusinessRecord(tx.QueryRow(ctx, `
		with updated as (
			update businesses
			set operational_status = $2,
				suspension_reason = case when $2 = 'suspended' then $3 else '' end,
				suspended_at = case when $2 = 'suspended' then now() else null end,
				suspended_by_admin_user_id = case when $2 = 'suspended' then $4::uuid else null end,
				updated_at = now()
			where business_id = $1
			returning *
		),
		order_stats as (
			select
				business_id,
				count(*)::int as orders_count,
				max(updated_at) as last_order_at
			from orders
			where business_id = $1
			group by business_id
		),
		money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as gmv_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				max(updated_at) filter (where status = 'succeeded') as last_payment_at
			from payments
			where business_id = $1
			group by business_id
		)
		select
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.display_name, ''),
			coalesce(owner.email, ''),
			p.name,
			p.code,
			b.verification_status,
			b.operational_status,
			coalesce(b.settlement_provider_subaccount, ''),
			coalesce(os.orders_count, 0),
			coalesce(ms.gmv_minor, 0),
			coalesce(ms.commission_minor, 0),
			greatest(
				b.updated_at,
				coalesce(os.last_order_at, b.updated_at),
				coalesce(ms.last_payment_at, b.updated_at)
			) as last_active_at,
			b.created_at,
			b.updated_at,
			coalesce(b.suspension_reason, ''),
			coalesce(b.suspended_at, b.updated_at),
			coalesce(b.suspended_by_admin_user_id::text, '')
		from updated b
		join plans p on p.plan_id = b.plan_id
		left join order_stats os on os.business_id = b.business_id
		left join money_stats ms on ms.business_id = b.business_id
		left join lateral (
			select u.display_name, u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
	`, input.BusinessID.String(),
		string(input.OperationalStatus),
		input.SuspensionReason,
		input.SuspendedByAdminUser.String(),
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminBusinessRecord{}, ErrNotFound
		}
		return ports.AdminBusinessRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminBusinessRecord{}, err
	}

	return record, nil
}

func scanAdminBusinessRecord(row pgx.Row) (ports.AdminBusinessRecord, error) {
	var record ports.AdminBusinessRecord
	var verificationStatus string
	var operationalStatus string
	var suspendedAt time.Time
	var suspendedByAdminUserID string
	if err := row.Scan(
		&record.BusinessID,
		&record.Name,
		&record.Handle,
		&record.OwnerName,
		&record.OwnerEmail,
		&record.PlanName,
		&record.PlanCode,
		&verificationStatus,
		&operationalStatus,
		&record.SettlementSubaccount,
		&record.OrdersCount,
		&record.GMVMinor,
		&record.CommissionMinor,
		&record.LastActiveAt,
		&record.CreatedAt,
		&record.UpdatedAt,
		&record.SuspensionReason,
		&suspendedAt,
		&suspendedByAdminUserID,
	); err != nil {
		return ports.AdminBusinessRecord{}, err
	}
	record.VerificationStatus = business.VerificationStatus(verificationStatus)
	record.OperationalStatus = business.OperationalStatus(operationalStatus)
	if record.OperationalStatus == business.OperationalStatusSuspended {
		record.SuspendedAt = &suspendedAt
		record.SuspendedByAdminUser = common.ID(suspendedByAdminUserID)
	}

	return record, nil
}
