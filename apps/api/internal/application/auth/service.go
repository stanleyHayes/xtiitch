package authapp

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

const (
	minPasswordLength         = 8
	ownerTransferConfirmation = "TRANSFER OWNER"
	// bcrypt silently truncates input beyond 72 bytes, so reject longer
	// passwords rather than hashing a quietly-truncated value.
	maxPasswordLength = 72
	// accessTokenTTL bounds how long the dashboard can act on one access token
	// before re-auth. The dashboard logs out on a 401, so this is effectively the
	// inactivity timeout. Updates spec §12: keep users signed in ~3× longer — a
	// 3-hour access window so brief inactivity never drops the session.
	accessTokenTTL = 3 * time.Hour
	// refreshTokenTTL is the long-lived login window (Updates §12: 3× longer).
	refreshTokenTTL = 90 * 24 * time.Hour
	// mfaChallengeTTL bounds how long a password-verified caller has to present
	// their second factor before the challenge token expires.
	mfaChallengeTTL = 5 * time.Minute
	// MFA verification lockout: after this many consecutive bad codes the account
	// is locked from MFA verification for the duration, to bound brute force.
	mfaMaxFailedAttempts = 5
	mfaLockoutDuration   = 15 * time.Minute
	// Self-service password reset: a one-time emailed code, short-lived and
	// attempt-capped to bound brute force.
	passwordResetTTL      = 15 * time.Minute
	maxPasswordResetTries = 5
)

var handlePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$`)

// reservedHandles are platform subdomains and system words that must never be a
// business store handle, since each business is reached at <handle>.xtiitch.com
// and these labels route to their own surfaces. Kept in sync with the
// storefront's RESERVED_SUBDOMAINS.
var reservedHandles = map[string]bool{
	"www": true, "app": true, "admin": true, "api": true,
	"store": true, "stores": true, "dashboard": true,
	"mail": true, "static": true, "assets": true, "cdn": true,
	"help": true, "support": true, "status": true, "blog": true,
	"xtiitch": true,
}

type Service struct {
	businesses    ports.BusinessIdentityRepository
	payments      ports.PaymentProvider
	sessions      ports.AuthSessionRepository
	passwords     ports.PasswordHasher
	accessTokens  ports.TokenIssuer
	refreshTokens ports.RefreshTokenIssuer
	emails        ports.EmailSender
	resets        ports.PasswordResetRepository
	dashboardURL  string
	ids           ports.IDGenerator
	clock         ports.Clock
	mfa           ports.MFARepository
	mfaSecrets    ports.MFASecrets
	mfaChallenges ports.MFAChallengeIssuer
	mfaVerifier   ports.MFAChallengeVerifier
	// WhatsApp one-time-code sign-in is optional (like MFA): when any is nil the
	// WhatsApp auth endpoints are disabled and password login is unaffected.
	whatsAppAuth ports.BusinessWhatsAppAuthRepository
	otpGen       ports.OTPGenerator
	whatsAppOTP  ports.CustomerOTPDelivery
	// discounts backs optional subscription discount-code redemption at checkout.
	// When nil, no code is accepted (a supplied code is rejected, never silently
	// ignored) and the plain intro/renewal charge path is unaffected.
	discounts ports.SubscriptionDiscountRepository
	// vatRateBps / vatInclusive apply VAT to subscription charges (activation,
	// renewal, upgrade proration). 0 disables VAT (behaviour unchanged); see
	// money.ApplyVAT. inclusive=false adds VAT on top of the listed price.
	vatRateBps   int
	vatInclusive bool
	// logger records auth-flow events (OTP send/verify, best-effort side effects)
	// so failures are visible instead of silently swallowed.
	logger *slog.Logger
}

type Dependencies struct {
	Businesses    ports.BusinessIdentityRepository
	Payments      ports.PaymentProvider
	Sessions      ports.AuthSessionRepository
	Passwords     ports.PasswordHasher
	AccessTokens  ports.TokenIssuer
	RefreshTokens ports.RefreshTokenIssuer
	Emails        ports.EmailSender
	Resets        ports.PasswordResetRepository
	DashboardURL  string
	IDs           ports.IDGenerator
	Clock         ports.Clock
	// MFA dependencies are optional: when any is nil, MFA enrolment/verification
	// is disabled and login always issues a session directly.
	MFA           ports.MFARepository
	MFASecrets    ports.MFASecrets
	MFAChallenges ports.MFAChallengeIssuer
	MFAVerifier   ports.MFAChallengeVerifier
	// Optional WhatsApp one-time-code sign-in dependencies.
	WhatsAppAuth ports.BusinessWhatsAppAuthRepository
	OTPGen       ports.OTPGenerator
	WhatsAppOTP  ports.CustomerOTPDelivery
	// Optional subscription discount-code redemption at checkout. When nil, codes
	// are unavailable and a supplied code is rejected.
	Discounts ports.SubscriptionDiscountRepository
	// VAT applied to subscription charges. VATRateBps 0 (default) disables it;
	// VATInclusive=false adds it at checkout, true treats listed prices as inclusive.
	VATRateBps   int
	VATInclusive bool
	// Logger records auth-flow events; when nil, slog.Default() is used.
	Logger *slog.Logger
}

func NewService(deps Dependencies) Service {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return Service{
		businesses:    deps.Businesses,
		payments:      deps.Payments,
		sessions:      deps.Sessions,
		passwords:     deps.Passwords,
		accessTokens:  deps.AccessTokens,
		refreshTokens: deps.RefreshTokens,
		emails:        deps.Emails,
		resets:        deps.Resets,
		dashboardURL:  strings.TrimRight(strings.TrimSpace(deps.DashboardURL), "/"),
		ids:           deps.IDs,
		clock:         deps.Clock,
		mfa:           deps.MFA,
		mfaSecrets:    deps.MFASecrets,
		mfaChallenges: deps.MFAChallenges,
		mfaVerifier:   deps.MFAVerifier,
		whatsAppAuth:  deps.WhatsAppAuth,
		otpGen:        deps.OTPGen,
		whatsAppOTP:   deps.WhatsAppOTP,
		discounts:     deps.Discounts,
		vatRateBps:    deps.VATRateBps,
		vatInclusive:  deps.VATInclusive,
		logger:        logger,
	}
}

// SubscriptionVATPolicy reports the configured VAT rate (basis points) and
// treatment applied to subscription charges, so the public /plans endpoint can
// disclose it. A zero rate means VAT is disabled.
func (s Service) SubscriptionVATPolicy() (rateBps int, inclusive bool) {
	return s.vatRateBps, s.vatInclusive
}

// grossSubscriptionCharge applies the configured subscription VAT to a base
// (net or listed) charge and returns the gross amount to charge and record. With
// VAT disabled (rate 0) or inclusive pricing the base is returned unchanged; with
// added-at-checkout pricing VAT is added on top. It is the single place the
// subscription money path grosses a charge for VAT.
func (s Service) grossSubscriptionCharge(baseMinor int64) int64 {
	return money.ApplyVAT(baseMinor, s.vatRateBps, s.vatInclusive).GrossMinor
}

// Subscription discount-code checkout errors. They are distinct sentinels so the
// dashboard can show a precise, non-silent message for an invalid/ineligible code
// (a bad code must never be quietly ignored — the Pricing Book §4).
var (
	// ErrDiscountCodeInvalid: unknown, inactive, archived, or discounts unavailable.
	ErrDiscountCodeInvalid = errors.New("discount code is invalid")
	// ErrDiscountCodeExpired: outside the code's [valid_from, valid_until] window.
	ErrDiscountCodeExpired = errors.New("discount code is expired or not yet valid")
	// ErrDiscountCodeIneligible: plan/cadence not eligible, or first-purchase-only
	// on an account that already consumed its first purchase.
	ErrDiscountCodeIneligible = errors.New("discount code is not eligible for this plan")
	// ErrDiscountCodeExhausted: total or per-account redemption cap reached.
	ErrDiscountCodeExhausted = errors.New("discount code has reached its redemption limit")
)

// Self-serve plan-change errors (Pricing Book §7). Distinct sentinels so the
// dashboard can explain precisely why a change was refused.
var (
	// ErrPlanChangeSamePlan: the target is the current plan, or a same-priced tier
	// (classification by monthly_fee_minor yields neither an upgrade nor a downgrade).
	ErrPlanChangeSamePlan = errors.New("subscription is already on that plan")
	// ErrPlanChangeBillingInactive: an upgrade that owes a prorated charge needs an
	// active recurring authorization on file, but the subscription has none (e.g. a
	// free plan or one that never completed billing setup). They must set up billing
	// via the activation flow first.
	ErrPlanChangeBillingInactive = errors.New("active recurring billing is required to upgrade")
	// ErrPlanChangeChargeFailed: the prorated upgrade charge did not succeed, so the
	// plan was NOT switched (money-critical: never grant entitlements unpaid).
	ErrPlanChangeChargeFailed = errors.New("the prorated upgrade charge did not succeed")
)

// mfaEnabled reports whether the optional MFA dependency set is fully wired.
func (s Service) mfaEnabled() bool {
	return s.mfa != nil && s.mfaSecrets != nil && s.mfaChallenges != nil && s.mfaVerifier != nil
}

// whatsAppOTPEnabled reports whether the optional WhatsApp one-time-code
// dependency set is fully wired.
func (s Service) whatsAppOTPEnabled() bool {
	return s.whatsAppAuth != nil && s.otpGen != nil && s.whatsAppOTP != nil
}

type RegisterBusinessCommand struct {
	BusinessName     string
	BusinessHandle   string
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
	PlanCode         string
	UserAgent        string
	IPAddress        string
	// OwnerPhone is the store owner's contact phone number captured at signup.
	// Unlike WhatsAppNumber it is not a sign-in identity and needs no verification;
	// it is stored for order and account notifications. Optional.
	OwnerPhone string
	// Optional WhatsApp identity captured at signup. When WhatsAppNumber is set,
	// WhatsAppCode must be a valid one-time code (proving control of the number);
	// the number is then stored as a verified alternative sign-in identity.
	WhatsAppNumber string
	WhatsAppCode   string
}

type LoginBusinessCommand struct {
	BusinessHandle string
	OwnerEmail     string
	OwnerPassword  string
	UserAgent      string
	IPAddress      string
}

type AuthResult struct {
	BusinessID       common.ID
	BusinessUserID   common.ID
	AccessToken      string
	RefreshToken     string
	AccessExpiresAt  time.Time
	RefreshExpiresAt time.Time
	// MFARequired is set when the password was correct but the account has MFA
	// enabled; the caller must complete VerifyMFALogin with MFAChallengeToken to
	// obtain a session. When true, the token fields above are empty.
	MFARequired       bool
	MFAChallengeToken string
}

func (s Service) RegisterBusiness(ctx context.Context, cmd RegisterBusinessCommand) (AuthResult, error) {
	normalized, err := normalizeRegistration(cmd)
	if err != nil {
		return AuthResult{}, err
	}

	passwordHash, err := s.passwords.Hash(normalized.OwnerPassword)
	if err != nil {
		return AuthResult{}, err
	}

	// Optional WhatsApp identity: when the signup supplied a number, it must be
	// proven with a valid one-time code before the account is created, and it is
	// then stored as verified. No number → register with email + password only
	// (fully backward compatible).
	var whatsAppNumber string
	var whatsAppVerified bool
	if strings.TrimSpace(cmd.WhatsAppNumber) != "" {
		if !s.whatsAppOTPEnabled() {
			return AuthResult{}, ErrWhatsAppOTPUnavailable
		}
		number, err := normalizeGhanaPhone(cmd.WhatsAppNumber)
		if err != nil {
			return AuthResult{}, err
		}
		if err := s.verifyBusinessOTP(ctx, number, cmd.WhatsAppCode); err != nil {
			return AuthResult{}, err
		}
		whatsAppNumber = number
		whatsAppVerified = true
	}

	identity, err := s.businesses.CreateBusinessWithOwner(ctx, ports.CreateBusinessWithOwnerInput{
		BusinessID:       s.ids.NewID(),
		BusinessName:     normalized.BusinessName,
		BusinessHandle:   normalized.BusinessHandle,
		OwnerUserID:      s.ids.NewID(),
		OwnerDisplayName: normalized.OwnerDisplayName,
		OwnerEmail:       normalized.OwnerEmail,
		OwnerPassword:    passwordHash,
		PlanCode:         normalized.PlanCode,
		Phone:            strings.TrimSpace(cmd.OwnerPhone),
		WhatsAppNumber:   whatsAppNumber,
		WhatsAppVerified: whatsAppVerified,
	})
	if err != nil {
		return AuthResult{}, err
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     identity.BusinessID,
		BusinessUserID: identity.BusinessUserID,
		Role:           identity.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

// HandleAvailability is the result of a store-handle availability check, used by
// the signup form to validate the handle in real time.
type HandleAvailability struct {
	Handle    string
	Available bool
	// Reason explains an unavailable handle: "invalid", "reserved", or "taken".
	// Empty when Available is true.
	Reason string
}

// CheckHandleAvailability validates a candidate store handle and reports whether
// it can be claimed, applying exactly the same normalization, format,
// reserved-word and uniqueness rules as RegisterBusiness. It performs no
// mutation and is safe to call unauthenticated.
func (s Service) CheckHandleAvailability(ctx context.Context, raw string) (HandleAvailability, error) {
	handle := normalizeHandle(raw)
	if handle == "" || !handlePattern.MatchString(handle) {
		return HandleAvailability{Handle: handle, Available: false, Reason: "invalid"}, nil
	}
	if reservedHandles[handle] {
		return HandleAvailability{Handle: handle, Available: false, Reason: "reserved"}, nil
	}
	exists, err := s.businesses.HandleExists(ctx, handle)
	if err != nil {
		return HandleAvailability{}, err
	}
	if exists {
		return HandleAvailability{Handle: handle, Available: false, Reason: "taken"}, nil
	}
	return HandleAvailability{Handle: handle, Available: true}, nil
}

// ListPublicPlans returns the active plan catalogue for the unauthenticated
// signup plan picker.
func (s Service) ListPublicPlans(ctx context.Context) ([]ports.PublicPlanRecord, error) {
	return s.businesses.ListActivePlans(ctx)
}

type InitializeSubscriptionAuthorizationCommand struct {
	Scope       common.TenantScope
	CallbackURL string
	// PlanCode is the TARGET plan the owner is activating/upgrading to. When set and
	// it differs from the current plan (e.g. a free store upgrading to a paid plan),
	// the subscription is switched to it before billing so the fee gate and first
	// charge use the target plan — mirroring how a fresh paid signup is seeded on
	// its plan before payment. Empty keeps the current plan (a re-activation).
	PlanCode string
	// BillingCadence is the owner's chosen cadence: 'quarterly' or 'yearly'.
	// Monthly billing is not offered under the Pricing Book, so an empty or
	// 'monthly' value is rejected for a paid plan.
	BillingCadence string
	// Code is an optional subscription discount code. When present it is validated
	// at checkout and, if valid, captured as a pending redemption that the later
	// verify step applies to the first charge (a code REPLACES the intro figure).
	Code string
}

type SubscriptionAuthorizationLink struct {
	BusinessID   common.ID
	BusinessName string
	OwnerEmail   string
	RedirectURL  string
	AccessCode   string
	Reference    string
	// Activated is true when the plan was activated immediately with no Paystack
	// checkout — a free_period or full (>=100%) discount collects nothing, and a
	// period already paid needs nothing. The dashboard shows success (no redirect).
	Activated bool
}

type VerifySubscriptionAuthorizationCommand struct {
	Scope     common.TenantScope
	Reference string
}

type SubscriptionAuthorizationResult struct {
	SubscriptionID          common.ID
	BusinessID              common.ID
	Status                  string
	BillingMode             string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
}

// InitializeSubscriptionAuthorization starts a Paystack recurring-billing
// authorization for the signed-in tenant's paid plan and returns the redirect
// link. Free plans (no monthly fee) need no authorization.
func (s Service) InitializeSubscriptionAuthorization(ctx context.Context, cmd InitializeSubscriptionAuthorizationCommand) (SubscriptionAuthorizationLink, error) {
	if cmd.Scope.BusinessID.IsZero() {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	if s.payments == nil {
		return SubscriptionAuthorizationLink{}, authdomain.ErrForbidden
	}
	// A paid plan must be billed quarterly or yearly — reject monthly/empty.
	cadence, err := normalizeBillingCadence(cmd.BillingCadence)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	subscription, err := s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	if subscription.Status == "canceled" {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Target plan: when the owner is activating/upgrading to a specific plan (e.g. a
	// FREE store choosing a paid plan), switch the subscription onto that plan first
	// so the fee gate and the callback's first charge use the target plan's figures.
	// Without this, a free-plan store (fee 0) can never start billing — it fails the
	// fee gate below, and change-plan refuses it as "billing inactive" — a deadlock.
	// The switch mirrors a fresh paid signup (plan seeded before payment; the
	// non-payment sweep reverts an abandoned activation).
	if targetCode := strings.ToLower(strings.TrimSpace(cmd.PlanCode)); targetCode != "" &&
		!strings.EqualFold(targetCode, strings.TrimSpace(subscription.PlanCode)) {
		target, err := s.businesses.GetPlanByCode(ctx, targetCode)
		if err != nil {
			return SubscriptionAuthorizationLink{}, err
		}
		if target.MonthlyFeeMinor <= 0 {
			// The target must be a paid plan; you don't "set up billing" for free.
			return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
		}
		// Only switch on a strict UPGRADE here (target fee > current). A downgrade
		// must go through ChangeSubscriptionPlan (parked to renewal), never an
		// immediate mid-cycle switch via activation.
		if target.MonthlyFeeMinor <= subscription.MonthlyFeeMinor {
			return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
		}
		if err := s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
			BusinessID: subscription.BusinessID,
			NewPlanID:  target.PlanID,
			// AmountMinor 0: no proration invoice here — the FIRST period is charged
			// on the Paystack callback (VerifySubscriptionAuthorization).
		}); err != nil {
			return SubscriptionAuthorizationLink{}, err
		}
		// Re-read so the fee gate + downstream figures reflect the target plan.
		subscription, err = s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
		if err != nil {
			return SubscriptionAuthorizationLink{}, err
		}
	}
	if subscription.MonthlyFeeMinor <= 0 {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Validate and capture an optional discount code BEFORE persisting the cadence
	// or minting the Paystack link, so an invalid/ineligible code fails the checkout
	// outright (never silently ignored) and never leaves a half-started billing
	// setup. A valid code is recorded as a PENDING redemption keyed to this
	// subscription and returns the outcome that prices the first-period checkout.
	outcome, err := s.captureSubscriptionDiscount(ctx, cmd.Scope, subscription, cadence, cmd.Code)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	// Persist the chosen cadence now, before the redirect: the callback that drives
	// verify/booking carries only the payment reference, so the cadence must already
	// be on the subscription to bill the right figure and set the right next billing
	// date — and to compute the deterministic per-period activation reference.
	if err := s.businesses.SetSubscriptionBillingCadence(ctx, subscription.BusinessID, cadence); err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	ownerEmail, err := normalizeEmail(subscription.OwnerEmail)
	if err != nil {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Deterministic per-period reference. It anchors the paid-invoice booking so
	// repeated callbacks (double submit, retries) never double-book, and its
	// ShouldCharge flag short-circuits a redundant checkout once the period is paid.
	activation, err := s.businesses.PrepareSubscriptionActivationCharge(ctx, subscription.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	if !activation.ShouldCharge {
		// This period is already paid (e.g. a prior checkout completed); nothing to
		// collect — report it as activated so the dashboard shows success.
		return SubscriptionAuthorizationLink{
			BusinessID:   subscription.BusinessID,
			BusinessName: subscription.BusinessName,
			OwnerEmail:   ownerEmail,
			Activated:    true,
		}, nil
	}
	// A captured discount REPLACES the intro figure. A free_period or full (>=100%)
	// discount collects nothing, so activate immediately with no Paystack checkout;
	// otherwise the checkout is priced at the discounted figure.
	chargeMinor := activationChargeMinor(subscription, cadence)
	if outcome != nil {
		if outcome.FreePeriod || outcome.ChargeMinor <= 0 {
			if err := s.activateDiscountedWithoutCharge(ctx, cmd.Scope, subscription, cadence, activation.Ref, *outcome); err != nil {
				return SubscriptionAuthorizationLink{}, err
			}
			return SubscriptionAuthorizationLink{
				BusinessID:   subscription.BusinessID,
				BusinessName: subscription.BusinessName,
				OwnerEmail:   ownerEmail,
				Activated:    true,
			}, nil
		}
		chargeMinor = outcome.ChargeMinor
	}
	if chargeMinor <= 0 {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Open a STANDARD Paystack checkout for the first period. The customer pays now
	// by MoMo or card; a card also yields a reusable authorization that the recurring
	// sweep charges each renewal (MoMo yields none — the sweep re-prompts). The
	// reference is unique per attempt (Paystack rejects a reused reference) but the
	// callback re-derives the deterministic per-period reference to book idempotently.
	gross := s.grossSubscriptionCharge(chargeMinor)
	checkoutRef := fmt.Sprintf("%s_%d", activation.Ref, s.clock.Now().Unix())
	result, err := s.payments.InitializeAuthorization(ctx, ports.InitializeAuthorizationInput{
		BusinessID:    subscription.BusinessID,
		CustomerEmail: ownerEmail,
		CallbackURL:   strings.TrimSpace(cmd.CallbackURL),
		AmountMinor:   gross,
		Currency:      "GHS",
		Reference:     checkoutRef,
	})
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	if strings.TrimSpace(result.RedirectURL) == "" || strings.TrimSpace(result.Reference) == "" {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	return SubscriptionAuthorizationLink{
		BusinessID:   subscription.BusinessID,
		BusinessName: subscription.BusinessName,
		OwnerEmail:   ownerEmail,
		RedirectURL:  result.RedirectURL,
		AccessCode:   result.AccessCode,
		Reference:    result.Reference,
	}, nil
}

// VerifySubscriptionAuthorization confirms the Paystack authorization the tenant
// completed and flips their subscription to recurring billing; the existing
// recurring-charge sweep then bills them each period.
func (s Service) VerifySubscriptionAuthorization(ctx context.Context, cmd VerifySubscriptionAuthorizationCommand) (SubscriptionAuthorizationResult, error) {
	if cmd.Scope.BusinessID.IsZero() {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	if s.payments == nil {
		return SubscriptionAuthorizationResult{}, authdomain.ErrForbidden
	}
	reference := strings.TrimSpace(cmd.Reference)
	if reference == "" || len([]rune(reference)) > 160 || strings.ContainsAny(reference, " \t\r\n") {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	subscription, err := s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	if subscription.MonthlyFeeMinor <= 0 || subscription.Status == "canceled" {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	// The cadence was persisted when the authorization link was created; a paid
	// plan cannot be activated without a billable (quarterly/yearly) cadence.
	cadence, err := normalizeBillingCadence(subscription.BillingCadence)
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	// Sanity-check the plan is configured for this cadence. The first period was
	// already priced and PAID at the standard checkout; here we only confirm and
	// book it, so the amount booked is what Paystack actually collected — never
	// re-charged (which would double-bill).
	if activationChargeMinor(subscription, cadence) <= 0 {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	result, err := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: reference})
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	customerRef := strings.TrimSpace(result.CustomerCode)
	authRef := strings.TrimSpace(result.AuthorizationCode)
	if !result.Succeeded {
		// The checkout was abandoned or the payment failed; leave the subscription
		// unactivated so the tenant can retry. Report it as not-yet-paid.
		status := subscription.Status
		if status == "active" {
			status = "past_due"
		}
		return SubscriptionAuthorizationResult{
			SubscriptionID: subscription.SubscriptionID,
			BusinessID:     subscription.BusinessID,
			Status:         status,
			BillingMode:    "recurring",
		}, nil
	}
	// Flip the subscription to recurring billing so the renewal sweep picks it up —
	// ALWAYS, even for mobile money (which yields no reusable authorization). Storing
	// the channel lets the sweep silently auto-charge a card at renewal but fall back
	// to a re-pay reminder for mobile money; without this a paid MoMo signup would be
	// left billing_mode='manual' and silently skipped by the sweep forever.
	channel := normalizeAuthorizationChannel(result.Channel)
	if authRef == "" && channel == "" {
		// No reusable authorization and an unknown channel would look card-like to the
		// sweep and get charged with an empty auth (a guaranteed failure). This is the
		// mobile-money shape, so mark it as such to route it to reminders instead.
		channel = "mobile_money"
	}
	if err := s.businesses.ActivateRecurringBilling(ctx, ports.ActivateRecurringBillingInput{
		BusinessID:              subscription.BusinessID,
		ProviderCustomerRef:     customerRef,
		ProviderSubscriptionRef: authRef,
		ProviderChannel:         channel,
	}); err != nil {
		return SubscriptionAuthorizationResult{}, err
	}

	// Book the paid first period. IDEMPOTENT: PrepareSubscriptionActivationCharge
	// returns a deterministic per-period ref and whether the period is still unpaid,
	// so a repeated callback (double submit, client retry, callback re-hit) re-uses
	// the same ref and the paid-invoice insert no-ops. The amount booked is what
	// Paystack collected at checkout.
	activation, err := s.businesses.PrepareSubscriptionActivationCharge(ctx, subscription.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	if activation.ShouldCharge {
		if err := s.bookFirstPeriodPaid(ctx, cmd.Scope, subscription, cadence, activation.Ref, result.AmountMinor); err != nil {
			return SubscriptionAuthorizationResult{}, err
		}
	}

	return SubscriptionAuthorizationResult{
		SubscriptionID:          subscription.SubscriptionID,
		BusinessID:              subscription.BusinessID,
		Status:                  "active",
		BillingMode:             "recurring",
		ProviderCustomerRef:     customerRef,
		ProviderSubscriptionRef: authRef,
	}, nil
}

// normalizeBillingCadence validates a paid-plan billing cadence. Under the
// Pricing Book only quarterly and yearly are billable; monthly or an empty value
// is rejected as invalid input.
func normalizeBillingCadence(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "quarterly":
		return "quarterly", nil
	case "yearly":
		return "yearly", nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

// activationChargeMinor returns the exact stored figure to charge for the given
// cadence: the one-time INTRO figure while the account has not consumed its first
// purchase, otherwise the FULL renewal figure. Amounts are the verbatim Pricing
// Book figures carried on the subscription record — never computed live.
func activationChargeMinor(sub ports.BusinessSubscriptionRecord, cadence string) int64 {
	switch cadence {
	case "quarterly":
		if sub.FirstPurchaseConsumed {
			return int64(sub.QuarterlyRenewalMinor)
		}
		return int64(sub.QuarterlyFirstMinor)
	case "yearly":
		if sub.FirstPurchaseConsumed {
			return int64(sub.YearlyRenewalMinor)
		}
		return int64(sub.YearlyFirstMinor)
	default:
		return 0
	}
}

// captureSubscriptionDiscount validates an optional discount code at checkout and,
// when valid, records a PENDING redemption keyed to the subscription and returns
// the computed outcome so the caller can price the first-period checkout (a code
// REPLACES the intro figure; a free_period/full discount needs no checkout at all).
// The verify step reads the pending redemption back and marks it applied once the
// first period is paid. A blank code is a no-op (nil outcome); any non-blank but
// invalid/ineligible code is rejected (never silently ignored).
func (s Service) captureSubscriptionDiscount(ctx context.Context, scope common.TenantScope, sub ports.BusinessSubscriptionRecord, cadence string, rawCode string) (*discountOutcome, error) {
	code := normalizeDiscountCode(rawCode)
	if code == "" {
		return nil, nil
	}
	if s.discounts == nil {
		return nil, ErrDiscountCodeInvalid
	}
	record, err := s.discounts.FindActiveDiscountCodeByCode(ctx, code)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil, ErrDiscountCodeInvalid
		}
		return nil, err
	}
	now := s.clock.Now()
	if record.ValidFrom != nil && now.Before(*record.ValidFrom) {
		return nil, ErrDiscountCodeExpired
	}
	// valid_until is exclusive: at or after it the code is expired.
	if record.ValidUntil != nil && !now.Before(*record.ValidUntil) {
		return nil, ErrDiscountCodeExpired
	}
	// Empty eligible_plans/eligible_cadences mean "all".
	if len(record.EligiblePlans) > 0 && !containsFold(record.EligiblePlans, sub.PlanCode) {
		return nil, ErrDiscountCodeIneligible
	}
	if len(record.EligibleCadences) > 0 && !containsFold(record.EligibleCadences, cadence) {
		return nil, ErrDiscountCodeIneligible
	}
	if record.FirstPurchaseOnly && sub.FirstPurchaseConsumed {
		return nil, ErrDiscountCodeIneligible
	}
	// A code is computed against the plan's FULL renewal figure; refuse when unset.
	renewal := renewalFigureMinor(sub, cadence)
	if renewal <= 0 {
		return nil, ErrDiscountCodeIneligible
	}
	outcome := computeDiscountOutcome(record.DiscountType, record.DiscountValue, renewal)
	// Enforce the per-account + total caps and insert the pending redemption
	// ATOMICALLY under an advisory lock on the code. This closes the check-then-act
	// race where two concurrent checkouts of a last-slot code both pass a separate
	// applied-only count and over-redeem; the repo counts applied + recent-pending
	// under the lock, so the second caller is refused before it can pay.
	if _, err := s.discounts.CreateRedemptionWithinCaps(ctx, scope, ports.CreateDiscountRedemptionInput{
		DiscountCodeID: record.DiscountCodeID,
		BusinessID:     sub.BusinessID,
		SubscriptionID: sub.SubscriptionID,
		AccountKey:     sub.BusinessID.String(),
		PlanCode:       sub.PlanCode,
		Cadence:        cadence,
		DiscountMinor:  outcome.DiscountMinor,
		Status:         "pending",
	}, record.MaxPerAccount, record.MaxRedemptionsTotal); err != nil {
		if errors.Is(err, ports.ErrDiscountRedemptionCapReached) {
			return nil, ErrDiscountCodeExhausted
		}
		return nil, err
	}
	return &outcome, nil
}

// activateDiscountedWithoutCharge activates a subscription whose captured discount
// collects NOTHING at checkout — a free_period starts a free window, a full
// (>=100%) discount books a zero paid invoice on the normal cadence — then flips
// the pending redemption to 'applied'. Used at initialize so these codes never open
// a zero-amount Paystack checkout (which Paystack would reject).
func (s Service) activateDiscountedWithoutCharge(ctx context.Context, scope common.TenantScope, sub ports.BusinessSubscriptionRecord, cadence string, ref string, outcome discountOutcome) error {
	pending, err := s.discounts.FindPendingRedemption(ctx, scope, sub.SubscriptionID)
	if err != nil {
		return err
	}
	// A free_period covers the code's month count; a full (100% / fixed >= renewal)
	// discount covers exactly this cadence's period. Both collect NOTHING, so both
	// start a free window via ActivateFreePeriodBilling — never a zero paid invoice,
	// which the business_subscription_invoices amount_minor > 0 check would reject.
	freeMonths := outcome.FreeMonths
	if !outcome.FreePeriod {
		freeMonths = cadenceMonths(cadence)
	}
	if err := s.discounts.ActivateFreePeriodBilling(ctx, scope, ports.ActivateFreePeriodInput{
		BusinessID: sub.BusinessID,
		ChargeRef:  ref,
		Currency:   "GHS",
		FreeMonths: freeMonths,
	}); err != nil {
		return err
	}
	return s.discounts.MarkRedemptionApplied(ctx, scope, ports.MarkDiscountRedemptionAppliedInput{
		RedemptionID:  pending.RedemptionID,
		DiscountMinor: outcome.DiscountMinor,
	})
}

// cadenceMonths is the number of months a billing cadence covers.
func cadenceMonths(cadence string) int {
	switch cadence {
	case "quarterly":
		return 3
	case "yearly":
		return 12
	default:
		return 1
	}
}

// bookFirstPeriodPaid records the first period as PAID after a standard checkout
// (the customer already paid at checkout.paystack.com — never re-charged here) and
// flips any captured discount to 'applied'. paidMinor is the amount Paystack
// actually collected. Idempotent: the paid-invoice insert no-ops on a repeat ref.
func (s Service) bookFirstPeriodPaid(ctx context.Context, scope common.TenantScope, sub ports.BusinessSubscriptionRecord, cadence string, ref string, paidMinor int64) error {
	if err := s.businesses.RecordSubscriptionActivationPayment(ctx, ports.RecordSubscriptionActivationPaymentInput{
		BusinessID:     sub.BusinessID,
		AmountMinor:    paidMinor,
		Currency:       "GHS",
		ChargeRef:      ref,
		BillingCadence: cadence,
	}); err != nil {
		return err
	}
	if s.discounts == nil {
		return nil
	}
	// A partial discount that went through checkout leaves a pending redemption;
	// mark it applied now that the first period is paid. Free/full discounts were
	// already applied at initialize (no checkout), so none is pending here.
	pending, err := s.discounts.FindPendingRedemption(ctx, scope, sub.SubscriptionID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil
		}
		return err
	}
	outcome := computeDiscountOutcome(pending.DiscountType, pending.DiscountValue, renewalFigureMinor(sub, cadence))
	return s.discounts.MarkRedemptionApplied(ctx, scope, ports.MarkDiscountRedemptionAppliedInput{
		RedemptionID:  pending.RedemptionID,
		DiscountMinor: outcome.DiscountMinor,
	})
}

// normalizeDiscountCode upper-cases and trims a discount code to match the stored
// canonical form (the DB constraint requires codes be upper-case).
func normalizeDiscountCode(raw string) string {
	return strings.ToUpper(strings.TrimSpace(raw))
}

// normalizeAuthorizationChannel lower-cases and trims a Paystack authorization
// channel ('card', 'mobile_money', …) for stable comparison, matching how the
// recurring sweep reads it back to decide silent auto-charge vs re-pay reminder.
func normalizeAuthorizationChannel(channel string) string {
	return strings.ToLower(strings.TrimSpace(channel))
}

// containsFold reports whether target matches any value case-insensitively.
func containsFold(values []string, target string) bool {
	trimmedTarget := strings.TrimSpace(target)
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), trimmedTarget) {
			return true
		}
	}
	return false
}

// discountOutcome is the applied result of a discount code at activation.
type discountOutcome struct {
	// ChargeMinor is the amount to charge the card now (0 for free_period / a full
	// discount).
	ChargeMinor int64
	// DiscountMinor is the money given away (renewal - charge), for attribution.
	DiscountMinor int64
	FreePeriod    bool
	FreeMonths    int
}

// computeDiscountOutcome applies a discount code against the plan's FULL renewal
// figure for the cadence (a code REPLACES the intro figure). Amounts are pesewas.
func computeDiscountOutcome(discountType string, value int, renewalMinor int64) discountOutcome {
	switch discountType {
	case "percentage":
		reduction := renewalMinor * int64(value) / 100 // floor
		if reduction > renewalMinor {
			reduction = renewalMinor
		}
		charge := renewalMinor - reduction
		return discountOutcome{ChargeMinor: charge, DiscountMinor: renewalMinor - charge}
	case "fixed":
		charge := renewalMinor - int64(value)
		if charge < 0 {
			charge = 0
		}
		return discountOutcome{ChargeMinor: charge, DiscountMinor: renewalMinor - charge}
	case "free_period":
		return discountOutcome{ChargeMinor: 0, DiscountMinor: renewalMinor, FreePeriod: true, FreeMonths: value}
	default:
		// Unknown type (guarded by the DB CHECK): apply no discount.
		return discountOutcome{ChargeMinor: renewalMinor, DiscountMinor: 0}
	}
}

// renewalFigureMinor returns the plan's FULL renewal figure for the cadence
// (minor units) — the base a discount is computed against. Zero when unset.
func renewalFigureMinor(sub ports.BusinessSubscriptionRecord, cadence string) int64 {
	switch cadence {
	case "quarterly":
		return int64(sub.QuarterlyRenewalMinor)
	case "yearly":
		return int64(sub.YearlyRenewalMinor)
	default:
		return 0
	}
}

// ChangeSubscriptionPlanCommand is an owner/admin request to move to another plan.
type ChangeSubscriptionPlanCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	PlanCode  string
}

// ChangeSubscriptionPlanResult reports the outcome of a plan change: an UPGRADE is
// applied immediately (Immediate = true) and may carry a prorated charge; a
// DOWNGRADE is scheduled for the next renewal (Immediate = false, EffectiveAt is
// the period end) with no charge or refund now.
type ChangeSubscriptionPlanResult struct {
	PlanCode string
	// Immediate is true for an applied upgrade, false for a scheduled downgrade.
	Immediate bool
	// ProratedChargeMinor is the amount charged now for the remainder of the current
	// period (upgrade). Zero for a downgrade or when the prorated difference rounds
	// to zero.
	ProratedChargeMinor int64
	// EffectiveAt is when the new plan takes effect: now for an upgrade, the current
	// period end for a scheduled downgrade.
	EffectiveAt time.Time
}

// ChangeSubscriptionPlan moves a business between plans self-serve (Pricing Book
// §7). It classifies by monthly_fee_minor: a strictly higher fee is an UPGRADE
// (switch + prorated charge now, entitlements immediate); a strictly lower fee is a
// DOWNGRADE (parked to apply at the next renewal, no mid-cycle refund or entitlement
// change); an equal fee is refused. Owner/admin only.
func (s Service) ChangeSubscriptionPlan(ctx context.Context, cmd ChangeSubscriptionPlanCommand) (ChangeSubscriptionPlanResult, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	if s.payments == nil {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrForbidden
	}
	planCode := strings.ToLower(strings.TrimSpace(cmd.PlanCode))
	if planCode == "" {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrInvalidInput
	}

	subscription, err := s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
	if err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	// A canceled subscription must re-activate through the normal flow, not swap plans.
	if subscription.Status == "canceled" {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrInvalidInput
	}

	target, err := s.businesses.GetPlanByCode(ctx, planCode)
	if err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	if strings.EqualFold(strings.TrimSpace(target.Code), strings.TrimSpace(subscription.PlanCode)) {
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeSamePlan
	}

	switch {
	case target.MonthlyFeeMinor > subscription.MonthlyFeeMinor:
		return s.upgradeSubscriptionPlan(ctx, subscription, target)
	case target.MonthlyFeeMinor < subscription.MonthlyFeeMinor:
		return s.downgradeSubscriptionPlan(ctx, subscription, target)
	default:
		// Same monthly fee → neither an upgrade nor a downgrade.
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeSamePlan
	}
}

// upgradeSubscriptionPlan switches to the higher plan immediately and charges the
// prorated difference for the remainder of the current period. The plan is switched
// only after a successful charge (or when nothing is owed).
func (s Service) upgradeSubscriptionPlan(ctx context.Context, sub ports.BusinessSubscriptionRecord, target ports.PlanPricingRecord) (ChangeSubscriptionPlanResult, error) {
	now := s.clock.Now()
	// Proration is computed against the cadence renewal figures, matching how the
	// recurring sweep bills each renewal. A non-billable cadence has no figure.
	cadence, err := normalizeBillingCadence(sub.BillingCadence)
	if err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	currentRenewal := renewalFigureMinor(sub, cadence)
	newRenewal := targetRenewalFigureMinor(target, cadence)
	if newRenewal <= 0 {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrInvalidInput
	}

	proration := prorationChargeMinor(currentRenewal, newRenewal, sub.CurrentPeriodStart, sub.CurrentPeriodEnd, now)

	// Nothing owed (difference rounds to zero, or the period is over): switch now
	// without a charge.
	if proration <= 0 {
		if err := s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
			BusinessID: sub.BusinessID,
			NewPlanID:  target.PlanID,
		}); err != nil {
			return ChangeSubscriptionPlanResult{}, err
		}
		return ChangeSubscriptionPlanResult{PlanCode: target.Code, Immediate: true, ProratedChargeMinor: 0, EffectiveAt: now}, nil
	}

	// A charge is due — the tenant must have an active recurring authorization to
	// charge against (the same stored authorization the renewal sweep uses).
	if sub.BillingMode != "recurring" || strings.TrimSpace(sub.ProviderSubscriptionRef) == "" {
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeBillingInactive
	}

	// VAT applies to the prorated top-up too. Gross the net proration once so the
	// charge, the booked invoice, and the reported amount agree.
	grossProration := s.grossSubscriptionCharge(proration)

	// Deterministic ref keyed on the subscription + target plan + period start, so a
	// double submit / retry reuses it: Paystack dedupes the charge and the invoice
	// insert no-ops — mirroring the activation charge's idempotency.
	ref := "xtsub_upgrade_" + sub.SubscriptionID.String() + "_" + target.Code + "_" + strconv.FormatInt(sub.CurrentPeriodStart.Unix(), 10)

	charge, chargeErr := s.payments.ChargeAuthorization(ctx, ports.ChargeAuthorizationInput{
		BusinessID:        sub.BusinessID,
		AuthorizationCode: strings.TrimSpace(sub.ProviderSubscriptionRef),
		CustomerEmail:     strings.TrimSpace(sub.OwnerEmail),
		AmountMinor:       grossProration,
		Currency:          "GHS",
		Reference:         ref,
	})
	if chargeErr != nil || !strings.EqualFold(strings.TrimSpace(charge.Status), "success") {
		// Do not switch the plan on a non-success charge: entitlements never go
		// unpaid. The deterministic ref lets the owner safely retry.
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeChargeFailed
	}

	if err := s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
		BusinessID:  sub.BusinessID,
		NewPlanID:   target.PlanID,
		AmountMinor: grossProration,
		Currency:    "GHS",
		ChargeRef:   ref,
	}); err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}

	return ChangeSubscriptionPlanResult{PlanCode: target.Code, Immediate: true, ProratedChargeMinor: grossProration, EffectiveAt: now}, nil
}

// downgradeSubscriptionPlan parks the change to apply at the next renewal. It never
// refunds or changes entitlements mid-cycle.
func (s Service) downgradeSubscriptionPlan(ctx context.Context, sub ports.BusinessSubscriptionRecord, target ports.PlanPricingRecord) (ChangeSubscriptionPlanResult, error) {
	if err := s.businesses.SchedulePlanDowngrade(ctx, ports.SchedulePlanDowngradeInput{
		BusinessID:  sub.BusinessID,
		NewPlanID:   target.PlanID,
		EffectiveAt: sub.CurrentPeriodEnd,
	}); err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	return ChangeSubscriptionPlanResult{PlanCode: target.Code, Immediate: false, ProratedChargeMinor: 0, EffectiveAt: sub.CurrentPeriodEnd}, nil
}

// targetRenewalFigureMinor returns the target plan's FULL renewal figure for the
// cadence (minor units). Zero when unset for that cadence.
func targetRenewalFigureMinor(target ports.PlanPricingRecord, cadence string) int64 {
	switch cadence {
	case "quarterly":
		return int64(target.QuarterlyRenewalMinor)
	case "yearly":
		return int64(target.YearlyRenewalMinor)
	default:
		return 0
	}
}

// prorationChargeMinor computes the prorated upgrade difference to charge now:
//
//	ceil( (newRenewal - currentRenewal) * daysRemainingInPeriod / totalDaysInPeriod )
//
// All in GHS minor units (pesewas). It guards against a non-positive difference, a
// zero/negative period, and a period already elapsed — any of which yields 0 (no
// charge). daysRemaining is clamped to [0, totalDays] so an odd clock never charges
// more than a full period's difference.
func prorationChargeMinor(currentRenewal, newRenewal int64, periodStart, periodEnd, now time.Time) int64 {
	diff := newRenewal - currentRenewal
	if diff <= 0 {
		return 0
	}
	const day = 24 * time.Hour
	totalDays := int64(periodEnd.Sub(periodStart) / day)
	if totalDays <= 0 {
		return 0
	}
	remainingDays := int64(periodEnd.Sub(now) / day)
	if remainingDays <= 0 {
		return 0
	}
	if remainingDays > totalDays {
		remainingDays = totalDays
	}
	// ceil(diff * remainingDays / totalDays) with integer math.
	numerator := diff * remainingDays
	return (numerator + totalDays - 1) / totalDays
}

// SubmitIdentityVerificationCommand is a business's Ghana Card submission.
type SubmitIdentityVerificationCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	CardNumber string
	IDPhotoURL string
}

// SubmitIdentityVerification stores the tenant's Ghana Card number + ID photo and
// moves them into verification 'pending' for operator review. The photo is
// uploaded to media storage by the caller; this records the resulting URL.
func (s Service) SubmitIdentityVerification(ctx context.Context, cmd SubmitIdentityVerificationCommand) error {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	// Normalize to the canonical Ghana Card PIN (GHA-#########-#) and validate the
	// format, so operators review a well-formed number rather than free text.
	card := strings.ToUpper(strings.TrimSpace(cmd.CardNumber))
	photo := strings.TrimSpace(cmd.IDPhotoURL)
	if !ghanaCardPattern.MatchString(card) || photo == "" || len(photo) > 2048 {
		return authdomain.ErrInvalidInput
	}
	if !strings.HasPrefix(photo, "http://") && !strings.HasPrefix(photo, "https://") {
		return authdomain.ErrInvalidInput
	}
	return s.businesses.SubmitIdentityDocument(ctx, ports.SubmitIdentityDocumentInput{
		BusinessID: cmd.Scope.BusinessID,
		CardNumber: card,
		IDPhotoURL: photo,
	})
}

// ghanaCardPattern matches the Ghana Card personal id number: GHA-#########-#.
var ghanaCardPattern = regexp.MustCompile(`^GHA-[0-9]{9}-[0-9]$`)

func (s Service) LoginBusiness(ctx context.Context, cmd LoginBusinessCommand) (AuthResult, error) {
	handle := normalizeHandle(cmd.BusinessHandle)
	email, err := normalizeEmail(cmd.OwnerEmail)
	if err != nil || handle == "" {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	credentials, err := s.businesses.FindBusinessUserByHandleAndEmail(ctx, handle, email)
	if err != nil || !credentials.IsActive {
		// Equalise timing against account enumeration: do equivalent password
		// work even when no active user matches, then fail identically.
		_, _ = s.passwords.Hash(cmd.OwnerPassword)
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if err := s.passwords.Compare(credentials.PasswordHash, cmd.OwnerPassword); err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	// If the account has a second factor enabled, do not issue a session yet:
	// return a short-lived challenge the caller redeems via VerifyMFALogin.
	if s.mfaEnabled() {
		scope := common.TenantScope{BusinessID: credentials.BusinessID}
		enrollment, err := s.mfa.Get(ctx, scope, credentials.UserID)
		if err == nil && enrollment.Enabled {
			now := s.clock.Now()
			challenge, err := s.mfaChallenges.IssueMFAChallengeToken(ctx, ports.MFAChallengeInput{
				Subject:    credentials.UserID,
				BusinessID: credentials.BusinessID,
				Role:       credentials.Role,
				IssuedAt:   now,
				ExpiresAt:  now.Add(mfaChallengeTTL),
			})
			if err != nil {
				return AuthResult{}, err
			}
			return AuthResult{
				BusinessID:        credentials.BusinessID,
				BusinessUserID:    credentials.UserID,
				MFARequired:       true,
				MFAChallengeToken: challenge,
			}, nil
		}
		if err != nil && !errors.Is(err, ports.ErrNotFound) {
			return AuthResult{}, err
		}
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     credentials.BusinessID,
		BusinessUserID: credentials.UserID,
		Role:           credentials.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

type RefreshSessionCommand struct {
	RefreshToken string
	UserAgent    string
	IPAddress    string
}

// RefreshSession validates a refresh token and rotates it: the presented
// session is revoked and a fresh access/refresh pair is issued. Rotation means
// a stolen-then-used refresh token is single-use and the theft is contained.
func (s Service) RefreshSession(ctx context.Context, cmd RefreshSessionCommand) (AuthResult, error) {
	token := strings.TrimSpace(cmd.RefreshToken)
	if token == "" {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	session, err := s.sessions.FindByRefreshTokenHash(ctx, s.refreshTokens.HashRefreshToken(token))
	if err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if session.Revoked || !session.UserIsActive || !s.clock.Now().Before(session.ExpiresAt) {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	if err := s.sessions.Revoke(ctx, session.BusinessID, session.SessionID); err != nil {
		return AuthResult{}, err
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     session.BusinessID,
		BusinessUserID: session.BusinessUserID,
		Role:           session.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

type LogoutCommand struct {
	RefreshToken string
}

// Logout revokes the session behind a refresh token. It is idempotent and never
// reveals whether the token existed.
func (s Service) Logout(ctx context.Context, cmd LogoutCommand) error {
	token := strings.TrimSpace(cmd.RefreshToken)
	if token == "" {
		return nil
	}

	session, err := s.sessions.FindByRefreshTokenHash(ctx, s.refreshTokens.HashRefreshToken(token))
	if err != nil {
		return nil
	}

	return s.sessions.Revoke(ctx, session.BusinessID, session.SessionID)
}

type ListBusinessUsersCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
}

func (s Service) ListBusinessUsers(ctx context.Context, cmd ListBusinessUsersCommand) ([]ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return nil, err
	}

	return s.businesses.ListBusinessUsers(ctx, cmd.Scope)
}

type CreateBusinessUserCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	DisplayName string
	Phone       string
	Email       string
	Password    string
	Role        business.UserRole
}

func (s Service) CreateBusinessUser(ctx context.Context, cmd CreateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	normalized, err := normalizeBusinessUserCreation(cmd)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}

	passwordHash, err := s.passwords.Hash(normalized.Password)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}

	user, err := s.businesses.CreateBusinessUser(ctx, cmd.Scope, ports.CreateBusinessUserInput{
		UserID:       s.ids.NewID(),
		BusinessID:   cmd.Scope.BusinessID,
		Email:        normalized.Email,
		DisplayName:  normalized.DisplayName,
		Phone:        strings.TrimSpace(cmd.Phone),
		PasswordHash: passwordHash,
		Role:         normalized.Role,
	})
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}
	// Best-effort invite email: never fail user creation on a delivery hiccup, but
	// log it so a missing invite is visible rather than silently dropped.
	if inviteErr := s.sendBusinessUserInvite(ctx, user); inviteErr != nil {
		s.logger.Warn("business user invite email failed",
			slog.String("business_id", cmd.Scope.BusinessID.String()),
			slog.String("error", inviteErr.Error()))
	}
	return user, nil
}

type UpdateBusinessUserCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	UserID      common.ID
	DisplayName string
	Phone       string
	Role        business.UserRole
	IsActive    bool
}

func (s Service) UpdateBusinessUser(ctx context.Context, cmd UpdateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessUserRecord{}, err
	}
	if cmd.UserID.IsZero() {
		return ports.BusinessUserRecord{}, authdomain.ErrInvalidInput
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" || !isManageableBusinessUserRole(cmd.Role) {
		return ports.BusinessUserRecord{}, authdomain.ErrInvalidInput
	}

	return s.businesses.UpdateBusinessUser(ctx, cmd.Scope, ports.UpdateBusinessUserInput{
		UserID:      cmd.UserID,
		DisplayName: displayName,
		Phone:       strings.TrimSpace(cmd.Phone),
		Role:        cmd.Role,
		IsActive:    cmd.IsActive,
	})
}

type ResetBusinessUserPasswordCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	UserID      common.ID
	NewPassword string
}

func (s Service) ResetBusinessUserPassword(ctx context.Context, cmd ResetBusinessUserPasswordCommand) error {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.UserID.IsZero() || len(cmd.NewPassword) < minPasswordLength || len(cmd.NewPassword) > maxPasswordLength {
		return authdomain.ErrInvalidInput
	}

	passwordHash, err := s.passwords.Hash(cmd.NewPassword)
	if err != nil {
		return err
	}

	return s.businesses.UpdateBusinessUserPassword(ctx, cmd.Scope, ports.UpdateBusinessUserPasswordInput{
		UserID:       cmd.UserID,
		PasswordHash: passwordHash,
	})
}

// ChangeOwnPasswordCommand carries a self-service password change for the
// authenticated user: they prove knowledge of CurrentPassword and set NewPassword.
type ChangeOwnPasswordCommand struct {
	Scope           common.TenantScope
	UserID          common.ID
	CurrentPassword string
	NewPassword     string
}

// ChangeOwnPassword lets a signed-in business user (owner or staff) rotate their
// own password by confirming the current one first. Unlike the admin reset path,
// it works for the owner too, since it is scoped to the caller's own user id.
func (s Service) ChangeOwnPassword(ctx context.Context, cmd ChangeOwnPasswordCommand) error {
	if cmd.UserID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	if len(cmd.NewPassword) < minPasswordLength || len(cmd.NewPassword) > maxPasswordLength {
		return authdomain.ErrInvalidInput
	}

	credentials, err := s.businesses.FindBusinessUserCredentialsByID(ctx, cmd.Scope, cmd.UserID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return authdomain.ErrInvalidCredentials
		}
		return err
	}
	if !credentials.IsActive {
		return authdomain.ErrInvalidCredentials
	}
	// Confirm the current password before allowing a change. A mismatch is an
	// invalid-credentials failure, distinct from a missing/expired session.
	if err := s.passwords.Compare(credentials.PasswordHash, cmd.CurrentPassword); err != nil {
		return authdomain.ErrInvalidCredentials
	}

	passwordHash, err := s.passwords.Hash(cmd.NewPassword)
	if err != nil {
		return err
	}

	return s.businesses.UpdateOwnPassword(ctx, cmd.Scope, ports.UpdateBusinessUserPasswordInput{
		UserID:       cmd.UserID,
		PasswordHash: passwordHash,
	})
}

// RequestPasswordReset emails a one-time code to a business login so a
// locked-out owner or staff member can set a new password. It always returns
// nil — whether or not the email maps to an account — so the endpoint never
// reveals which addresses are registered.
func (s Service) RequestPasswordReset(ctx context.Context, rawEmail string) error {
	if s.resets == nil {
		return nil
	}
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return nil
	}
	target, err := s.resets.FindBusinessUserByEmail(ctx, email)
	if err != nil {
		return nil
	}

	code, err := generateResetCode()
	if err != nil {
		return err
	}
	now := s.clock.Now()
	if err := s.resets.CreatePasswordResetChallenge(ctx, ports.CreatePasswordResetChallengeInput{
		ChallengeID: s.ids.NewID(),
		UserID:      target.UserID,
		Email:       email,
		CodeHash:    hashResetCode(code),
		ExpiresAt:   now.Add(passwordResetTTL),
	}); err != nil {
		return err
	}

	displayName := strings.TrimSpace(target.DisplayName)
	if displayName == "" {
		displayName = target.Email
	}
	body := fmt.Sprintf(
		"Hi %s,\n\nUse this code to reset your Xtiitch dashboard password:\n\n    %s\n\nIt expires in 15 minutes. If you didn't request this, ignore this email — your password stays unchanged.\n\nThanks,\nXtiitch",
		displayName,
		code,
	)
	return s.emails.Send(ctx, ports.EmailMessage{
		To:      target.Email,
		Subject: "Reset your Xtiitch password",
		Body:    body,
	})
}

// ConfirmPasswordReset validates the emailed code and sets the new password.
func (s Service) ConfirmPasswordReset(ctx context.Context, rawEmail string, code string, newPassword string) error {
	if s.resets == nil {
		return authdomain.ErrResetCodeInvalid
	}
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return authdomain.ErrResetCodeInvalid
	}
	if len(newPassword) < minPasswordLength || len(newPassword) > maxPasswordLength {
		return authdomain.ErrInvalidInput
	}

	now := s.clock.Now()
	challenge, err := s.resets.LatestActivePasswordResetChallenge(ctx, email, now)
	if err != nil {
		return authdomain.ErrResetCodeInvalid
	}
	if challenge.Attempts >= maxPasswordResetTries {
		return authdomain.ErrResetCodeInvalid
	}
	if hashResetCode(code) != challenge.CodeHash {
		if incErr := s.resets.IncrementPasswordResetAttempts(ctx, challenge.ChallengeID); incErr != nil {
			s.logger.Error("failed to increment password reset attempts", slog.String("error", incErr.Error()))
		}
		return authdomain.ErrResetCodeInvalid
	}

	passwordHash, err := s.passwords.Hash(newPassword)
	if err != nil {
		return err
	}
	if err := s.resets.SetBusinessUserPasswordByID(ctx, challenge.UserID, passwordHash); err != nil {
		return err
	}
	return s.resets.ConsumePasswordResetChallenge(ctx, challenge.ChallengeID)
}

func generateResetCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashResetCode(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

type TransferBusinessOwnerCommand struct {
	Scope          common.TenantScope
	ActorUserID    common.ID
	ActorRole      business.UserRole
	NewOwnerUserID common.ID
	Confirmation   string
}

func (s Service) TransferBusinessOwner(ctx context.Context, cmd TransferBusinessOwnerCommand) (ports.TransferBusinessOwnerResult, error) {
	if cmd.Scope.BusinessID.IsZero() || cmd.ActorUserID.IsZero() || cmd.NewOwnerUserID.IsZero() {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}
	if cmd.ActorRole != business.UserRoleOwner {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrForbidden
	}
	if cmd.ActorUserID == cmd.NewOwnerUserID {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}
	if strings.TrimSpace(cmd.Confirmation) != ownerTransferConfirmation {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}

	return s.businesses.TransferBusinessOwner(ctx, cmd.Scope, ports.TransferBusinessOwnerInput{
		CurrentOwnerUserID: cmd.ActorUserID,
		NewOwnerUserID:     cmd.NewOwnerUserID,
	})
}

type normalizedRegistration struct {
	BusinessName     string
	BusinessHandle   string
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
	PlanCode         string
}

func normalizeRegistration(cmd RegisterBusinessCommand) (normalizedRegistration, error) {
	businessName := strings.TrimSpace(cmd.BusinessName)
	ownerName := strings.TrimSpace(cmd.OwnerDisplayName)
	handle := normalizeHandle(cmd.BusinessHandle)
	email, err := normalizeEmail(cmd.OwnerEmail)
	if err != nil {
		return normalizedRegistration{}, errors.Join(authdomain.ErrInvalidInput, err)
	}
	if businessName == "" || ownerName == "" || handle == "" || !handlePattern.MatchString(handle) {
		return normalizedRegistration{}, authdomain.ErrInvalidInput
	}
	if reservedHandles[handle] {
		return normalizedRegistration{}, authdomain.ErrInvalidInput
	}
	if len(cmd.OwnerPassword) < minPasswordLength || len(cmd.OwnerPassword) > maxPasswordLength {
		return normalizedRegistration{}, authdomain.ErrInvalidInput
	}

	return normalizedRegistration{
		BusinessName:     businessName,
		BusinessHandle:   handle,
		OwnerDisplayName: ownerName,
		OwnerEmail:       email,
		OwnerPassword:    cmd.OwnerPassword,
		PlanCode:         strings.ToLower(strings.TrimSpace(cmd.PlanCode)),
	}, nil
}

type normalizedBusinessUserCreation struct {
	DisplayName string
	Email       string
	Password    string
	Role        business.UserRole
}

func normalizeBusinessUserCreation(cmd CreateBusinessUserCommand) (normalizedBusinessUserCreation, error) {
	displayName := strings.TrimSpace(cmd.DisplayName)
	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return normalizedBusinessUserCreation{}, errors.Join(authdomain.ErrInvalidInput, err)
	}
	if displayName == "" || !isManageableBusinessUserRole(cmd.Role) {
		return normalizedBusinessUserCreation{}, authdomain.ErrInvalidInput
	}
	if len(cmd.Password) < minPasswordLength || len(cmd.Password) > maxPasswordLength {
		return normalizedBusinessUserCreation{}, authdomain.ErrInvalidInput
	}

	return normalizedBusinessUserCreation{
		DisplayName: displayName,
		Email:       email,
		Password:    cmd.Password,
		Role:        cmd.Role,
	}, nil
}

func authorizeBusinessUserManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	switch role {
	case business.UserRoleOwner, business.UserRoleAdmin:
		return nil
	default:
		return authdomain.ErrForbidden
	}
}

func isManageableBusinessUserRole(role business.UserRole) bool {
	return role == business.UserRoleAdmin || role == business.UserRoleStaff
}

func (s Service) sendBusinessUserInvite(ctx context.Context, user ports.BusinessUserRecord) error {
	if s.emails == nil || strings.TrimSpace(user.Email) == "" {
		return nil
	}
	loginURL := s.dashboardURL
	if loginURL == "" {
		loginURL = "https://app.xtiitch.com"
	}
	loginURL = strings.TrimRight(loginURL, "/") + "/login"
	displayName := strings.TrimSpace(user.DisplayName)
	if displayName == "" {
		displayName = user.Email
	}
	subject := "You have been invited to Xtiitch"
	body := fmt.Sprintf(
		"Hi %s,\n\nYou have been added to the Xtiitch business dashboard as %s.\nOpen %s and sign in with this email address. For security, Xtiitch does not email temporary passwords, so ask your owner or admin for the temporary password they set for you.\n\nThanks,\nXtiitch",
		displayName,
		user.Role,
		loginURL,
	)
	return s.emails.Send(ctx, ports.EmailMessage{
		To:      user.Email,
		Subject: subject,
		Body:    body,
	})
}

func normalizeEmail(value string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}

	return strings.ToLower(parsed.Address), nil
}

func normalizeHandle(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

type issueSessionInput struct {
	BusinessID     common.ID
	BusinessUserID common.ID
	Role           business.UserRole
	UserAgent      string
	IPAddress      string
}

func (s Service) issueSession(ctx context.Context, input issueSessionInput) (AuthResult, error) {
	now := s.clock.Now()
	accessExpiresAt := now.Add(accessTokenTTL)
	refreshExpiresAt := now.Add(refreshTokenTTL)

	accessToken, err := s.accessTokens.IssueAccessToken(ctx, ports.AccessTokenInput{
		Subject:    input.BusinessUserID,
		BusinessID: input.BusinessID,
		Role:       input.Role,
		IssuedAt:   now,
		ExpiresAt:  accessExpiresAt,
	})
	if err != nil {
		return AuthResult{}, err
	}

	refreshToken, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return AuthResult{}, err
	}

	if err := s.sessions.Create(ctx, ports.CreateAuthSessionInput{
		SessionID:        s.ids.NewID(),
		BusinessID:       input.BusinessID,
		BusinessUserID:   input.BusinessUserID,
		RefreshTokenHash: s.refreshTokens.HashRefreshToken(refreshToken),
		UserAgent:        strings.TrimSpace(input.UserAgent),
		IPAddress:        strings.TrimSpace(input.IPAddress),
		ExpiresAt:        refreshExpiresAt,
	}); err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		BusinessID:       input.BusinessID,
		BusinessUserID:   input.BusinessUserID,
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  accessExpiresAt,
		RefreshExpiresAt: refreshExpiresAt,
	}, nil
}

// ---------------------------------------------------------------------------
// Opt-in TOTP MFA
// ---------------------------------------------------------------------------

// MFAStatus is the enrolment state for the current user.
type MFAStatus struct {
	Enabled         bool
	Enrolled        bool
	BackupCodesLeft int
}

// MFAEnrollmentSetup is returned when a user begins enrolment. The client renders
// ProvisioningURI as a QR code and offers Secret for manual entry.
type MFAEnrollmentSetup struct {
	Secret          string
	ProvisioningURI string
}

// GetMFAStatus reports whether the user has MFA enrolled/enabled.
func (s Service) GetMFAStatus(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAStatus, error) {
	if !s.mfaEnabled() {
		return MFAStatus{}, nil
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return MFAStatus{}, nil
		}
		return MFAStatus{}, err
	}
	return MFAStatus{
		Enabled:         enrollment.Enabled,
		Enrolled:        true,
		BackupCodesLeft: enrollment.BackupCodesLeft,
	}, nil
}

// StartMFAEnrollment generates a fresh secret for the user and returns the
// provisioning material. It does not enable MFA — ActivateMFA does, once a code
// is verified. Re-running it before activation simply rotates the pending secret.
func (s Service) StartMFAEnrollment(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAEnrollmentSetup, error) {
	if !s.mfaEnabled() {
		return MFAEnrollmentSetup{}, authdomain.ErrForbidden
	}
	if scope.BusinessID.IsZero() || userID.IsZero() {
		return MFAEnrollmentSetup{}, authdomain.ErrInvalidInput
	}

	if existing, err := s.mfa.Get(ctx, scope, userID); err == nil && existing.Enabled {
		return MFAEnrollmentSetup{}, authdomain.ErrMFAAlreadyEnabled
	} else if err != nil && !errors.Is(err, ports.ErrNotFound) {
		return MFAEnrollmentSetup{}, err
	}

	secret, err := s.mfaSecrets.GenerateSecret()
	if err != nil {
		return MFAEnrollmentSetup{}, err
	}
	encrypted, err := s.mfaSecrets.EncryptSecret(secret)
	if err != nil {
		return MFAEnrollmentSetup{}, err
	}
	if err := s.mfa.Upsert(ctx, scope, ports.UpsertMFAInput{
		UserID:          userID,
		BusinessID:      scope.BusinessID,
		SecretEncrypted: encrypted,
	}); err != nil {
		return MFAEnrollmentSetup{}, err
	}

	return MFAEnrollmentSetup{
		Secret:          secret,
		ProvisioningURI: s.mfaSecrets.ProvisioningURI(secret, s.mfaAccountName(ctx, scope, userID)),
	}, nil
}

// ActivateMFA verifies the first code against the pending secret, enables MFA,
// and returns one-time backup codes (shown to the user once).
func (s Service) ActivateMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) ([]string, error) {
	if !s.mfaEnabled() {
		return nil, authdomain.ErrForbidden
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil, authdomain.ErrMFANotEnrolled
		}
		return nil, err
	}
	if enrollment.Enabled {
		return nil, authdomain.ErrMFAAlreadyEnabled
	}

	secret, err := s.mfaSecrets.DecryptSecret(enrollment.SecretEncrypted)
	if err != nil {
		return nil, err
	}
	step, ok := s.mfaSecrets.VerifyCode(secret, code, s.clock.Now(), enrollment.LastUsedStep)
	if !ok {
		return nil, authdomain.ErrInvalidMFACode
	}

	backupCodes, err := s.mfaSecrets.GenerateBackupCodes()
	if err != nil {
		return nil, err
	}
	hashes := make([]string, 0, len(backupCodes))
	for _, c := range backupCodes {
		hashes = append(hashes, s.mfaSecrets.HashBackupCode(c))
	}
	if err := s.mfa.Enable(ctx, scope, ports.EnableMFAInput{
		UserID:           userID,
		BackupCodeHashes: hashes,
		LastUsedStep:     step,
	}); err != nil {
		return nil, err
	}

	return backupCodes, nil
}

// DisableMFA turns MFA off after verifying a current code or a backup code.
func (s Service) DisableMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) error {
	if !s.mfaEnabled() {
		return authdomain.ErrForbidden
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return authdomain.ErrMFANotEnabled
		}
		return err
	}
	if !enrollment.Enabled {
		return authdomain.ErrMFANotEnabled
	}

	ok, err := s.verifyMFAFactor(ctx, scope, enrollment, code)
	if err != nil {
		return err
	}
	if !ok {
		return authdomain.ErrInvalidMFACode
	}

	return s.mfa.Delete(ctx, scope, userID)
}

// VerifyMFALoginCommand completes a login challenge with a second factor.
type VerifyMFALoginCommand struct {
	ChallengeToken string
	Code           string
	UserAgent      string
	IPAddress      string
}

// VerifyMFALogin redeems a password-stage challenge token plus a TOTP/backup code
// for a full session.
func (s Service) VerifyMFALogin(ctx context.Context, cmd VerifyMFALoginCommand) (AuthResult, error) {
	if !s.mfaEnabled() {
		return AuthResult{}, authdomain.ErrForbidden
	}
	verified, err := s.mfaVerifier.VerifyMFAChallengeToken(ctx, strings.TrimSpace(cmd.ChallengeToken))
	if err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	scope := common.TenantScope{BusinessID: verified.BusinessID}
	enrollment, err := s.mfa.Get(ctx, scope, verified.Subject)
	if err != nil || !enrollment.Enabled {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	// Re-confirm the user is still active: they may have been deactivated during
	// the (up to 5-minute) challenge window.
	if !s.businessUserActive(ctx, scope, verified.Subject) {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	ok, err := s.verifyMFAFactor(ctx, scope, enrollment, cmd.Code)
	if err != nil {
		return AuthResult{}, err
	}
	if !ok {
		return AuthResult{}, authdomain.ErrInvalidMFACode
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     verified.BusinessID,
		BusinessUserID: verified.Subject,
		Role:           verified.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

// verifyMFAFactor accepts either a valid current TOTP code (not previously used,
// per the last-used-step replay guard) or an unused backup code (which it
// consumes). It enforces a per-account lockout after repeated failures, and on
// success advances the replay guard / clears the lockout counter.
func (s Service) verifyMFAFactor(ctx context.Context, scope common.TenantScope, enrollment ports.MFAEnrollment, code string) (bool, error) {
	now := s.clock.Now()
	if !enrollment.LockedUntil.IsZero() && now.Before(enrollment.LockedUntil) {
		// Locked out: refuse without consuming the code, surfaced as invalid.
		return false, nil
	}

	secret, err := s.mfaSecrets.DecryptSecret(enrollment.SecretEncrypted)
	if err != nil {
		return false, err
	}

	if step, ok := s.mfaSecrets.VerifyCode(secret, code, now, enrollment.LastUsedStep); ok {
		if err := s.mfa.MarkVerified(ctx, scope, enrollment.UserID, step); err != nil {
			return false, err
		}
		return true, nil
	}

	consumed, err := s.mfa.ConsumeBackupCode(ctx, scope, enrollment.UserID, s.mfaSecrets.HashBackupCode(code))
	if err != nil {
		return false, err
	}
	if consumed {
		// Reset the lockout counter (step is unchanged for backup codes).
		if err := s.mfa.MarkVerified(ctx, scope, enrollment.UserID, enrollment.LastUsedStep); err != nil {
			return false, err
		}
		return true, nil
	}

	if _, err := s.mfa.RegisterFailedAttempt(ctx, scope, enrollment.UserID, mfaMaxFailedAttempts, mfaLockoutDuration); err != nil {
		return false, err
	}
	return false, nil
}

// businessUserActive reports whether the user still exists and is active in the
// tenant. Used to re-confirm at MFA-login time.
func (s Service) businessUserActive(ctx context.Context, scope common.TenantScope, userID common.ID) bool {
	users, err := s.businesses.ListBusinessUsers(ctx, scope)
	if err != nil {
		return false
	}
	for _, u := range users {
		if u.UserID == userID {
			return u.IsActive
		}
	}
	return false
}

// mfaAccountName resolves a human label for the authenticator entry (the user's
// email when available, otherwise the user id).
func (s Service) mfaAccountName(ctx context.Context, scope common.TenantScope, userID common.ID) string {
	users, err := s.businesses.ListBusinessUsers(ctx, scope)
	if err == nil {
		for _, u := range users {
			if u.UserID == userID && strings.TrimSpace(u.Email) != "" {
				return u.Email
			}
		}
	}
	return userID.String()
}
