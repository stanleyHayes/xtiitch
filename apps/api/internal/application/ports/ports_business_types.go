package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type PasswordResetTarget struct {
	UserID      common.ID
	Email       string
	DisplayName string
}

type CreatePasswordResetChallengeInput struct {
	ChallengeID common.ID
	UserID      common.ID
	Email       string
	CodeHash    string
	ExpiresAt   time.Time
}

type PasswordResetChallenge struct {
	ChallengeID common.ID
	UserID      common.ID
	Email       string
	CodeHash    string
	Attempts    int
	ExpiresAt   time.Time
}

type CreateBusinessWithOwnerInput struct {
	BusinessID       common.ID
	BusinessName     string
	BusinessHandle   string
	OwnerUserID      common.ID
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
	// PlanCode is the plan the owner chose at signup. A paid choice is parked as
	// pending while the effective business plan remains Free until payment.
	// Empty or unknown codes fall back to Free.
	PlanCode string
	// Phone is the store owner's contact phone number captured at signup, stored
	// for order and account notifications. Optional; not a sign-in identity.
	Phone string
	// PhoneVerified records that the phone was proven with an OTP at signup. The
	// phone is the number Xtiitch sends SMS to, so it is the number worth proving
	// (signup used to prove the WhatsApp number instead, which is chat-only).
	PhoneVerified bool
	// WhatsApp identity is optional and additive to email + password: when
	// WhatsAppNumber is set the owner can also sign in with a WhatsApp code, and
	// WhatsAppVerified records that the number was proven (via OTP) at signup.
	WhatsAppNumber   string
	WhatsAppVerified bool
}

// PublicPlanRecord is the subset of plan data safe to expose unauthenticated for
// the signup plan picker. The quarterly/yearly first+renewal figures are the
// exact stored Pricing Book amounts (minor units): the first paid subscription
// bills the *first* figure, every renewal bills the *renewal* figure.
type PublicPlanRecord struct {
	Code            string
	Name            string
	MonthlyFeeMinor int
	YearlyFeeMinor  int
	CommissionBps   int
	DesignLimit     *int
	// Cadence pricing (minor units). Zero for the free plan.
	QuarterlyFirstMinor   int
	QuarterlyRenewalMinor int
	YearlyFirstMinor      int
	YearlyRenewalMinor    int
}

// BusinessSubscriptionRecord is the tenant's own subscription view for the
// self-serve billing flow (joined with plan + owner email).
type BusinessSubscriptionRecord struct {
	SubscriptionID          common.ID
	BusinessID              common.ID
	BusinessName            string
	OwnerEmail              string
	PlanCode                string
	MonthlyFeeMinor         int
	Status                  string
	BillingMode             string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
	// BillingCadence is the tenant's chosen cadence ('monthly' is the legacy
	// default; the Pricing Book activation path requires 'quarterly' or 'yearly').
	BillingCadence string
	// FirstPurchaseConsumed is true once the account has been charged at least
	// once; the one-time intro figure is only billed while it is false.
	FirstPurchaseConsumed bool
	// EffectivePlan* is the plan whose entitlements the business has actually
	// paid for. During a payment-pending upgrade the billing fields above describe
	// the target plan, while these fields remain on the current/free plan.
	EffectivePlanCode              string
	EffectiveMonthlyFeeMinor       int
	EffectiveQuarterlyRenewalMinor int
	EffectiveYearlyRenewalMinor    int
	// Cadence pricing carried from the joined plan (minor units), so the
	// activation charge can pick the intro/renewal figure without a second query.
	QuarterlyFirstMinor   int
	QuarterlyRenewalMinor int
	YearlyFirstMinor      int
	YearlyRenewalMinor    int
	// Current billed period bounds, so a self-serve plan change can prorate the
	// remainder of the period (upgrade) and pin a downgrade's effective date.
	CurrentPeriodStart time.Time
	CurrentPeriodEnd   time.Time
	// PendingUpgradePlanID is the target plan of an upgrade that is parked
	// AWAITING PAYMENT (business_subscriptions.pending_plan_id with a NULL
	// pending_plan_effective_at): the owner checked out but Paystack has not
	// verified the charge yet. Empty when no payment-pending upgrade exists.
	// While it is set the plan pricing fields above reflect the PENDING plan
	// (so the first charge is priced correctly), but entitlements still resolve
	// from the current paid-up plan — businesses.plan_id only moves once the
	// payment verifies. A SCHEDULED downgrade (effective_at set) is different
	// and is not reported here.
	PendingUpgradePlanID common.ID
}

// PlanPricingRecord is a plan's identity + pricing needed to classify and prorate a
// self-serve plan change. It comes from the global (non-tenant) plans table.
type PlanPricingRecord struct {
	PlanID          common.ID
	Code            string
	MonthlyFeeMinor int
	// Cadence renewal figures (minor units); the proration is computed against
	// these, matching how the recurring sweep bills each renewal.
	QuarterlyRenewalMinor int
	YearlyRenewalMinor    int
}

