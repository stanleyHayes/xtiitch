package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
			u.is_active,
			u.login_locked_until
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
		&credentials.LoginLockedUntil,
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

// RecordFailedBusinessLogin bumps the failed-attempt counter and locks the account
// for lockFor once it reaches maxAttempts (then resets the counter), mirroring the
// MFA verify lockout. Bypass: login is cross-tenant (resolved by handle).
func (repo BusinessIdentityRepository) RecordFailedBusinessLogin(ctx context.Context, userID common.ID, maxAttempts int, lockFor time.Duration) error {
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
		set failed_login_attempts = case when failed_login_attempts + 1 >= $2 then 0 else failed_login_attempts + 1 end,
			login_locked_until = case when failed_login_attempts + 1 >= $2 then now() + make_interval(secs => $3) else login_locked_until end,
			updated_at = now()
		where business_user_id = $1
	`, userID.String(), maxAttempts, lockFor.Seconds()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ClearFailedBusinessLogin resets the counter + lockout after a successful login.
func (repo BusinessIdentityRepository) ClearFailedBusinessLogin(ctx context.Context, userID common.ID) error {
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
		set failed_login_attempts = 0, login_locked_until = null, updated_at = now()
		where business_user_id = $1 and (failed_login_attempts <> 0 or login_locked_until is not null)
	`, userID.String()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// FindBusinessUserByHandleAndWhatsApp resolves the owner of a store handle whose
// WhatsApp number matches (the WhatsApp sign-in identity). Cross-tenant, so it
// runs under the RLS bypass, mirroring FindBusinessUserByHandleAndEmail.
func (repo BusinessIdentityRepository) FindBusinessUserByHandleAndWhatsApp(ctx context.Context, handle string, whatsAppNumber string) (ports.BusinessUserCredentials, error) {
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
			and u.whatsapp_number = $2
		limit 1
	`, handle, whatsAppNumber).Scan(
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

// CreateSignInOTPChallenge stores a hashed business sign-in code (global,
// bypass-gated store keyed on the WhatsApp number).
func (repo BusinessIdentityRepository) CreateSignInOTPChallenge(ctx context.Context, input ports.CreateSignInOTPChallengeInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		insert into business_signin_otp_challenges (challenge_id, whatsapp_number, code_hash, expires_at)
		values ($1, $2, $3, $4)
	`, input.ChallengeID.String(), input.WhatsAppNumber, input.CodeHash, input.ExpiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// LatestActiveSignInOTPChallenge returns the newest unconsumed, unexpired sign-in
// challenge for a WhatsApp number.
func (repo BusinessIdentityRepository) LatestActiveSignInOTPChallenge(ctx context.Context, whatsAppNumber string, now time.Time) (ports.BusinessOTPChallengeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessOTPChallengeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.BusinessOTPChallengeRecord{}, err
	}
	var record ports.BusinessOTPChallengeRecord
	if err := tx.QueryRow(ctx, `
		select challenge_id::text, whatsapp_number, code_hash, attempts, expires_at
		from business_signin_otp_challenges
		where whatsapp_number = $1 and consumed_at is null and expires_at > $2
		order by created_at desc
		limit 1
	`, whatsAppNumber, now).Scan(
		&record.ChallengeID, &record.WhatsAppNumber, &record.CodeHash, &record.Attempts, &record.ExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessOTPChallengeRecord{}, ErrNotFound
		}
		return ports.BusinessOTPChallengeRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessOTPChallengeRecord{}, err
	}
	return record, nil
}

func (repo BusinessIdentityRepository) IncrementSignInOTPAttempts(ctx context.Context, challengeID common.ID) error {
	return repo.execSignInOTPBypass(ctx, `
		update business_signin_otp_challenges set attempts = attempts + 1 where challenge_id = $1
	`, challengeID.String())
}

func (repo BusinessIdentityRepository) ConsumeSignInOTPChallenge(ctx context.Context, challengeID common.ID) error {
	return repo.execSignInOTPBypass(ctx, `
		update business_signin_otp_challenges set consumed_at = now() where challenge_id = $1
	`, challengeID.String())
}

func (repo BusinessIdentityRepository) execSignInOTPBypass(ctx context.Context, sql string, args ...any) error {
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

func (repo BusinessIdentityRepository) FindBusinessUserCredentialsByID(ctx context.Context, scope common.TenantScope, userID common.ID) (ports.BusinessUserCredentials, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessUserCredentials{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessUserCredentials{}, err
	}

	var credentials ports.BusinessUserCredentials
	var role string
	if err := tx.QueryRow(ctx, `
		select
			business_id,
			business_user_id,
			password_hash,
			role,
			is_active
		from business_users
		where business_user_id = $1
			and business_id = $2
		limit 1
	`, userID.String(), scope.BusinessID.String()).Scan(
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
