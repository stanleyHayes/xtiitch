package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

func (repo AdminAuthRepository) UpdateAdminProfile(
	ctx context.Context,
	input ports.UpdateAdminProfileInput) (ports.AdminUserRecord,
	error,
) {
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

	return ports.AdminRolePermissionsRecord(input), nil
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
