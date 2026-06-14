package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
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

func rollbackAuthSessionUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
