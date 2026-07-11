package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ErrNotFound aliases the port-level not-found sentinel so handlers can map it
// to a 404 without importing this adapter.
var ErrNotFound = ports.ErrNotFound

// pgUniqueViolation is the SQLSTATE code Postgres returns for a unique
// constraint violation (e.g. a store handle that is already taken).
const pgUniqueViolation = "23505"

type BusinessIdentityRepository struct {
	pool *pgxpool.Pool
}

func NewBusinessIdentityRepository(pool *pgxpool.Pool) BusinessIdentityRepository {
	return BusinessIdentityRepository{pool: pool}
}

// --- Self-service password reset (cross-tenant; runs under the RLS bypass) ---

// FindBusinessUserByEmail resolves an active login from its email alone, so a
// locked-out user can request a reset without remembering their store handle.
func (repo BusinessIdentityRepository) FindBusinessUserByEmail(ctx context.Context, email string) (ports.PasswordResetTarget, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.PasswordResetTarget{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.PasswordResetTarget{}, err
	}

	var target ports.PasswordResetTarget
	if err := tx.QueryRow(ctx, `
		select business_user_id, email, display_name
		from business_users
		where lower(email) = lower($1) and is_active = true
		order by created_at asc
		limit 1
	`, email).Scan(&target.UserID, &target.Email, &target.DisplayName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.PasswordResetTarget{}, ErrNotFound
		}
		return ports.PasswordResetTarget{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.PasswordResetTarget{}, err
	}
	return target, nil
}

