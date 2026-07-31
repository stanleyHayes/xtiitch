package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliateAccountRecord struct {
	AccountID        common.ID
	AffiliateID      common.ID
	Email            string
	DisplayName      string
	Code             string
	CookieWindowDays int
	Status           string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type AffiliateAccountCredentials struct {
	AffiliateAccountRecord
	PasswordHash string
	LockedUntil  *time.Time
}

type ActivateAffiliateAccountInput struct {
	ActivationTokenHash string
	PasswordHash        string
	ActivatedAt         time.Time
}

type CreateAffiliateRecoveryTokenInput struct {
	TokenID   common.ID
	Email     string
	TokenHash string
	ExpiresAt time.Time
}

type ResetAffiliatePasswordInput struct {
	TokenHash    string
	PasswordHash string
	ResetAt      time.Time
}

type CreateAffiliateSessionInput struct {
	SessionID        common.ID
	AccountID        common.ID
	RefreshTokenHash string
	UserAgent        string
	IPHash           string
	ExpiresAt        time.Time
}

type AffiliateSessionWithAccount struct {
	SessionID     common.ID
	AccountID     common.ID
	AffiliateID   common.ID
	Email         string
	DisplayName   string
	Code          string
	AccountStatus string
	Revoked       bool
	ExpiresAt     time.Time
}

type AffiliateAccessTokenInput struct {
	AccountID   common.ID
	AffiliateID common.ID
	IssuedAt    time.Time
	ExpiresAt   time.Time
}

type VerifiedAffiliateAccessToken struct {
	AccountID   common.ID
	AffiliateID common.ID
}
