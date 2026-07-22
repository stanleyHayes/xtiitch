package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
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
	// CloseCustomerDraftOrder hides one awaiting-payment order from both the
	// customer and business views. For a cart order it closes the whole checkout
	// group atomically so a partially closed basket can never be paid.
	CloseCustomerDraftOrder(ctx context.Context, customerID common.ID, orderID common.ID, at time.Time) (bool, error)
	// MarkCustomerOrderReceived stamps one of the customer's orders received
	// (§5.3.2) at the given time, but only when the order sits in its final
	// stage; the granular outcome lets the caller distinguish missing,
	// not-yet-final and already-received without a second round-trip.
	MarkCustomerOrderReceived(ctx context.Context, customerID common.ID, orderID common.ID, at time.Time) (MarkReceivedResult, error)
	// MarkCustomerBasketReceived stamps ALL of the customer's final-stage
	// orders in one checkout basket (§5.3.2 whole-basket "Received") in a single
	// transaction and returns how many were newly stamped. Already-stamped and
	// not-yet-final orders are left alone, so a repeat call is an idempotent
	// no-op returning 0.
	MarkCustomerBasketReceived(ctx context.Context, customerID common.ID, checkoutGroupID common.ID, at time.Time) (int, error)
	// GetCustomerOrderPaymentContext loads one of the customer's orders with
	// everything a re-initiated payment needs, or ErrNotFound when the order is
	// missing or belongs to someone else (indistinguishable by design).
	GetCustomerOrderPaymentContext(ctx context.Context, customerID common.ID, orderID common.ID) (CustomerOrderPaymentContext, error)
	// GetCustomerProfile / UpdateCustomerProfile read and edit the global customer
	// identity (name, email, WhatsApp contact number). The login Phone is immutable
	// (it's the verified login); WhatsAppPhone is a separate editable contact.
	GetCustomerProfile(ctx context.Context, customerID common.ID) (CustomerProfile, error)
	UpdateCustomerProfile(ctx context.Context, customerID common.ID, displayName, email, whatsAppPhone string) (CustomerProfile, error)
}

// CustomerTokenIssuer / CustomerTokenVerifier mint and validate customer session
// tokens. This is a distinct scope from business and admin tokens.
type CustomerTokenIssuer interface {
	IssueCustomerAccessToken(ctx context.Context, input CustomerAccessTokenInput) (string, error)
}

type CustomerTokenVerifier interface {
	VerifyCustomerAccessToken(ctx context.Context, token string) (VerifiedCustomerToken, error)
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
