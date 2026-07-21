package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BusinessRepository interface {
	GetByID(ctx context.Context, scope common.TenantScope, id common.ID) (business.Business, error)
}

type BusinessIdentityRepository interface {
	CreateBusinessWithOwner(ctx context.Context, input CreateBusinessWithOwnerInput) (BusinessOwnerIdentity, error)
	// HandleExists reports whether a business already owns the given (normalized)
	// store handle. Handles are globally unique, so this is a cross-tenant lookup
	// that runs under the RLS bypass. Powers the signup form's real-time handle
	// availability check.
	HandleExists(ctx context.Context, handle string) (bool, error)
	ListActivePlans(ctx context.Context) ([]PublicPlanRecord, error)
	// GetPlanByCode resolves an active plan's identity + pricing by its (lower-cased)
	// code, so a self-serve plan change can classify upgrade/downgrade and prorate.
	// ErrNotFound when no active plan has the code.
	GetPlanByCode(ctx context.Context, code string) (PlanPricingRecord, error)
	GetBusinessSubscription(ctx context.Context, businessID common.ID) (BusinessSubscriptionRecord, error)
	// SetPendingPlanUpgrade parks the target plan of an upgrade on the subscription
	// as PAYMENT-PENDING (pending_plan_id set, pending_plan_effective_at NULL — the
	// shape migration 000118 admits alongside the scheduled-downgrade pair). It
	// changes NO entitlements: businesses.plan_id stays on the current paid-up plan
	// until VerifySubscriptionAuthorization confirms the Paystack payment and
	// applies the switch via ApplyImmediatePlanUpgrade (which also clears the
	// pending fields).
	SetPendingPlanUpgrade(ctx context.Context, businessID common.ID, planID common.ID) error
	// ApplyImmediatePlanUpgrade switches the tenant to a higher plan now — on the
	// subscription AND the business (so entitlements take effect immediately) — and,
	// when AmountMinor > 0, books the prorated difference as a paid invoice on the
	// deterministic ChargeRef. It is idempotent: the invoice insert is ON CONFLICT
	// (invoice_ref) DO NOTHING and the plan switch shares that transaction, so a
	// replayed upgrade (double submit / retry after a partial failure) neither
	// double-charges nor re-switches. Any parked pending downgrade is cleared.
	ApplyImmediatePlanUpgrade(ctx context.Context, input ApplyImmediatePlanUpgradeInput) error
	// SchedulePlanDowngrade parks a pending plan change on the subscription to apply
	// at EffectiveAt (the current period end). It does NOT refund, charge, or change
	// entitlements now; the recurring renewal sweep applies it at period end via
	// ApplyDuePlanChanges.
	SchedulePlanDowngrade(ctx context.Context, input SchedulePlanDowngradeInput) error
	ActivateRecurringBilling(ctx context.Context, input ActivateRecurringBillingInput) error
	// PrepareSubscriptionActivationCharge returns a DETERMINISTIC charge reference
	// for the subscription's current period and whether a first charge is still
	// due (no paid invoice for that period yet). The stable ref makes the
	// first-period charge idempotent: a repeated authorization-verify reuses the
	// same ref, so Paystack dedupes the charge and the paid-invoice insert is a
	// no-op — preventing a double charge on retry/replay.
	PrepareSubscriptionActivationCharge(ctx context.Context, businessID common.ID) (SubscriptionActivationCharge, error)
	// RecordSubscriptionActivationPayment books the first recurring charge a tenant
	// paid at authorization time: a paid invoice for the current period plus the
	// subscription flipped to active with next_billing_at at the period end. It is
	// idempotent on the charge ref (re-recording the same ref is a no-op).
	RecordSubscriptionActivationPayment(ctx context.Context, input RecordSubscriptionActivationPaymentInput) error
	// SetSubscriptionBillingCadence records the tenant's chosen billing cadence
	// ('quarterly' or 'yearly') on their subscription. It is called when the
	// authorization link is created, so that the later verify/first-charge step
	// (driven by the Paystack callback, which only carries the payment reference)
	// can read back the cadence to pick the intro/renewal amount and the next
	// billing date. It does NOT consume the first purchase or charge anything.
	SetSubscriptionBillingCadence(ctx context.Context, businessID common.ID, cadence string) error
	// SubmitIdentityDocument stores (or replaces) a business's Ghana Card number and
	// ID photo and moves it into verification 'pending' for operator review. An
	// already-verified business keeps its status (resubmission only updates the
	// document); unverified/rejected/pending move to pending.
	SubmitIdentityDocument(ctx context.Context, input SubmitIdentityDocumentInput) error
	FindBusinessUserByHandleAndEmail(ctx context.Context, handle string, email string) (BusinessUserCredentials, error)
	FindBusinessUserCredentialsByID(ctx context.Context, scope common.TenantScope, userID common.ID) (BusinessUserCredentials, error)
	// RecordFailedBusinessLogin increments the account's failed-attempt counter and,
	// on reaching maxAttempts, sets a lockout of lockFor and resets the counter.
	RecordFailedBusinessLogin(ctx context.Context, userID common.ID, maxAttempts int, lockFor time.Duration) error
	// ClearFailedBusinessLogin resets the failed-attempt counter and lockout after a
	// successful password login.
	ClearFailedBusinessLogin(ctx context.Context, userID common.ID) error
	ListBusinessUsers(ctx context.Context, scope common.TenantScope) ([]BusinessUserRecord, error)
	CreateBusinessUser(ctx context.Context, scope common.TenantScope, input CreateBusinessUserInput) (BusinessUserRecord, error)
	UpdateBusinessUser(ctx context.Context, scope common.TenantScope, input UpdateBusinessUserInput) (BusinessUserRecord, error)
	// FindBusinessUserProfileByID returns the caller's own profile row (§9),
	// including the WhatsApp number and phone-verification marker that
	// BusinessUserRecord does not carry. Tenant-scoped; ErrNotFound when no row
	// with that id exists in the scope.
	FindBusinessUserProfileByID(ctx context.Context, scope common.TenantScope, userID common.ID) (BusinessUserProfileRecord, error)
	// UpdateOwnBusinessUserProfile writes the caller's own profile row. Unlike
	// UpdateBusinessUser it may touch the owner row (self-service, §9) but has
	// no role/is_active knobs, so a user can never promote or deactivate
	// themselves through it.
	UpdateOwnBusinessUserProfile(ctx context.Context, scope common.TenantScope, input UpdateOwnBusinessUserProfileInput) (BusinessUserProfileRecord, error)
	UpdateBusinessUserPassword(ctx context.Context, scope common.TenantScope, input UpdateBusinessUserPasswordInput) error
	// UpdateOwnPassword sets the password for the authenticated user themselves.
	// Unlike UpdateBusinessUserPassword (the admin reset path, which refuses to
	// touch an owner), this is scoped to the caller's own user id, so an owner
	// can rotate their own credential.
	UpdateOwnPassword(ctx context.Context, scope common.TenantScope, input UpdateBusinessUserPasswordInput) error
	TransferBusinessOwner(ctx context.Context, scope common.TenantScope, input TransferBusinessOwnerInput) (TransferBusinessOwnerResult, error)
}

