package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminAuthRepository struct {
	pool *pgxpool.Pool
}

func NewAdminAuthRepository(pool *pgxpool.Pool) AdminAuthRepository {
	return AdminAuthRepository{pool: pool}
}

func (repo AdminAuthRepository) EnsureBootstrapUser(ctx context.Context, input ports.CreateAdminUserInput) (ports.AdminUserRecord, error) {
	existing, err := repo.findRecordByEmail(ctx, input.Email)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return ports.AdminUserRecord{}, err
	}

	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		insert into admin_users (
			admin_user_id,
			email,
			display_name,
			password_hash,
			role,
			is_active
		)
		values ($1, $2, $3, $4, $5, true)
		returning
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), input.Email, input.DisplayName, input.PasswordHash, string(input.Role)))
	if err == nil {
		return user, nil
	}
	if adminEmailTaken(err) {
		return repo.findRecordByEmail(ctx, input.Email)
	}

	return ports.AdminUserRecord{}, err
}

func (repo AdminAuthRepository) FindByEmail(ctx context.Context, email string) (ports.AdminUserCredentials, error) {
	var user ports.AdminUserCredentials
	var role string
	if err := repo.pool.QueryRow(ctx, `
		select
			admin_user_id::text,
			email,
			display_name,
			password_hash,
			role,
			is_active
		from admin_users
		where lower(email) = lower($1)
		limit 1
	`, email).Scan(
		&user.UserID,
		&user.Email,
		&user.DisplayName,
		&user.PasswordHash,
		&role,
		&user.IsActive,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserCredentials{}, ErrNotFound
		}
		return ports.AdminUserCredentials{}, err
	}
	user.Role = admindomain.Role(role)

	return user, nil
}

