package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// scanBusinessUserProfileRecord reads the §9 own-profile projection: the
// team-management columns plus the WhatsApp chat number and the phone
// verification marker.
func scanBusinessUserProfileRecord(row pgx.Row) (ports.BusinessUserProfileRecord, error) {
	var user ports.BusinessUserProfileRecord
	var role string
	if err := row.Scan(
		&user.UserID,
		&user.BusinessID,
		&user.Email,
		&user.DisplayName,
		&user.Phone,
		&user.PhoneVerifiedAt,
		&user.WhatsAppNumber,
		&role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	); err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}
	user.Role = business.UserRole(role)
	return user, nil
}

// businessUserWhatsAppTaken reports a clash on the globally-unique WhatsApp
// number (it doubles as the WhatsApp sign-in identity, migration 000063).
func businessUserWhatsAppTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "business_users_whatsapp_unique_idx"
}

// FindBusinessUserProfileByID returns the caller's own profile row (§9),
// tenant-scoped like every other business_users read.
func (repo BusinessIdentityRepository) FindBusinessUserProfileByID(
	ctx context.Context,
	scope common.TenantScope,
	userID common.ID,
) (ports.BusinessUserProfileRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}

	user, err := scanBusinessUserProfileRecord(tx.QueryRow(ctx, `
		select
			business_user_id::text,
			business_id::text,
			email,
			display_name,
			coalesce(phone, ''),
			phone_verified_at,
			coalesce(whatsapp_number, ''),
			role,
			is_active,
			created_at,
			updated_at
		from business_users
		where business_user_id = $1
			and business_id = $2
	`, userID.String(), scope.BusinessID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessUserProfileRecord{}, ports.ErrNotFound
		}
		return ports.BusinessUserProfileRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}

	return user, nil
}

// UpdateOwnBusinessUserProfile writes the caller's own profile row (§9).
// Unlike UpdateBusinessUser there is deliberately NO `role <> 'owner'` guard:
// self-service targets the caller's own row, owner included. It also carries
// no role/is_active columns, so a user can never promote or deactivate
// themselves through this path. PhoneVerified stamps phone_verified_at anew
// (a just-proven new number); otherwise the existing marker is kept.
func (repo BusinessIdentityRepository) UpdateOwnBusinessUserProfile(
	ctx context.Context,
	scope common.TenantScope,
	input ports.UpdateOwnBusinessUserProfileInput,
) (ports.BusinessUserProfileRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}

	user, err := scanBusinessUserProfileRecord(tx.QueryRow(ctx, `
		update business_users
		set email = $3,
			display_name = $4,
			phone = $5,
			phone_verified_at = case when $6 then now() else phone_verified_at end,
			whatsapp_number = $7,
			updated_at = now()
		where business_user_id = $1
			and business_id = $2
		returning
			business_user_id::text,
			business_id::text,
			email,
			display_name,
			coalesce(phone, ''),
			phone_verified_at,
			coalesce(whatsapp_number, ''),
			role,
			is_active,
			created_at,
			updated_at
	`,
		input.UserID.String(), scope.BusinessID.String(), input.Email, input.DisplayName,
		nullIfEmpty(input.Phone), input.PhoneVerified, nullIfEmpty(input.WhatsAppNumber),
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessUserProfileRecord{}, ports.ErrNotFound
		}
		if businessUserEmailTaken(err) {
			return ports.BusinessUserProfileRecord{}, business.ErrUserEmailTaken
		}
		if businessUserWhatsAppTaken(err) {
			return ports.BusinessUserProfileRecord{}, business.ErrUserWhatsAppTaken
		}
		return ports.BusinessUserProfileRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}

	return user, nil
}
