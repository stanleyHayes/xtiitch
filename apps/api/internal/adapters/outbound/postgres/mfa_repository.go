package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// MFARepository persists business-user multi-factor enrolment under RLS.
type MFARepository struct {
	pool *pgxpool.Pool
}

func NewMFARepository(pool *pgxpool.Pool) MFARepository {
	return MFARepository{pool: pool}
}

type backupCode struct {
	Hash   string  `json:"hash"`
	UsedAt *string `json:"used_at"`
}

func (repo MFARepository) Get(ctx context.Context, scope common.TenantScope, userID common.ID) (ports.MFAEnrollment, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.MFAEnrollment{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.MFAEnrollment{}, err
	}

	var enrollment ports.MFAEnrollment
	if err := tx.QueryRow(ctx, `
		select
			business_id::text,
			secret_encrypted,
			enabled,
			jsonb_array_length(backup_codes) as total,
			coalesce((
				select count(*) from jsonb_array_elements(backup_codes) el
				where el->>'used_at' is null
			), 0) as remaining
		from business_user_mfa
		where business_user_id = $1
	`, userID.String()).Scan(
		&enrollment.BusinessID,
		&enrollment.SecretEncrypted,
		&enrollment.Enabled,
		&enrollment.BackupCodesTotal,
		&enrollment.BackupCodesLeft,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.MFAEnrollment{}, ports.ErrNotFound
		}
		return ports.MFAEnrollment{}, err
	}
	enrollment.UserID = userID

	if err := tx.Commit(ctx); err != nil {
		return ports.MFAEnrollment{}, err
	}

	return enrollment, nil
}

func (repo MFARepository) Upsert(ctx context.Context, scope common.TenantScope, input ports.UpsertMFAInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// A fresh secret invalidates any prior (possibly unconfirmed) enrolment, so
	// re-running setup resets enabled/confirmed/backup-codes.
	if _, err := tx.Exec(ctx, `
		insert into business_user_mfa (business_user_id, business_id, secret_encrypted, enabled, backup_codes)
		values ($1, $2, $3, false, '[]'::jsonb)
		on conflict (business_user_id) do update
		set secret_encrypted = excluded.secret_encrypted,
			enabled = false,
			confirmed_at = null,
			backup_codes = '[]'::jsonb,
			updated_at = now()
	`, input.UserID.String(), input.BusinessID.String(), input.SecretEncrypted); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo MFARepository) Enable(ctx context.Context, scope common.TenantScope, input ports.EnableMFAInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	codes := make([]backupCode, 0, len(input.BackupCodeHashes))
	for _, hash := range input.BackupCodeHashes {
		codes = append(codes, backupCode{Hash: hash, UsedAt: nil})
	}
	encoded, err := json.Marshal(codes)
	if err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update business_user_mfa
		set enabled = true,
			confirmed_at = now(),
			backup_codes = $2::jsonb,
			updated_at = now()
		where business_user_id = $1
	`, input.UserID.String(), string(encoded))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrNotFound
	}

	return tx.Commit(ctx)
}

func (repo MFARepository) ConsumeBackupCode(ctx context.Context, scope common.TenantScope, userID common.ID, codeHash string) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return false, err
	}

	var raw []byte
	if err := tx.QueryRow(ctx, `
		select backup_codes from business_user_mfa where business_user_id = $1 for update
	`, userID.String()).Scan(&raw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	var codes []backupCode
	if err := json.Unmarshal(raw, &codes); err != nil {
		return false, err
	}

	matched := false
	for i := range codes {
		if codes[i].Hash == codeHash && codes[i].UsedAt == nil {
			matched = true
			used := timeNowMarker
			codes[i].UsedAt = &used
			break
		}
	}
	if !matched {
		// No unused matching code — not an error, just no consumption.
		return false, tx.Commit(ctx)
	}

	updated, err := json.Marshal(codes)
	if err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `
		update business_user_mfa
		set backup_codes = $2::jsonb, updated_at = now()
		where business_user_id = $1
	`, userID.String(), string(updated)); err != nil {
		return false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}

	return true, nil
}

// timeNowMarker records that a backup code was consumed. The exact timestamp is
// not security-relevant (the code is one-time regardless), so a stable marker
// keeps the read-modify-write simple and deterministic.
const timeNowMarker = "used"

func (repo MFARepository) Delete(ctx context.Context, scope common.TenantScope, userID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		delete from business_user_mfa where business_user_id = $1
	`, userID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
