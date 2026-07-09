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
	ListBusinessUsers(ctx context.Context, scope common.TenantScope) ([]BusinessUserRecord, error)
	CreateBusinessUser(ctx context.Context, scope common.TenantScope, input CreateBusinessUserInput) (BusinessUserRecord, error)
	UpdateBusinessUser(ctx context.Context, scope common.TenantScope, input UpdateBusinessUserInput) (BusinessUserRecord, error)
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
	// PlanCode is the plan the owner chose at signup. Empty or unknown codes
	// fall back to the free plan in the repository.
	PlanCode string
	// Phone is the store owner's contact phone number captured at signup, stored
	// for order and account notifications. Optional; not a sign-in identity.
	Phone string
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
	BusinessID  common.ID
	NewPlanID   common.ID
	AmountMinor int64
	Currency    string
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
}

// RecordSubscriptionActivationPaymentInput books the first recurring charge.
type RecordSubscriptionActivationPaymentInput struct {
	BusinessID  common.ID
	AmountMinor int64
	Currency    string
	// ChargeRef is the Paystack charge reference; it becomes the invoice ref so the
	// charge webhook reconciles to this already-paid invoice (a no-op).
	ChargeRef string
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
}

// SubmitIdentityDocumentInput carries a business's Ghana Card submission.
type SubmitIdentityDocumentInput struct {
	BusinessID common.ID
	CardNumber string
	IDPhotoURL string
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
	ChargeRef  string
	Currency   string
	FreeMonths int
}

type BusinessOwnerIdentity struct {
	BusinessID     common.ID
	BusinessUserID common.ID
	Role           business.UserRole
}

type BusinessUserCredentials struct {
	BusinessID   common.ID
	UserID       common.ID
	PasswordHash string
	Role         business.UserRole
	IsActive     bool
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
	LatestActiveSignInOTPChallenge(ctx context.Context, whatsAppNumber string, now time.Time) (BusinessOTPChallengeRecord, error)
	IncrementSignInOTPAttempts(ctx context.Context, challengeID common.ID) error
	ConsumeSignInOTPChallenge(ctx context.Context, challengeID common.ID) error
}

// CreateSignInOTPChallengeInput stores a hashed business sign-in code.
type CreateSignInOTPChallengeInput struct {
	ChallengeID    common.ID
	WhatsAppNumber string
	CodeHash       string
	ExpiresAt      time.Time
}

// BusinessOTPChallengeRecord is an active business sign-in OTP challenge.
type BusinessOTPChallengeRecord struct {
	ChallengeID    common.ID
	WhatsAppNumber string
	CodeHash       string
	Attempts       int
	ExpiresAt      time.Time
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

type AuthSessionRepository interface {
	Create(ctx context.Context, input CreateAuthSessionInput) error
	// FindByRefreshTokenHash looks a session up by the credential itself (the
	// hash is globally unique), so it carries no tenant scope, like login. The
	// caller validates expiry/revocation/active-user against its own clock.
	FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (AuthSessionWithUser, error)
	// Revoke marks a session revoked within its tenant scope.
	Revoke(ctx context.Context, businessID common.ID, sessionID common.ID) error
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

type TransactionManager interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type Clock interface {
	Now() time.Time
}

type IDGenerator interface {
	NewID() common.ID
}

type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash string, password string) error
}

type TokenIssuer interface {
	IssueAccessToken(ctx context.Context, input AccessTokenInput) (string, error)
}

type TokenVerifier interface {
	VerifyAccessToken(ctx context.Context, token string) (VerifiedAccessToken, error)
}

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