func (repo BusinessIdentityRepository) CreatePasswordResetChallenge(ctx context.Context, input ports.CreatePasswordResetChallengeInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		insert into business_password_reset_challenges
			(challenge_id, business_user_id, email, code_hash, expires_at)
		values ($1, $2, $3, $4, $5)
	`, input.ChallengeID.String(), input.UserID.String(), input.Email, input.CodeHash, input.ExpiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo BusinessIdentityRepository) LatestActivePasswordResetChallenge(ctx context.Context, email string, now time.Time) (ports.PasswordResetChallenge, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.PasswordResetChallenge{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.PasswordResetChallenge{}, err
	}

	var challenge ports.PasswordResetChallenge
	if err := tx.QueryRow(ctx, `
		select challenge_id, business_user_id, email, code_hash, attempts, expires_at
		from business_password_reset_challenges
		where lower(email) = lower($1) and consumed_at is null and expires_at > $2
		order by created_at desc
		limit 1
	`, email, now).Scan(
		&challenge.ChallengeID,
		&challenge.UserID,
		&challenge.Email,
		&challenge.CodeHash,
		&challenge.Attempts,
		&challenge.ExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.PasswordResetChallenge{}, ErrNotFound
		}
		return ports.PasswordResetChallenge{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.PasswordResetChallenge{}, err
	}
	return challenge, nil
}

func (repo BusinessIdentityRepository) IncrementPasswordResetAttempts(ctx context.Context, challengeID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		update business_password_reset_challenges
		set attempts = attempts + 1
		where challenge_id = $1
	`, challengeID.String()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo BusinessIdentityRepository) ConsumePasswordResetChallenge(ctx context.Context, challengeID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		update business_password_reset_challenges
		set consumed_at = now()
		where challenge_id = $1
	`, challengeID.String()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo BusinessIdentityRepository) SetBusinessUserPasswordByID(ctx context.Context, userID common.ID, passwordHash string) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		update business_users
		set password_hash = $2, updated_at = now()
		where business_user_id = $1
	`, userID.String(), passwordHash); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo BusinessIdentityRepository) CreateBusinessWithOwner(ctx context.Context, input ports.CreateBusinessWithOwnerInput) (ports.BusinessOwnerIdentity, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	// Place the business on the plan the owner chose at signup; an empty or
	// unknown/inactive code falls back to the free plan (the union-all keeps the
	// chosen row first, so limit 1 picks it when present).
	_, err = tx.Exec(ctx, `
		insert into businesses (business_id, plan_id, name, handle, verification_status)
		select $1, plan_id, $2, $3, 'unverified'
		from (
			select plan_id from plans where code = $4 and is_active = true
			union all
			select plan_id from plans where code = 'free' and is_active = true
		) chosen
		limit 1
	`, input.BusinessID.String(), input.BusinessName, input.BusinessHandle, input.PlanCode)
	if err != nil {
		// The store handle is globally unique; surface a clash as a domain
		// conflict so callers can return 409 rather than an opaque 500.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return ports.BusinessOwnerIdentity{}, business.ErrHandleTaken
		}
		return ports.BusinessOwnerIdentity{}, err
	}

	// Every business needs a subscription row on its chosen plan (the admin
	// console and the recurring-billing sweep read it). The migration only
	// backfilled pre-existing tenants, so create one here for new signups.
	if _, err := tx.Exec(ctx, `
		insert into business_subscriptions (business_id, plan_id, status)
		select business_id, plan_id, 'active'
		from businesses
		where business_id = $1
		on conflict (business_id) do nothing
	`, input.BusinessID.String()); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	if _, err := tx.Exec(ctx, `insert into store_settings (business_id) values ($1)`, input.BusinessID.String()); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_users (
			business_user_id,
			business_id,
			email,
			display_name,
			password_hash,
			role,
			is_active,
			phone,
			whatsapp_number,
			whatsapp_verified_at
		)
		values ($1, $2, $3, $4, $5, 'owner', true, $6, $7, case when $8 then now() else null end)
	`, input.OwnerUserID.String(), input.BusinessID.String(), input.OwnerEmail, input.OwnerDisplayName, input.OwnerPassword, nullIfEmpty(input.Phone), nullIfEmpty(input.WhatsAppNumber), input.WhatsAppVerified); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	// Seed the default production stages for both flows (Spec 8.4.1). Each is
	// tied to one of the three customer-facing colours.
	if _, err := tx.Exec(ctx, `
		insert into stage_templates (stage_id, business_id, name, colour, flow, sequence)
		values
			(gen_random_uuid(), $1, 'Order placed', 'red', 'ready_made', 1),
			(gen_random_uuid(), $1, 'Preparing', 'yellow', 'ready_made', 2),
			(gen_random_uuid(), $1, 'Ready / delivered', 'green', 'ready_made', 3),
			(gen_random_uuid(), $1, 'Order received', 'red', 'bespoke', 1),
			(gen_random_uuid(), $1, 'Being made', 'yellow', 'bespoke', 2),
			(gen_random_uuid(), $1, 'Ready for fitting', 'yellow', 'bespoke', 3),
			(gen_random_uuid(), $1, 'Ready / delivered', 'green', 'bespoke', 4)
	`, input.BusinessID.String()); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	// Seed a sensible default set of bespoke measurement fields so the
	// self-measure route works out of the box; the business can curate them later.
	if _, err := tx.Exec(ctx, `
		insert into measurement_fields (field_id, business_id, label, unit, sequence)
		values
			(gen_random_uuid(), $1, 'Chest / Bust', 'in', 1),
			(gen_random_uuid(), $1, 'Waist', 'in', 2),
			(gen_random_uuid(), $1, 'Hips', 'in', 3),
			(gen_random_uuid(), $1, 'Shoulder', 'in', 4),
			(gen_random_uuid(), $1, 'Sleeve length', 'in', 5),
			(gen_random_uuid(), $1, 'Top length', 'in', 6),
			(gen_random_uuid(), $1, 'Trouser length', 'in', 7),
			(gen_random_uuid(), $1, 'Neck', 'in', 8)
	`, input.BusinessID.String()); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	return ports.BusinessOwnerIdentity{
		BusinessID:     input.BusinessID,
		BusinessUserID: input.OwnerUserID,
		Role:           business.UserRoleOwner,
	}, nil
}

// HandleExists reports whether any business already owns the given handle.
// Handles are globally unique across tenants, so the lookup runs under the RLS
// bypass.
func (repo BusinessIdentityRepository) HandleExists(ctx context.Context, handle string) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return false, err
	}

	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists(select 1 from businesses where lower(handle) = lower($1))
	`, handle).Scan(&exists); err != nil {
		return false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return exists, nil
}
func scanBusinessUserRecord(row pgx.Row) (ports.BusinessUserRecord, error) {
	var user ports.BusinessUserRecord
	var role string
	if err := row.Scan(
		&user.UserID,
		&user.BusinessID,
		&user.Email,
		&user.DisplayName,
		&user.Phone,
		&role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	); err != nil {
		return ports.BusinessUserRecord{}, err
	}
	user.Role = business.UserRole(role)
	return user, nil
}

func businessUserEmailTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "business_users_business_email_unique_idx"
}

func rollbackUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
