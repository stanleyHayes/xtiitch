package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AuthSessionRepository struct {
	pool *pgxpool.Pool
}

func NewAuthSessionRepository(pool *pgxpool.Pool) AuthSessionRepository {
	return AuthSessionRepository{pool: pool}
}

func (repo AuthSessionRepository) Create(ctx context.Context, input ports.CreateAuthSessionInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackAuthSessionUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into auth_sessions (
			session_id,
			business_id,
			business_user_id,
			refresh_token_hash,
			user_agent,
			ip_address,
			expires_at
		)
		values ($1, $2, $3, $4, $5, $6, $7)
	`, input.SessionID.String(), input.BusinessID.String(), input.BusinessUserID.String(), input.RefreshTokenHash, input.UserAgent, input.IPAddress, input.ExpiresAt); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo AuthSessionRepository) FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (ports.AuthSessionWithUser, error) {
	// A refresh token is a credential resolved before the tenant is known, so
	// the lookup runs with the RLS bypass under a transaction.
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AuthSessionWithUser{}, err
	}
	defer rollbackAuthSessionUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AuthSessionWithUser{}, err
	}

	var session ports.AuthSessionWithUser
	var role string
	if err := tx.QueryRow(ctx, `
		select
			s.session_id,
			s.business_id,
			s.business_user_id,
			u.role,
			u.is_active,
			(s.revoked_at is not null) as revoked,
			s.expires_at
		from auth_sessions s
		join business_users u
			on u.business_user_id = s.business_user_id
			and u.business_id = s.business_id
		where s.refresh_token_hash = $1
		limit 1
	`, refreshTokenHash).Scan(
		&session.SessionID,
		&session.BusinessID,
		&session.BusinessUserID,
		&role,
		&session.UserIsActive,
		&session.Revoked,
		&session.ExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AuthSessionWithUser{}, ErrNotFound
		}
		return ports.AuthSessionWithUser{}, err
	}
	session.Role = business.UserRole(role)

	if err := tx.Commit(ctx); err != nil {
		return ports.AuthSessionWithUser{}, err
	}

	return session, nil
}

func (repo AuthSessionRepository) Revoke(ctx context.Context, businessID common.ID, sessionID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackAuthSessionUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update auth_sessions
		set revoked_at = now(), updated_at = now()
		where session_id = $1 and business_id = $2 and revoked_at is null
	`, sessionID.String(), businessID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func rollbackAuthSessionUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