type RefreshTokenIssuer interface {
	NewRefreshToken() (string, error)
	HashRefreshToken(token string) string
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

type MFAChallengeIssuer interface {
	IssueMFAChallengeToken(ctx context.Context, input MFAChallengeInput) (string, error)
}

type MFAChallengeVerifier interface {
	VerifyMFAChallengeToken(ctx context.Context, token string) (VerifiedAccessToken, error)
}

// MFASecrets owns the cryptography behind authenticator-app MFA: TOTP secret
// generation/verification (RFC 6238), at-rest encryption of the secret, and
// single-use backup codes. The application service depends only on this port.
type MFASecrets interface {
	GenerateSecret() (string, error)
	ProvisioningURI(secret string, accountName string) string
	// VerifyCode returns the matched TOTP step (and true) only for a code at a
	// step strictly greater than afterStep, so a code cannot be replayed.
	VerifyCode(secret string, code string, now time.Time, afterStep int64) (int64, bool)
	GenerateBackupCodes() ([]string, error)
	HashBackupCode(code string) string
	EncryptSecret(secret string) ([]byte, error)
	DecryptSecret(ciphertext []byte) (string, error)
}

// MFARepository persists per-user MFA enrolment, tenant-scoped under RLS.
type MFARepository interface {
	// Get returns the enrolment for a user, or ErrNotFound if none exists.
	Get(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAEnrollment, error)
	// Upsert stores (or replaces) the pending secret, leaving MFA disabled until
	// the first code is verified.
	Upsert(ctx context.Context, scope common.TenantScope, input UpsertMFAInput) error
	// Enable turns the enrolment on and stores the backup-code hashes.
	Enable(ctx context.Context, scope common.TenantScope, input EnableMFAInput) error
	// ConsumeBackupCode marks one matching, unused backup-code hash as used and
	// reports whether a match was found.
	ConsumeBackupCode(ctx context.Context, scope common.TenantScope, userID common.ID, codeHash string) (bool, error)
	// MarkVerified records a successful second factor: it advances last_used_step
	// (so a TOTP code cannot be replayed) and clears the failed-attempt lockout.
	MarkVerified(ctx context.Context, scope common.TenantScope, userID common.ID, usedStep int64) error
	// RegisterFailedAttempt increments the failed-attempt counter and, once it
	// reaches threshold, sets a lockout of lockFor and resets the counter. It
	// returns the active lockout deadline (zero time when not locked).
	RegisterFailedAttempt(ctx context.Context, scope common.TenantScope, userID common.ID, threshold int, lockFor time.Duration) (time.Time, error)
	// Delete removes the enrolment, disabling MFA for the user.
	Delete(ctx context.Context, scope common.TenantScope, userID common.ID) error
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

type PaymentProvider interface {
	CreateBusinessSubaccount(ctx context.Context, input CreateBusinessSubaccountInput) (CreateBusinessSubaccountResult, error)
	InitializeTransaction(ctx context.Context, input InitializeTransactionInput) (InitializeTransactionResult, error)
	InitializeAuthorization(ctx context.Context, input InitializeAuthorizationInput) (InitializeAuthorizationResult, error)
	VerifyAuthorization(ctx context.Context, input VerifyAuthorizationInput) (VerifyAuthorizationResult, error)
	ChargeAuthorization(ctx context.Context, input ChargeAuthorizationInput) (ChargeAuthorizationResult, error)
	// VerifyWebhookSignature checks a raw webhook body against its signature
	// header. It operates on bytes, never a decoded value, so the signature is
	// verified over exactly what the provider signed.
	VerifyWebhookSignature(payload []byte, signature string) bool
	ParseChargeEvent(payload []byte) (ProviderChargeEvent, error)
}

type CreateBusinessSubaccountInput struct {
	BusinessID        common.ID
	BusinessName      string
	SettlementAccount string
}

type CreateBusinessSubaccountResult struct {
	ProviderReference string
}

type InitializeTransactionInput struct {
	BusinessID      common.ID
	SubaccountRef   string
	CustomerEmail   string
	AmountMinor     int64
	CommissionMinor int64
	Currency        string
	Reference       string
}

type InitializeTransactionResult struct {
	AuthorizationURL  string
	AccessCode        string
	ProviderReference string
}

type InitializeAuthorizationInput struct {
	BusinessID    common.ID
	CustomerEmail string
	CallbackURL   string
}

type InitializeAuthorizationResult struct {
	RedirectURL string
	AccessCode  string
	Reference   string
}

type VerifyAuthorizationInput struct {
	Reference string
}

type VerifyAuthorizationResult struct {
	AuthorizationCode string
	CustomerCode      string
	CustomerEmail     string
	Channel           string
	Bank              string
	Active            bool
}

type ChargeAuthorizationInput struct {
	BusinessID        common.ID
	AuthorizationCode string
	CustomerEmail     string
	AmountMinor       int64
	Currency          string
	Reference         string
}

type ChargeAuthorizationResult struct {
	ProviderReference string
	Status            string
	AmountMinor       int64
	Currency          string
}

type ProviderChargeEvent struct {
	EventType         string
	ProviderReference string
	Succeeded         bool
	AmountMinor       int64
	// Signature is the idempotency key for this event (provider + reference +
	// type), used to make a re-delivered confirmation a no-op.
	Signature string
}

type PaymentRepository interface {
	Create(ctx context.Context, input CreatePaymentInput) error
	// ConfirmFromProvider records the provider event and advances the matching
	// payment in a single transaction, so a re-delivered event is a no-op.
	ConfirmFromProvider(ctx context.Context, input ConfirmPaymentInput) (ConfirmPaymentResult, error)
	ListByBusiness(ctx context.Context, scope common.TenantScope) ([]PaymentRecord, error)
	// RecordManualTaking logs an off-platform sale (cash/momo/other). Paystack
	// does not move this money, so any platform commission is only an accrued
	// offline receivable for later invoice/reconciliation.
	RecordManualTaking(ctx context.Context, scope common.TenantScope, input ManualTakingInput) error
	// ListManualTakings lists a business's off-platform takings, most recent first.
	ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ManualTakingRecord, error)
	// MoneySummary aggregates the business's income: succeeded through-platform
	// payments and their commission, plus off-platform manual takings.
	MoneySummary(ctx context.Context, scope common.TenantScope) (MoneySummary, error)
}

type ManualTakingInput struct {
	TakingID         common.ID
	BusinessID       common.ID
	OrderID          *common.ID
	AmountMinor      int64
	Method           string
	WhatFor          string
	CommissionBps    int
	CommissionMinor  int64
	CommissionStatus string
	CommissionNote   string
}

type ManualTakingRecord struct {
	TakingID         common.ID
	AmountMinor      int64
	Method           string
	WhatFor          string
	CommissionBps    int
	CommissionMinor  int64
	CommissionStatus string
	CommissionNote   string
	TakenAt          time.Time
}

// MoneySummary is the business's income overview, all in GHS pesewas. Net income
// is what the business keeps: through-platform settlements (gross minus the
// platform commission) plus off-platform takings, less accrued offline platform
// commission that still needs later invoice/reconciliation.
type MoneySummary struct {
	ThroughPlatformMinor      int64
	CommissionMinor           int64
	ManualTakingsMinor        int64
	OfflineCommissionDueMinor int64
	NetIncomeMinor            int64
}

type CreatePaymentInput struct {
	PaymentID         common.ID
	BusinessID        common.ID
	OrderID           *common.ID
	BookingID         *common.ID
	Purpose           string
	AmountMinor       int64
	Currency          string
	Method            string
	ProviderReference string
	CommissionMinor   int64
}

type ConfirmPaymentInput struct {
	EventSignature    string
	EventType         string
	ProviderReference string
	Succeeded         bool
}

type ConfirmPaymentResult struct {
	AlreadyProcessed         bool
	PaymentFound             bool
	SubscriptionInvoiceFound bool
	AdCampaignPaymentFound   bool
	BusinessID               common.ID
}

type PaymentRecord struct {
	PaymentID         common.ID
	BusinessID        common.ID
	Purpose           string
	AmountMinor       int64
	Currency          string
	Method            string
	ProviderReference string
	Status            string
	CommissionMinor   int64
}

type BusinessChargeRepository interface {
	GetChargeContext(ctx context.Context, scope common.TenantScope) (BusinessChargeContext, error)
	ProvisionSubaccount(ctx context.Context, businessID common.ID, subaccountRef string, settlementAccount string) error
}

type BusinessChargeContext struct {
	BusinessID    common.ID
	Name          string
	Verified      bool
	SubaccountRef string
	CommissionBps int
	// FeePassToBuyer: when true the buyer pays the platform fee on top of the
	// order total and the merchant nets the full total (Pricing Book §3).
	FeePassToBuyer bool
}

// MediaStore signs a direct, browser-to-provider image upload. The client
// uploads the file straight to the provider with the returned signature, then
// stores only the resulting URL on a design — image bytes never pass through
// Xtiitch.
type MediaStore interface {
	SignUpload(ctx context.Context, scope common.TenantScope, folder string) (SignedUpload, error)
}

type SignedUpload struct {
	Signature string
	Timestamp int64
	CloudName string
	APIKey    string
	Folder    string
}

type EmailSender interface {
	Send(ctx context.Context, message EmailMessage) error
}

type EmailMessage struct {
	To      string
	Subject string
	Body    string
}

type PushSender interface {
	Send(ctx context.Context, message PushMessage) error
}

type PushMessage struct {
	To    string
	Title string
	Body  string
}

type JobQueue interface {
	Enqueue(ctx context.Context, job Job) error
}

type Job struct {
	Name       string
	TenantID   common.ID
	Payload    map[string]string
	IdempotKey string
}
