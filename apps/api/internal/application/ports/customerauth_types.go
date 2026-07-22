package ports

import (
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

type CustomerOrderSummary struct {
	OrderID        common.ID
	BusinessName   string
	BusinessHandle string
	// StorePhone is the selling store's contact number (§5.3.3 / §12: the
	// customer can call the store about an order). Sourced from the store
	// owner's direct phone, falling back to their WhatsApp number (the only
	// contact older owners have); '' when the store has neither.
	StorePhone  string
	DesignTitle string
	Status      string
	// Kind is the customer-facing discriminator (§5.3.1): "standard" for a
	// made-to-wear (ready_made flow) order, "bespoke" for a custom one.
	Kind string
	// CheckoutGroupID links the orders bought together in one store basket
	// (§5.3.1 basket grouping); nil for a single-design checkout, which never
	// got a group.
	CheckoutGroupID  *common.ID
	AgreedTotalMinor int64
	CreatedAt        time.Time
	// ReceivedAt is the customer's "Received" acknowledgement (§5.3.2); nil
	// until they hit the button on an archived (final-stage) order.
	ReceivedAt *time.Time
}

// MarkReceivedResult is the outcome of stamping one customer's order received
// (§5.3.2), resolved by the repository in one pass so the application layer can
// map it to the right response.
type MarkReceivedResult struct {
	// Found is false when no order with that id belongs to the customer (an
	// other-customer order is indistinguishable from a missing one — 404).
	Found bool
	// FinalStage is false when the order has not reached its final stage yet
	// (status = 'fulfilled'); only a final-stage order may be marked received.
	FinalStage bool
	// AlreadyReceived is true when the order was already stamped — a repeat
	// mark is an idempotent no-op, not an error.
	AlreadyReceived bool
}

type CustomerProfile struct {
	CustomerID    common.ID
	DisplayName   string
	Phone         string
	Email         string
	WhatsAppPhone string
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

// CustomerOrderPaymentContext is everything needed to re-initiate a Paystack
// charge for one of the customer's draft orders (the payment-link endpoint):
// the tenant, the outstanding amount, how the original charge was purposed,
// and — for a cart basket — the per-design line amounts so the re-charge is
// commissioned exactly like the original combined charge.
type CustomerOrderPaymentContext struct {
	OrderID       common.ID
	BusinessID    common.ID
	Status        string
	CreatedAt     time.Time
	ClosedAt      *time.Time
	CustomerEmail string
	// OutstandingMinor is what is still owed on the order (agreed minus
	// settled); for a cart basket it is the whole group's outstanding, because
	// one charge pays the basket.
	OutstandingMinor int64
	// Purpose mirrors the original charge (standard_full / deposit /
	// booking_deposit / cart_full), so a success settles the order exactly as
	// the first attempt would have.
	Purpose   string
	BookingID *common.ID
	// LineAmountsMinor carries one commission base per basket design (delivery
	// fees excluded, matching the original cart charge); nil for a single-order
	// charge, which InitiateCharge commissions on the amount itself.
	LineAmountsMinor []int64
	// The latest attempt is verified before another link is minted. This avoids
	// double-charging an order whose prior Paystack transaction is still open.
	LastPaymentReference string
	LastPaymentStatus    string
}
