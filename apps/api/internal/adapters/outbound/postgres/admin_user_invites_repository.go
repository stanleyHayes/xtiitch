package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Operator invites. The admin_users row is created inactive with an empty
// password hash, so the account exists (reserving the email, and visible in the
// operator list as pending) but cannot be signed into until the invited person
// sets their own password from the one-time link.

// CreateAdminUserInvite writes the operator and the invite together. A partial
// write here is the worst outcome — an operator nobody can activate whose email
// is now taken — so both statements share one transaction.
//
// Re-inviting supersedes: any live invite for the operator is consumed first,
// which is what the partial unique index on (admin_user_id) where consumed_at is
// null requires, and what stops a superseded link from still working.
func (repo AdminAuthRepository) CreateAdminUserInvite(
	ctx context.Context,
	input ports.CreateAdminUserInviteInput,
) (ports.AdminUserRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	user, err := scanAdminUserRecord(tx.QueryRow(ctx, `
		insert into admin_users (
			admin_user_id,
			email,
			display_name,
			password_hash,
			role,
			is_active
		)
		values ($1, $2, $3, '', $4, false)
		on conflict (email) do update
			set display_name = excluded.display_name,
				role = excluded.role,
				updated_at = now()
			where admin_users.is_active = false
		returning
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), input.Email, input.DisplayName, string(input.Role)))
	if err != nil {
		// The conflict clause only updates a still-pending operator, so an
		// active account with this email leaves no row to return.
		if errors.Is(err, pgx.ErrNoRows) || adminEmailTaken(err) {
			return ports.AdminUserRecord{}, admindomain.ErrUserEmailTaken
		}
		return ports.AdminUserRecord{}, err
	}

	// Supersede any outstanding invite before issuing the new one.
	if _, err := tx.Exec(ctx, `
		update admin_user_invites
		set consumed_at = $2
		where admin_user_id = $1 and consumed_at is null
	`, user.UserID.String(), input.Now); err != nil {
		return ports.AdminUserRecord{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into admin_user_invites (
			invite_id,
			admin_user_id,
			token_hash,
			sent_to_email,
			sent_to_phone,
			invited_by,
			expires_at
		)
		values ($1, $2, $3, $4, $5, nullif($6, '')::uuid, $7)
	`,
		input.InviteID.String(),
		user.UserID.String(),
		input.TokenHash,
		input.SentToEmail,
		input.SentToPhone,
		input.InvitedBy.String(),
		input.ExpiresAt,
	); err != nil {
		return ports.AdminUserRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminUserRecord{}, err
	}
	return user, nil
}

// FindAdminUserInvite resolves a token hash. Expiry and prior consumption are
// filtered in SQL rather than checked by the caller, so there is exactly one
// place that decides whether an invite is still usable.
func (repo AdminAuthRepository) FindAdminUserInvite(
	ctx context.Context,
	tokenHash string,
	now time.Time,
) (ports.AdminUserInviteRecord, error) {
	var (
		record ports.AdminUserInviteRecord
		id     string
		userID string
		role   string
	)
	err := repo.pool.QueryRow(ctx, `
		select
			i.invite_id::text,
			i.admin_user_id::text,
			u.email,
			u.display_name,
			u.role,
			i.expires_at
		from admin_user_invites i
		join admin_users u on u.admin_user_id = i.admin_user_id
		where i.token_hash = $1
			and i.consumed_at is null
			and i.expires_at > $2
	`, tokenHash, now).Scan(
		&id, &userID, &record.Email, &record.DisplayName, &role, &record.ExpiresAt,
	)
	if err != nil {
		return ports.AdminUserInviteRecord{}, err
	}
	record.InviteID = common.ID(id)
	record.UserID = common.ID(userID)
	record.Role = admindomain.Role(role)
	return record, nil
}

// ConsumeAdminUserInvite sets the password, activates the operator and marks
// the invite used. The update filters on consumed_at is null, so a replayed
// link affects no rows and returns ErrNoRows rather than resetting a password
// that is already in use.
func (repo AdminAuthRepository) ConsumeAdminUserInvite(
	ctx context.Context,
	input ports.ConsumeAdminUserInviteInput,
) (ports.AdminUserRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	if err := tx.QueryRow(ctx, `
		update admin_user_invites
		set consumed_at = $2
		where token_hash = $1
			and consumed_at is null
			and expires_at > $2
		returning admin_user_id::text
	`, input.TokenHash, input.Now).Scan(&userID); err != nil {
		return ports.AdminUserRecord{}, err
	}

	user, err := scanAdminUserRecord(tx.QueryRow(ctx, `
		update admin_users
		set password_hash = $2,
			is_active = true,
			failed_login_attempts = 0,
			login_locked_until = null,
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
	`, userID, input.PasswordHash))
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminUserRecord{}, err
	}
	return user, nil
}