// ApplyImmediatePlanUpgradeInput switches a tenant to a higher plan at once. When
// AmountMinor > 0 it also books the prorated charge as a paid invoice keyed on
// ChargeRef (idempotent); a zero amount just switches the plan (no invoice).
type ApplyImmediatePlanUpgradeInput struct {
	BusinessID     common.ID
	NewPlanID      common.ID
	BillingCadence string
	AmountMinor    int64
	Currency       string
	// ChargeRef is the deterministic Paystack charge reference; it becomes the
	// invoice ref so the charge webhook reconciles to this already-paid invoice and
	// a replayed upgrade no-ops instead of switching/charging twice.
	ChargeRef string
}

// SchedulePlanDowngradeInput parks a pending downgrade to apply at period end. It
// does NOT change entitlements or move money now.
type SchedulePlanDowngradeInput struct {
	BusinessID  common.ID
	NewPlanID   common.ID
	EffectiveAt time.Time
}

// ActivateRecurringBillingInput stores the verified Paystack references on a
// tenant's subscription.
type ActivateRecurringBillingInput struct {
	BusinessID              common.ID
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
	// ProviderChannel is the Paystack authorization channel ('card', 'mobile_money',
	// …). It MUST be stored so the recurring sweep can tell a silently-chargeable
	// card from a mobile-money authorization that has to be reminder-driven. Empty
	// is treated as card-like (silent auto-charge), preserving legacy behaviour.
	ProviderChannel string
}

// RecordSubscriptionActivationPaymentInput books the first recurring charge.
type RecordSubscriptionActivationPaymentInput struct {
	BusinessID  common.ID
	AmountMinor int64
	Currency    string
	// ChargeRef is the Paystack charge reference; it becomes the invoice ref so the
	// charge webhook reconciles to this already-paid invoice (a no-op).
	ChargeRef string
	// PeriodStart is the period anchor PrepareSubscriptionActivationCharge
	// returned alongside ChargeRef. The booking must use it VERBATIM: the ref is
	// derived from this anchor, so recomputing a start here (a second now())
	// could disagree with the ref's anchor and let a retried verify book a
	// duplicate paid invoice under a fresh ref.
	PeriodStart time.Time
	// BillingCadence ('quarterly' or 'yearly') drives the paid period length: on a
	// fresh (first) charge the period end and next_billing_at advance by 3 or 12
	// months, and first_purchase_consumed is set so the intro is never re-granted.
	BillingCadence string
}

// SubscriptionActivationCharge is the deterministic reference for a
// subscription's first-period charge plus whether that charge is still due.
type SubscriptionActivationCharge struct {
	Ref          string
	ShouldCharge bool
	// PeriodStart is the anchor Ref was derived from: the current period's start
	// while that period is still live (a retry no-ops against it), or now() once
	// the period has lapsed, so a resubscribe pays for a FRESH period instead of
	// colliding with the stale period's already-paid invoice. Hand it back via
	// RecordSubscriptionActivationPaymentInput so the booking matches the ref.
	PeriodStart time.Time
}

// SubmitIdentityDocumentInput carries a business's Ghana Card submission: the
// owner's full legal name as printed on the card (§2.3), the card number, and
// both the front and back photos.
type SubmitIdentityDocumentInput struct {
	BusinessID     common.ID
	FullLegalName  string
	CardNumber     string
	IDPhotoURL     string
	IDPhotoBackURL string
}

// SubscriptionDiscountCode is a discount code as needed at checkout validation.
type SubscriptionDiscountCode struct {
	DiscountCodeID common.ID
	Code           string
	// DiscountType is 'free_period', 'percentage', or 'fixed'.
	DiscountType string
	// DiscountValue is >0: percent (percentage), pesewas off (fixed), or free
	// months (free_period).
	DiscountValue     int
	EligiblePlans     []string
	EligibleCadences  []string
	FirstPurchaseOnly bool
	// MaxRedemptionsTotal is the global applied-redemption cap; nil means unlimited.
	MaxRedemptionsTotal *int
	MaxPerAccount       int
	ValidFrom           *time.Time
	ValidUntil          *time.Time
}

// CreateDiscountRedemptionInput records a redemption for attribution. At checkout
// Status is 'pending'; the verify step flips it to 'applied'.
type CreateDiscountRedemptionInput struct {
	DiscountCodeID common.ID
	BusinessID     common.ID
	SubscriptionID common.ID
	AccountKey     string
	PlanCode       string
	Cadence        string
	DiscountMinor  int64
	Status         string
}

// PendingDiscountRedemption is a captured-but-not-yet-applied redemption joined
// with the discount type/value needed to compute the activation charge.
type PendingDiscountRedemption struct {
	RedemptionID   common.ID
	DiscountCodeID common.ID
	DiscountType   string
	DiscountValue  int
	PlanCode       string
	Cadence        string
	DiscountMinor  int64
}

// MarkDiscountRedemptionAppliedInput flips a pending redemption to applied.
type MarkDiscountRedemptionAppliedInput struct {
	RedemptionID  common.ID
	DiscountMinor int64
}

