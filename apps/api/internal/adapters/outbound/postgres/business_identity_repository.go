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

// ListActivePlans returns the public-safe plan catalogue for the signup picker.
func (repo BusinessIdentityRepository) ListActivePlans(ctx context.Context) ([]ports.PublicPlanRecord, error) {
	rows, err := repo.pool.Query(ctx, `
		select code, name, monthly_fee_minor, yearly_fee_minor, commission_bps, design_limit
		from plans
		where is_active = true
		order by monthly_fee_minor asc, name asc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := make([]ports.PublicPlanRecord, 0)
	for rows.Next() {
		var plan ports.PublicPlanRecord
		if err := rows.Scan(
			&plan.Code,
			&plan.Name,
			&plan.MonthlyFeeMinor,
			&plan.YearlyFeeMinor,
			&plan.CommissionBps,
			&plan.DesignLimit,
		); err != nil {
			return nil, err
		}
		plans = append(plans, plan)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return plans, nil
}

// GetBusinessSubscription returns the tenant's subscription joined with its plan
// and owner email, powering the self-serve billing flow.
func (repo BusinessIdentityRepository) GetBusinessSubscription(ctx context.Context, businessID common.ID) (ports.BusinessSubscriptionRecord, error) {
	var record ports.BusinessSubscriptionRecord
	err := repo.pool.QueryRow(ctx, `
		select
			s.subscription_id::text,
			s.business_id::text,
			b.name,
			coalesce((
				select email from business_users
				where business_id = b.business_id and role = 'owner' and is_active = true
				order by created_at asc
				limit 1
			), ''),
			p.code,
			p.monthly_fee_minor,
			s.status,
			s.billing_mode,
			s.provider_customer_ref,
			s.provider_subscription_ref
		from business_subscriptions s
		join businesses b on b.business_id = s.business_id
		join plans p on p.plan_id = s.plan_id
		where s.business_id = $1
	`, businessID.String()).Scan(
		&record.SubscriptionID,
		&record.BusinessID,
		&record.BusinessName,
		&record.OwnerEmail,
		&record.PlanCode,
		&record.MonthlyFeeMinor,
		&record.Status,
		&record.BillingMode,
		&record.ProviderCustomerRef,
		&record.ProviderSubscriptionRef,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessSubscriptionRecord{}, ErrNotFound
		}
		return ports.BusinessSubscriptionRecord{}, err
	}
	return record, nil
}

// ActivateRecurringBilling stores the verified Paystack customer + authorization
// codes and flips the subscription to recurring Paystack billing.
func (repo BusinessIdentityRepository) ActivateRecurringBilling(ctx context.Context, input ports.ActivateRecurringBillingInput) error {
	_, err := repo.pool.Exec(ctx, `
		update business_subscriptions
		set billing_mode = 'recurring',
			provider = 'paystack',
			provider_customer_ref = $2,
			provider_subscription_ref = $3,
			updated_at = now()
		where business_id = $1
	`, input.BusinessID.String(), input.ProviderCustomerRef, input.ProviderSubscriptionRef)
	return err
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

func (repo BusinessIdentityRepository) ListBusinessUsers(ctx context.Context, scope common.TenantScope) ([]ports.BusinessUserRecord, error) {
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

func (repo BusinessIdentityRepository) CreateBusinessUser(ctx context.Context, scope common.TenantScope, input ports.CreateBusinessUserInput) (ports.BusinessUserRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	user, err := scanBusinessUserRecord(tx.QueryRow(ctx, `
		insert into business_users (
			business_user_id,
			business_id,
			email,
			display_name,
			password_hash,
			role,
			is_active
		)
		values ($1, $2, $3, $4, $5, $6, true)
		returning
			business_user_id::text,
			business_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), input.BusinessID.String(), input.Email, input.DisplayName, input.PasswordHash, string(input.Role)))
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

func (repo BusinessIdentityRepository) UpdateBusinessUser(ctx context.Context, scope common.TenantScope, input ports.UpdateBusinessUserInput) (ports.BusinessUserRecord, error) {
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
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), scope.BusinessID.String(), input.DisplayName, string(input.Role), input.IsActive))
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

func (repo BusinessIdentityRepository) UpdateBusinessUserPassword(ctx context.Context, scope common.TenantScope, input ports.UpdateBusinessUserPasswordInput) error {
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

func (repo BusinessIdentityRepository) UpdateOwnPassword(ctx context.Context, scope common.TenantScope, input ports.UpdateBusinessUserPasswordInput) error {
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

func (repo BusinessIdentityRepository) TransferBusinessOwner(ctx context.Context, scope common.TenantScope, input ports.TransferBusinessOwnerInput) (ports.TransferBusinessOwnerResult, error) {
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

func scanBusinessUserRecord(row pgx.Row) (ports.BusinessUserRecord, error) {
	var user ports.BusinessUserRecord
	var role string
	if err := row.Scan(
		&user.UserID,
		&user.BusinessID,
		&user.Email,
		&user.DisplayName,
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