func (repo AdminAuthRepository) FindByID(ctx context.Context, userID common.ID) (ports.AdminUserRecord, error) {
	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		select
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
		from admin_users
		where admin_user_id = $1
		limit 1
	`, userID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserRecord{}, ErrNotFound
		}
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (repo AdminAuthRepository) RecordLogin(ctx context.Context, userID common.ID) error {
	_, err := repo.pool.Exec(ctx, `
		update admin_users
		set last_login_at = now(), updated_at = now()
		where admin_user_id = $1
	`, userID.String())
	return err
}

func (repo AdminAuthRepository) ListAdminUsers(ctx context.Context) ([]ports.AdminUserRecord, error) {
	rows, err := repo.pool.Query(ctx, `
		select
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
		from admin_users
		order by
			case role
				when 'owner' then 1
				when 'operator' then 2
				else 3
			end,
			lower(display_name),
			created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []ports.AdminUserRecord
	for rows.Next() {
		user, err := scanAdminUserRecord(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

func (repo AdminAuthRepository) CreateAdminUser(ctx context.Context, input ports.CreateAdminUserInput) (ports.AdminUserRecord, error) {
	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		insert into admin_users (
			admin_user_id,
			email,
			display_name,
			password_hash,
			role,
			is_active
		)
		values ($1, $2, $3, $4, $5, true)
		returning
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), input.Email, input.DisplayName, input.PasswordHash, string(input.Role)))
	if err != nil {
		if adminEmailTaken(err) {
			return ports.AdminUserRecord{}, admindomain.ErrUserEmailTaken
		}
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (repo AdminAuthRepository) UpdateAdminUser(ctx context.Context, input ports.UpdateAdminUserInput) (ports.AdminUserRecord, error) {
	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		update admin_users
		set display_name = $2,
			role = $3,
			is_active = $4,
			updated_at = now()
		where admin_user_id = $1
		returning
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), input.DisplayName, string(input.Role), input.IsActive))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserRecord{}, ErrNotFound
		}
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (repo AdminAuthRepository) UpdateAdminProfile(ctx context.Context, input ports.UpdateAdminProfileInput) (ports.AdminUserRecord, error) {
	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		update admin_users
		set email = $2,
			display_name = $3,
			updated_at = now()
		where admin_user_id = $1
		returning
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), input.Email, input.DisplayName))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserRecord{}, ErrNotFound
		}
		if adminEmailTaken(err) {
			return ports.AdminUserRecord{}, admindomain.ErrUserEmailTaken
		}
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (repo AdminAuthRepository) ListAdminRolePermissions(ctx context.Context) ([]ports.AdminRolePermissionsRecord, error) {
	rows, err := repo.pool.Query(ctx, `
		select role, permission
		from admin_role_permissions
		order by
			case role
				when 'owner' then 1
				when 'operator' then 2
				else 3
			end,
			array_position(array[
				'manage_admin_users',
				'manage_roles',
				'manage_settings',
				'review_businesses',
				'manage_money_rails',
				'manage_subscriptions',
				'manage_plans',
				'manage_promotions',
				'manage_ads',
				'manage_growth',
				'manage_risk',
				'manage_support',
				'view_audit'
			]::text[], permission)
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byRole := make(map[admindomain.Role][]admindomain.Permission, len(admindomain.RoleCatalog()))
	for _, role := range admindomain.RoleCatalog() {
		byRole[role] = nil
	}

	for rows.Next() {
		var role string
		var permission string
		if err := rows.Scan(&role, &permission); err != nil {
			return nil, err
		}
		byRole[admindomain.Role(role)] = append(
			byRole[admindomain.Role(role)],
			admindomain.Permission(permission),
		)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	records := make([]ports.AdminRolePermissionsRecord, 0, len(admindomain.RoleCatalog()))
	for _, role := range admindomain.RoleCatalog() {
		records = append(records, ports.AdminRolePermissionsRecord{
			Role:        role,
			Permissions: byRole[role],
		})
	}

	return records, nil
}

func (repo AdminAuthRepository) ReplaceAdminRolePermissions(
	ctx context.Context,
	input ports.UpdateAdminRolePermissionsInput,
) (ports.AdminRolePermissionsRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, `
		delete from admin_role_permissions
		where role = $1
	`, string(input.Role)); err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}

	for _, permission := range input.Permissions {
		if _, err := tx.Exec(ctx, `
			insert into admin_role_permissions (role, permission)
			values ($1, $2)
		`, string(input.Role), string(permission)); err != nil {
			return ports.AdminRolePermissionsRecord{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}

	return ports.AdminRolePermissionsRecord{
		Role:        input.Role,
		Permissions: input.Permissions,
	}, nil
}

func (repo AdminAuthRepository) GetAdminPreferences(ctx context.Context, userID common.ID) (ports.AdminPreferencesRecord, error) {
	if _, err := repo.pool.Exec(ctx, `
		insert into admin_operator_preferences (admin_user_id)
		values ($1)
		on conflict (admin_user_id) do nothing
	`, userID.String()); err != nil {
		return ports.AdminPreferencesRecord{}, err
	}

	preferences, err := scanAdminPreferencesRecord(repo.pool.QueryRow(ctx, `
		select
			admin_user_id::text,
			timezone,
			phone_number,
			notify_email,
			notify_sms,
			alert_verifications,
			alert_money_rails,
			alert_subscriptions,
			alert_promotions,
			alert_risk,
			alert_support,
			daily_digest_time,
			created_at,
			updated_at
		from admin_operator_preferences
		where admin_user_id = $1
		limit 1
	`, userID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPreferencesRecord{}, ErrNotFound
		}
		return ports.AdminPreferencesRecord{}, err
	}

	return preferences, nil
}

func (repo AdminAuthRepository) UpdateAdminPreferences(
	ctx context.Context,
	input ports.UpdateAdminPreferencesInput,
) (ports.AdminPreferencesRecord, error) {
	preferences, err := scanAdminPreferencesRecord(repo.pool.QueryRow(ctx, `
		insert into admin_operator_preferences (
			admin_user_id,
			timezone,
			phone_number,
			notify_email,
			notify_sms,
			alert_verifications,
			alert_money_rails,
			alert_subscriptions,
			alert_promotions,
			alert_risk,
			alert_support,
			daily_digest_time
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		on conflict (admin_user_id) do update
		set timezone = excluded.timezone,
			phone_number = excluded.phone_number,
			notify_email = excluded.notify_email,
			notify_sms = excluded.notify_sms,
			alert_verifications = excluded.alert_verifications,
			alert_money_rails = excluded.alert_money_rails,
			alert_subscriptions = excluded.alert_subscriptions,
			alert_promotions = excluded.alert_promotions,
			alert_risk = excluded.alert_risk,
			alert_support = excluded.alert_support,
			daily_digest_time = excluded.daily_digest_time,
			updated_at = now()
		returning
			admin_user_id::text,
			timezone,
			phone_number,
			notify_email,
			notify_sms,
			alert_verifications,
			alert_money_rails,
			alert_subscriptions,
			alert_promotions,
			alert_risk,
			alert_support,
			daily_digest_time,
			created_at,
			updated_at
	`, input.UserID.String(),
		input.Timezone,
		input.PhoneNumber,
		input.NotifyEmail,
		input.NotifySMS,
		input.AlertVerifications,
		input.AlertMoneyRails,
		input.AlertSubscriptions,
		input.AlertPromotions,
		input.AlertRisk,
		input.AlertSupport,
		input.DailyDigestTime,
	))
	if err != nil {
		return ports.AdminPreferencesRecord{}, err
	}

	return preferences, nil
}

func (repo AdminAuthRepository) GetAdminPlatformSettings(ctx context.Context) (ports.AdminPlatformSettingsRecord, error) {
	if _, err := repo.pool.Exec(ctx, `
		insert into admin_platform_settings (settings_id)
		values (true)
		on conflict (settings_id) do nothing
	`); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	settings, err := scanAdminPlatformSettingsRecord(repo.pool.QueryRow(ctx, `
		select
			platform_name,
			support_email,
			verification_sla_hours,
			payout_review_threshold_pesewas,
			maintenance_mode,
			updated_at
		from admin_platform_settings
		where settings_id = true
		limit 1
	`))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPlatformSettingsRecord{}, ErrNotFound
		}
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

func (repo AdminAuthRepository) UpdateAdminPlatformSettings(
	ctx context.Context,
	input ports.UpdateAdminPlatformSettingsInput,
) (ports.AdminPlatformSettingsRecord, error) {
	settings, err := scanAdminPlatformSettingsRecord(repo.pool.QueryRow(ctx, `
		insert into admin_platform_settings (
			settings_id,
			platform_name,
			support_email,
			verification_sla_hours,
			payout_review_threshold_pesewas,
			maintenance_mode
		)
		values (true, $1, $2, $3, $4, $5)
		on conflict (settings_id) do update
		set platform_name = excluded.platform_name,
			support_email = excluded.support_email,
			verification_sla_hours = excluded.verification_sla_hours,
			payout_review_threshold_pesewas = excluded.payout_review_threshold_pesewas,
			maintenance_mode = excluded.maintenance_mode,
			updated_at = now()
		returning
			platform_name,
			support_email,
			verification_sla_hours,
			payout_review_threshold_pesewas,
			maintenance_mode,
			updated_at
	`, input.PlatformName,
		input.SupportEmail,
		input.VerificationSLAHours,
		input.PayoutReviewThresholdPesewas,
		input.MaintenanceMode,
	))
	if err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

func (repo AdminAuthRepository) CreateAdminAuditEvent(
	ctx context.Context,
	input ports.CreateAdminAuditEventInput,
) (ports.AdminAuditEventRecord, error) {
	metadata, err := json.Marshal(input.Metadata)
	if err != nil {
		return ports.AdminAuditEventRecord{}, err
	}

	record, err := scanAdminAuditEventRecord(repo.pool.QueryRow(ctx, `
		insert into admin_audit_events (
			audit_event_id,
			actor_admin_user_id,
			actor_email,
			actor_role,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata,
			ip_address,
			user_agent
		)
		select
			$1,
			u.admin_user_id,
			u.email,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10::jsonb,
			$11,
			$12
		from admin_users u
		where u.admin_user_id = $2
		returning
			audit_event_id::text,
			coalesce(actor_admin_user_id::text, ''),
			actor_email,
			actor_role,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata,
			ip_address,
			user_agent,
			created_at
	`, input.AuditEventID.String(),
		input.ActorUserID.String(),
		string(input.ActorRole),
		input.Action,
		input.TargetType,
		input.TargetID,
		input.TargetLabel,
		input.Summary,
		string(input.Severity),
		string(metadata),
		input.IPAddress,
		input.UserAgent,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAuditEventRecord{}, ErrNotFound
		}
		return ports.AdminAuditEventRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminAuditEvents(
	ctx context.Context,
	input ports.ListAdminAuditEventsInput,
) ([]ports.AdminAuditEventRecord, error) {
	limit := input.Limit
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	query := `
		select
			audit_event_id::text,
			coalesce(actor_admin_user_id::text, ''),
			actor_email,
			actor_role,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata,
			ip_address,
			user_agent,
			created_at
		from admin_audit_events
	`
	args := []any{limit}
	if input.Severity.Valid() {
		query += " where severity = $2"
		args = append(args, string(input.Severity))
	}
	query += " order by created_at desc limit $1"

	rows, err := repo.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []ports.AdminAuditEventRecord
	for rows.Next() {
		record, err := scanAdminAuditEventRecord(rows)
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

func (repo AdminAuthRepository) ListAdminVerificationCases(ctx context.Context) ([]ports.AdminVerificationCaseRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.display_name, ''),
			coalesce(owner.email, ''),
			p.name,
			p.code,
			b.verification_status,
			coalesce(b.settlement_provider, ''),
			coalesce(b.settlement_provider_subaccount, ''),
			coalesce(b.settlement_mobile_money_number, ''),
			b.created_at,
			b.updated_at
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join lateral (
			select u.display_name, u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		order by
			case b.verification_status
				when 'pending' then 1
				when 'unverified' then 2
				when 'rejected' then 3
				else 4
			end,
			b.updated_at desc,
			b.created_at desc
		limit 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminVerificationCaseRecord{}
	for rows.Next() {
		record, err := scanAdminVerificationCaseRecord(rows)
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

func (repo AdminAuthRepository) DecideAdminBusinessVerification(
	ctx context.Context,
	input ports.AdminBusinessVerificationDecisionInput,
) (ports.AdminVerificationCaseRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	record, err := scanAdminVerificationCaseRecord(tx.QueryRow(ctx, `
		with updated as (
			update businesses
			set verification_status = $2,
				updated_at = now()
			where business_id = $1
			returning *
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
			coalesce(b.settlement_provider, ''),
			coalesce(b.settlement_provider_subaccount, ''),
			coalesce(b.settlement_mobile_money_number, ''),
			b.created_at,
			b.updated_at
		from updated b
		join plans p on p.plan_id = b.plan_id
		left join lateral (
			select u.display_name, u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
	`, input.BusinessID.String(), string(input.Status)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminVerificationCaseRecord{}, ErrNotFound
		}
		return ports.AdminVerificationCaseRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	return record, nil
}

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
				max(updated_at) as last_payment_at
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
				max(updated_at) as last_payment_at
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

func (repo AdminAuthRepository) GetAdminPlatformMetrics(ctx context.Context) (ports.AdminPlatformMetricsRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}

	var record ports.AdminPlatformMetricsRecord
	if err := tx.QueryRow(ctx, `
		with business_stats as (
			select
				count(*)::int as total_businesses,
				count(*) filter (where operational_status = 'active')::int as active_businesses,
				count(*) filter (where operational_status = 'suspended')::int as suspended_businesses,
				count(*) filter (
					where operational_status = 'active'
						and verification_status in ('unverified', 'pending')
				)::int as pending_verifications
			from businesses
		),
		payment_stats as (
			select
				coalesce(sum(amount_minor) filter (
					where status = 'succeeded'
						and created_at >= date_trunc('month', now())
				), 0)::bigint as gmv_month_minor,
				coalesce(sum(commission_minor) filter (
					where status = 'succeeded'
						and created_at >= date_trunc('month', now())
				), 0)::bigint as platform_revenue_month_minor,
				count(*) filter (
					where status in ('succeeded', 'failed')
						and created_at >= now() - interval '30 days'
				)::int as total_payments_30d,
				count(*) filter (
					where status = 'failed'
						and created_at >= now() - interval '30 days'
				)::int as failed_payments_30d
			from payments
		)
		select
			p.gmv_month_minor,
			p.platform_revenue_month_minor,
			b.active_businesses,
			b.total_businesses,
			b.pending_verifications,
			b.suspended_businesses,
			case
				when p.total_payments_30d = 0 then 10000
				else round(((p.total_payments_30d - p.failed_payments_30d)::numeric / p.total_payments_30d::numeric) * 10000)::int
			end as payment_health_bps,
			p.failed_payments_30d,
			p.total_payments_30d,
			now()
		from business_stats b
		cross join payment_stats p
	`).Scan(
		&record.GMVMonthMinor,
		&record.PlatformRevenueMonthMinor,
		&record.ActiveBusinesses,
		&record.TotalBusinesses,
		&record.PendingVerifications,
		&record.SuspendedBusinesses,
		&record.PaymentHealthBPS,
		&record.FailedPayments30d,
		&record.TotalPayments30d,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) GetAdminMoneyRails(ctx context.Context) (ports.AdminMoneyRailsRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}

	webhookRows, err := tx.Query(ctx, `
		with event_attempts as (
			select
				provider_reference,
				count(*)::int as attempts,
				max(processed_at) as received_at,
				max(event_type) as event_type
			from payment_provider_events
			group by provider_reference
		)
		select
			coalesce(p.payment_id::text, 'provider-' || md5(e.provider_reference)) as id,
			e.provider_reference,
			coalesce(b.name, 'Unmatched provider event') as business_name,
			case
				when r.created_at is not null then 'replayed'
				when p.status = 'reversed' then 'reversed'
				when p.status = 'succeeded' and e.attempts > 1 then 'replayed'
				when p.status = 'succeeded' then 'verified'
				else 'failed'
			end as status,
			coalesce(p.purpose, e.event_type, 'unknown') as purpose,
			coalesce(p.amount_minor, 0)::bigint as amount_minor,
			e.attempts,
			e.received_at,
			case
				when r.created_at is not null then 'Operator replay request queued: ' || r.reason
				when p.payment_id is null then 'Provider event did not map to a payment record.'
				when p.status = 'reversed' then 'Payment was reversed after refund or dispute review.'
				when p.status = 'succeeded' and e.attempts > 1 then 'Multiple provider deliveries reconciled safely against the payment ledger.'
				when p.status = 'succeeded' then 'Signature verified and payment marked succeeded.'
				when p.status = 'failed' then 'Signature verified and payment marked failed.'
				else 'Provider event is recorded; payment remains under review.'
			end as note
		from event_attempts e
		left join payments p on p.provider_reference = e.provider_reference
		left join businesses b on b.business_id = p.business_id
		left join lateral (
			select reason, created_at
			from admin_money_replay_requests r
			where r.provider_reference = e.provider_reference
				and r.status = 'queued'
			order by r.created_at desc
			limit 1
		) r on true
		order by e.received_at desc
		limit 50
	`)
	if err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	defer webhookRows.Close()

	record := ports.AdminMoneyRailsRecord{
		WebhookEvents: []ports.AdminMoneyWebhookEventRecord{},
		PayoutReviews: []ports.AdminMoneyPayoutReviewRecord{},
		UpdatedAt:     time.Now().UTC(),
	}
	for webhookRows.Next() {
		var event ports.AdminMoneyWebhookEventRecord
		if err := webhookRows.Scan(
			&event.ID,
			&event.ProviderReference,
			&event.BusinessName,
			&event.Status,
			&event.Purpose,
			&event.AmountMinor,
			&event.Attempts,
			&event.ReceivedAt,
			&event.Note,
		); err != nil {
			return ports.AdminMoneyRailsRecord{}, err
		}
		record.WebhookEvents = append(record.WebhookEvents, event)
	}
	if err := webhookRows.Err(); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	webhookRows.Close()

	payoutRows, err := tx.Query(ctx, `
		with money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as succeeded_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				count(*) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				)::int as failed_30d,
				count(*) filter (where status = 'initiated')::int as initiated_count,
				max(updated_at) as last_payment_at
			from payments
			group by business_id
		)
		select
			b.business_id::text,
			b.name,
			coalesce(b.settlement_provider_subaccount, ''),
			case
				when coalesce(h.is_active, false) then 'blocked'
				when b.operational_status = 'suspended'
					or b.verification_status = 'rejected' then 'blocked'
				when coalesce(b.settlement_provider_subaccount, '') = ''
					or b.verification_status <> 'verified'
					or coalesce(ms.failed_30d, 0) > 0
					or coalesce(ms.initiated_count, 0) > 0 then 'review'
				else 'ready'
			end as status,
			greatest(coalesce(ms.succeeded_minor, 0) - coalesce(ms.commission_minor, 0), 0)::bigint as settlement_minor,
			coalesce(ms.commission_minor, 0)::bigint as commission_minor,
			case
				when coalesce(h.is_active, false) then 'Operator settlement review hold: ' || h.reason
				when b.operational_status = 'suspended' then 'Keep settlement on hold while the business is suspended.'
				when b.verification_status = 'rejected' then 'Do not enable settlement until business verification is restored.'
				when coalesce(b.settlement_provider_subaccount, '') = '' then 'Connect and verify the Paystack subaccount before settlement.'
				when b.verification_status <> 'verified' then 'Wait for business verification before enabling payment settlement.'
				when coalesce(ms.failed_30d, 0) > 0 then 'Review failed payments before account or payout changes.'
				when coalesce(ms.initiated_count, 0) > 0 then 'Watch pending payments until provider confirmation arrives.'
				else 'No action needed; split settlement is healthy.'
			end as next_action,
			coalesce(h.is_active, false) as hold_active,
			coalesce(h.reason, '') as hold_reason,
			coalesce(h.updated_at, b.updated_at) as hold_updated_at
		from businesses b
		left join money_stats ms on ms.business_id = b.business_id
		left join admin_settlement_review_holds h on h.business_id = b.business_id and h.is_active
		where
			coalesce(b.settlement_provider_subaccount, '') <> ''
			or b.verification_status = 'verified'
			or b.operational_status = 'suspended'
			or coalesce(h.is_active, false)
			or coalesce(ms.succeeded_minor, 0) > 0
			or coalesce(ms.failed_30d, 0) > 0
			or coalesce(ms.initiated_count, 0) > 0
		order by
			case
				when coalesce(h.is_active, false) then 1
				when b.operational_status = 'suspended'
					or b.verification_status = 'rejected' then 1
				when coalesce(b.settlement_provider_subaccount, '') = ''
					or b.verification_status <> 'verified'
					or coalesce(ms.failed_30d, 0) > 0
					or coalesce(ms.initiated_count, 0) > 0 then 2
				else 3
			end,
			coalesce(ms.last_payment_at, b.updated_at) desc,
			b.created_at desc
		limit 100
	`)
	if err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	defer payoutRows.Close()

	for payoutRows.Next() {
		var review ports.AdminMoneyPayoutReviewRecord
		var holdUpdatedAt time.Time
		if err := payoutRows.Scan(
			&review.ID,
			&review.BusinessName,
			&review.SubaccountRef,
			&review.Status,
			&review.SettlementMinor,
			&review.CommissionMinor,
			&review.NextAction,
			&review.HoldActive,
			&review.HoldReason,
			&holdUpdatedAt,
		); err != nil {
			return ports.AdminMoneyRailsRecord{}, err
		}
		if review.HoldActive {
			review.HoldUpdatedAt = &holdUpdatedAt
		}
		record.PayoutReviews = append(record.PayoutReviews, review)
	}
	if err := payoutRows.Err(); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminSubscriptions(ctx context.Context) ([]ports.AdminSubscriptionRecord, error) {
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
				count(*)::int as orders_count
			from orders
			group by business_id
		),
		design_stats as (
			select
				business_id,
				count(*)::int as design_count
			from designs
			where status = 'active'
			group by business_id
		),
		money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as gmv_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor
			from payments
			group by business_id
		)
		select
			coalesce(s.subscription_id::text, '') as subscription_id,
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.email, ''),
			coalesce(sp.code, p.code),
			coalesce(sp.name, p.name),
			coalesce(sp.monthly_fee_minor, p.monthly_fee_minor)::bigint,
			coalesce(sp.commission_bps, p.commission_bps)::int,
			coalesce(sp.design_limit, p.design_limit),
			coalesce(
				s.status,
				case when p.monthly_fee_minor = 0 then 'active' else 'trialing' end
			),
			coalesce(s.billing_mode, 'manual'),
			coalesce(s.provider, 'manual'),
			coalesce(s.provider_customer_ref, ''),
			coalesce(s.provider_subscription_ref, ''),
			coalesce(s.current_period_start, b.created_at),
			coalesce(
				s.current_period_end,
				greatest(b.created_at + interval '1 month', now() + interval '1 day')
			),
			s.trial_ends_at,
			s.grace_ends_at,
			coalesce(s.cancel_at_period_end, false),
			s.canceled_at,
			coalesce(s.failed_payment_count, 0),
			coalesce(s.last_invoice_ref, ''),
			s.last_payment_at,
			s.next_billing_at,
			coalesce(ds.design_count, 0),
			coalesce(os.orders_count, 0),
			coalesce(ms.gmv_minor, 0),
			coalesce(ms.commission_minor, 0),
			coalesce(s.updated_at, b.updated_at)
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join business_subscriptions s on s.business_id = b.business_id
		left join plans sp on sp.plan_id = s.plan_id
		left join design_stats ds on ds.business_id = b.business_id
		left join order_stats os on os.business_id = b.business_id
		left join money_stats ms on ms.business_id = b.business_id
		left join lateral (
			select u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		order by
			case
				when coalesce(s.status, '') in ('past_due', 'grace_period') then 1
				when coalesce(s.status, '') = 'cancel_at_period_end' then 2
				when p.monthly_fee_minor > 0 then 3
				else 4
			end,
			coalesce(s.updated_at, b.updated_at) desc,
			b.created_at desc
		limit 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminSubscriptionRecord{}
	for rows.Next() {
		record, err := scanAdminSubscriptionRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	eventsByBusiness, err := listAdminSubscriptionEvents(ctx, tx)
	if err != nil {
		return nil, err
	}
	invoicesByBusiness, err := listAdminSubscriptionInvoices(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].Events = eventsByBusiness[records[index].BusinessID]
		records[index].Invoices = invoicesByBusiness[records[index].BusinessID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) UpdateAdminSubscription(
	ctx context.Context,
	input ports.UpdateAdminSubscriptionInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_subscriptions (
			business_id,
			plan_id,
			status,
			billing_mode,
			provider,
			current_period_start,
			current_period_end,
			trial_ends_at,
			next_billing_at
		)
		select
			b.business_id,
			b.plan_id,
			case when p.monthly_fee_minor = 0 then 'active' else 'trialing' end,
			'manual',
			'manual',
			now(),
			now() + interval '1 month',
			case when p.monthly_fee_minor > 0 then now() + interval '14 days' end,
			case when p.monthly_fee_minor > 0 then now() + interval '14 days' end
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1::uuid
		on conflict (business_id) do nothing
	`, input.BusinessID.String()); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := scanAdminSubscriptionRecord(tx.QueryRow(ctx, `
		with free_plan as (
			select plan_id
			from plans
			where code = 'free' and is_active = true
			order by created_at
			limit 1
		),
		updated as (
			update business_subscriptions s
			set
				plan_id = case
					when $2 = 'canceled' then coalesce((select plan_id from free_plan), s.plan_id)
					else s.plan_id
				end,
				status = $2,
				billing_mode = $3,
				provider = case when $3 = 'manual' then 'manual' else 'paystack' end,
				provider_customer_ref = $4,
				provider_subscription_ref = $5,
				grace_ends_at = case
					when $2 = 'grace_period' then coalesce(s.grace_ends_at, now() + interval '7 days')
					else null
				end,
				cancel_at_period_end = ($2 = 'cancel_at_period_end'),
				canceled_at = case
					when $2 = 'canceled' then coalesce(s.canceled_at, now())
					else null
				end,
				failed_payment_count = case
					when $2 in ('past_due', 'grace_period') then greatest(s.failed_payment_count, 1)
					when $2 in ('active', 'trialing') then 0
					else s.failed_payment_count
				end,
				next_billing_at = case
					when $2 = 'canceled' then null
					when p.monthly_fee_minor = 0 then null
					else coalesce(s.next_billing_at, s.current_period_end)
				end,
				updated_at = now()
			from plans p
			where s.business_id = $1::uuid
				and p.plan_id = s.plan_id
			returning s.*
		),
		downgraded_business as (
			update businesses b
			set plan_id = s.plan_id, updated_at = now()
			from updated s
			where $2 = 'canceled'
				and b.business_id = s.business_id
			returning 1
		),
		order_stats as (
			select
				business_id,
				count(*)::int as orders_count
			from orders
			where business_id = $1::uuid
			group by business_id
		),
		design_stats as (
			select
				business_id,
				count(*)::int as design_count
			from designs
			where business_id = $1::uuid and status = 'active'
			group by business_id
		),
		money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as gmv_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor
			from payments
			where business_id = $1::uuid
			group by business_id
		)
		select
			s.subscription_id::text,
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.email, ''),
			p.code,
			p.name,
			p.monthly_fee_minor::bigint,
			p.commission_bps::int,
			p.design_limit,
			s.status,
			s.billing_mode,
			s.provider,
			s.provider_customer_ref,
			s.provider_subscription_ref,
			s.current_period_start,
			s.current_period_end,
			s.trial_ends_at,
			s.grace_ends_at,
			s.cancel_at_period_end,
			s.canceled_at,
			s.failed_payment_count,
			s.last_invoice_ref,
			s.last_payment_at,
			s.next_billing_at,
			coalesce(ds.design_count, 0),
			coalesce(os.orders_count, 0),
			coalesce(ms.gmv_minor, 0),
			coalesce(ms.commission_minor, 0),
			s.updated_at
		from updated s
		join businesses b on b.business_id = s.business_id
		join plans p on p.plan_id = s.plan_id
		left join design_stats ds on ds.business_id = b.business_id
		left join order_stats os on os.business_id = b.business_id
		left join money_stats ms on ms.business_id = b.business_id
		left join lateral (
			select u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
	`, input.BusinessID.String(),
		input.Status,
		input.BillingMode,
		input.ProviderCustomerRef,
		input.ProviderSubscriptionRef,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_subscription_events (
			subscription_id,
			business_id,
			actor_admin_user_id,
			event_type,
			summary,
			metadata
		)
		values (
			$1::uuid,
			$2::uuid,
			$3::uuid,
			$4,
			$5,
			jsonb_build_object(
				'status', $6::text,
				'billing_mode', $7::text,
				'provider_customer_ref', $8::text,
				'provider_subscription_ref', $9::text,
				'reason', $10::text
			)
		)
	`, record.SubscriptionID.String(),
		record.BusinessID.String(),
		input.ActorAdminUser.String(),
		"subscription."+input.Status,
		input.Reason,
		input.Status,
		input.BillingMode,
		input.ProviderCustomerRef,
		input.ProviderSubscriptionRef,
		input.Reason,
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	eventsByBusiness, err := listAdminSubscriptionEvents(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	invoicesByBusiness, err := listAdminSubscriptionInvoices(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	record.Events = eventsByBusiness[record.BusinessID]
	record.Invoices = invoicesByBusiness[record.BusinessID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) IssueAdminSubscriptionInvoice(
	ctx context.Context,
	input ports.IssueAdminSubscriptionInvoiceInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := ensureAdminSubscription(ctx, tx, input.BusinessID); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	var businessID common.ID
	var subscriptionID common.ID
	if err := tx.QueryRow(ctx, `
		with candidate as (
			select
				s.subscription_id,
				s.business_id,
				s.plan_id,
				s.billing_mode,
				s.current_period_end,
				p.monthly_fee_minor
			from business_subscriptions s
			join plans p on p.plan_id = s.plan_id
			where s.business_id = $2::uuid
				and s.status <> 'canceled'
				and p.monthly_fee_minor > 0
		),
		inserted as (
			insert into business_subscription_invoices (
				invoice_id,
				subscription_id,
				business_id,
				plan_id,
				invoice_ref,
				status,
				billing_mode,
				provider,
				provider_invoice_ref,
				payment_url,
				amount_minor,
				currency,
				period_start,
				period_end,
				due_at,
				issued_by_admin_user_id
			)
			select
				$1::uuid,
				c.subscription_id,
				c.business_id,
				c.plan_id,
				$3,
				'issued',
				c.billing_mode,
				case when c.billing_mode = 'manual' then 'manual' else 'paystack' end,
				$4,
				$5,
				c.monthly_fee_minor,
				'GHS',
				greatest(c.current_period_end, now()),
				greatest(c.current_period_end, now()) + interval '1 month',
				$6,
				$7::uuid
			from candidate c
			returning subscription_id, business_id, invoice_ref, provider
		),
		updated as (
			update business_subscriptions s
			set
				last_invoice_ref = i.invoice_ref,
				next_billing_at = $6,
				provider = i.provider,
				updated_at = now()
			from inserted i
			where s.subscription_id = i.subscription_id
			returning s.business_id, s.subscription_id
		)
		select business_id::text, subscription_id::text from updated
	`, input.InvoiceID.String(),
		input.BusinessID.String(),
		input.InvoiceRef,
		input.ProviderInvoiceRef,
		input.PaymentURL,
		input.DueAt,
		input.ActorAdminUser.String(),
	).Scan(&businessID, &subscriptionID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ports.ErrSubscriptionBillingUnavailable
		}
		if subscriptionInvoiceOpen(err) {
			return ports.AdminSubscriptionRecord{}, ports.ErrSubscriptionInvoiceOpen
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := insertAdminSubscriptionEvent(ctx, tx, subscriptionID, businessID, input.ActorAdminUser,
		"subscription.invoice_issued",
		input.Reason,
		map[string]string{
			"invoice_id":           input.InvoiceID.String(),
			"invoice_ref":          input.InvoiceRef,
			"provider_invoice_ref": input.ProviderInvoiceRef,
			"payment_url":          input.PaymentURL,
			"due_at":               input.DueAt.Format(time.RFC3339),
		},
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := getAdminSubscriptionRecordByBusiness(ctx, tx, businessID)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) MarkAdminSubscriptionInvoicePaid(
	ctx context.Context,
	input ports.MarkAdminSubscriptionInvoicePaidInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	var businessID common.ID
	var subscriptionID common.ID
	var invoiceRef string
	if err := tx.QueryRow(ctx, `
		with paid_invoice as (
			update business_subscription_invoices i
			set
				status = 'paid',
				paid_at = coalesce(i.paid_at, now()),
				failed_at = null,
				failure_reason = '',
				updated_at = now()
			where i.invoice_id = $1::uuid
				and i.status in ('issued', 'failed')
			returning i.*
		),
		updated as (
			update business_subscriptions s
			set
				status = 'active',
				failed_payment_count = 0,
				grace_ends_at = null,
				cancel_at_period_end = false,
				last_invoice_ref = i.invoice_ref,
				last_payment_at = now(),
				current_period_start = i.period_start,
				current_period_end = i.period_end,
				next_billing_at = i.period_end,
				billing_mode = i.billing_mode,
				provider = i.provider,
				updated_at = now()
			from paid_invoice i
			where s.subscription_id = i.subscription_id
			returning s.business_id, s.subscription_id, i.invoice_ref
		)
		select business_id::text, subscription_id::text, invoice_ref from updated
	`, input.InvoiceID.String()).Scan(&businessID, &subscriptionID, &invoiceRef); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ports.ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := insertAdminSubscriptionEvent(ctx, tx, subscriptionID, businessID, input.ActorAdminUser,
		"subscription.invoice_paid",
		input.Reason,
		map[string]string{
			"invoice_id":  input.InvoiceID.String(),
			"invoice_ref": invoiceRef,
		},
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := getAdminSubscriptionRecordByBusiness(ctx, tx, businessID)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) MarkAdminSubscriptionInvoiceFailed(
	ctx context.Context,
	input ports.MarkAdminSubscriptionInvoiceFailedInput,
) (ports.AdminSubscriptionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	var businessID common.ID
	var subscriptionID common.ID
	var invoiceRef string
	if err := tx.QueryRow(ctx, `
		with failed_invoice as (
			update business_subscription_invoices i
			set
				status = 'failed',
				failed_at = coalesce(i.failed_at, now()),
				failure_reason = $2,
				updated_at = now()
			where i.invoice_id = $1::uuid
				and i.status = 'issued'
			returning i.*
		),
		updated as (
			update business_subscriptions s
			set
				status = case
					when s.failed_payment_count + 1 >= 2 then 'grace_period'
					else 'past_due'
				end,
				failed_payment_count = s.failed_payment_count + 1,
				grace_ends_at = case
					when s.failed_payment_count + 1 >= 2 then coalesce(s.grace_ends_at, now() + interval '7 days')
					else null
				end,
				last_invoice_ref = i.invoice_ref,
				next_billing_at = now() + interval '1 day',
				billing_mode = i.billing_mode,
				provider = i.provider,
				updated_at = now()
			from failed_invoice i
			where s.subscription_id = i.subscription_id
			returning s.business_id, s.subscription_id, i.invoice_ref
		)
		select business_id::text, subscription_id::text, invoice_ref from updated
	`, input.InvoiceID.String(), input.Reason).Scan(&businessID, &subscriptionID, &invoiceRef); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ports.ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := insertAdminSubscriptionEvent(ctx, tx, subscriptionID, businessID, input.ActorAdminUser,
		"subscription.invoice_failed",
		input.Reason,
		map[string]string{
			"invoice_id":  input.InvoiceID.String(),
			"invoice_ref": invoiceRef,
			"reason":      input.Reason,
		},
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	record, err := getAdminSubscriptionRecordByBusiness(ctx, tx, businessID)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) RunAdminSubscriptionBillingSweep(
	ctx context.Context,
	input ports.RunAdminSubscriptionBillingSweepInput,
) (ports.AdminSubscriptionBillingSweepRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	var record ports.AdminSubscriptionBillingSweepRecord
	if err := tx.QueryRow(ctx, `
		with free_plan as (
			select plan_id
			from plans
			where code = 'free' and is_active = true
			order by created_at
			limit 1
		),
		failed_invoices as (
			update business_subscription_invoices i
			set
				status = 'failed',
				failed_at = coalesce(i.failed_at, now()),
				failure_reason = $2,
				updated_at = now()
			where i.status = 'issued'
				and i.due_at <= now()
			returning i.invoice_id, i.subscription_id, i.business_id, i.invoice_ref
		),
		failed_subscriptions as (
			update business_subscriptions s
			set
				status = case
					when s.failed_payment_count + 1 >= 2 then 'grace_period'
					else 'past_due'
				end,
				failed_payment_count = s.failed_payment_count + 1,
				grace_ends_at = case
					when s.failed_payment_count + 1 >= 2 then coalesce(s.grace_ends_at, now() + interval '7 days')
					else null
				end,
				last_invoice_ref = f.invoice_ref,
				next_billing_at = case
					when s.failed_payment_count + 1 >= 2 then coalesce(s.grace_ends_at, now() + interval '7 days')
					else now() + interval '1 day'
				end,
				updated_at = now()
			from failed_invoices f
			where s.subscription_id = f.subscription_id
			returning
				s.subscription_id,
				s.business_id,
				f.invoice_id,
				f.invoice_ref,
				s.status
		),
		failed_events as (
			insert into business_subscription_events (
				subscription_id,
				business_id,
				actor_admin_user_id,
				event_type,
				summary,
				metadata
			)
			select
				f.subscription_id,
				f.business_id,
				$1::uuid,
				'subscription.invoice_overdue',
				$2,
				jsonb_build_object(
					'invoice_id', f.invoice_id::text,
					'invoice_ref', f.invoice_ref,
					'status', f.status,
					'reason', $2::text
				)
			from failed_subscriptions f
			returning 1
		),
		canceled_subscriptions as (
			update business_subscriptions s
			set
				plan_id = coalesce((select plan_id from free_plan), s.plan_id),
				status = 'canceled',
				canceled_at = coalesce(s.canceled_at, now()),
				cancel_at_period_end = false,
				next_billing_at = null,
				updated_at = now()
			where s.status = 'grace_period'
				and s.grace_ends_at is not null
				and s.grace_ends_at <= now()
			returning s.subscription_id, s.business_id, s.plan_id
		),
		downgraded_businesses as (
			update businesses b
			set plan_id = c.plan_id, updated_at = now()
			from canceled_subscriptions c
			where b.business_id = c.business_id
			returning 1
		),
		canceled_events as (
			insert into business_subscription_events (
				subscription_id,
				business_id,
				actor_admin_user_id,
				event_type,
				summary,
				metadata
			)
			select
				c.subscription_id,
				c.business_id,
				$1::uuid,
				'subscription.grace_expired',
				$2,
				jsonb_build_object(
					'status', 'canceled',
					'reason', $2::text
				)
			from canceled_subscriptions c
			returning 1
		),
		touched as (
			select business_id from failed_subscriptions
			union
			select business_id from canceled_subscriptions
		)
		select
			(select count(*)::int from failed_invoices),
			(select count(*)::int from canceled_subscriptions),
			(select count(*)::int from touched),
			now()
	`, input.ActorAdminUser.String(), input.Reason).Scan(
		&record.OverdueInvoicesFailed,
		&record.SubscriptionsCanceled,
		&record.BusinessesTouched,
		&record.RanAt,
	); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminPlans(ctx context.Context) ([]ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminPlansQuery()+`
		order by p.is_active desc, p.monthly_fee_minor, p.created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminPlanRecord{}
	for rows.Next() {
		record, err := scanAdminPlanRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) CreateAdminPlan(
	ctx context.Context,
	input ports.CreateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := scanAdminPlanRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into plans (
				code,
				name,
				monthly_fee_minor,
				commission_bps,
				design_limit,
				is_active
			)
			values ($1, $2, $3, $4, $5, true)
			returning *
		)
		`+adminPlanSelect("inserted")+`
	`, input.Code,
		input.Name,
		input.MonthlyFeeMinor,
		input.CommissionBPS,
		nullableIntArg(input.DesignLimit),
	))
	if err != nil {
		if planCodeTaken(err) {
			return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminPlanRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminPlan(
	ctx context.Context,
	input ports.UpdateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := scanAdminPlanRecord(tx.QueryRow(ctx, `
		with updated as (
			update plans
			set name = $2,
				monthly_fee_minor = $3,
				commission_bps = $4,
				design_limit = $5,
				is_active = $6,
				updated_at = now()
			where plan_id = $1::uuid
			returning *
		)
		`+adminPlanSelect("updated")+`
	`, input.PlanID.String(),
		input.Name,
		input.MonthlyFeeMinor,
		input.CommissionBPS,
		nullableIntArg(input.DesignLimit),
		input.IsActive,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPlanRecord{}, ErrNotFound
		}
		return ports.AdminPlanRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminPlan(
	ctx context.Context,
	input ports.ArchiveAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := scanAdminPlanRecord(tx.QueryRow(ctx, `
		with updated as (
			update plans
			set is_active = false,
				updated_at = now()
			where plan_id = $1::uuid
			returning *
		)
		`+adminPlanSelect("updated")+`
	`, input.PlanID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPlanRecord{}, ErrNotFound
		}
		return ports.AdminPlanRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminPromotions(ctx context.Context) ([]ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminPromotionsQuery()+`
		order by
			case p.status when 'active' then 1 when 'paused' then 2 else 3 end,
			p.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminPromotionRecord{}
	for rows.Next() {
		record, err := scanAdminPromotionRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentRedemptions = redemptionsByPromotion[records[index].PromotionID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) CreateAdminPromotion(
	ctx context.Context,
	input ports.CreateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := scanAdminPromotionRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into promotions (
				promotion_id,
				business_id,
				code,
				title,
				description,
				discount_type,
				discount_value,
				max_discount_minor,
				min_spend_minor,
				usage_limit_global,
				usage_limit_per_customer,
				funding_source,
				scope,
				target_collection_id,
				target_design_id,
				status,
				starts_at,
				ends_at,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid,
				$2::uuid,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				$11,
				$12,
				$13,
				$14,
				$15,
				$16,
				$17,
				$18,
				$19::uuid,
				$19::uuid
			)
			returning *
		)
		`+adminPromotionSelect("inserted")+`
	`, input.PromotionID.String(),
		nullableIDArg(input.BusinessID),
		nullableTextArg(input.Code),
		input.Title,
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		nullableInt64Arg(input.MaxDiscountMinor),
		input.MinSpendMinor,
		nullableIntArg(input.UsageLimitGlobal),
		nullableIntArg(input.UsageLimitPerCustomer),
		input.FundingSource,
		input.Scope,
		nullableIDArg(input.TargetCollectionID),
		nullableIDArg(input.TargetDesignID),
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if promotionCodeTaken(err) {
			return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPromotionRecord{}, ErrNotFound
		}
		return ports.AdminPromotionRecord{}, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	record.RecentRedemptions = redemptionsByPromotion[record.PromotionID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminPromotion(
	ctx context.Context,
	input ports.UpdateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := scanAdminPromotionRecord(tx.QueryRow(ctx, `
		with updated as (
			update promotions
			set business_id = $2::uuid,
				code = $3,
				title = $4,
				description = $5,
				discount_type = $6,
				discount_value = $7,
				max_discount_minor = $8,
				min_spend_minor = $9,
				usage_limit_global = $10,
				usage_limit_per_customer = $11,
				funding_source = $12,
				scope = $13,
				target_collection_id = $14,
				target_design_id = $15,
				status = $16,
				starts_at = $17,
				ends_at = $18,
				updated_by_admin_user_id = $19::uuid,
				updated_at = now()
			where promotion_id = $1::uuid
			returning *
		)
		`+adminPromotionSelect("updated")+`
	`, input.PromotionID.String(),
		nullableIDArg(input.BusinessID),
		nullableTextArg(input.Code),
		input.Title,
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		nullableInt64Arg(input.MaxDiscountMinor),
		input.MinSpendMinor,
		nullableIntArg(input.UsageLimitGlobal),
		nullableIntArg(input.UsageLimitPerCustomer),
		input.FundingSource,
		input.Scope,
		nullableIDArg(input.TargetCollectionID),
		nullableIDArg(input.TargetDesignID),
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if promotionCodeTaken(err) {
			return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPromotionRecord{}, ErrNotFound
		}
		return ports.AdminPromotionRecord{}, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	record.RecentRedemptions = redemptionsByPromotion[record.PromotionID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminPromotion(
	ctx context.Context,
	input ports.ArchiveAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := scanAdminPromotionRecord(tx.QueryRow(ctx, `
		with updated as (
			update promotions
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where promotion_id = $1::uuid
			returning *
		)
		`+adminPromotionSelect("updated")+`
	`, input.PromotionID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPromotionRecord{}, ErrNotFound
		}
		return ports.AdminPromotionRecord{}, err
	}

	redemptionsByPromotion, err := listAdminPromotionRedemptions(ctx, tx)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	record.RecentRedemptions = redemptionsByPromotion[record.PromotionID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminAdCampaigns(ctx context.Context) ([]ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminAdCampaignsQuery()+`
		order by
			case c.status
				when 'pending_review' then 1
				when 'active' then 2
				when 'paused' then 3
				when 'completed' then 4
				else 5
			end,
			c.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAdCampaignRecord{}
	for rows.Next() {
		record, err := scanAdminAdCampaignRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	paymentsByCampaign, err := listAdminAdCampaignPayments(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentPayments = paymentsByCampaign[records[index].CampaignID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) CreateAdminAdCampaign(
	ctx context.Context,
	input ports.CreateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := scanAdminAdCampaignRecord(tx.QueryRow(ctx, `
		with eligible_business as (
			select business_id
			from businesses b
			where b.business_id = $2::uuid
				and b.verification_status = 'verified'
				and b.operational_status = 'active'
				and (
					$3 <> 'promoted_design'
					or exists (
						select 1
						from designs d
						where d.business_id = b.business_id
							and d.design_id::text = $4
							and d.status = 'active'
					)
				)
		),
		inserted as (
			insert into ad_campaigns (
				campaign_id,
				advertiser_business_id,
				placement_type,
				target_ref_id,
				headline,
				description,
				status,
				pricing_model,
				budget_minor,
				daily_cap_minor,
				starts_at,
				ends_at,
				reviewed_by_admin_user_id,
				review_note,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			select
				$1::uuid,
				eligible_business.business_id,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				$11,
				$12,
				case when $7 in ('active', 'paused', 'completed') then $13::uuid else null end,
				$14,
				$13::uuid,
				$13::uuid
			from eligible_business
			returning *
		)
		`+adminAdCampaignSelect("inserted")+`
	`, input.CampaignID.String(),
		input.BusinessID.String(),
		input.PlacementType,
		input.TargetRefID,
		input.Headline,
		input.Description,
		input.Status,
		input.PricingModel,
		input.BudgetMinor,
		nullableInt64Arg(input.DailyCapMinor),
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
		input.ReviewNote,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignRecord{}, err
	}
	record.RecentPayments, err = listAdminAdCampaignPaymentsForCampaign(ctx, tx, record.CampaignID)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminAdCampaign(
	ctx context.Context,
	input ports.UpdateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := scanAdminAdCampaignRecord(tx.QueryRow(ctx, `
		with eligible_business as (
			select business_id
			from businesses b
			where b.business_id = $2::uuid
				and b.verification_status = 'verified'
				and b.operational_status = 'active'
				and (
					$3 <> 'promoted_design'
					or exists (
						select 1
						from designs d
						where d.business_id = b.business_id
							and d.design_id::text = $4
							and d.status = 'active'
					)
				)
		),
		updated as (
			update ad_campaigns c
			set advertiser_business_id = eligible_business.business_id,
				placement_type = $3,
				target_ref_id = $4,
				headline = $5,
				description = $6,
				status = $7,
				pricing_model = $8,
				budget_minor = $9,
				daily_cap_minor = $10,
				starts_at = $11,
				ends_at = $12,
				reviewed_by_admin_user_id = case
					when $7 in ('active', 'paused', 'completed') then $13::uuid
					else c.reviewed_by_admin_user_id
				end,
				review_note = $14,
				updated_by_admin_user_id = $13::uuid,
				updated_at = now()
			from eligible_business
			where c.campaign_id = $1::uuid
				and c.status <> 'archived'
			returning c.*
		)
		`+adminAdCampaignSelect("updated")+`
	`, input.CampaignID.String(),
		input.BusinessID.String(),
		input.PlacementType,
		input.TargetRefID,
		input.Headline,
		input.Description,
		input.Status,
		input.PricingModel,
		input.BudgetMinor,
		nullableInt64Arg(input.DailyCapMinor),
		input.StartsAt,
		input.EndsAt,
		input.ActorAdminUser.String(),
		input.ReviewNote,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignRecord{}, err
	}
	record.RecentPayments, err = listAdminAdCampaignPaymentsForCampaign(ctx, tx, record.CampaignID)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminAdCampaign(
	ctx context.Context,
	input ports.ArchiveAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := scanAdminAdCampaignRecord(tx.QueryRow(ctx, `
		with updated as (
			update ad_campaigns
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where campaign_id = $1::uuid
			returning *
		)
		`+adminAdCampaignSelect("updated")+`
	`, input.CampaignID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignRecord{}, err
	}
	record.RecentPayments, err = listAdminAdCampaignPaymentsForCampaign(ctx, tx, record.CampaignID)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) GetAdminAdCampaignPaymentIntent(
	ctx context.Context,
	campaignID common.ID,
) (ports.AdminAdCampaignPaymentIntentRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}

	var intent ports.AdminAdCampaignPaymentIntentRecord
	var openPaymentID pgtype.Text
	var openProvider pgtype.Text
	var openProviderReference pgtype.Text
	var openPaymentURL pgtype.Text
	var openCurrency pgtype.Text
	var openStatus pgtype.Text
	var openFailureReason pgtype.Text
	var openAmountMinor pgtype.Int8
	var openCreatedAt pgtype.Timestamptz
	var openUpdatedAt pgtype.Timestamptz
	var openPaidAt pgtype.Timestamptz
	var openFailedAt pgtype.Timestamptz
	err = tx.QueryRow(ctx, `
		with paid as (
			select
				campaign_id,
				coalesce(sum(amount_minor) filter (where status = 'paid'), 0)::bigint as paid_minor
			from ad_campaign_payments
			group by campaign_id
		)
		select
			c.campaign_id::text,
			c.advertiser_business_id::text,
			b.name,
			coalesce(owner.email, ''),
			c.headline,
			c.budget_minor::bigint,
			coalesce(paid.paid_minor, 0)::bigint,
			greatest(c.budget_minor - coalesce(paid.paid_minor, 0), 0)::bigint,
			open_payment.payment_id::text,
			open_payment.provider,
			open_payment.provider_reference,
			open_payment.payment_url,
			open_payment.amount_minor,
			open_payment.currency,
			open_payment.status,
			open_payment.paid_at,
			open_payment.failed_at,
			open_payment.failure_reason,
			open_payment.created_at,
			open_payment.updated_at
		from ad_campaigns c
		join businesses b on b.business_id = c.advertiser_business_id
		left join paid on paid.campaign_id = c.campaign_id
		left join lateral (
			select u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		left join lateral (
			select *
			from ad_campaign_payments ap
			where ap.campaign_id = c.campaign_id and ap.status = 'initiated'
			order by ap.created_at desc
			limit 1
		) open_payment on true
		where c.campaign_id = $1::uuid
			and c.status <> 'archived'
	`, campaignID.String()).Scan(
		&intent.CampaignID,
		&intent.BusinessID,
		&intent.BusinessName,
		&intent.OwnerEmail,
		&intent.Headline,
		&intent.BudgetMinor,
		&intent.PaidMinor,
		&intent.DueMinor,
		&openPaymentID,
		&openProvider,
		&openProviderReference,
		&openPaymentURL,
		&openAmountMinor,
		&openCurrency,
		&openStatus,
		&openPaidAt,
		&openFailedAt,
		&openFailureReason,
		&openCreatedAt,
		&openUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignPaymentIntentRecord{}, ErrNotFound
		}
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}
	if openPaymentID.Valid {
		intent.OpenPayment = &ports.AdminAdCampaignPaymentRecord{
			PaymentID:         common.ID(openPaymentID.String),
			CampaignID:        intent.CampaignID,
			BusinessID:        intent.BusinessID,
			Provider:          openProvider.String,
			ProviderReference: openProviderReference.String,
			PaymentURL:        openPaymentURL.String,
			AmountMinor:       openAmountMinor.Int64,
			Currency:          openCurrency.String,
			Status:            openStatus.String,
			PaidAt:            timestamptzPtr(openPaidAt),
			FailedAt:          timestamptzPtr(openFailedAt),
			FailureReason:     openFailureReason.String,
			CreatedAt:         openCreatedAt.Time,
			UpdatedAt:         openUpdatedAt.Time,
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignPaymentIntentRecord{}, err
	}

	return intent, nil
}

func (repo AdminAuthRepository) CreateAdminAdCampaignPayment(
	ctx context.Context,
	input ports.CreateAdminAdCampaignPaymentInput,
) (ports.AdminAdCampaignPaymentRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}

	payment, err := scanAdminAdCampaignPaymentRecord(tx.QueryRow(ctx, `
		with eligible_campaign as (
			select c.campaign_id, c.advertiser_business_id
			from ad_campaigns c
			where c.campaign_id = $2::uuid
				and c.advertiser_business_id = $3::uuid
				and c.status <> 'archived'
		),
		inserted as (
			insert into ad_campaign_payments (
				payment_id,
				campaign_id,
				advertiser_business_id,
				provider,
				provider_reference,
				payment_url,
				amount_minor,
				currency,
				status,
				requested_by_admin_user_id
			)
			select
				$1::uuid,
				eligible_campaign.campaign_id,
				eligible_campaign.advertiser_business_id,
				'paystack',
				$4,
				$5,
				$6,
				$7,
				'initiated',
				$8::uuid
			from eligible_campaign
			returning *
		)
		`+adminAdCampaignPaymentSelect("inserted")+`
	`, input.PaymentID.String(),
		input.CampaignID.String(),
		input.BusinessID.String(),
		input.ProviderReference,
		input.PaymentURL,
		input.AmountMinor,
		input.Currency,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAdCampaignPaymentRecord{}, ErrNotFound
		}
		if isOpenAdCampaignPayment(err) {
			return ports.AdminAdCampaignPaymentRecord{}, ports.ErrPaymentInFlight
		}
		return ports.AdminAdCampaignPaymentRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}

	return payment, nil
}

func (repo AdminAuthRepository) ListAdminAffiliates(ctx context.Context) ([]ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminAffiliatesQuery()+`
		order by
			case status when 'pending_review' then 1 when 'active' then 2 when 'paused' then 3 else 4 end,
			updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateRecord{}
	for rows.Next() {
		record, err := scanAdminAffiliateRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) ListAdminAffiliateAttribution(ctx context.Context) ([]ports.AdminAffiliateAttributionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		with click_stats as (
			select
				affiliate_id,
				count(*)::bigint as click_count,
				max(clicked_at) as last_clicked_at
			from affiliate_clicks
			group by affiliate_id
		),
		conversion_stats as (
			select
				affiliate_id,
				count(*)::bigint as conversion_count,
				count(*) filter (where status = 'pending')::bigint as pending_count,
				count(*) filter (where status = 'approved')::bigint as approved_count,
				count(*) filter (where status = 'settled')::bigint as settled_count,
				count(*) filter (where status = 'reversed')::bigint as reversed_count,
				coalesce(sum(gross_minor), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor), 0)::bigint as commission_minor,
				max(updated_at) as last_conversion_at
			from affiliate_conversions
			group by affiliate_id
		)
		select
			a.affiliate_id::text,
			a.code,
			a.display_name,
			coalesce(click_stats.click_count, 0)::bigint,
			coalesce(conversion_stats.conversion_count, 0)::bigint,
			coalesce(conversion_stats.pending_count, 0)::bigint,
			coalesce(conversion_stats.approved_count, 0)::bigint,
			coalesce(conversion_stats.settled_count, 0)::bigint,
			coalesce(conversion_stats.reversed_count, 0)::bigint,
			coalesce(conversion_stats.gross_minor, 0)::bigint,
			coalesce(conversion_stats.commission_minor, 0)::bigint,
			greatest(
				a.updated_at,
				coalesce(click_stats.last_clicked_at, 'epoch'::timestamptz),
				coalesce(conversion_stats.last_conversion_at, 'epoch'::timestamptz)
			)
		from affiliates a
		left join click_stats on click_stats.affiliate_id = a.affiliate_id
		left join conversion_stats on conversion_stats.affiliate_id = a.affiliate_id
		order by
			coalesce(conversion_stats.conversion_count, 0) desc,
			coalesce(click_stats.click_count, 0) desc,
			a.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateAttributionRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateAttributionRecord
		var lastActivityAt time.Time
		if err := rows.Scan(
			&record.AffiliateID,
			&record.Code,
			&record.DisplayName,
			&record.ClickCount,
			&record.ConversionCount,
			&record.PendingConversionCount,
			&record.ApprovedConversionCount,
			&record.SettledConversionCount,
			&record.ReversedConversionCount,
			&record.GrossMinor,
			&record.CommissionMinor,
			&lastActivityAt,
		); err != nil {
			return nil, err
		}
		record.LastActivityAt = &lastActivityAt
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	conversions, err := listAdminAffiliateConversions(ctx, tx)
	if err != nil {
		return nil, err
	}
	payouts, err := listAdminAffiliatePayouts(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentConversions = conversions[records[index].AffiliateID]
		records[index].RecentPayouts = payouts[records[index].AffiliateID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) UpdateAdminAffiliateConversionStatus(
	ctx context.Context,
	input ports.UpdateAdminAffiliateConversionStatusInput,
) (ports.AdminAffiliateConversionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	current, err := queryAdminAffiliateConversion(ctx, tx, input.ConversionID.String())
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	if !validAffiliateConversionTransition(current.Status, input.Status) {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
	}

	if _, err := tx.Exec(ctx, `
		update affiliate_conversions
		set status = $2,
			approved_at = case
				when $2 = 'approved' then coalesce(approved_at, now())
				else approved_at
			end,
			settled_at = case
				when $2 = 'settled' then coalesce(settled_at, now())
				else settled_at
			end,
			reversed_at = case
				when $2 = 'reversed' then coalesce(reversed_at, now())
				else reversed_at
			end,
			reversal_reason = case
				when $2 = 'reversed' then $3
				else reversal_reason
			end,
			metadata = metadata || jsonb_build_object(
				'admin_status_note', $3::text,
				'admin_status_by', $4::text,
				'admin_status_at', now()
			),
			updated_at = now()
		where affiliate_conversion_id = $1::uuid
	`, input.ConversionID.String(), input.Status, input.Reason, input.ActorAdminUser.String()); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	record, err := queryAdminAffiliateConversion(ctx, tx, input.ConversionID.String())
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) CreateAdminAffiliatePayout(
	ctx context.Context,
	input ports.CreateAdminAffiliatePayoutInput,
) (ports.AdminAffiliatePayoutRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	record, err := scanAdminAffiliatePayoutRecord(tx.QueryRow(ctx, `
		with affiliate as (
			select
				affiliate_id,
				display_name,
				payout_mode,
				payout_reference
			from affiliates
			where affiliate_id = $2::uuid
				and status <> 'archived'
		),
		eligible as (
			select
				affiliate_conversion_id,
				gross_minor,
				commission_minor
			from affiliate_conversions
			where affiliate_id = $2::uuid
				and status = 'approved'
			order by approved_at nulls last, updated_at, affiliate_conversion_id
			for update
		),
		totals as (
			select
				count(*)::int as conversion_count,
				coalesce(sum(gross_minor), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor), 0)::bigint as commission_minor
			from eligible
			having count(*) > 0
		),
		inserted as (
			insert into affiliate_payout_batches (
				payout_batch_id,
				affiliate_id,
				payout_mode,
				payout_reference,
				conversion_count,
				gross_minor,
				commission_minor,
				status,
				notes,
				created_by_admin_user_id
			)
			select
				$1::uuid,
				affiliate.affiliate_id,
				affiliate.payout_mode,
				coalesce(nullif($3::text, ''), affiliate.payout_reference),
				totals.conversion_count,
				totals.gross_minor,
				totals.commission_minor,
				'settled',
				$4::text,
				$5::uuid
			from affiliate
			join totals on true
			returning *
		),
		updated as (
			update affiliate_conversions ac
			set status = 'settled',
				settled_at = coalesce(settled_at, now()),
				payout_batch_id = (select payout_batch_id from inserted),
				metadata = metadata || jsonb_build_object(
					'payout_batch_id', (select payout_batch_id::text from inserted),
					'payout_reference', (select payout_reference from inserted),
					'payout_reconciled_by', $5::text,
					'payout_reconciled_at', now(),
					'payout_note', $4::text
				),
				updated_at = now()
			from eligible
			where ac.affiliate_conversion_id = eligible.affiliate_conversion_id
			returning 1
		)
		select
			inserted.payout_batch_id::text,
			inserted.affiliate_id::text,
			affiliate.display_name,
			inserted.payout_mode,
			inserted.payout_reference,
			inserted.conversion_count,
			inserted.gross_minor,
			inserted.commission_minor,
			inserted.status,
			inserted.notes,
			inserted.created_at,
			inserted.updated_at
		from inserted
		join affiliate on affiliate.affiliate_id = inserted.affiliate_id
	`, input.PayoutBatchID.String(),
		input.AffiliateID.String(),
		input.PayoutReference,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) CreateAdminAffiliate(
	ctx context.Context,
	input ports.CreateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into affiliates (
				affiliate_id,
				entity_type,
				code,
				display_name,
				contact_name,
				email,
				phone,
				website_url,
				commission_model,
				commission_rate,
				cookie_window_days,
				payout_mode,
				payout_reference,
				status,
				notes,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				$11,
				$12,
				$13,
				$14,
				$15,
				$16::uuid,
				$16::uuid
			)
			returning *
		)
		`+adminAffiliateSelect("inserted")+`
	`, input.AffiliateID.String(),
		input.EntityType,
		input.Code,
		input.DisplayName,
		input.ContactName,
		input.Email,
		input.Phone,
		input.WebsiteURL,
		input.CommissionModel,
		input.CommissionRate,
		input.CookieWindowDays,
		input.PayoutMode,
		input.PayoutReference,
		input.Status,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminAffiliate(
	ctx context.Context,
	input ports.UpdateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with updated as (
			update affiliates
			set entity_type = $2,
				code = $3,
				display_name = $4,
				contact_name = $5,
				email = $6,
				phone = $7,
				website_url = $8,
				commission_model = $9,
				commission_rate = $10,
				cookie_window_days = $11,
				payout_mode = $12,
				payout_reference = $13,
				status = $14,
				notes = $15,
				updated_by_admin_user_id = $16::uuid,
				updated_at = now()
			where affiliate_id = $1::uuid
				and status <> 'archived'
			returning *
		)
		`+adminAffiliateSelect("updated")+`
	`, input.AffiliateID.String(),
		input.EntityType,
		input.Code,
		input.DisplayName,
		input.ContactName,
		input.Email,
		input.Phone,
		input.WebsiteURL,
		input.CommissionModel,
		input.CommissionRate,
		input.CookieWindowDays,
		input.PayoutMode,
		input.PayoutReference,
		input.Status,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminAffiliate(
	ctx context.Context,
	input ports.ArchiveAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with updated as (
			update affiliates
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where affiliate_id = $1::uuid
			returning *
		)
		`+adminAffiliateSelect("updated")+`
	`, input.AffiliateID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminReferralProgrammes(ctx context.Context) ([]ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminReferralProgrammesQuery()+`
		order by
			case status when 'draft' then 1 when 'active' then 2 when 'paused' then 3 else 4 end,
			updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminReferralProgrammeRecord{}
	for rows.Next() {
		record, err := scanAdminReferralProgrammeRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	codesByProgramme, err := listAdminReferralCodes(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentCodes = codesByProgramme[records[index].ProgrammeID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) CreateAdminReferralProgramme(
	ctx context.Context,
	input ports.CreateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := scanAdminReferralProgrammeRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into referral_programmes (
				referral_programme_id,
				title,
				code_prefix,
				audience,
				referrer_reward_kind,
				referee_reward_kind,
				reward_type,
				reward_value,
				max_reward_minor,
				qualifying_order_min_minor,
				reward_hold_days,
				status,
				starts_at,
				ends_at,
				notes,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				$11,
				$12,
				$13,
				$14,
				$15,
				$16::uuid,
				$16::uuid
			)
			returning *
		)
		`+adminReferralProgrammeSelect("inserted")+`
	`, input.ProgrammeID.String(),
		input.Title,
		input.CodePrefix,
		input.Audience,
		input.ReferrerRewardKind,
		input.RefereeRewardKind,
		input.RewardType,
		input.RewardValue,
		nullableInt64Arg(input.MaxRewardMinor),
		input.QualifyingOrderMinMinor,
		input.RewardHoldDays,
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if referralProgrammeCodeTaken(err) {
			return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminReferralProgrammeRecord{}, err
	}

	codesByProgramme, err := listAdminReferralCodesForProgramme(ctx, tx, record.ProgrammeID)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.RecentCodes = codesByProgramme[record.ProgrammeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminReferralProgramme(
	ctx context.Context,
	input ports.UpdateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := scanAdminReferralProgrammeRecord(tx.QueryRow(ctx, `
		with updated as (
			update referral_programmes
			set title = $2,
				code_prefix = $3,
				audience = $4,
				referrer_reward_kind = $5,
				referee_reward_kind = $6,
				reward_type = $7,
				reward_value = $8,
				max_reward_minor = $9,
				qualifying_order_min_minor = $10,
				reward_hold_days = $11,
				status = $12,
				starts_at = $13,
				ends_at = $14,
				notes = $15,
				updated_by_admin_user_id = $16::uuid,
				updated_at = now()
			where referral_programme_id = $1::uuid
				and status <> 'archived'
			returning *
		)
		`+adminReferralProgrammeSelect("updated")+`
	`, input.ProgrammeID.String(),
		input.Title,
		input.CodePrefix,
		input.Audience,
		input.ReferrerRewardKind,
		input.RefereeRewardKind,
		input.RewardType,
		input.RewardValue,
		nullableInt64Arg(input.MaxRewardMinor),
		input.QualifyingOrderMinMinor,
		input.RewardHoldDays,
		input.Status,
		input.StartsAt,
		input.EndsAt,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if referralProgrammeCodeTaken(err) {
			return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminReferralProgrammeRecord{}, ErrNotFound
		}
		return ports.AdminReferralProgrammeRecord{}, err
	}

	codesByProgramme, err := listAdminReferralCodesForProgramme(ctx, tx, record.ProgrammeID)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.RecentCodes = codesByProgramme[record.ProgrammeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminReferralProgramme(
	ctx context.Context,
	input ports.ArchiveAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := scanAdminReferralProgrammeRecord(tx.QueryRow(ctx, `
		with updated as (
			update referral_programmes
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where referral_programme_id = $1::uuid
			returning *
		)
		`+adminReferralProgrammeSelect("updated")+`
	`, input.ProgrammeID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminReferralProgrammeRecord{}, ErrNotFound
		}
		return ports.AdminReferralProgrammeRecord{}, err
	}

	codesByProgramme, err := listAdminReferralCodesForProgramme(ctx, tx, record.ProgrammeID)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.RecentCodes = codesByProgramme[record.ProgrammeID]

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) CreateAdminReferralCode(
	ctx context.Context,
	input ports.CreateAdminReferralCodeInput,
) (ports.AdminReferralCodeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}

	record, err := scanAdminReferralCodeRecord(tx.QueryRow(ctx, `
		with programme as (
			select referral_programme_id
			from referral_programmes
			where referral_programme_id = $2::uuid
				and status = 'active'
		),
		owner_context as (
			select
				null::uuid as business_id
			where $3 = 'platform'
			union all
			select
				b.business_id
			from businesses b
			where $3 = 'business'
				and b.business_id = $4::uuid
				and b.verification_status = 'verified'
				and b.operational_status = 'active'
		),
		inserted as (
			insert into referral_codes (
				referral_code_id,
				referral_programme_id,
				business_id,
				owner_type,
				owner_business_id,
				code,
				status,
				metadata
			)
			select
				$1::uuid,
				programme.referral_programme_id,
				owner_context.business_id,
				$3,
				case when $3 = 'business' then owner_context.business_id else null end,
				$5,
				$6,
				jsonb_build_object(
					'source',
					'admin_issue',
					'issued_by_admin_user_id',
					$7::text
				)
			from programme
			cross join owner_context
			returning *
		)
		`+adminReferralCodeSelect("inserted")+`
	`, input.ReferralCodeID.String(),
		input.ProgrammeID.String(),
		input.OwnerType,
		nullableIDArg(input.BusinessID),
		input.Code,
		input.Status,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if referralCodeTaken(err) {
			return ports.AdminReferralCodeRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminReferralCodeRecord{}, ErrNotFound
		}
		return ports.AdminReferralCodeRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) IssueAdminReferralRewards(
	ctx context.Context,
	input ports.IssueAdminReferralRewardsInput,
) (ports.AdminReferralRewardIssueRecord, error) {
	limit := input.Limit
	if limit <= 0 {
		limit = 50
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	var record ports.AdminReferralRewardIssueRecord
	err = tx.QueryRow(ctx, `
		with due_referrals as (
			select
				r.referral_id,
				r.referral_programme_id,
				r.business_id,
				r.referee_customer_id,
				r.referrer_customer_id,
				r.referrer_business_id,
				rp.title,
				rp.code_prefix,
				rp.referrer_reward_kind,
				rp.referee_reward_kind,
				rp.reward_type,
				rp.reward_value,
				rp.max_reward_minor
			from referrals r
			join referral_programmes rp
				on rp.referral_programme_id = r.referral_programme_id
			where r.status = 'qualified'
				and r.qualified_at is not null
				and r.qualified_at <= now() - (rp.reward_hold_days::text || ' days')::interval
				and not exists (
					select 1
					from referral_rewards rw
					where rw.referral_id = r.referral_id
				)
			order by r.qualified_at, r.referral_id
			limit $2
			for update of r skip locked
		),
		reward_candidates as (
			select
				referral_id,
				business_id,
				'referrer'::text as beneficiary_type,
				referrer_reward_kind as reward_kind,
				referrer_customer_id as beneficiary_customer_id,
				referrer_business_id as beneficiary_business_id,
				title,
				code_prefix,
				reward_type,
				reward_value,
				max_reward_minor
			from due_referrals
			where referrer_reward_kind <> 'none'
			union all
			select
				referral_id,
				business_id,
				'referee'::text as beneficiary_type,
				referee_reward_kind as reward_kind,
				referee_customer_id as beneficiary_customer_id,
				null::uuid as beneficiary_business_id,
				title,
				code_prefix,
				reward_type,
				reward_value,
				max_reward_minor
			from due_referrals
			where referee_reward_kind <> 'none'
		),
		valid_candidates as (
			select
				*,
				upper(
					left(regexp_replace(code_prefix, '[^A-Za-z0-9_-]', '', 'g'), 12)
					|| '-' || substr(referral_id::text, 1, 8)
					|| '-' || case beneficiary_type when 'referrer' then 'R' else 'E' end
				) as voucher_code
			from reward_candidates
			where (
				reward_kind = 'voucher'
				and beneficiary_customer_id is not null
			)
			or (
				reward_kind = 'commission_rebate'
				and beneficiary_business_id is not null
			)
		),
		voucher_promotions as (
			insert into promotions (
				promotion_id,
				business_id,
				code,
				title,
				description,
				discount_type,
				discount_value,
				max_discount_minor,
				min_spend_minor,
				usage_limit_global,
				usage_limit_per_customer,
				funding_source,
				scope,
				status,
				starts_at,
				ends_at
			)
			select
				gen_random_uuid(),
				business_id,
				voucher_code,
				'Referral reward: ' || title,
				'Single-use referral reward voucher.',
				reward_type,
				reward_value,
				case when reward_type = 'percentage' then max_reward_minor else null end,
				0,
				1,
				1,
				'business',
				'store',
				'active',
				now(),
				now() + interval '90 days'
			from valid_candidates
			where reward_kind = 'voucher'
			returning promotion_id, code
		),
		inserted_rewards as (
			insert into referral_rewards (
				referral_reward_id,
				referral_id,
				business_id,
				beneficiary_type,
				beneficiary_customer_id,
				beneficiary_business_id,
				reward_kind,
				promotion_id,
				status,
				available_at,
				issued_at,
				metadata
			)
			select
				gen_random_uuid(),
				c.referral_id,
				c.business_id,
				c.beneficiary_type,
				c.beneficiary_customer_id,
				c.beneficiary_business_id,
				c.reward_kind,
				vp.promotion_id,
				case when c.reward_kind = 'voucher' then 'issued' else 'pending' end,
				now(),
				case when c.reward_kind = 'voucher' then now() else null end,
				jsonb_build_object(
					'source', 'admin_reward_issue',
					'issued_by_admin_user_id', $1::text,
					'voucher_code', coalesce(vp.code, ''),
					'reward_type', c.reward_type,
					'reward_value', c.reward_value::text
				)
			from valid_candidates c
			left join voucher_promotions vp on vp.code = c.voucher_code
			where c.reward_kind <> 'voucher'
				or vp.promotion_id is not null
			on conflict (referral_id, beneficiary_type) do nothing
			returning
				referral_id,
				reward_kind,
				metadata->>'reward_type' as reward_type,
				(metadata->>'reward_value')::bigint as reward_value
		),
		rewarded_referrals as (
			update referrals r
			set status = 'rewarded',
				rewarded_at = coalesce(rewarded_at, now()),
				updated_at = now()
			where r.referral_id in (
				select distinct referral_id from inserted_rewards
			)
			returning r.referral_id
		)
		select
			coalesce((select count(*)::int from rewarded_referrals), 0),
			coalesce((select count(*)::int from inserted_rewards), 0),
			coalesce((select count(*)::int from inserted_rewards where reward_kind = 'voucher'), 0),
			coalesce((select count(*)::int from inserted_rewards where reward_kind = 'commission_rebate'), 0),
			coalesce((
				select sum(case when reward_type = 'fixed' then reward_value else 0 end)::bigint
				from inserted_rewards
			), 0),
			now()
	`, input.ActorAdminUser.String(), limit).Scan(
		&record.ReferralCount,
		&record.RewardCount,
		&record.VoucherCount,
		&record.CommissionRebateCount,
		&record.TotalRewardMinor,
		&record.IssuedAt,
	)
	if err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) QueueAdminMoneyReplay(
	ctx context.Context,
	input ports.QueueAdminMoneyReplayInput,
) (ports.AdminMoneyReplayRequestRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	var paymentID string
	var businessName string
	if err := tx.QueryRow(ctx, `
		with candidate as (
			select $1::text as provider_reference
			where exists (
				select 1 from payments where provider_reference = $1
			)
			or exists (
				select 1 from payment_provider_events where provider_reference = $1
			)
		)
		select
			coalesce(p.payment_id::text, ''),
			coalesce(b.name, 'Unmatched provider event')
		from candidate c
		left join payments p on p.provider_reference = c.provider_reference
		left join businesses b on b.business_id = p.business_id
		limit 1
	`, input.ProviderReference).Scan(&paymentID, &businessName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminMoneyReplayRequestRecord{}, ErrNotFound
		}
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	var record ports.AdminMoneyReplayRequestRecord
	if err := tx.QueryRow(ctx, `
		insert into admin_money_replay_requests (
			replay_request_id,
			provider_reference,
			payment_id,
			requested_by_admin_user_id,
			reason,
			status
		)
		values ($1, $2, nullif($3, '')::uuid, $4, $5, 'queued')
		returning
			replay_request_id::text,
			provider_reference,
			coalesce(payment_id::text, ''),
			$6::text,
			reason,
			status,
			created_at
	`, input.ReplayRequestID.String(),
		input.ProviderReference,
		paymentID,
		input.RequestedByUserID.String(),
		input.Reason,
		businessName,
	).Scan(
		&record.ReplayRequestID,
		&record.ProviderReference,
		&record.PaymentID,
		&record.BusinessName,
		&record.Reason,
		&record.Status,
		&record.CreatedAt,
	); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ReverseAdminMoneyPayment(
	ctx context.Context,
	input ports.ReverseAdminMoneyPaymentInput,
) (ports.AdminMoneyReversalRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}

	var record ports.AdminMoneyReversalRecord
	var paymentStatus string
	var orderID pgtype.Text
	if err := tx.QueryRow(ctx, `
		select
			p.payment_id::text,
			p.provider_reference,
			p.business_id::text,
			coalesce(b.name, ''),
			p.order_id::text,
			p.status,
			now()
		from payments p
		join businesses b on b.business_id = p.business_id
		where p.provider_reference = $1
		for update of p
	`, input.ProviderReference).Scan(
		&record.PaymentID,
		&record.ProviderReference,
		&record.BusinessID,
		&record.BusinessName,
		&orderID,
		&paymentStatus,
		&record.ReversedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminMoneyReversalRecord{}, ErrNotFound
		}
		return ports.AdminMoneyReversalRecord{}, err
	}
	record.OrderID = commonIDPtr(orderID)
	record.Reason = input.Reason

	if paymentStatus != "succeeded" && paymentStatus != "reversed" {
		return ports.AdminMoneyReversalRecord{}, authdomain.ErrInvalidInput
	}

	if paymentStatus == "succeeded" {
		tag, err := tx.Exec(ctx, `
			update payments
			set status = 'reversed',
				updated_at = now()
			where payment_id = $1::uuid
				and status = 'succeeded'
		`, record.PaymentID.String())
		if err != nil {
			return ports.AdminMoneyReversalRecord{}, err
		}
		record.PaymentReversed = tag.RowsAffected() > 0
	}

	if record.PaymentReversed && record.OrderID != nil {
		if err := tx.QueryRow(ctx, `
			with voided_redemptions as (
				update promotion_redemptions
				set status = 'void',
					updated_at = now()
				where business_id = $1::uuid
					and order_id = $2::uuid
					and status in ('pending', 'applied')
				returning 1
			),
			reversed_affiliates as (
				update affiliate_conversions
				set status = 'reversed',
					reversed_at = coalesce(reversed_at, now()),
					reversal_reason = $3,
					metadata = metadata || jsonb_build_object(
						'source', 'admin_payment_reversal',
						'reversed_by_admin_user_id', $4::text,
						'reversed_provider_reference', $5::text,
						'reversal_reason', $3::text,
						'reversed_at', now()
					),
					updated_at = now()
				where business_id = $1::uuid
					and order_id = $2::uuid
					and status <> 'reversed'
				returning 1
			),
			voided_referrals as (
				update referrals
				set status = 'void',
					updated_at = now(),
					metadata = metadata || jsonb_build_object(
						'source', 'admin_payment_reversal',
						'reversed_by_admin_user_id', $4::text,
						'reversed_provider_reference', $5::text,
						'reversal_reason', $3::text,
						'reversed_at', now()
					)
				where business_id = $1::uuid
					and order_id = $2::uuid
					and status in ('pending', 'qualified', 'rewarded')
				returning referral_id
			),
			voided_rewards as (
				update referral_rewards rr
				set status = 'void',
					updated_at = now(),
					metadata = metadata || jsonb_build_object(
						'source', 'admin_payment_reversal',
						'reversed_by_admin_user_id', $4::text,
						'reversed_provider_reference', $5::text,
						'reversal_reason', $3::text,
						'reversed_at', now()
					)
				from voided_referrals vf
				where rr.referral_id = vf.referral_id
					and rr.status <> 'void'
				returning rr.promotion_id
			),
			archived_generated_promotions as (
				update promotions p
				set status = 'archived',
					updated_by_admin_user_id = $4::uuid,
					updated_at = now()
				where p.promotion_id in (
						select promotion_id
						from voided_rewards
						where promotion_id is not null
					)
					and p.status <> 'archived'
				returning 1
			)
			select
				(select count(*)::int from voided_redemptions),
				(select count(*)::int from reversed_affiliates),
				(select count(*)::int from voided_referrals),
				(select count(*)::int from voided_rewards),
				(select count(*)::int from archived_generated_promotions)
		`, record.BusinessID.String(),
			record.OrderID.String(),
			record.Reason,
			input.ActorAdminUser.String(),
			record.ProviderReference,
		).Scan(
			&record.PromotionRedemptionCount,
			&record.AffiliateConversionCount,
			&record.ReferralCount,
			&record.ReferralRewardCount,
			&record.GeneratedPromotionCount,
		); err != nil {
			return ports.AdminMoneyReversalRecord{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) SetAdminSettlementReviewHold(
	ctx context.Context,
	input ports.SetAdminSettlementReviewHoldInput,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists (
			select 1 from businesses where business_id = $1
		)
	`, input.BusinessID.String()).Scan(&exists); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}
	if !exists {
		return ports.AdminMoneyPayoutReviewRecord{}, ErrNotFound
	}

	if input.Hold {
		if _, err := tx.Exec(ctx, `
			insert into admin_settlement_review_holds (
				business_id,
				is_active,
				reason,
				placed_by_admin_user_id,
				placed_at,
				released_by_admin_user_id,
				released_at,
				updated_at
			)
			values ($1, true, $2, $3, now(), null, null, now())
			on conflict (business_id) do update
			set is_active = true,
				reason = excluded.reason,
				placed_by_admin_user_id = excluded.placed_by_admin_user_id,
				placed_at = now(),
				released_by_admin_user_id = null,
				released_at = null,
				updated_at = now()
		`, input.BusinessID.String(), input.Reason, input.ActorAdminUser.String()); err != nil {
			return ports.AdminMoneyPayoutReviewRecord{}, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			update admin_settlement_review_holds
			set is_active = false,
				reason = $2,
				released_by_admin_user_id = $3,
				released_at = now(),
				updated_at = now()
			where business_id = $1
		`, input.BusinessID.String(), input.Reason, input.ActorAdminUser.String()); err != nil {
			return ports.AdminMoneyPayoutReviewRecord{}, err
		}
	}

	record, err := queryAdminMoneyPayoutReview(ctx, tx, input.BusinessID.String())
	if err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminRiskReviews(ctx context.Context) ([]ports.AdminRiskReviewRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	records, err := queryAdminRiskReviews(ctx, tx, "")
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) SetAdminRiskReviewStatus(
	ctx context.Context,
	input ports.SetAdminRiskReviewStatusInput,
) (ports.AdminRiskReviewRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	current, err := queryAdminRiskReview(ctx, tx, input.ReviewKey)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into admin_risk_review_states (
			review_key,
			business_id,
			status,
			reason,
			updated_by_admin_user_id,
			updated_at
		)
		values ($1, $2, $3, $4, $5, now())
		on conflict (review_key) do update
		set business_id = excluded.business_id,
			status = excluded.status,
			reason = excluded.reason,
			updated_by_admin_user_id = excluded.updated_by_admin_user_id,
			updated_at = now()
	`, input.ReviewKey,
		current.BusinessID.String(),
		input.Status,
		input.Reason,
		input.ActorAdminUser.String(),
	); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	record, err := queryAdminRiskReview(ctx, tx, input.ReviewKey)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	return record, nil
}

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

func (repo AdminAuthRepository) Create(ctx context.Context, input ports.CreateAdminSessionInput) error {
	_, err := repo.pool.Exec(ctx, `
		insert into admin_sessions (
			session_id,
			admin_user_id,
			refresh_token_hash,
			user_agent,
			ip_address,
			expires_at
		)
		values ($1, $2, $3, $4, $5, $6)
	`, input.SessionID.String(), input.AdminUserID.String(), input.RefreshTokenHash, input.UserAgent, input.IPAddress, input.ExpiresAt)
	return err
}

func (repo AdminAuthRepository) FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (ports.AdminSessionWithUser, error) {
	var session ports.AdminSessionWithUser
	var role string
	if err := repo.pool.QueryRow(ctx, `
		select
			s.session_id::text,
			s.admin_user_id::text,
			u.email,
			u.display_name,
			u.role,
			u.is_active,
			(s.revoked_at is not null) as revoked,
			s.expires_at
		from admin_sessions s
		join admin_users u on u.admin_user_id = s.admin_user_id
		where s.refresh_token_hash = $1
		limit 1
	`, refreshTokenHash).Scan(
		&session.SessionID,
		&session.AdminUserID,
		&session.Email,
		&session.DisplayName,
		&role,
		&session.UserIsActive,
		&session.Revoked,
		&session.ExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSessionWithUser{}, ErrNotFound
		}
		return ports.AdminSessionWithUser{}, err
	}
	session.Role = admindomain.Role(role)

	return session, nil
}

func (repo AdminAuthRepository) Revoke(ctx context.Context, sessionID common.ID) error {
	_, err := repo.pool.Exec(ctx, `
		update admin_sessions
		set revoked_at = now(), updated_at = now()
		where session_id = $1 and revoked_at is null
	`, sessionID.String())
	return err
}

func (repo AdminAuthRepository) findRecordByEmail(ctx context.Context, email string) (ports.AdminUserRecord, error) {
	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		select
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
		from admin_users
		where lower(email) = lower($1)
		limit 1
	`, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserRecord{}, ErrNotFound
		}
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func scanAdminUserRecord(row pgx.Row) (ports.AdminUserRecord, error) {
	var user ports.AdminUserRecord
	var role string
	if err := row.Scan(
		&user.UserID,
		&user.Email,
		&user.DisplayName,
		&role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	); err != nil {
		return ports.AdminUserRecord{}, err
	}
	user.Role = admindomain.Role(role)

	return user, nil
}

func scanAdminPreferencesRecord(row pgx.Row) (ports.AdminPreferencesRecord, error) {
	var preferences ports.AdminPreferencesRecord
	if err := row.Scan(
		&preferences.UserID,
		&preferences.Timezone,
		&preferences.PhoneNumber,
		&preferences.NotifyEmail,
		&preferences.NotifySMS,
		&preferences.AlertVerifications,
		&preferences.AlertMoneyRails,
		&preferences.AlertSubscriptions,
		&preferences.AlertPromotions,
		&preferences.AlertRisk,
		&preferences.AlertSupport,
		&preferences.DailyDigestTime,
		&preferences.CreatedAt,
		&preferences.UpdatedAt,
	); err != nil {
		return ports.AdminPreferencesRecord{}, err
	}

	return preferences, nil
}

func scanAdminPlatformSettingsRecord(row pgx.Row) (ports.AdminPlatformSettingsRecord, error) {
	var settings ports.AdminPlatformSettingsRecord
	if err := row.Scan(
		&settings.PlatformName,
		&settings.SupportEmail,
		&settings.VerificationSLAHours,
		&settings.PayoutReviewThresholdPesewas,
		&settings.MaintenanceMode,
		&settings.UpdatedAt,
	); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

func scanAdminVerificationCaseRecord(row pgx.Row) (ports.AdminVerificationCaseRecord, error) {
	var record ports.AdminVerificationCaseRecord
	var status string
	if err := row.Scan(
		&record.BusinessID,
		&record.BusinessName,
		&record.Handle,
		&record.OwnerName,
		&record.OwnerEmail,
		&record.PlanName,
		&record.PlanCode,
		&status,
		&record.SettlementProvider,
		&record.SettlementSubaccount,
		&record.SettlementAccountHint,
		&record.SubmittedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}
	record.VerificationStatus = business.VerificationStatus(status)

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

func scanAdminSubscriptionRecord(row pgx.Row) (ports.AdminSubscriptionRecord, error) {
	var record ports.AdminSubscriptionRecord
	var designLimit pgtype.Int4
	var trialEndsAt pgtype.Timestamptz
	var graceEndsAt pgtype.Timestamptz
	var canceledAt pgtype.Timestamptz
	var lastPaymentAt pgtype.Timestamptz
	var nextBillingAt pgtype.Timestamptz
	if err := row.Scan(
		&record.SubscriptionID,
		&record.BusinessID,
		&record.BusinessName,
		&record.Handle,
		&record.OwnerEmail,
		&record.PlanCode,
		&record.PlanName,
		&record.MonthlyFeeMinor,
		&record.CommissionBPS,
		&designLimit,
		&record.Status,
		&record.BillingMode,
		&record.Provider,
		&record.ProviderCustomerRef,
		&record.ProviderSubscriptionRef,
		&record.CurrentPeriodStart,
		&record.CurrentPeriodEnd,
		&trialEndsAt,
		&graceEndsAt,
		&record.CancelAtPeriodEnd,
		&canceledAt,
		&record.FailedPaymentCount,
		&record.LastInvoiceRef,
		&lastPaymentAt,
		&nextBillingAt,
		&record.DesignCount,
		&record.OrdersCount,
		&record.GMVMinor,
		&record.CommissionMinor,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	record.DesignLimit = int4Ptr(designLimit)
	record.TrialEndsAt = timestamptzPtr(trialEndsAt)
	record.GraceEndsAt = timestamptzPtr(graceEndsAt)
	record.CanceledAt = timestamptzPtr(canceledAt)
	record.LastPaymentAt = timestamptzPtr(lastPaymentAt)
	record.NextBillingAt = timestamptzPtr(nextBillingAt)
	record.Events = []ports.AdminSubscriptionEventRecord{}
	record.Invoices = []ports.AdminSubscriptionInvoiceRecord{}

	return record, nil
}

func scanAdminSubscriptionInvoiceRecord(row pgx.Row) (ports.AdminSubscriptionInvoiceRecord, error) {
	var record ports.AdminSubscriptionInvoiceRecord
	var paidAt pgtype.Timestamptz
	var failedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.BusinessID,
		&record.InvoiceID,
		&record.SubscriptionID,
		&record.InvoiceRef,
		&record.Status,
		&record.BillingMode,
		&record.Provider,
		&record.ProviderInvoiceRef,
		&record.PaymentURL,
		&record.AmountMinor,
		&record.Currency,
		&record.PeriodStart,
		&record.PeriodEnd,
		&record.DueAt,
		&paidAt,
		&failedAt,
		&record.FailureReason,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminSubscriptionInvoiceRecord{}, err
	}
	record.PaidAt = timestamptzPtr(paidAt)
	record.FailedAt = timestamptzPtr(failedAt)

	return record, nil
}

func scanAdminPlanRecord(row pgx.Row) (ports.AdminPlanRecord, error) {
	var record ports.AdminPlanRecord
	var designLimit pgtype.Int4
	if err := row.Scan(
		&record.PlanID,
		&record.Code,
		&record.Name,
		&record.MonthlyFeeMinor,
		&record.CommissionBPS,
		&designLimit,
		&record.IsActive,
		&record.BusinessCount,
		&record.ActiveSubscriptionCount,
		&record.EstimatedMRRMinor,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	record.DesignLimit = int4Ptr(designLimit)
	return record, nil
}

func scanAdminPromotionRecord(row pgx.Row) (ports.AdminPromotionRecord, error) {
	var record ports.AdminPromotionRecord
	var businessID pgtype.Text
	var targetCollectionID pgtype.Text
	var targetDesignID pgtype.Text
	var maxDiscountMinor pgtype.Int8
	var usageLimitGlobal pgtype.Int4
	var usageLimitPerCustomer pgtype.Int4
	var startsAt pgtype.Timestamptz
	var endsAt pgtype.Timestamptz
	if err := row.Scan(
		&record.PromotionID,
		&businessID,
		&record.BusinessName,
		&record.BusinessHandle,
		&record.Code,
		&record.Title,
		&record.Description,
		&record.DiscountType,
		&record.DiscountValue,
		&maxDiscountMinor,
		&record.MinSpendMinor,
		&usageLimitGlobal,
		&usageLimitPerCustomer,
		&record.FundingSource,
		&record.Scope,
		&targetCollectionID,
		&targetDesignID,
		&record.Status,
		&startsAt,
		&endsAt,
		&record.RedemptionCount,
		&record.DiscountRedeemedMinor,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	if businessID.Valid {
		id := common.ID(businessID.String)
		record.BusinessID = &id
	}
	if targetCollectionID.Valid {
		id := common.ID(targetCollectionID.String)
		record.TargetCollectionID = &id
	}
	if targetDesignID.Valid {
		id := common.ID(targetDesignID.String)
		record.TargetDesignID = &id
	}
	record.MaxDiscountMinor = int8Ptr(maxDiscountMinor)
	record.UsageLimitGlobal = int4Ptr(usageLimitGlobal)
	record.UsageLimitPerCustomer = int4Ptr(usageLimitPerCustomer)
	record.StartsAt = timestamptzPtr(startsAt)
	record.EndsAt = timestamptzPtr(endsAt)
	return record, nil
}

func scanAdminAdCampaignRecord(row pgx.Row) (ports.AdminAdCampaignRecord, error) {
	var record ports.AdminAdCampaignRecord
	var dailyCapMinor pgtype.Int8
	if err := row.Scan(
		&record.CampaignID,
		&record.BusinessID,
		&record.BusinessName,
		&record.BusinessHandle,
		&record.PlacementType,
		&record.TargetRefID,
		&record.TargetLabel,
		&record.Headline,
		&record.Description,
		&record.Status,
		&record.PricingModel,
		&record.BudgetMinor,
		&record.SpendMinor,
		&dailyCapMinor,
		&record.StartsAt,
		&record.EndsAt,
		&record.ImpressionCount,
		&record.ClickCount,
		&record.ClickRateBPS,
		&record.ReviewNote,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	record.DailyCapMinor = int8Ptr(dailyCapMinor)
	return record, nil
}

func scanAdminAdCampaignPaymentRecord(row pgx.Row) (ports.AdminAdCampaignPaymentRecord, error) {
	var record ports.AdminAdCampaignPaymentRecord
	var paidAt pgtype.Timestamptz
	var failedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.PaymentID,
		&record.CampaignID,
		&record.BusinessID,
		&record.Provider,
		&record.ProviderReference,
		&record.PaymentURL,
		&record.AmountMinor,
		&record.Currency,
		&record.Status,
		&paidAt,
		&failedAt,
		&record.FailureReason,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAdCampaignPaymentRecord{}, err
	}
	record.PaidAt = timestamptzPtr(paidAt)
	record.FailedAt = timestamptzPtr(failedAt)
	return record, nil
}

func scanAdminAffiliateRecord(row pgx.Row) (ports.AdminAffiliateRecord, error) {
	var record ports.AdminAffiliateRecord
	if err := row.Scan(
		&record.AffiliateID,
		&record.EntityType,
		&record.Code,
		&record.DisplayName,
		&record.ContactName,
		&record.Email,
		&record.Phone,
		&record.WebsiteURL,
		&record.CommissionModel,
		&record.CommissionRate,
		&record.CookieWindowDays,
		&record.PayoutMode,
		&record.PayoutReference,
		&record.Status,
		&record.Notes,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	return record, nil
}

func listAdminAffiliateConversions(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminAffiliateConversionRecord, error) {
	rows, err := tx.Query(ctx, `
		with ranked as (
			select
				affiliate_conversions.*,
				row_number() over (
					partition by affiliate_id
					order by updated_at desc, created_at desc
				) as rank
			from affiliate_conversions
		)
		select
			r.affiliate_conversion_id::text,
			r.affiliate_id::text,
			r.business_id::text,
			coalesce(b.name, '') as business_name,
			r.order_id::text,
			r.gross_minor,
			r.commission_minor,
			r.status,
			r.attribution_model,
			r.hold_until,
			r.created_at,
			r.updated_at
		from ranked r
		left join businesses b on b.business_id = r.business_id
		where r.rank <= 5
		order by r.affiliate_id, r.updated_at desc, r.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[common.ID][]ports.AdminAffiliateConversionRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateConversionRecord
		var holdUntil pgtype.Timestamptz
		if err := rows.Scan(
			&record.ConversionID,
			&record.AffiliateID,
			&record.BusinessID,
			&record.BusinessName,
			&record.OrderID,
			&record.GrossMinor,
			&record.CommissionMinor,
			&record.Status,
			&record.AttributionModel,
			&holdUntil,
			&record.CreatedAt,
			&record.UpdatedAt,
		); err != nil {
			return nil, err
		}
		record.HoldUntil = timestamptzPtr(holdUntil)
		out[record.AffiliateID] = append(out[record.AffiliateID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func listAdminAffiliatePayouts(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminAffiliatePayoutRecord, error) {
	rows, err := tx.Query(ctx, `
		with ranked as (
			select
				affiliate_payout_batches.*,
				row_number() over (
					partition by affiliate_id
					order by created_at desc, updated_at desc
				) as rank
			from affiliate_payout_batches
		)
		select
			r.payout_batch_id::text,
			r.affiliate_id::text,
			coalesce(a.display_name, '') as display_name,
			r.payout_mode,
			r.payout_reference,
			r.conversion_count,
			r.gross_minor,
			r.commission_minor,
			r.status,
			r.notes,
			r.created_at,
			r.updated_at
		from ranked r
		left join affiliates a on a.affiliate_id = r.affiliate_id
		where r.rank <= 3
		order by r.affiliate_id, r.created_at desc, r.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[common.ID][]ports.AdminAffiliatePayoutRecord{}
	for rows.Next() {
		record, err := scanAdminAffiliatePayoutRecord(rows)
		if err != nil {
			return nil, err
		}
		out[record.AffiliateID] = append(out[record.AffiliateID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func queryAdminAffiliateConversion(
	ctx context.Context,
	tx pgx.Tx,
	conversionID string,
) (ports.AdminAffiliateConversionRecord, error) {
	return scanAdminAffiliateConversionRecord(tx.QueryRow(ctx, `
		select
			ac.affiliate_conversion_id::text,
			ac.affiliate_id::text,
			ac.business_id::text,
			coalesce(b.name, '') as business_name,
			ac.order_id::text,
			ac.gross_minor,
			ac.commission_minor,
			ac.status,
			ac.attribution_model,
			ac.hold_until,
			ac.created_at,
			ac.updated_at
		from affiliate_conversions ac
		left join businesses b on b.business_id = ac.business_id
		where ac.affiliate_conversion_id = $1::uuid
	`, conversionID))
}

func scanAdminAffiliateConversionRecord(row pgx.Row) (ports.AdminAffiliateConversionRecord, error) {
	var record ports.AdminAffiliateConversionRecord
	var holdUntil pgtype.Timestamptz
	if err := row.Scan(
		&record.ConversionID,
		&record.AffiliateID,
		&record.BusinessID,
		&record.BusinessName,
		&record.OrderID,
		&record.GrossMinor,
		&record.CommissionMinor,
		&record.Status,
		&record.AttributionModel,
		&holdUntil,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateConversionRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateConversionRecord{}, err
	}
	record.HoldUntil = timestamptzPtr(holdUntil)
	return record, nil
}

func scanAdminAffiliatePayoutRecord(row pgx.Row) (ports.AdminAffiliatePayoutRecord, error) {
	var record ports.AdminAffiliatePayoutRecord
	if err := row.Scan(
		&record.PayoutBatchID,
		&record.AffiliateID,
		&record.DisplayName,
		&record.PayoutMode,
		&record.PayoutReference,
		&record.ConversionCount,
		&record.GrossMinor,
		&record.CommissionMinor,
		&record.Status,
		&record.Notes,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliatePayoutRecord{}, ErrNotFound
		}
		return ports.AdminAffiliatePayoutRecord{}, err
	}
	return record, nil
}

func validAffiliateConversionTransition(from string, to string) bool {
	if from == to {
		return true
	}
	switch from {
	case "pending":
		return to == "approved" || to == "reversed"
	case "approved":
		return to == "settled" || to == "reversed"
	default:
		return false
	}
}

func scanAdminReferralProgrammeRecord(row pgx.Row) (ports.AdminReferralProgrammeRecord, error) {
	var record ports.AdminReferralProgrammeRecord
	var maxRewardMinor pgtype.Int8
	var startsAt pgtype.Timestamptz
	var endsAt pgtype.Timestamptz
	if err := row.Scan(
		&record.ProgrammeID,
		&record.Title,
		&record.CodePrefix,
		&record.Audience,
		&record.ReferrerRewardKind,
		&record.RefereeRewardKind,
		&record.RewardType,
		&record.RewardValue,
		&maxRewardMinor,
		&record.QualifyingOrderMinMinor,
		&record.RewardHoldDays,
		&record.Status,
		&startsAt,
		&endsAt,
		&record.Notes,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	record.MaxRewardMinor = int8Ptr(maxRewardMinor)
	record.StartsAt = timestamptzPtr(startsAt)
	record.EndsAt = timestamptzPtr(endsAt)
	return record, nil
}

func scanAdminReferralCodeRecord(row pgx.Row) (ports.AdminReferralCodeRecord, error) {
	var record ports.AdminReferralCodeRecord
	var businessID pgtype.Text
	var ownerBusinessID pgtype.Text
	var ownerCustomerID pgtype.Text
	if err := row.Scan(
		&record.ReferralCodeID,
		&record.ProgrammeID,
		&businessID,
		&record.BusinessName,
		&record.BusinessHandle,
		&record.OwnerType,
		&ownerBusinessID,
		&ownerCustomerID,
		&record.OwnerLabel,
		&record.Code,
		&record.Status,
		&record.ReferralCount,
		&record.QualifiedCount,
		&record.RewardedCount,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}
	record.BusinessID = commonIDPtr(businessID)
	record.OwnerBusinessID = commonIDPtr(ownerBusinessID)
	record.OwnerCustomerID = commonIDPtr(ownerCustomerID)
	return record, nil
}

func listAdminReferralCodes(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminReferralCodeRecord, error) {
	rows, err := tx.Query(ctx, `
		with ranked as (
			select
				referral_codes.*,
				row_number() over (
					partition by referral_programme_id
					order by updated_at desc, created_at desc
				) as rank
			from referral_codes
		)
		`+adminReferralCodeSelect("ranked")+`
		where rc.rank <= 5
		order by rc.referral_programme_id, rc.updated_at desc, rc.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAdminReferralCodeRows(rows)
}

func listAdminReferralCodesForProgramme(
	ctx context.Context,
	tx pgx.Tx,
	programmeID common.ID,
) (map[common.ID][]ports.AdminReferralCodeRecord, error) {
	rows, err := tx.Query(ctx, adminReferralCodeSelect("referral_codes")+`
		where rc.referral_programme_id = $1::uuid
		order by rc.updated_at desc, rc.created_at desc
		limit 5
	`, programmeID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanAdminReferralCodeRows(rows)
}

func scanAdminReferralCodeRows(rows pgx.Rows) (map[common.ID][]ports.AdminReferralCodeRecord, error) {
	out := map[common.ID][]ports.AdminReferralCodeRecord{}
	for rows.Next() {
		record, err := scanAdminReferralCodeRecord(rows)
		if err != nil {
			return nil, err
		}
		out[record.ProgrammeID] = append(out[record.ProgrammeID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func listAdminPromotionRedemptions(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminPromotionRedemptionRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			pr.promotion_redemption_id::text,
			pr.promotion_id::text,
			pr.business_id::text,
			pr.order_id::text,
			pr.customer_id::text,
			coalesce(c.display_name, ''),
			pr.discount_minor::bigint,
			pr.status,
			pr.redeemed_at,
			pr.created_at,
			pr.updated_at
		from (
			select
				pr.*,
				row_number() over (
					partition by pr.promotion_id
					order by pr.created_at desc, pr.promotion_redemption_id
				) as redemption_rank
			from promotion_redemptions pr
		) pr
		left join customers c on c.customer_id = pr.customer_id
		where pr.redemption_rank <= 5
		order by pr.promotion_id, pr.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	redemptions := map[common.ID][]ports.AdminPromotionRedemptionRecord{}
	for rows.Next() {
		record, err := scanAdminPromotionRedemptionRecord(rows)
		if err != nil {
			return nil, err
		}
		redemptions[record.PromotionID] = append(redemptions[record.PromotionID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return redemptions, nil
}

func scanAdminPromotionRedemptionRecord(row pgx.Row) (ports.AdminPromotionRedemptionRecord, error) {
	var record ports.AdminPromotionRedemptionRecord
	var orderID pgtype.Text
	var customerID pgtype.Text
	var redeemedAt pgtype.Timestamptz
	if err := row.Scan(
		&record.PromotionRedemptionID,
		&record.PromotionID,
		&record.BusinessID,
		&orderID,
		&customerID,
		&record.CustomerName,
		&record.DiscountMinor,
		&record.Status,
		&redeemedAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminPromotionRedemptionRecord{}, err
	}
	record.OrderID = commonIDPtr(orderID)
	record.CustomerID = commonIDPtr(customerID)
	record.RedeemedAt = timestamptzPtr(redeemedAt)
	return record, nil
}

func scanAdminAuditEventRecord(row pgx.Row) (ports.AdminAuditEventRecord, error) {
	var record ports.AdminAuditEventRecord
	var actorUserID string
	var actorRole string
	var severity string
	var metadata []byte
	if err := row.Scan(
		&record.AuditEventID,
		&actorUserID,
		&record.ActorEmail,
		&actorRole,
		&record.Action,
		&record.TargetType,
		&record.TargetID,
		&record.TargetLabel,
		&record.Summary,
		&severity,
		&metadata,
		&record.IPAddress,
		&record.UserAgent,
		&record.CreatedAt,
	); err != nil {
		return ports.AdminAuditEventRecord{}, err
	}

	record.ActorUserID = common.ID(actorUserID)
	record.ActorRole = admindomain.Role(actorRole)
	record.Severity = admindomain.AuditSeverity(severity)
	if len(metadata) > 0 {
		if err := json.Unmarshal(metadata, &record.Metadata); err != nil {
			return ports.AdminAuditEventRecord{}, err
		}
	}
	if record.Metadata == nil {
		record.Metadata = map[string]string{}
	}

	return record, nil
}

func listAdminSubscriptionEvents(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminSubscriptionEventRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			e.business_id::text,
			e.subscription_event_id::text,
			e.event_type,
			e.summary,
			coalesce(u.email, ''),
			e.created_at
		from business_subscription_events e
		left join admin_users u on u.admin_user_id = e.actor_admin_user_id
		order by e.created_at desc
		limit 250
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := map[common.ID][]ports.AdminSubscriptionEventRecord{}
	for rows.Next() {
		var record ports.AdminSubscriptionEventRecord
		if err := rows.Scan(
			&record.BusinessID,
			&record.SubscriptionEventID,
			&record.EventType,
			&record.Summary,
			&record.ActorEmail,
			&record.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(events[record.BusinessID]) < 5 {
			events[record.BusinessID] = append(events[record.BusinessID], record)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

func listAdminSubscriptionInvoices(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminSubscriptionInvoiceRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			i.business_id::text,
			i.invoice_id::text,
			i.subscription_id::text,
			i.invoice_ref,
			i.status,
			i.billing_mode,
			i.provider,
			i.provider_invoice_ref,
			i.payment_url,
			i.amount_minor,
			i.currency,
			i.period_start,
			i.period_end,
			i.due_at,
			i.paid_at,
			i.failed_at,
			i.failure_reason,
			i.created_at,
			i.updated_at
		from business_subscription_invoices i
		order by
			case i.status
				when 'issued' then 1
				when 'failed' then 2
				when 'paid' then 3
				else 4
			end,
			i.created_at desc
		limit 300
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invoices := map[common.ID][]ports.AdminSubscriptionInvoiceRecord{}
	for rows.Next() {
		record, err := scanAdminSubscriptionInvoiceRecord(rows)
		if err != nil {
			return nil, err
		}
		if len(invoices[record.BusinessID]) < 5 {
			invoices[record.BusinessID] = append(invoices[record.BusinessID], record)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return invoices, nil
}

func ensureAdminSubscription(ctx context.Context, tx pgx.Tx, businessID common.ID) error {
	_, err := tx.Exec(ctx, `
		insert into business_subscriptions (
			business_id,
			plan_id,
			status,
			billing_mode,
			provider,
			current_period_start,
			current_period_end,
			trial_ends_at,
			next_billing_at
		)
		select
			b.business_id,
			b.plan_id,
			case when p.monthly_fee_minor = 0 then 'active' else 'trialing' end,
			'manual',
			'manual',
			now(),
			now() + interval '1 month',
			case when p.monthly_fee_minor > 0 then now() + interval '14 days' end,
			case when p.monthly_fee_minor > 0 then now() + interval '14 days' end
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1::uuid
		on conflict (business_id) do nothing
	`, businessID.String())
	return err
}

func getAdminSubscriptionRecordByBusiness(
	ctx context.Context,
	tx pgx.Tx,
	businessID common.ID,
) (ports.AdminSubscriptionRecord, error) {
	record, err := scanAdminSubscriptionRecord(tx.QueryRow(ctx, `
		with order_stats as (
			select
				business_id,
				count(*)::int as orders_count
			from orders
			where business_id = $1::uuid
			group by business_id
		),
		design_stats as (
			select
				business_id,
				count(*)::int as design_count
			from designs
			where business_id = $1::uuid and status = 'active'
			group by business_id
		),
		money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as gmv_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor
			from payments
			where business_id = $1::uuid
			group by business_id
		)
		select
			s.subscription_id::text,
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.email, ''),
			p.code,
			p.name,
			p.monthly_fee_minor::bigint,
			p.commission_bps::int,
			p.design_limit,
			s.status,
			s.billing_mode,
			s.provider,
			s.provider_customer_ref,
			s.provider_subscription_ref,
			s.current_period_start,
			s.current_period_end,
			s.trial_ends_at,
			s.grace_ends_at,
			s.cancel_at_period_end,
			s.canceled_at,
			s.failed_payment_count,
			s.last_invoice_ref,
			s.last_payment_at,
			s.next_billing_at,
			coalesce(ds.design_count, 0),
			coalesce(os.orders_count, 0),
			coalesce(ms.gmv_minor, 0),
			coalesce(ms.commission_minor, 0),
			s.updated_at
		from business_subscriptions s
		join businesses b on b.business_id = s.business_id
		join plans p on p.plan_id = s.plan_id
		left join design_stats ds on ds.business_id = b.business_id
		left join order_stats os on os.business_id = b.business_id
		left join money_stats ms on ms.business_id = b.business_id
		left join lateral (
			select u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		where s.business_id = $1::uuid
	`, businessID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSubscriptionRecord{}, ErrNotFound
		}
		return ports.AdminSubscriptionRecord{}, err
	}

	eventsByBusiness, err := listAdminSubscriptionEvents(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	invoicesByBusiness, err := listAdminSubscriptionInvoices(ctx, tx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	record.Events = eventsByBusiness[record.BusinessID]
	record.Invoices = invoicesByBusiness[record.BusinessID]

	return record, nil
}

func insertAdminSubscriptionEvent(
	ctx context.Context,
	tx pgx.Tx,
	subscriptionID common.ID,
	businessID common.ID,
	actorAdminUserID common.ID,
	eventType string,
	summary string,
	metadata map[string]string,
) error {
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		insert into business_subscription_events (
			subscription_id,
			business_id,
			actor_admin_user_id,
			event_type,
			summary,
			metadata
		)
		values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb)
	`, subscriptionID.String(), businessID.String(), actorAdminUserID.String(), eventType, summary, string(metadataJSON))
	return err
}

func commonIDPtr(value pgtype.Text) *common.ID {
	if !value.Valid {
		return nil
	}
	id := common.ID(value.String)
	return &id
}

func int4Ptr(value pgtype.Int4) *int {
	if !value.Valid {
		return nil
	}
	out := int(value.Int32)
	return &out
}

func int8Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	out := value.Int64
	return &out
}

func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	out := value.Time
	return &out
}

func adminPlansQuery() string {
	return adminPlanSelect("plans")
}

func adminPlanSelect(source string) string {
	return `
		select
			p.plan_id::text,
			p.code,
			p.name,
			p.monthly_fee_minor::bigint,
			p.commission_bps::int,
			p.design_limit,
			p.is_active,
			coalesce(b.business_count, 0)::int,
			coalesce(s.active_subscription_count, 0)::int,
			(coalesce(s.billable_subscription_count, 0) * p.monthly_fee_minor)::bigint,
			p.created_at,
			p.updated_at
		from ` + source + ` p
		left join lateral (
			select count(*)::int as business_count
			from businesses b
			where b.plan_id = p.plan_id
		) b on true
		left join lateral (
			select
				count(*) filter (where s.status <> 'canceled')::int as active_subscription_count,
				count(*) filter (
					where s.status <> 'canceled' and p.monthly_fee_minor > 0
				)::int as billable_subscription_count
			from business_subscriptions s
			where s.plan_id = p.plan_id
		) s on true
	`
}

func adminPromotionsQuery() string {
	return adminPromotionSelect("promotions")
}

func adminPromotionSelect(source string) string {
	return `
		select
			p.promotion_id::text,
			p.business_id::text,
			coalesce(b.name, ''),
			coalesce(b.handle, ''),
			coalesce(p.code, ''),
			p.title,
			p.description,
			p.discount_type,
			p.discount_value::bigint,
			p.max_discount_minor,
			p.min_spend_minor::bigint,
			p.usage_limit_global,
			p.usage_limit_per_customer,
			p.funding_source,
			p.scope,
			p.target_collection_id::text,
			p.target_design_id::text,
			p.status,
			p.starts_at,
			p.ends_at,
			coalesce(r.redemption_count, 0)::int,
			coalesce(r.discount_redeemed_minor, 0)::bigint,
			p.created_at,
			p.updated_at
		from ` + source + ` p
		left join businesses b on b.business_id = p.business_id
		left join lateral (
			select
				count(*) filter (where pr.status = 'applied')::int as redemption_count,
				coalesce(sum(pr.discount_minor) filter (where pr.status = 'applied'), 0)::bigint as discount_redeemed_minor
			from promotion_redemptions pr
			where pr.promotion_id = p.promotion_id
		) r on true
	`
}

func adminAdCampaignsQuery() string {
	return adminAdCampaignSelect("ad_campaigns")
}

func adminAdCampaignSelect(source string) string {
	return `
		select
			c.campaign_id::text,
			c.advertiser_business_id::text,
			b.name,
			b.handle,
			c.placement_type,
			c.target_ref_id,
			case
				when c.placement_type = 'promoted_design' then coalesce(d.title, c.target_ref_id)
				when c.placement_type = 'homepage_hero' then b.name || ' homepage hero'
				else b.name
			end as target_label,
			c.headline,
			c.description,
			c.status,
			c.pricing_model,
			c.budget_minor::bigint,
			c.spend_to_date_minor::bigint,
			c.daily_cap_minor,
			c.starts_at,
			c.ends_at,
			coalesce(e.impression_count, 0)::int,
			coalesce(e.click_count, 0)::int,
			case
				when coalesce(e.impression_count, 0) = 0 then 0
				else round((coalesce(e.click_count, 0)::numeric / e.impression_count::numeric) * 10000)::int
			end as click_rate_bps,
			c.review_note,
			c.created_at,
			c.updated_at
		from ` + source + ` c
		join businesses b on b.business_id = c.advertiser_business_id
		left join designs d on d.business_id = c.advertiser_business_id
			and d.design_id::text = c.target_ref_id
		left join lateral (
			select
				count(*) filter (where event_type = 'impression')::int as impression_count,
				count(*) filter (where event_type = 'click')::int as click_count
			from ad_events e
			where e.campaign_id = c.campaign_id
		) e on true
	`
}

func adminAdCampaignPaymentSelect(source string) string {
	return `
		select
			ap.payment_id::text,
			ap.campaign_id::text,
			ap.advertiser_business_id::text,
			ap.provider,
			ap.provider_reference,
			ap.payment_url,
			ap.amount_minor::bigint,
			ap.currency,
			ap.status,
			ap.paid_at,
			ap.failed_at,
			ap.failure_reason,
			ap.created_at,
			ap.updated_at
		from ` + source + ` ap
	`
}

func listAdminAdCampaignPayments(
	ctx context.Context,
	tx pgx.Tx,
) (map[common.ID][]ports.AdminAdCampaignPaymentRecord, error) {
	rows, err := tx.Query(ctx, adminAdCampaignPaymentSelect("ad_campaign_payments")+`
		order by ap.created_at desc
		limit 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	payments := map[common.ID][]ports.AdminAdCampaignPaymentRecord{}
	for rows.Next() {
		record, err := scanAdminAdCampaignPaymentRecord(rows)
		if err != nil {
			return nil, err
		}
		payments[record.CampaignID] = append(payments[record.CampaignID], record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func listAdminAdCampaignPaymentsForCampaign(
	ctx context.Context,
	tx pgx.Tx,
	campaignID common.ID,
) ([]ports.AdminAdCampaignPaymentRecord, error) {
	rows, err := tx.Query(ctx, adminAdCampaignPaymentSelect("ad_campaign_payments")+`
		where ap.campaign_id = $1::uuid
		order by ap.created_at desc
		limit 10
	`, campaignID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAdCampaignPaymentRecord{}
	for rows.Next() {
		record, err := scanAdminAdCampaignPaymentRecord(rows)
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

func adminAffiliatesQuery() string {
	return adminAffiliateSelect("affiliates")
}

func adminAffiliateSelect(source string) string {
	return `
		select
			a.affiliate_id::text,
			a.entity_type,
			a.code,
			a.display_name,
			a.contact_name,
			a.email,
			a.phone,
			a.website_url,
			a.commission_model,
			a.commission_rate::bigint,
			a.cookie_window_days::int,
			a.payout_mode,
			a.payout_reference,
			a.status,
			a.notes,
			a.created_at,
			a.updated_at
		from ` + source + ` a
	`
}

func adminReferralProgrammesQuery() string {
	return adminReferralProgrammeSelect("referral_programmes")
}

func adminReferralProgrammeSelect(source string) string {
	return `
		select
			r.referral_programme_id::text,
			r.title,
			r.code_prefix,
			r.audience,
			r.referrer_reward_kind,
			r.referee_reward_kind,
			r.reward_type,
			r.reward_value::bigint,
			r.max_reward_minor,
			r.qualifying_order_min_minor::bigint,
			r.reward_hold_days::int,
			r.status,
			r.starts_at,
			r.ends_at,
			r.notes,
			r.created_at,
			r.updated_at
		from ` + source + ` r
	`
}

func adminReferralCodeSelect(source string) string {
	return `
		select
			rc.referral_code_id::text,
			rc.referral_programme_id::text,
			rc.business_id::text,
			coalesce(b.name, '') as business_name,
			coalesce(b.handle, '') as business_handle,
			rc.owner_type,
			rc.owner_business_id::text,
			rc.owner_customer_id::text,
			case
				when rc.owner_type = 'business' then coalesce(owner_business.name, 'Business referral')
				when rc.owner_type = 'customer' then coalesce(c.display_name, c.email, 'Customer referral')
				else 'Platform'
			end as owner_label,
			rc.code,
			rc.status,
			coalesce(stats.referral_count, 0)::int,
			coalesce(stats.qualified_count, 0)::int,
			coalesce(stats.rewarded_count, 0)::int,
			rc.created_at,
			rc.updated_at
		from ` + source + ` rc
		left join businesses b on b.business_id = rc.business_id
		left join businesses owner_business on owner_business.business_id = rc.owner_business_id
		left join customers c on c.customer_id = rc.owner_customer_id
		left join (
			select
				referral_code_id,
				count(*)::int as referral_count,
				count(*) filter (where status in ('qualified', 'rewarded'))::int as qualified_count,
				count(*) filter (where status = 'rewarded')::int as rewarded_count
			from referrals
			group by referral_code_id
		) stats on stats.referral_code_id = rc.referral_code_id
	`
}

func queryAdminMoneyPayoutReview(
	ctx context.Context,
	tx pgx.Tx,
	businessID string,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	var record ports.AdminMoneyPayoutReviewRecord
	var holdUpdatedAt time.Time
	if err := tx.QueryRow(ctx, `
		with money_stats as (
			select
				business_id,
				coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0)::bigint as succeeded_minor,
				coalesce(sum(commission_minor) filter (where status = 'succeeded'), 0)::bigint as commission_minor,
				count(*) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				)::int as failed_30d,
				count(*) filter (where status = 'initiated')::int as initiated_count
			from payments
			where business_id = $1
			group by business_id
		)
		select
			b.business_id::text,
			b.name,
			coalesce(b.settlement_provider_subaccount, ''),
			case
				when coalesce(h.is_active, false) then 'blocked'
				when b.operational_status = 'suspended'
					or b.verification_status = 'rejected' then 'blocked'
				when coalesce(b.settlement_provider_subaccount, '') = ''
					or b.verification_status <> 'verified'
					or coalesce(ms.failed_30d, 0) > 0
					or coalesce(ms.initiated_count, 0) > 0 then 'review'
				else 'ready'
			end as status,
			greatest(coalesce(ms.succeeded_minor, 0) - coalesce(ms.commission_minor, 0), 0)::bigint as settlement_minor,
			coalesce(ms.commission_minor, 0)::bigint as commission_minor,
			case
				when coalesce(h.is_active, false) then 'Operator settlement review hold: ' || h.reason
				when b.operational_status = 'suspended' then 'Keep settlement on hold while the business is suspended.'
				when b.verification_status = 'rejected' then 'Do not enable settlement until business verification is restored.'
				when coalesce(b.settlement_provider_subaccount, '') = '' then 'Connect and verify the Paystack subaccount before settlement.'
				when b.verification_status <> 'verified' then 'Wait for business verification before enabling payment settlement.'
				when coalesce(ms.failed_30d, 0) > 0 then 'Review failed payments before account or payout changes.'
				when coalesce(ms.initiated_count, 0) > 0 then 'Watch pending payments until provider confirmation arrives.'
				else 'No action needed; split settlement is healthy.'
			end as next_action,
			coalesce(h.is_active, false) as hold_active,
			coalesce(h.reason, '') as hold_reason,
			coalesce(h.updated_at, b.updated_at) as hold_updated_at
		from businesses b
		left join money_stats ms on ms.business_id = b.business_id
		left join admin_settlement_review_holds h on h.business_id = b.business_id and h.is_active
		where b.business_id = $1
	`, businessID).Scan(
		&record.ID,
		&record.BusinessName,
		&record.SubaccountRef,
		&record.Status,
		&record.SettlementMinor,
		&record.CommissionMinor,
		&record.NextAction,
		&record.HoldActive,
		&record.HoldReason,
		&holdUpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminMoneyPayoutReviewRecord{}, ErrNotFound
		}
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	if record.HoldActive {
		record.HoldUpdatedAt = &holdUpdatedAt
	}

	return record, nil
}

func queryAdminRiskReview(
	ctx context.Context,
	tx pgx.Tx,
	reviewKey string,
) (ports.AdminRiskReviewRecord, error) {
	records, err := queryAdminRiskReviews(ctx, tx, reviewKey)
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}
	if len(records) == 0 {
		return ports.AdminRiskReviewRecord{}, ErrNotFound
	}
	return records[0], nil
}

func queryAdminRiskReviews(
	ctx context.Context,
	tx pgx.Tx,
	reviewKey string,
) ([]ports.AdminRiskReviewRecord, error) {
	rows, err := tx.Query(ctx, `
		with payment_stats as (
			select
				business_id,
				count(*) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				)::int as failed_30d,
				max(updated_at) filter (
					where status = 'failed'
						and updated_at >= now() - interval '30 days'
				) as failed_at
			from payments
			group by business_id
		),
		replay_stats as (
			select
				p.business_id,
				count(*)::int as queued_replays,
				max(r.created_at) as replay_at
			from admin_money_replay_requests r
			join payments p on p.provider_reference = r.provider_reference
			where r.status = 'queued'
			group by p.business_id
		),
		active_holds as (
			select
				business_id,
				reason,
				updated_at
			from admin_settlement_review_holds
			where is_active
		),
		signals as (
			select
				'payment_failures:' || b.business_id::text as review_key,
				b.business_id,
				'Payment failure spike' as title,
				b.name as business_name,
				case
					when coalesce(ps.failed_30d, 0) >= 3
						or coalesce(rs.queued_replays, 0) > 0 then 'high'
					else 'medium'
				end as level,
				coalesce(ps.failed_30d, 0)::text
					|| ' failed payment(s) in the last 30 days'
					|| case
						when coalesce(rs.queued_replays, 0) > 0
							then '; ' || rs.queued_replays::text || ' replay request(s) queued.'
						else '.'
					end as reason,
				'Money rails' as owner,
				greatest(
					coalesce(ps.failed_at, b.updated_at),
					coalesce(rs.replay_at, b.updated_at),
					b.updated_at
				) as signal_at
			from businesses b
			join payment_stats ps on ps.business_id = b.business_id
			left join replay_stats rs on rs.business_id = b.business_id
			where coalesce(ps.failed_30d, 0) > 0

			union all

			select
				'settlement_hold:' || b.business_id::text as review_key,
				b.business_id,
				'Settlement review hold' as title,
				b.name as business_name,
				'high' as level,
				'Operator hold is active: ' || h.reason as reason,
				'Money rails' as owner,
				h.updated_at as signal_at
			from businesses b
			join active_holds h on h.business_id = b.business_id

			union all

			select
				'suspended_business:' || b.business_id::text as review_key,
				b.business_id,
				'Business suspended' as title,
				b.name as business_name,
				'high' as level,
				coalesce(nullif(b.suspension_reason, ''), 'Business is suspended and needs operator review.') as reason,
				'Trust review' as owner,
				coalesce(b.suspended_at, b.updated_at) as signal_at
			from businesses b
			where b.operational_status = 'suspended'

			union all

			select
				'rejected_verification:' || b.business_id::text as review_key,
				b.business_id,
				'Rejected verification' as title,
				b.name as business_name,
				'high' as level,
				'Business verification is rejected; review owner and settlement evidence before reinstatement.' as reason,
				'Verification' as owner,
				b.updated_at as signal_at
			from businesses b
			where b.verification_status = 'rejected'

			union all

			select
				'missing_subaccount:' || b.business_id::text as review_key,
				b.business_id,
				'Payout subaccount missing' as title,
				b.name as business_name,
				'medium' as level,
				'Business is verified but has no settlement subaccount configured.' as reason,
				'Payments setup' as owner,
				b.updated_at as signal_at
			from businesses b
			where b.verification_status = 'verified'
				and coalesce(b.settlement_provider_subaccount, '') = ''
		)
		select
			s.review_key,
			s.business_id::text,
			s.title,
			s.business_name,
			s.level,
			s.reason,
			s.owner,
			coalesce(st.status, 'open') as status,
			coalesce(st.updated_at, s.signal_at, now()) as updated_at
		from signals s
		left join admin_risk_review_states st on st.review_key = s.review_key
		where ($1::text = '' or s.review_key = $1)
		order by
			case coalesce(st.status, 'open')
				when 'open' then 1
				else 2
			end,
			case s.level
				when 'high' then 1
				when 'medium' then 2
				else 3
			end,
			coalesce(st.updated_at, s.signal_at, now()) desc,
			s.business_name
		limit 100
	`, reviewKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminRiskReviewRecord{}
	for rows.Next() {
		record, err := scanAdminRiskReviewRecord(rows)
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

func scanAdminRiskReviewRecord(row pgx.Row) (ports.AdminRiskReviewRecord, error) {
	var record ports.AdminRiskReviewRecord
	if err := row.Scan(
		&record.ReviewKey,
		&record.BusinessID,
		&record.Title,
		&record.BusinessName,
		&record.Level,
		&record.Reason,
		&record.Owner,
		&record.Status,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminRiskReviewRecord{}, err
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

func adminEmailTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "admin_users_email_unique_idx"
}

func planCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "plans_code_key"
}

func subscriptionInvoiceOpen(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgUniqueViolation &&
		pgErr.ConstraintName == "business_subscription_invoices_one_open_idx"
}

func promotionCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "promotions_active_code_unique_idx"
}

func affiliateCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "affiliates_code_unique_idx"
}

func referralProgrammeCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "referral_programmes_code_prefix_unique_idx"
}

func referralCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "referral_codes_code_unique_idx"
}

func isOpenAdCampaignPayment(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "ad_campaign_payments_one_open_idx"
}

func nullableTextArg(value string) any {
	if value == "" {
		return nil
	}
	return value
}
