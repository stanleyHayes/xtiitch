package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type TransactionManager interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
type Clock interface {
	Now() time.Time
}
type IDGenerator interface {
	NewID() common.ID
}
type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash string, password string) error
}
type TokenIssuer interface {
	IssueAccessToken(ctx context.Context, input AccessTokenInput) (string, error)
}
type TokenVerifier interface {
	VerifyAccessToken(ctx context.Context, token string) (VerifiedAccessToken, error)
}
type VerifiedAccessToken struct {
	Subject    common.ID
	BusinessID common.ID
	Role       business.UserRole
}
type AccessTokenInput struct {
	Subject    common.ID
	BusinessID common.ID
	Role       business.UserRole
	IssuedAt   time.Time
	ExpiresAt  time.Time
}
type RefreshTokenIssuer interface {
	NewRefreshToken() (string, error)
	HashRefreshToken(token string) string
}

// MFAChallengeInput parameterises a pending-second-factor token: it stands for a
// caller who passed the password check but still owes a TOTP/backup code.
type MFAChallengeInput struct {
	Subject    common.ID
	BusinessID common.ID
	Role       business.UserRole
	IssuedAt   time.Time
	ExpiresAt  time.Time
}
type MFAChallengeIssuer interface {
	IssueMFAChallengeToken(ctx context.Context, input MFAChallengeInput) (string, error)
}
type MFAChallengeVerifier interface {
	VerifyMFAChallengeToken(ctx context.Context, token string) (VerifiedAccessToken, error)
}

// MFASecrets owns the cryptography behind authenticator-app MFA: TOTP secret
// generation/verification (RFC 6238), at-rest encryption of the secret, and
// single-use backup codes. The application service depends only on this port.
type MFASecrets interface {
	GenerateSecret() (string, error)
	ProvisioningURI(secret string, accountName string) string
	// VerifyCode returns the matched TOTP step (and true) only for a code at a
	// step strictly greater than afterStep, so a code cannot be replayed.
	VerifyCode(secret string, code string, now time.Time, afterStep int64) (int64, bool)
	GenerateBackupCodes() ([]string, error)
	HashBackupCode(code string) string
	EncryptSecret(secret string) ([]byte, error)
	DecryptSecret(ciphertext []byte) (string, error)
}

// MFARepository persists per-user MFA enrolment, tenant-scoped under RLS.
type MFARepository interface {
	// Get returns the enrolment for a user, or ErrNotFound if none exists.
	Get(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAEnrollment, error)
	// Upsert stores (or replaces) the pending secret, leaving MFA disabled until
	// the first code is verified.
	Upsert(ctx context.Context, scope common.TenantScope, input UpsertMFAInput) error
	// Enable turns the enrolment on and stores the backup-code hashes.
	Enable(ctx context.Context, scope common.TenantScope, input EnableMFAInput) error
	// ConsumeBackupCode marks one matching, unused backup-code hash as used and
	// reports whether a match was found.
	ConsumeBackupCode(ctx context.Context, scope common.TenantScope, userID common.ID, codeHash string) (bool, error)
	// MarkVerified records a successful second factor: it advances last_used_step
	// (so a TOTP code cannot be replayed) and clears the failed-attempt lockout.
	MarkVerified(ctx context.Context, scope common.TenantScope, userID common.ID, usedStep int64) error
	// RegisterFailedAttempt increments the failed-attempt counter and, once it
	// reaches threshold, sets a lockout of lockFor and resets the counter. It
	// returns the active lockout deadline (zero time when not locked).
	RegisterFailedAttempt(
		ctx context.Context,
		scope common.TenantScope,
		userID common.ID,
		threshold int,
		lockFor time.Duration,
	) (time.Time, error)
	// Delete removes the enrolment, disabling MFA for the user.
	Delete(ctx context.Context, scope common.TenantScope, userID common.ID) error
}
type MFAEnrollment struct {
	BusinessID       common.ID
	UserID           common.ID
	SecretEncrypted  []byte
	Enabled          bool
	BackupCodesTotal int
	BackupCodesLeft  int
	LastUsedStep     int64
	LockedUntil      time.Time
}
type UpsertMFAInput struct {
	UserID          common.ID
	BusinessID      common.ID
	SecretEncrypted []byte
}
type EnableMFAInput struct {
	UserID           common.ID
	BackupCodeHashes []string
	// LastUsedStep pins the step of the activation code so it cannot be replayed
	// to complete a login immediately after enabling.
	LastUsedStep int64
}
type JobQueue interface {
	Enqueue(ctx context.Context, job Job) error
}
type Job struct {
	Name       string
	TenantID   common.ID
	Payload    map[string]string
	IdempotKey string
}
