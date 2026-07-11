package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

// MFAChallengeInput parameterises a pending-second-factor token: it stands for a
// caller who passed the password check but still owes a TOTP/backup code.
type MFAChallengeInput struct {
	Subject    common.ID
	BusinessID common.ID
	Role       business.UserRole
	IssuedAt   time.Time
	ExpiresAt  time.Time
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

type Job struct {
	Name       string
	TenantID   common.ID
	Payload    map[string]string
	IdempotKey string
}
