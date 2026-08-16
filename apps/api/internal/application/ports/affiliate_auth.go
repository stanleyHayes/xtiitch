package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliateAuthRepository interface {
	ActivateAffiliateAccount(
		ctx context.Context,
		input ActivateAffiliateAccountInput,
	) (AffiliateAccountRecord, error)
	FindAffiliateAccountByEmail(
		ctx context.Context,
		email string,
	) (AffiliateAccountCredentials, error)
	FindAffiliateAccountByID(
		ctx context.Context,
		accountID common.ID,
	) (AffiliateAccountRecord, error)
	CreateAffiliateActivationToken(
		ctx context.Context,
		input CreateAffiliateActivationTokenInput,
	) (AffiliateAccountRecord, error)
	CreateAffiliateRecoveryToken(
		ctx context.Context,
		input CreateAffiliateRecoveryTokenInput,
	) (AffiliateAccountRecord, error)
	ResetAffiliatePassword(
		ctx context.Context,
		input ResetAffiliatePasswordInput,
	) error
	RecordFailedAffiliateLogin(
		ctx context.Context,
		accountID common.ID,
		maxAttempts int,
		lockFor time.Duration,
	) error
	ClearFailedAffiliateLogin(ctx context.Context, accountID common.ID) error
	RecordAffiliateLogin(ctx context.Context, accountID common.ID) error
	CreateAffiliateSession(ctx context.Context, input CreateAffiliateSessionInput) error
	FindAffiliateSession(
		ctx context.Context,
		refreshTokenHash string,
	) (AffiliateSessionWithAccount, error)
	RevokeAffiliateSession(ctx context.Context, sessionID common.ID) error
}

type AffiliateTokenIssuer interface {
	IssueAffiliateAccessToken(
		ctx context.Context,
		input AffiliateAccessTokenInput,
	) (string, error)
}

type AffiliateTokenVerifier interface {
	VerifyAffiliateAccessToken(
		ctx context.Context,
		token string,
	) (VerifiedAffiliateAccessToken, error)
}