// ActivateFreePeriodInput activates a subscription on a free-period code.
type ActivateFreePeriodInput struct {
	BusinessID common.ID
	// ChargeRef is the deterministic activation ref (the invoice ref), so the zero
	// invoice is idempotent against re-verify and the charge webhook.
	ChargeRef string
	// PeriodStart is the period anchor PrepareSubscriptionActivationCharge
	// derived ChargeRef from. It must be stored VERBATIM as the window's
	// current_period_start: recomputing a start here could disagree with the
	// ref's anchor and let a re-entry during the window derive a DIFFERENT ref —
	// granting the free period a second time.
	PeriodStart time.Time
	Currency    string
	FreeMonths  int
}

type BusinessOwnerIdentity struct {
	BusinessID     common.ID
	BusinessUserID common.ID
	Role           business.UserRole
}

type BusinessUserCredentials struct {
	BusinessID common.ID
	UserID     common.ID
	// LoginLockedUntil is non-nil and in the future when the account is temporarily
	// locked after too many failed password attempts.
	LoginLockedUntil *time.Time
	PasswordHash     string
	Role             business.UserRole
	IsActive         bool
}

// CreateSignInOTPChallengeInput stores a hashed business sign-in code.
type CreateSignInOTPChallengeInput struct {
	ChallengeID    common.ID
	WhatsAppNumber string
	CodeHash       string
	ExpiresAt      time.Time
	// Purpose scopes the challenge to the flow that issued it, so a code obtained
	// for one flow cannot be replayed into another (see BusinessOTPPurpose).
	Purpose string
}

// The flows that may issue a business one-time code. A challenge is only valid
// for the purpose it was issued under: the store is keyed on the phone number,
// which is shared across flows, so without this a code the owner requested to
// sign in would equally authorise redirecting their payouts.
const (
	BusinessOTPPurposeSignIn   = "signin"
	BusinessOTPPurposeRegister = "register"
	BusinessOTPPurposePayout   = "payout"
	// BusinessOTPPurposeProfile scopes codes that prove a NEW phone number in the
	// §9 owner self-service profile flow, before it may replace the old one.
	BusinessOTPPurposeProfile = "profile"
)

// BusinessOTPChallengeRecord is an active business sign-in OTP challenge.
type BusinessOTPChallengeRecord struct {
	ChallengeID    common.ID
	WhatsAppNumber string
	CodeHash       string
	Attempts       int
	ExpiresAt      time.Time
	// CreatedAt is when the code was sent, used to throttle resends to the same
	// number. Each send costs a real SMS.
	CreatedAt time.Time
}

type BusinessUserRecord struct {
	UserID      common.ID
	BusinessID  common.ID
	Email       string
	DisplayName string
	Phone       string
	Role        business.UserRole
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CreateBusinessUserInput struct {
	UserID       common.ID
	BusinessID   common.ID
	Email        string
	DisplayName  string
	Phone        string
	PasswordHash string
	Role         business.UserRole
}

type UpdateBusinessUserInput struct {
	UserID      common.ID
	DisplayName string
	Phone       string
	Role        business.UserRole
	IsActive    bool
}

// BusinessUserProfileRecord is the signed-in user's own profile (§9), richer
// than BusinessUserRecord: it carries the WhatsApp chat number and whether the
// phone was OTP-proven, which the team-management record does not need.
type BusinessUserProfileRecord struct {
	UserID          common.ID
	BusinessID      common.ID
	Email           string
	DisplayName     string
	Phone           string
	PhoneVerifiedAt *time.Time
	WhatsAppNumber  string
	Role            business.UserRole
	IsActive        bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// UpdateOwnBusinessUserProfileInput carries the caller's MERGED profile values
// (the service resolves "field omitted" against the current row, so every field
// here is final). Unlike UpdateBusinessUserInput it has no role/is_active:
// self-service must never let a user promote or deactivate themselves, and it
// may touch the owner row, which the team-management update deliberately
// refuses. PhoneVerified records that a new phone was just OTP-proven, so the
// repo stamps phone_verified_at anew; when false the column is left alone.
type UpdateOwnBusinessUserProfileInput struct {
	UserID         common.ID
	Email          string
	DisplayName    string
	Phone          string
	PhoneVerified  bool
	WhatsAppNumber string
}

type UpdateBusinessUserPasswordInput struct {
	UserID       common.ID
	PasswordHash string
}

type TransferBusinessOwnerInput struct {
	CurrentOwnerUserID common.ID
	NewOwnerUserID     common.ID
}

type TransferBusinessOwnerResult struct {
	PreviousOwner BusinessUserRecord
	NewOwner      BusinessUserRecord
}

type CreateAuthSessionInput struct {
	SessionID        common.ID
	BusinessID       common.ID
	BusinessUserID   common.ID
	RefreshTokenHash string
	UserAgent        string
	IPAddress        string
	ExpiresAt        time.Time
}

type AuthSessionWithUser struct {
	SessionID      common.ID
	BusinessID     common.ID
	BusinessUserID common.ID
	Role           business.UserRole
	UserIsActive   bool
	Revoked        bool
	ExpiresAt      time.Time
}
