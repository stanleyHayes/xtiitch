package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
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

func (repo BusinessIdentityRepository) CreateBusinessWithOwner(ctx context.Context, input ports.CreateBusinessWithOwnerInput) (ports.BusinessOwnerIdentity, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	_, err = tx.Exec(ctx, `
		insert into businesses (business_id, plan_id, name, handle, verification_status)
		select $1, plan_id, $2, $3, 'unverified'
		from plans
		where code = 'free' and is_active = true
	`, input.BusinessID.String(), input.BusinessName, input.BusinessHandle)
	if err != nil {
		// The store handle is globally unique; surface a clash as a domain
		// conflict so callers can return 409 rather than an opaque 500.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return ports.BusinessOwnerIdentity{}, business.ErrHandleTaken
		}
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
			is_active
		)
		values ($1, $2, $3, $4, $5, 'owner', true)
	`, input.OwnerUserID.String(), input.BusinessID.String(), input.OwnerEmail, input.OwnerDisplayName, input.OwnerPassword); err != nil {
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

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessOwnerIdentity{}, err
	}

	return ports.BusinessOwnerIdentity{
		BusinessID:     input.BusinessID,
		BusinessUserID: input.OwnerUserID,
		Role:           business.UserRoleOwner,
	}, nil
}

func (repo BusinessIdentityRepository) FindBusinessUserByHandleAndEmail(ctx context.Context, handle string, email string) (ports.BusinessUserCredentials, error) {
	// Login resolves a tenant from a handle, so it is inherently cross-tenant:
	// it runs with the RLS bypass under a transaction.
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessUserCredentials{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.BusinessUserCredentials{}, err
	}

	var credentials ports.BusinessUserCredentials
	var role string
	if err := tx.QueryRow(ctx, `
		select
			b.business_id,
			u.business_user_id,
			u.password_hash,
			u.role,
			u.is_active
		from businesses b
		join business_users u on u.business_id = b.business_id
		where lower(b.handle) = lower($1)
			and lower(u.email) = lower($2)
		limit 1
	`, handle, email).Scan(
		&credentials.BusinessID,
		&credentials.UserID,
		&credentials.PasswordHash,
		&role,
		&credentials.IsActive,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessUserCredentials{}, ErrNotFound
		}
		return ports.BusinessUserCredentials{}, err
	}
	credentials.Role = business.UserRole(role)

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessUserCredentials{}, err
	}

	return credentials, nil
}

func rollbackUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