// PasswordResetRepository backs self-service business password resets. A
// locked-out user has no session and therefore no tenant, so every method is
// cross-tenant and the implementation runs under the RLS bypass.
type PasswordResetRepository interface {
	FindBusinessUserByEmail(ctx context.Context, email string) (PasswordResetTarget, error)
	CreatePasswordResetChallenge(ctx context.Context, input CreatePasswordResetChallengeInput) error
	LatestActivePasswordResetChallenge(ctx context.Context, email string, now time.Time) (PasswordResetChallenge, error)
	IncrementPasswordResetAttempts(ctx context.Context, challengeID common.ID) error
	ConsumePasswordResetChallenge(ctx context.Context, challengeID common.ID) error
	SetBusinessUserPasswordByID(ctx context.Context, userID common.ID, passwordHash string) error
}

// SubscriptionDiscountRepository backs discount-code redemption at subscription
// checkout. Discount codes are global/admin objects (no tenant RLS), so the code
// lookup and the cross-tenant redemption counts run under the RLS bypass; the
// redemption rows are tenant-isolated (forced RLS) and are read/written under the
// business's scope. A code REPLACES the first-purchase intro (it does not stack).
type SubscriptionDiscountRepository interface {
	// FindActiveDiscountCodeByCode resolves an active, non-archived code by its
	// (normalized, upper-cased) code string. Bypass. ErrNotFound when none matches.
	FindActiveDiscountCodeByCode(ctx context.Context, code string) (SubscriptionDiscountCode, error)
	// CountAppliedRedemptions returns the total APPLIED redemptions for a code
	// across all tenants (for the max_redemptions_total cap). Bypass.
	CountAppliedRedemptions(ctx context.Context, discountCodeID common.ID) (int, error)
	// CountAppliedRedemptionsForAccount returns the APPLIED redemptions a single
	// business made against a code (for the max_per_account cap). Bypass.
	CountAppliedRedemptionsForAccount(ctx context.Context, discountCodeID common.ID, businessID common.ID) (int, error)
	// CreateRedemption inserts a tenant-scoped redemption row (written 'pending' at
	// checkout) and returns its id.
	CreateRedemption(ctx context.Context, scope common.TenantScope, input CreateDiscountRedemptionInput) (common.ID, error)
	// CreateRedemptionWithinCaps atomically enforces the per-account and total caps
	// and inserts the 'pending' redemption in ONE transaction, serialized by an
	// advisory lock on the code, so concurrent checkouts of the same limited code
	// cannot both pass the cap check and over-redeem. Counts APPLIED redemptions
	// plus recent (uncommitted-window) PENDING ones so a race in the pending→settle
	// window is caught. Returns ErrDiscountRedemptionCapReached when a cap is hit.
	CreateRedemptionWithinCaps(
		ctx context.Context,
		scope common.TenantScope,
		input CreateDiscountRedemptionInput,
		maxPerAccount int,
		maxTotal *int,
	) (common.ID, error)
	// FindPendingRedemption returns the latest still-'pending' redemption for a
	// subscription (the discount captured at checkout), joined with its code so the
	// verify step can apply it. ErrNotFound when the subscription has no pending
	// discount. Tenant-scoped.
	FindPendingRedemption(ctx context.Context, scope common.TenantScope, subscriptionID common.ID) (PendingDiscountRedemption, error)
	// MarkRedemptionApplied transitions a pending redemption to 'applied' with the
	// final discount amount + applied_at. Idempotent: it only touches a row still
	// in 'pending'. Tenant-scoped.
	MarkRedemptionApplied(ctx context.Context, scope common.TenantScope, input MarkDiscountRedemptionAppliedInput) error
	// ActivateFreePeriodBilling activates a subscription on a free-period code
	// without charging the card: it books a zero, already-'paid' invoice on the
	// deterministic activation ref (idempotent) and sets next_billing_at to now +
	// freeMonths. Tenant-scoped.
	ActivateFreePeriodBilling(ctx context.Context, scope common.TenantScope, input ActivateFreePeriodInput) error
}

