package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	pgForeignKeyViolation = "23503"
	pgCheckViolation      = "23514"
)

type AdminAuthRepository struct {
	pool *pgxpool.Pool
}

func NewAdminAuthRepository(pool *pgxpool.Pool) AdminAuthRepository {
	return AdminAuthRepository{pool: pool}
}

func (repo AdminAuthRepository) EnsureBootstrapUser(ctx context.Context, input ports.CreateAdminUserInput) (ports.AdminUserRecord, error) {
	existing, err := repo.findRecordByEmail(ctx, input.Email)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return ports.AdminUserRecord{}, err
	}

	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		insert into admin_users (
			admin_user_id,
			email,
			display_name,
			password_hash,
			role,
			is_active
		)
		values ($1, $2, $3, $4, $5, true)
		returning
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
	`, input.UserID.String(), input.Email, input.DisplayName, input.PasswordHash, string(input.Role)))
	if err == nil {
		return user, nil
	}
	if adminEmailTaken(err) {
		return repo.findRecordByEmail(ctx, input.Email)
	}

	return ports.AdminUserRecord{}, err
}

func (repo AdminAuthRepository) FindByEmail(ctx context.Context, email string) (ports.AdminUserCredentials, error) {
	var user ports.AdminUserCredentials
	var role string
	if err := repo.pool.QueryRow(ctx, `
		select
			admin_user_id::text,
			email,
			display_name,
			password_hash,
			role,
			is_active,
			login_locked_until
		from admin_users
		where lower(email) = lower($1)
		limit 1
	`, email).Scan(
		&user.UserID,
		&user.Email,
		&user.DisplayName,
		&user.PasswordHash,
		&role,
		&user.IsActive,
		&user.LoginLockedUntil,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserCredentials{}, ErrNotFound
		}
		return ports.AdminUserCredentials{}, err
	}
	user.Role = admindomain.Role(role)

	return user, nil
}

// RecordFailedAdminLogin bumps the failed-attempt counter and locks the account for
// lockFor once it reaches maxAttempts (then resets the counter).
func (repo AdminAuthRepository) RecordFailedAdminLogin(
	ctx context.Context,
	userID common.ID,
	maxAttempts int,
	lockFor time.Duration,
) error {
	_, err := repo.pool.Exec(ctx, `
		update admin_users
		set failed_login_attempts = case when failed_login_attempts + 1 >= $2 then 0 else failed_login_attempts + 1 end,
			login_locked_until = case when failed_login_attempts + 1 >= $2 then now() + make_interval(secs => $3) else login_locked_until end,
			updated_at = now()
		where admin_user_id = $1::uuid
	`, userID.String(), maxAttempts, lockFor.Seconds())
	return err
}

// ClearFailedAdminLogin resets the counter + lockout after a successful login.
func (repo AdminAuthRepository) ClearFailedAdminLogin(ctx context.Context, userID common.ID) error {
	_, err := repo.pool.Exec(ctx, `
		update admin_users
		set failed_login_attempts = 0, login_locked_until = null, updated_at = now()
		where admin_user_id = $1::uuid and (failed_login_attempts <> 0 or login_locked_until is not null)
	`, userID.String())
	return err
}

func (repo AdminAuthRepository) FindByID(ctx context.Context, userID common.ID) (ports.AdminUserRecord, error) {
	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		select
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
		from admin_users
		where admin_user_id = $1
		limit 1
	`, userID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserRecord{}, ErrNotFound
		}
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (repo AdminAuthRepository) RecordLogin(ctx context.Context, userID common.ID) error {
	_, err := repo.pool.Exec(ctx, `
		update admin_users
		set last_login_at = now(), updated_at = now()
		where admin_user_id = $1
	`, userID.String())
	return err
}

