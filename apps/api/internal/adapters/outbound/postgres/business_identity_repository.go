package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

var ErrNotFound = errors.New("record not found")

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
	row := repo.pool.QueryRow(ctx, `
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
	`, handle, email)

	var credentials ports.BusinessUserCredentials
	var role string
	if err := row.Scan(
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

	return credentials, nil
}

func rollbackUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