// BusinessWhatsAppAuthRepository backs WhatsApp one-time-code auth for the
// business dashboard: resolving an owner by store handle + WhatsApp number, and
// a global (bypass-gated) sign-in OTP challenge store keyed on the number (also
// reused for pre-registration number verification). Kept separate from
// BusinessIdentityRepository so it doesn't disturb that interface's many
// implementers.
type BusinessWhatsAppAuthRepository interface {
	FindBusinessUserByHandleAndWhatsApp(ctx context.Context, handle string, whatsAppNumber string) (BusinessUserCredentials, error)
	CreateSignInOTPChallenge(ctx context.Context, input CreateSignInOTPChallengeInput) error
	// LatestActiveSignInOTPChallenge returns the newest live challenge for a
	// number AND purpose. Purpose is part of the lookup, not a post-hoc check, so
	// a code issued for another flow simply is not found.
	LatestActiveSignInOTPChallenge(
		ctx context.Context, whatsAppNumber string, purpose string, now time.Time,
	) (BusinessOTPChallengeRecord, error)
	IncrementSignInOTPAttempts(ctx context.Context, challengeID common.ID) error
	ConsumeSignInOTPChallenge(ctx context.Context, challengeID common.ID) error
	// MarkSignInOTPChallengeVerified stamps verified_at WITHOUT consuming the
	// challenge (§8 verify-then-register): the proof is recorded so the flow's
	// completion step can accept it, but the challenge stays live until that
	// step consumes it or it expires.
	MarkSignInOTPChallengeVerified(ctx context.Context, challengeID common.ID) error
	// LatestVerifiedSignInOTPChallenge returns the newest verified-but-unconsumed,
	// unexpired challenge for a number AND purpose — i.e. a proof completed
	// earlier in the flow that the completion step may now redeem.
	LatestVerifiedSignInOTPChallenge(
		ctx context.Context, whatsAppNumber string, purpose string, now time.Time,
	) (BusinessOTPChallengeRecord, error)
}

type AuthSessionRepository interface {
	Create(ctx context.Context, input CreateAuthSessionInput) error
	// FindByRefreshTokenHash looks a session up by the credential itself (the
	// hash is globally unique), so it carries no tenant scope, like login. The
	// caller validates expiry/revocation/active-user against its own clock.
	FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (AuthSessionWithUser, error)
	// Revoke marks a session revoked within its tenant scope.
	Revoke(ctx context.Context, businessID common.ID, sessionID common.ID) error
}