func (repo AdminAuthRepository) CreateAdminAuditEvent(
	ctx context.Context,
	input ports.CreateAdminAuditEventInput,
) (ports.AdminAuditEventRecord, error) {
	metadata, err := json.Marshal(input.Metadata)
	if err != nil {
		return ports.AdminAuditEventRecord{}, err
	}

	record, err := scanAdminAuditEventRecord(repo.pool.QueryRow(ctx, `
		insert into admin_audit_events (
			audit_event_id,
			actor_admin_user_id,
			actor_email,
			actor_role,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata,
			ip_address,
			user_agent
		)
		select
			$1,
			u.admin_user_id,
			u.email,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10::jsonb,
			$11,
			$12
		from admin_users u
		where u.admin_user_id = $2
		returning
			audit_event_id::text,
			coalesce(actor_admin_user_id::text, ''),
			actor_email,
			actor_role,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata,
			ip_address,
			user_agent,
			created_at
	`, input.AuditEventID.String(),
		input.ActorUserID.String(),
		string(input.ActorRole),
		input.Action,
		input.TargetType,
		input.TargetID,
		input.TargetLabel,
		input.Summary,
		string(input.Severity),
		string(metadata),
		input.IPAddress,
		input.UserAgent,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAuditEventRecord{}, ErrNotFound
		}
		return ports.AdminAuditEventRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminAuditEvents(
	ctx context.Context,
	input ports.ListAdminAuditEventsInput,
) ([]ports.AdminAuditEventRecord, error) {
	limit := input.Limit
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	query := `
		select
			audit_event_id::text,
			coalesce(actor_admin_user_id::text, ''),
			actor_email,
			actor_role,
			action,
			target_type,
			target_id,
			target_label,
			summary,
			severity,
			metadata,
			ip_address,
			user_agent,
			created_at
		from admin_audit_events
	`
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	// Placeholders are numbered as the arguments are appended, so adding a filter
	// cannot silently renumber the ones already there.
	args := []any{}
	conditions := []string{}
	condition := func(clause string, value any) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(clause, len(args)))
	}
	if input.Severity.Valid() {
		condition("severity = $%d", string(input.Severity))
	}
	if strings.TrimSpace(input.ActorEmail) != "" {
		condition("actor_email = $%d", strings.ToLower(strings.TrimSpace(input.ActorEmail)))
	}
	if !input.From.IsZero() {
		condition("created_at >= $%d", input.From)
	}
	if !input.To.IsZero() {
		condition("created_at <= $%d", input.To)
	}
	if len(conditions) > 0 {
		query += " where " + strings.Join(conditions, " and ")
	}
	args = append(args, limit)
	query += fmt.Sprintf(" order by created_at desc limit $%d", len(args))
	args = append(args, offset)
	query += fmt.Sprintf(" offset $%d", len(args))

	rows, err := repo.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []ports.AdminAuditEventRecord
	for rows.Next() {
		record, err := scanAdminAuditEventRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) Create(ctx context.Context, input ports.CreateAdminSessionInput) error {
	_, err := repo.pool.Exec(ctx, `
		insert into admin_sessions (
			session_id,
			admin_user_id,
			refresh_token_hash,
			user_agent,
			ip_address,
			expires_at
		)
		values ($1, $2, $3, $4, $5, $6)
	`, input.SessionID.String(), input.AdminUserID.String(), input.RefreshTokenHash, input.UserAgent, input.IPAddress, input.ExpiresAt)
	return err
}

func (repo AdminAuthRepository) FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (ports.AdminSessionWithUser, error) {
	var session ports.AdminSessionWithUser
	var role string
	if err := repo.pool.QueryRow(ctx, `
		select
			s.session_id::text,
			s.admin_user_id::text,
			u.email,
			u.display_name,
			u.role,
			u.is_active,
			(s.revoked_at is not null) as revoked,
			s.expires_at
		from admin_sessions s
		join admin_users u on u.admin_user_id = s.admin_user_id
		where s.refresh_token_hash = $1
		limit 1
	`, refreshTokenHash).Scan(
		&session.SessionID,
		&session.AdminUserID,
		&session.Email,
		&session.DisplayName,
		&role,
		&session.UserIsActive,
		&session.Revoked,
		&session.ExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminSessionWithUser{}, ErrNotFound
		}
		return ports.AdminSessionWithUser{}, err
	}
	session.Role = admindomain.Role(role)

	return session, nil
}

