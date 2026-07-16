package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo BusinessIdentityRepository) ListBusinessUsers(
	ctx context.Context,
	scope common.TenantScope,
) ([]ports.BusinessUserRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select
			business_user_id::text,
			business_id::text,
			email,
			display_name,
			coalesce(phone, ''),
			role,
			is_active,
			created_at,
			updated_at
		from business_users
		where business_id = $1
		order by
			case role
				when 'owner' then 1
				when 'admin' then 2
				else 3
			end,
			lower(display_name),
			created_at
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []ports.BusinessUserRecord
	for rows.Next() {
		user, err := scanBusinessUserRecord(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return users, nil
}

// ensureStaffCapacity caps a business's ACTIVE dashboard users at its plan's
// staff_limit (NULL = unlimited). It locks the business row so two concurrent
// invites cannot both pass the check and land one seat over.
//
// The cap was sold per plan (Free 1 / Starter 1 / Growth 3 / Studio 10) and
// enforced nowhere, so every plan had unlimited seats until migration 000088 gave
// it a column to read.
//
// Only ACTIVE users count, so deactivating a user frees their seat. Businesses
// already over the cap when this shipped keep their existing users -- this blocks
// the next create rather than retroactively locking anyone out.
func ensureStaffCapacity(ctx context.Context, tx pgx.Tx, businessID common.ID) error {
	var limit sql.NullInt64
	var activeCount int
	err := tx.QueryRow(ctx, `
		select p.staff_limit,
			(
				select count(*)::int
				from business_users u
				where u.business_id = b.business_id and u.is_active
			) as active_users
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1
		for update of b
	`, businessID.String()).Scan(&limit, &activeCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if limit.Valid && int64(activeCount) >= limit.Int64 {
		return ports.ErrPlanLimitExceeded
	}
	return nil
}

func (repo BusinessIdentityRepository) CreateBusinessUser(
	ctx context.Context,
	scope common.TenantScope,
	input ports.CreateBusinessUserInput,
) (ports.BusinessUserRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	if err := ensureStaffCapacity(ctx, tx, scope.BusinessID); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	user, err := scanBusinessUserRecord(tx.QueryRow(ctx, `
		insert into business_users (
			business_user_id,
			business_id,
			email,
			display_name,
			phone,
			password_hash,
			role,
			is_active
		)
		values ($1, $2, $3, $4, $5, $6, $7, true)
		returning
			business_user_id::text,
			business_id::text,
			email,
			display_name,
			coalesce(phone, ''),
			role,
			is_active,
			created_at,
			updated_at
	`,
		input.UserID.String(), input.BusinessID.String(), input.Email, input.DisplayName,
		nullIfEmpty(input.Phone), input.PasswordHash, string(input.Role),
	))
	if err != nil {
		if businessUserEmailTaken(err) {
			return ports.BusinessUserRecord{}, business.ErrUserEmailTaken
		}
		return ports.BusinessUserRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	return user, nil
}

func (repo BusinessIdentityRepository) UpdateBusinessUser(
	ctx context.Context,
	scope common.TenantScope,
	input ports.UpdateBusinessUserInput,
) (ports.BusinessUserRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	user, err := scanBusinessUserRecord(tx.QueryRow(ctx, `
		update business_users
		set display_name = $3,
			phone = $6,
			role = $4,
			is_active = $5,
			updated_at = now()
		where business_user_id = $1
			and business_id = $2
			and role <> 'owner'
		returning
			business_user_id::text,
			business_id::text,
			email,
			display_name,
			coalesce(phone, ''),
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), scope.BusinessID.String(), input.DisplayName, string(input.Role), input.IsActive, nullIfEmpty(input.Phone)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessUserRecord{}, ports.ErrNotFound
		}
		return ports.BusinessUserRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	return user, nil
}

func (repo BusinessIdentityRepository) UpdateBusinessUserPassword(
	ctx context.Context,
	scope common.TenantScope,
	input ports.UpdateBusinessUserPasswordInput,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update business_users
		set password_hash = $3,
			updated_at = now()
		where business_user_id = $1
			and business_id = $2
			and role <> 'owner'
	`, input.UserID.String(), scope.BusinessID.String(), input.PasswordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrNotFound
	}

	return tx.Commit(ctx)
}

func (repo BusinessIdentityRepository) UpdateOwnPassword(
	ctx context.Context,
	scope common.TenantScope,
	input ports.UpdateBusinessUserPasswordInput,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// No role guard here: the caller updates their own credential, identified by
	// their authenticated user id, so an owner can rotate their own password.
	tag, err := tx.Exec(ctx, `
		update business_users
		set password_hash = $3,
			updated_at = now()
		where business_user_id = $1
			and business_id = $2
	`, input.UserID.String(), scope.BusinessID.String(), input.PasswordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrNotFound
	}

	return tx.Commit(ctx)
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo BusinessIdentityRepository) TransferBusinessOwner(
	ctx context.Context,
	scope common.TenantScope,
	input ports.TransferBusinessOwnerInput,
) (ports.TransferBusinessOwnerResult, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.TransferBusinessOwnerResult{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.TransferBusinessOwnerResult{}, err
	}

	rows, err := tx.Query(ctx, `
		select business_user_id::text, role, is_active
		from business_users
		where business_id = $1
			and business_user_id in ($2, $3)
		order by business_user_id
		for update
	`, scope.BusinessID.String(), input.CurrentOwnerUserID.String(), input.NewOwnerUserID.String())
	if err != nil {
		return ports.TransferBusinessOwnerResult{}, err
	}
	defer rows.Close()

	type lockedUser struct {
		role     business.UserRole
		isActive bool
	}
	locked := map[common.ID]lockedUser{}
	for rows.Next() {
		var userID common.ID
		var role string
		var active bool
		if err := rows.Scan(&userID, &role, &active); err != nil {
			return ports.TransferBusinessOwnerResult{}, err
		}
		locked[userID] = lockedUser{role: business.UserRole(role), isActive: active}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return ports.TransferBusinessOwnerResult{}, err
	}
	rows.Close()

	currentOwner, ok := locked[input.CurrentOwnerUserID]
	if !ok || !currentOwner.isActive || currentOwner.role != business.UserRoleOwner {
		return ports.TransferBusinessOwnerResult{}, ports.ErrNotFound
	}
	newOwner, ok := locked[input.NewOwnerUserID]
	if !ok || !newOwner.isActive || newOwner.role != business.UserRoleAdmin {
		return ports.TransferBusinessOwnerResult{}, ports.ErrNotFound
	}

	updatedRows, err := tx.Query(ctx, `
		update business_users
		set role = case
				when business_user_id = $2 then 'admin'
				when business_user_id = $3 then 'owner'
				else role
			end,
			updated_at = now()
		where business_id = $1
			and business_user_id in ($2, $3)
		returning
			business_user_id::text,
			business_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, scope.BusinessID.String(), input.CurrentOwnerUserID.String(), input.NewOwnerUserID.String())
	if err != nil {
		return ports.TransferBusinessOwnerResult{}, err
	}
	defer updatedRows.Close()

	updated := map[common.ID]ports.BusinessUserRecord{}
	for updatedRows.Next() {
		user, err := scanBusinessUserRecord(updatedRows)
		if err != nil {
			return ports.TransferBusinessOwnerResult{}, err
		}
		updated[user.UserID] = user
	}
	if err := updatedRows.Err(); err != nil {
		updatedRows.Close()
		return ports.TransferBusinessOwnerResult{}, err
	}
	updatedRows.Close()

	previousOwner, hasPrevious := updated[input.CurrentOwnerUserID]
	transferredOwner, hasTransferred := updated[input.NewOwnerUserID]
	if !hasPrevious || !hasTransferred {
		return ports.TransferBusinessOwnerResult{}, ports.ErrNotFound
	}

	if _, err := tx.Exec(ctx, `
		update auth_sessions
		set revoked_at = now(),
			updated_at = now()
		where business_id = $1
			and business_user_id in ($2, $3)
			and revoked_at is null
	`, scope.BusinessID.String(), input.CurrentOwnerUserID.String(), input.NewOwnerUserID.String()); err != nil {
		return ports.TransferBusinessOwnerResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.TransferBusinessOwnerResult{}, err
	}

	return ports.TransferBusinessOwnerResult{
		PreviousOwner: previousOwner,
		NewOwner:      transferredOwner,
	}, nil
}
