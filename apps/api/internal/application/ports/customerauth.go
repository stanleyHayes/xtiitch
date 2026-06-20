package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// CustomerAuthRepository persists phone one-time-code challenges and resolves
// customer identities. Customers are a global identity (no tenant scope), so
// this runs under the RLS bypass.
type CustomerAuthRepository interface {
	CreateOTPChallenge(ctx context.Context, input CreateOTPChallengeInput) error
	// LatestActiveOTPChallenge returns the newest unconsumed, unexpired challenge
	// for a phone, or ErrNotFound when there is none.
	LatestActiveOTPChallenge(ctx context.Context, phone string, now time.Time) (OTPChallengeRecord, error)
	IncrementOTPAttempts(ctx context.Context, challengeID common.ID) error
	ConsumeOTPChallenge(ctx context.Context, challengeID common.ID) error
	// UpsertVerifiedCustomerByPhone resolves (or creates) the customer for a
	// verified phone and stamps phone_verified_at, returning the customer id.
	UpsertVerifiedCustomerByPhone(ctx context.Context, newID common.ID, phone string) (common.ID, error)
}

type CreateOTPChallengeInput struct {
	ChallengeID common.ID
	Phone       string
	CodeHash    string
	ExpiresAt   time.Time
}

type OTPChallengeRecord struct {
	ChallengeID common.ID
	Phone       string
	CodeHash    string
	Attempts    int
	ExpiresAt   time.Time
}

// CustomerTokenIssuer / CustomerTokenVerifier mint and validate customer session
// tokens. This is a distinct scope from business and admin tokens.
type CustomerTokenIssuer interface {
	IssueCustomerAccessToken(ctx context.Context, input CustomerAccessTokenInput) (string, error)
}

type CustomerTokenVerifier interface {
	VerifyCustomerAccessToken(ctx context.Context, token string) (VerifiedCustomerToken, error)
}

type CustomerAccessTokenInput struct {
	CustomerID common.ID
	Phone      string
	IssuedAt   time.Time
	ExpiresAt  time.Time
}

type VerifiedCustomerToken struct {
	CustomerID common.ID
	Phone      string
}

// CustomerOTPDelivery sends a one-time code to a customer's phone (WhatsApp/SMS).
type CustomerOTPDelivery interface {
	SendOTP(ctx context.Context, phone string, code string) error
}

// OTPGenerator generates and hashes one-time codes.
type OTPGenerator interface {
	NewCode() (string, error)
	HashCode(code string) string
}