func (repo AdminAuthRepository) Revoke(ctx context.Context, sessionID common.ID) error {
	_, err := repo.pool.Exec(ctx, `
		update admin_sessions
		set revoked_at = now(), updated_at = now()
		where session_id = $1 and revoked_at is null
	`, sessionID.String())
	return err
}

func (repo AdminAuthRepository) findRecordByEmail(ctx context.Context, email string) (ports.AdminUserRecord, error) {
	user, err := scanAdminUserRecord(repo.pool.QueryRow(ctx, `
		select
			admin_user_id::text,
			email,
			display_name,
			role,
			is_active,
			created_at,
			updated_at
		from admin_users
		where lower(email) = lower($1)
		limit 1
	`, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminUserRecord{}, ErrNotFound
		}
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func scanAdminUserRecord(row pgx.Row) (ports.AdminUserRecord, error) {
	var user ports.AdminUserRecord
	var role string
	if err := row.Scan(
		&user.UserID,
		&user.Email,
		&user.DisplayName,
		&role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	); err != nil {
		return ports.AdminUserRecord{}, err
	}
	user.Role = admindomain.Role(role)

	return user, nil
}

func scanAdminAuditEventRecord(row pgx.Row) (ports.AdminAuditEventRecord, error) {
	var record ports.AdminAuditEventRecord
	var actorUserID string
	var actorRole string
	var severity string
	var metadata []byte
	if err := row.Scan(
		&record.AuditEventID,
		&actorUserID,
		&record.ActorEmail,
		&actorRole,
		&record.Action,
		&record.TargetType,
		&record.TargetID,
		&record.TargetLabel,
		&record.Summary,
		&severity,
		&metadata,
		&record.IPAddress,
		&record.UserAgent,
		&record.CreatedAt,
	); err != nil {
		return ports.AdminAuditEventRecord{}, err
	}

	record.ActorUserID = common.ID(actorUserID)
	record.ActorRole = admindomain.Role(actorRole)
	record.Severity = admindomain.AuditSeverity(severity)
	if len(metadata) > 0 {
		if err := json.Unmarshal(metadata, &record.Metadata); err != nil {
			return ports.AdminAuditEventRecord{}, err
		}
	}
	if record.Metadata == nil {
		record.Metadata = map[string]string{}
	}

	return record, nil
}

func commonIDPtr(value pgtype.Text) *common.ID {
	if !value.Valid {
		return nil
	}
	id := common.ID(value.String)
	return &id
}

func int4Ptr(value pgtype.Int4) *int {
	if !value.Valid {
		return nil
	}
	out := int(value.Int32)
	return &out
}

func int8Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	out := value.Int64
	return &out
}

func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	out := value.Time
	return &out
}

func adminEmailTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "admin_users_email_unique_idx"
}

// ListLatestSweepRuns reports the freshness of each scheduled worker sweep.
//
// One row per sweep name: when it last ran, when it last SUCCEEDED, and why it
// failed if it did. The two timestamps are separate on purpose — a sweep that
// fires hourly and fails every time is alive by run time and dead by outcome.
func (repo AdminAuthRepository) ListLatestSweepRuns(ctx context.Context) ([]ports.SweepRunRecord, error) {
	const query = `
		select
			sweep_name,
			max(started_at)                                        as last_run_at,
			coalesce(max(started_at) filter (where succeeded), 'epoch'::timestamptz) as last_succeeded_at,
			(array_agg(succeeded order by started_at desc))[1]      as last_succeeded,
			coalesce((array_agg(coalesce(error, '') order by started_at desc))[1], '') as last_error
		from worker_sweep_runs
		group by sweep_name
		order by sweep_name
	`
	rows, err := repo.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.SweepRunRecord{}
	for rows.Next() {
		var record ports.SweepRunRecord
		if err := rows.Scan(
			&record.SweepName,
			&record.LastRunAt,
			&record.LastSucceededAt,
			&record.LastSucceeded,
			&record.LastError,
		); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}
