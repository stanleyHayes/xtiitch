package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// CustomerAuthRepository persists phone OTP challenges and resolves customer
// identities. Customers are a global identity, so it runs under the RLS bypass.
type CustomerAuthRepository struct {
	pool *pgxpool.Pool
}

func NewCustomerAuthRepository(pool *pgxpool.Pool) CustomerAuthRepository {
	return CustomerAuthRepository{pool: pool}
}

func (repo CustomerAuthRepository) CreateOTPChallenge(ctx context.Context, input ports.CreateOTPChallengeInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into customer_otp_challenges (challenge_id, phone, code_hash, expires_at)
		values ($1, $2, $3, $4)
	`, input.ChallengeID.String(), input.Phone, input.CodeHash, input.ExpiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo CustomerAuthRepository) LatestActiveOTPChallenge(ctx context.Context, phone string, now time.Time) (ports.OTPChallengeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.OTPChallengeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.OTPChallengeRecord{}, err
	}

	var record ports.OTPChallengeRecord
	if err := tx.QueryRow(ctx, `
		select challenge_id::text, phone, code_hash, attempts, expires_at
		from customer_otp_challenges
		where phone = $1 and consumed_at is null and expires_at > $2
		order by created_at desc
		limit 1
	`, phone, now).Scan(
		&record.ChallengeID, &record.Phone, &record.CodeHash, &record.Attempts, &record.ExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.OTPChallengeRecord{}, ports.ErrNotFound
		}
		return ports.OTPChallengeRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.OTPChallengeRecord{}, err
	}
	return record, nil
}

func (repo CustomerAuthRepository) IncrementOTPAttempts(ctx context.Context, challengeID common.ID) error {
	return repo.execBypass(ctx, `
		update customer_otp_challenges set attempts = attempts + 1 where challenge_id = $1
	`, challengeID.String())
}

func (repo CustomerAuthRepository) ConsumeOTPChallenge(ctx context.Context, challengeID common.ID) error {
	return repo.execBypass(ctx, `
		update customer_otp_challenges set consumed_at = now() where challenge_id = $1
	`, challengeID.String())
}

func (repo CustomerAuthRepository) UpsertVerifiedCustomerByPhone(ctx context.Context, newID common.ID, phone string) (common.ID, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return common.ID(""), err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return common.ID(""), err
	}

	var existing string
	err = tx.QueryRow(ctx, `
		select customer_id::text from customers
		where phone = $1 and erased_at is null
		order by created_at desc
		limit 1
	`, phone).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return common.ID(""), err
	}

	if existing != "" {
		if _, err := tx.Exec(ctx, `
			update customers set phone_verified_at = now(), updated_at = now() where customer_id = $1
		`, existing); err != nil {
			return common.ID(""), err
		}
		if err := tx.Commit(ctx); err != nil {
			return common.ID(""), err
		}
		return common.ID(existing), nil
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, phone, phone_verified_at)
		values ($1, $2, now())
	`, newID.String(), phone); err != nil {
		return common.ID(""), err
	}
	if err := tx.Commit(ctx); err != nil {
		return common.ID(""), err
	}
	return newID, nil
}

func (repo CustomerAuthRepository) execBypass(ctx context.Context, sql string, args ...any) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, sql, args...); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
