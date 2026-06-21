package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// CustomerOTPChannel names the medium a one-time code is sent over. Customers
// can sign in by phone (WhatsApp) or by email; the challenge stores which.
type CustomerOTPChannel string

const (
	CustomerOTPChannelWhatsApp CustomerOTPChannel = "whatsapp"
	CustomerOTPChannelEmail    CustomerOTPChannel = "email"
)

// CustomerAuthRepository persists one-time-code challenges and resolves customer
// identities. Customers are a global identity (no tenant scope), so this runs
// under the RLS bypass.
type CustomerAuthRepository interface {
	CreateOTPChallenge(ctx context.Context, input CreateOTPChallengeInput) error
	// LatestActiveOTPChallenge returns the newest unconsumed, unexpired challenge
	// for a channel + identifier (phone for whatsapp, email for email), or
	// ErrNotFound when there is none.
	LatestActiveOTPChallenge(ctx context.Context, channel CustomerOTPChannel, identifier string, now time.Time) (OTPChallengeRecord, error)
	IncrementOTPAttempts(ctx context.Context, challengeID common.ID) error
	ConsumeOTPChallenge(ctx context.Context, challengeID common.ID) error
	// UpsertVerifiedCustomerByPhone resolves (or creates) the customer for a
	// verified phone and stamps phone_verified_at, returning the customer id.
	UpsertVerifiedCustomerByPhone(ctx context.Context, newID common.ID, phone string) (common.ID, error)
	// UpsertVerifiedCustomerByEmail resolves (or creates) the customer for a
	// verified email (matched case-insensitively, earliest first) and returns the
	// customer id. A newly created customer has an email and no phone.
	UpsertVerifiedCustomerByEmail(ctx context.Context, newID common.ID, email string) (common.ID, error)
	// ListCustomerOrders returns a signed-in customer's orders across every shop
	// (cross-tenant, RLS bypass), newest first.
	ListCustomerOrders(ctx context.Context, customerID common.ID) ([]CustomerOrderSummary, error)
	// GetCustomerProfile / UpdateCustomerProfile read and edit the global customer
	// identity (name, email). Phone is immutable (it's the verified login).
	GetCustomerProfile(ctx context.Context, customerID common.ID) (CustomerProfile, error)
	UpdateCustomerProfile(ctx context.Context, customerID common.ID, displayName string, email string) (CustomerProfile, error)
}

type CustomerOrderSummary struct {
	OrderID          common.ID
	BusinessName     string
	BusinessHandle   string
	DesignTitle      string
	Status           string
	AgreedTotalMinor int64
	CreatedAt        time.Time
}

type CustomerProfile struct {
	CustomerID  common.ID
	DisplayName string
	Phone       string
	Email       string
}

type CreateOTPChallengeInput struct {
	ChallengeID common.ID
	Channel     CustomerOTPChannel
	Phone       string
	Email       string
	CodeHash    string
	ExpiresAt   time.Time
}

type OTPChallengeRecord struct {
	ChallengeID common.ID
	Channel     CustomerOTPChannel
	Phone       string
	Email       string
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

// CustomerEmailOTPDelivery sends a one-time code to a customer's email. Like the
// phone delivery, the dev fallback logs the code when no email provider is
// configured, so email sign-in is exercisable locally.
type CustomerEmailOTPDelivery interface {
	SendEmailOTP(ctx context.Context, email string, code string) error
}

// OTPGenerator generates and hashes one-time codes.
type OTPGenerator interface {
	NewCode() (string, error)
	HashCode(code string) string
}
