package ports

import (
	"context"
	"time"

	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminUserRepository interface {
	EnsureBootstrapUser(ctx context.Context, input CreateAdminUserInput) (AdminUserRecord, error)
	FindByEmail(ctx context.Context, email string) (AdminUserCredentials, error)
	// RecordFailedAdminLogin increments the account's failed-attempt counter and, on
	// reaching maxAttempts, sets a lockout of lockFor and resets the counter.
	RecordFailedAdminLogin(ctx context.Context, userID common.ID, maxAttempts int, lockFor time.Duration) error
	// ClearFailedAdminLogin resets the failed-attempt counter and lockout after a
	// successful password login.
	ClearFailedAdminLogin(ctx context.Context, userID common.ID) error
	FindByID(ctx context.Context, userID common.ID) (AdminUserRecord, error)
	ListAdminUsers(ctx context.Context) ([]AdminUserRecord, error)
	CreateAdminUser(ctx context.Context, input CreateAdminUserInput) (AdminUserRecord, error)
	UpdateAdminUser(ctx context.Context, input UpdateAdminUserInput) (AdminUserRecord, error)
	UpdateAdminProfile(ctx context.Context, input UpdateAdminProfileInput) (AdminUserRecord, error)
	ListAdminRolePermissions(ctx context.Context) ([]AdminRolePermissionsRecord, error)
	ReplaceAdminRolePermissions(ctx context.Context, input UpdateAdminRolePermissionsInput) (AdminRolePermissionsRecord, error)
	GetAdminPreferences(ctx context.Context, userID common.ID) (AdminPreferencesRecord, error)
	UpdateAdminPreferences(ctx context.Context, input UpdateAdminPreferencesInput) (AdminPreferencesRecord, error)
	GetAdminPlatformSettings(ctx context.Context) (AdminPlatformSettingsRecord, error)
	UpdateAdminPlatformSettings(ctx context.Context, input UpdateAdminPlatformSettingsInput) (AdminPlatformSettingsRecord, error)
	UpdateAdminMarketingFlags(ctx context.Context, input UpdateAdminMarketingFlagsInput) (AdminPlatformSettingsRecord, error)
	RecordLogin(ctx context.Context, userID common.ID) error
}

type AdminAuditRepository interface {
	CreateAdminAuditEvent(ctx context.Context, input CreateAdminAuditEventInput) (AdminAuditEventRecord, error)
	ListAdminAuditEvents(ctx context.Context, input ListAdminAuditEventsInput) ([]AdminAuditEventRecord, error)
}

type AdminBusinessRepository interface {
	ListAdminVerificationCases(ctx context.Context) ([]AdminVerificationCaseRecord, error)
	DecideAdminBusinessVerification(ctx context.Context, input AdminBusinessVerificationDecisionInput) (AdminVerificationCaseRecord, error)
	ListAdminBusinesses(ctx context.Context) ([]AdminBusinessRecord, error)
	ListAdminCustomers(ctx context.Context) ([]AdminCustomerRecord, error)
	// ExportAdminCustomer gathers every record held about one customer for a Data
	// Protection Act (Act 843) subject-access request. Read-only.
	ExportAdminCustomer(ctx context.Context, customerID common.ID) (AdminCustomerExportRecord, error)
	// EraseAdminCustomer anonymises a customer's personal data platform-wide
	// (right to erasure). Order/payment records are retained but reference only
	// the opaque customer id.
	EraseAdminCustomer(ctx context.Context, customerID common.ID) (AdminCustomerErasureRecord, error)
	UpdateAdminBusinessStatus(ctx context.Context, input UpdateAdminBusinessStatusInput) (AdminBusinessRecord, error)
	GetAdminPlatformMetrics(ctx context.Context) (AdminPlatformMetricsRecord, error)
	GetAdminMoneyRails(ctx context.Context) (AdminMoneyRailsRecord, error)
	ListAdminSubscriptions(ctx context.Context) ([]AdminSubscriptionRecord, error)
	UpdateAdminSubscription(ctx context.Context, input UpdateAdminSubscriptionInput) (AdminSubscriptionRecord, error)
	IssueAdminSubscriptionInvoice(ctx context.Context, input IssueAdminSubscriptionInvoiceInput) (AdminSubscriptionRecord, error)
	MarkAdminSubscriptionInvoicePaid(ctx context.Context, input MarkAdminSubscriptionInvoicePaidInput) (AdminSubscriptionRecord, error)
	MarkAdminSubscriptionInvoiceFailed(ctx context.Context, input MarkAdminSubscriptionInvoiceFailedInput) (AdminSubscriptionRecord, error)
	RunAdminSubscriptionBillingSweep(ctx context.Context, input RunAdminSubscriptionBillingSweepInput) (AdminSubscriptionBillingSweepRecord, error)
	// EnqueueSubscriptionRenewalReminder writes a renewal-reminder intent to the
	// notification outbox (WhatsApp) alongside a dedup log row in one transaction,
	// so each (subscription, period, kind) reminder is enqueued at most once. The
	// result reports whether a new reminder was enqueued (false = already sent).
	EnqueueSubscriptionRenewalReminder(ctx context.Context, input EnqueueSubscriptionRenewalReminderInput) (SubscriptionRenewalReminderResult, error)
	ListAdminPlans(ctx context.Context) ([]AdminPlanRecord, error)
	CreateAdminPlan(ctx context.Context, input CreateAdminPlanInput) (AdminPlanRecord, error)
	UpdateAdminPlan(ctx context.Context, input UpdateAdminPlanInput) (AdminPlanRecord, error)
	ArchiveAdminPlan(ctx context.Context, input ArchiveAdminPlanInput) (AdminPlanRecord, error)
	ListAdminPlanEntitlements(ctx context.Context) ([]AdminPlanEntitlementFeatureRecord, error)
	UpdateAdminPlanEntitlements(ctx context.Context, input UpdateAdminPlanEntitlementsInput) ([]AdminPlanEntitlementFeatureRecord, error)
	ListAdminSubscriptionDiscountCodes(ctx context.Context) ([]AdminSubscriptionDiscountCodeRecord, error)
	CreateAdminSubscriptionDiscountCode(ctx context.Context, input CreateAdminSubscriptionDiscountCodeInput) (AdminSubscriptionDiscountCodeRecord, error)
	UpdateAdminSubscriptionDiscountCode(ctx context.Context, input UpdateAdminSubscriptionDiscountCodeInput) (AdminSubscriptionDiscountCodeRecord, error)
	ArchiveAdminSubscriptionDiscountCode(ctx context.Context, input ArchiveAdminSubscriptionDiscountCodeInput) (AdminSubscriptionDiscountCodeRecord, error)
	ListAdminPromotions(ctx context.Context) ([]AdminPromotionRecord, error)
	CreateAdminPromotion(ctx context.Context, input CreateAdminPromotionInput) (AdminPromotionRecord, error)
	UpdateAdminPromotion(ctx context.Context, input UpdateAdminPromotionInput) (AdminPromotionRecord, error)
	ArchiveAdminPromotion(ctx context.Context, input ArchiveAdminPromotionInput) (AdminPromotionRecord, error)
	ListAdminAdCampaigns(ctx context.Context) ([]AdminAdCampaignRecord, error)
	CreateAdminAdCampaign(ctx context.Context, input CreateAdminAdCampaignInput) (AdminAdCampaignRecord, error)
	UpdateAdminAdCampaign(ctx context.Context, input UpdateAdminAdCampaignInput) (AdminAdCampaignRecord, error)
	ArchiveAdminAdCampaign(ctx context.Context, input ArchiveAdminAdCampaignInput) (AdminAdCampaignRecord, error)
	GetAdminAdCampaignPaymentIntent(ctx context.Context, campaignID common.ID) (AdminAdCampaignPaymentIntentRecord, error)
	CreateAdminAdCampaignPayment(ctx context.Context, input CreateAdminAdCampaignPaymentInput) (AdminAdCampaignPaymentRecord, error)
	ListAdminAffiliates(ctx context.Context) ([]AdminAffiliateRecord, error)
	ListAdminAffiliateAttribution(ctx context.Context) ([]AdminAffiliateAttributionRecord, error)
	UpdateAdminAffiliateConversionStatus(ctx context.Context, input UpdateAdminAffiliateConversionStatusInput) (AdminAffiliateConversionRecord, error)
	CreateAdminAffiliatePayout(ctx context.Context, input CreateAdminAffiliatePayoutInput) (AdminAffiliatePayoutRecord, error)
	CreateAdminAffiliate(ctx context.Context, input CreateAdminAffiliateInput) (AdminAffiliateRecord, error)
	UpdateAdminAffiliate(ctx context.Context, input UpdateAdminAffiliateInput) (AdminAffiliateRecord, error)
	ArchiveAdminAffiliate(ctx context.Context, input ArchiveAdminAffiliateInput) (AdminAffiliateRecord, error)
	ListAdminReferralProgrammes(ctx context.Context) ([]AdminReferralProgrammeRecord, error)
	CreateAdminReferralProgramme(ctx context.Context, input CreateAdminReferralProgrammeInput) (AdminReferralProgrammeRecord, error)
	UpdateAdminReferralProgramme(ctx context.Context, input UpdateAdminReferralProgrammeInput) (AdminReferralProgrammeRecord, error)
	ArchiveAdminReferralProgramme(ctx context.Context, input ArchiveAdminReferralProgrammeInput) (AdminReferralProgrammeRecord, error)
	CreateAdminReferralCode(ctx context.Context, input CreateAdminReferralCodeInput) (AdminReferralCodeRecord, error)
	IssueAdminReferralRewards(ctx context.Context, input IssueAdminReferralRewardsInput) (AdminReferralRewardIssueRecord, error)
	QueueAdminMoneyReplay(ctx context.Context, input QueueAdminMoneyReplayInput) (AdminMoneyReplayRequestRecord, error)
	ReverseAdminMoneyPayment(ctx context.Context, input ReverseAdminMoneyPaymentInput) (AdminMoneyReversalRecord, error)
	SetAdminSettlementReviewHold(ctx context.Context, input SetAdminSettlementReviewHoldInput) (AdminMoneyPayoutReviewRecord, error)
	ListAdminRiskReviews(ctx context.Context) ([]AdminRiskReviewRecord, error)
	SetAdminRiskReviewStatus(ctx context.Context, input SetAdminRiskReviewStatusInput) (AdminRiskReviewRecord, error)
	ListAdminSupportTickets(ctx context.Context) ([]AdminSupportTicketRecord, error)
	UpdateAdminSupportTicket(ctx context.Context, input UpdateAdminSupportTicketInput) (AdminSupportTicketRecord, error)
}

type CreateAdminUserInput struct {
	UserID       common.ID
	Email        string
	DisplayName  string
	PasswordHash string
	Role         admindomain.Role
}

type AdminUserRecord struct {
	UserID      common.ID
	Email       string
	DisplayName string
	Role        admindomain.Role
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type UpdateAdminUserInput struct {
	UserID      common.ID
	DisplayName string
	Role        admindomain.Role
	IsActive    bool
}

type UpdateAdminProfileInput struct {
	UserID      common.ID
	Email       string
	DisplayName string
}

type AdminRolePermissionsRecord struct {
	Role        admindomain.Role
	Permissions []admindomain.Permission
}

type UpdateAdminRolePermissionsInput struct {
	Role        admindomain.Role
	Permissions []admindomain.Permission
}

type AdminPreferencesRecord struct {
	UserID             common.ID
	Timezone           string
	PhoneNumber        string
	NotifyEmail        bool
	NotifySMS          bool
	AlertVerifications bool
	AlertMoneyRails    bool
	AlertSubscriptions bool
	AlertPromotions    bool
	AlertRisk          bool
	AlertSupport       bool
	DailyDigestTime    string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type UpdateAdminPreferencesInput struct {
	UserID             common.ID
	Timezone           string
	PhoneNumber        string
	NotifyEmail        bool
	NotifySMS          bool
	AlertVerifications bool
	AlertMoneyRails    bool
	AlertSubscriptions bool
	AlertPromotions    bool
	AlertRisk          bool
	AlertSupport       bool
	DailyDigestTime    string
}

type AdminPlatformSettingsRecord struct {
	PlatformName                 string
	SupportEmail                 string
	VerificationSLAHours         int
	PayoutReviewThresholdPesewas int
	MaintenanceMode              bool
	BrandLogoURL                 string
	MarketingFlags               MarketingFlags
	// AIAssistantAddonEnabled is the platform master switch for the paid AI writing
	// add-on: when false it cannot be purchased or renewed anywhere, overriding the
	// per-deployment capability gate.
	AIAssistantAddonEnabled bool
	UpdatedAt               time.Time
}

// MarketingFlags gate whether each not-yet-launched marketing surface is shown.
// All default false during the pre-launch / waitlist period; an owner reveals
// each one from the admin console without a redeploy.
type MarketingFlags struct {
	BrowseStore bool
	Discover    bool
	CreateStore bool
	Pricing     bool
}

type UpdateAdminPlatformSettingsInput struct {
	PlatformName                 string
	SupportEmail                 string
	VerificationSLAHours         int
	PayoutReviewThresholdPesewas int
	MaintenanceMode              bool
	BrandLogoURL                 string
	AIAssistantAddonEnabled      bool
}

// UpdateAdminMarketingFlagsInput is a partial update of the four marketing
// launch flags: only fields whose matching *Set pointer is non-nil are written.
type UpdateAdminMarketingFlagsInput struct {
	BrowseStore *bool
	Discover    *bool
	CreateStore *bool
	Pricing     *bool
}

type AdminUserCredentials struct {
	UserID      common.ID
	Email       string
	DisplayName string
	// LoginLockedUntil is non-nil and in the future when the account is temporarily
	// locked after too many failed password attempts.
	LoginLockedUntil *time.Time
	PasswordHash     string
	Role             admindomain.Role
	IsActive         bool
}

type AdminAuditEventRecord struct {
	AuditEventID common.ID
	ActorUserID  common.ID
	ActorEmail   string
	ActorRole    admindomain.Role
	Action       string
	TargetType   string
	TargetID     string
	TargetLabel  string
	Summary      string
	Severity     admindomain.AuditSeverity
	Metadata     map[string]string
	IPAddress    string
	UserAgent    string
	CreatedAt    time.Time
}

type CreateAdminAuditEventInput struct {
	AuditEventID common.ID
	ActorUserID  common.ID
	ActorRole    admindomain.Role
	Action       string
	TargetType   string
	TargetID     string
	TargetLabel  string
	Summary      string
	Severity     admindomain.AuditSeverity
	Metadata     map[string]string
	IPAddress    string
	UserAgent    string
}

type ListAdminAuditEventsInput struct {
	Limit    int
	Severity admindomain.AuditSeverity
}

type AdminVerificationCaseRecord struct {
	BusinessID            common.ID
	BusinessName          string
	Handle                string
	OwnerName             string
	OwnerEmail            string
	PlanName              string
	PlanCode              string
	VerificationStatus    business.VerificationStatus
	SettlementProvider    string
	SettlementSubaccount  string
	SettlementAccountHint string
	// Ghana Card identity document the business submitted for review (empty when
	// none submitted yet).
	IDCardNumber string
	IDPhotoURL   string
	SubmittedAt  time.Time
	UpdatedAt    time.Time
}

type AdminBusinessVerificationDecisionInput struct {
	BusinessID common.ID
	Status     business.VerificationStatus
}

type AdminBusinessRecord struct {
	BusinessID           common.ID
	Name                 string
	Handle               string
	OwnerName            string
	OwnerEmail           string
	PlanName             string
	PlanCode             string
	VerificationStatus   business.VerificationStatus
	OperationalStatus    business.OperationalStatus
	SettlementSubaccount string
	OrdersCount          int
	GMVMinor             int64
	CommissionMinor      int64
	LastActiveAt         time.Time
	CreatedAt            time.Time
	UpdatedAt            time.Time
	SuspensionReason     string
	SuspendedAt          *time.Time
	SuspendedByAdminUser common.ID
}

type AdminCustomerRecord struct {
	CustomerID         common.ID
	Email              string
	Phone              string
	DisplayName        string
	TenantCount        int
	OrderCount         int
	CustomOrderCount   int
	GMVMinor           int64
	LastBusinessName   string
	LastBusinessHandle string
	LastActiveAt       time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// AdminCustomerExportRecord is the complete picture of one customer's data held
// across the platform, assembled for a subject-access request.
type AdminCustomerExportRecord struct {
	CustomerID   common.ID
	Email        string
	Phone        string
	DisplayName  string
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Businesses   []AdminCustomerExportBusiness
	Orders       []AdminCustomerExportOrder
	Measurements []AdminCustomerExportMeasurement
}

type AdminCustomerExportBusiness struct {
	BusinessName   string
	BusinessHandle string
	FirstSeenAt    time.Time
}

type AdminCustomerExportOrder struct {
	OrderID          common.ID
	BusinessName     string
	DesignTitle      string
	OrderType        string
	Status           string
	AgreedTotalMinor int64
	CreatedAt        time.Time
}

type AdminCustomerExportMeasurement struct {
	OrderID   common.ID
	Source    string
	Values    string // raw JSON object of measurement field → value
	CreatedAt time.Time
}

// AdminCustomerErasureRecord summarises what an erasure touched.
type AdminCustomerErasureRecord struct {
	CustomerID          common.ID
	OrdersRetained      int
	MeasurementsCleared int
	BookingAddresses    int
}

type UpdateAdminBusinessStatusInput struct {
	BusinessID           common.ID
	OperationalStatus    business.OperationalStatus
	SuspensionReason     string
	SuspendedByAdminUser common.ID
}

type AdminPlatformMetricsRecord struct {
	GMVMonthMinor             int64
	PlatformRevenueMonthMinor int64
	ActiveBusinesses          int
	TotalBusinesses           int
	PendingVerifications      int
	SuspendedBusinesses       int
	PaymentHealthBPS          int
	FailedPayments30d         int
	TotalPayments30d          int
	UpdatedAt                 time.Time
}

type AdminMoneyRailsRecord struct {
	WebhookEvents []AdminMoneyWebhookEventRecord
	PayoutReviews []AdminMoneyPayoutReviewRecord
	UpdatedAt     time.Time
}

type AdminMoneyWebhookEventRecord struct {
	ID                string
	ProviderReference string
	BusinessName      string
	Status            string
	Purpose           string
	AmountMinor       int64
	Attempts          int
	ReceivedAt        time.Time
	Note              string
}

type AdminMoneyPayoutReviewRecord struct {
	ID              string
	BusinessName    string
	SubaccountRef   string
	Status          string
	SettlementMinor int64
	CommissionMinor int64
	NextAction      string
	HoldActive      bool
	HoldReason      string
	HoldUpdatedAt   *time.Time
}

type AdminSubscriptionRecord struct {
	SubscriptionID  common.ID
	BusinessID      common.ID
	BusinessName    string
	Handle          string
	OwnerName       string
	OwnerPhone      string
	OwnerEmail      string
	OwnerWhatsApp   string
	PlanCode        string
	PlanName        string
	MonthlyFeeMinor int64
	// BillingCadence is how often this subscription renews: 'monthly'
	// (legacy/back-compat), 'quarterly', or 'yearly'. Quarterly/yearly bill the
	// fixed Pricing-Book renewal figures below instead of the monthly fee.
	BillingCadence          string
	QuarterlyRenewalMinor   int64
	YearlyRenewalMinor      int64
	CommissionBPS           int
	DesignLimit             *int
	DesignCount             int
	Status                  string
	BillingMode             string
	Provider                string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
	// ProviderChannel is the stored Paystack authorization channel ('card',
	// 'mobile_money', 'bank', …). '' means unknown/legacy and is treated as
	// card-like: the recurring sweep still attempts a silent auto-charge.
	// 'mobile_money' flips the subscription to reminder-driven (no silent charge).
	ProviderChannel     string
	CurrentPeriodStart  time.Time
	CurrentPeriodEnd    time.Time
	TrialEndsAt         *time.Time
	GraceEndsAt         *time.Time
	CancelAtPeriodEnd   bool
	CanceledAt          *time.Time
	FailedPaymentCount  int
	LastInvoiceRef      string
	LastPaymentAt       *time.Time
	NextBillingAt       *time.Time
	SignupAt            time.Time
	RenewalAt           *time.Time
	StoreLink           string
	DiscountCode        string
	DiscountInstitution string
	LastActiveAt        time.Time
	OrdersCount         int
	GMVMinor            int64
	CommissionMinor     int64
	UpdatedAt           time.Time
	Events              []AdminSubscriptionEventRecord
	Invoices            []AdminSubscriptionInvoiceRecord
}

type AdminSubscriptionEventRecord struct {
	SubscriptionEventID common.ID
	BusinessID          common.ID
	EventType           string
	Summary             string
	ActorEmail          string
	CreatedAt           time.Time
}

type UpdateAdminSubscriptionInput struct {
	BusinessID              common.ID
	Status                  string
	BillingMode             string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
	// ProviderChannel is the Paystack authorization channel to persist ('card',
	// 'mobile_money', …). Empty leaves the stored channel untouched, so manual
	// status edits do not erase a previously verified channel.
	ProviderChannel string
	Reason          string
	ActorAdminUser  common.ID
}

type AdminSubscriptionInvoiceRecord struct {
	InvoiceID          common.ID
	SubscriptionID     common.ID
	BusinessID         common.ID
	InvoiceRef         string
	Status             string
	BillingMode        string
	Provider           string
	ProviderInvoiceRef string
	PaymentURL         string
	AmountMinor        int64
	Currency           string
	PeriodStart        time.Time
	PeriodEnd          time.Time
	DueAt              time.Time
	PaidAt             *time.Time
	FailedAt           *time.Time
	FailureReason      string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type IssueAdminSubscriptionInvoiceInput struct {
	InvoiceID          common.ID
	BusinessID         common.ID
	InvoiceRef         string
	ProviderInvoiceRef string
	PaymentURL         string
	DueAt              time.Time
	ActorAdminUser     common.ID
	Reason             string
	// AmountMinor is the exact figure to bill for this invoice's period. When
	// zero the repository falls back to the plan's monthly fee (manual/legacy
	// path). The recurring sweep sets it to the cadence renewal figure.
	AmountMinor int64
	// PeriodMonths is how many months this invoice's period covers. When zero
	// the repository defaults to 1 month (manual/legacy path). The recurring
	// sweep sets it to the cadence length (quarterly 3, yearly 12, monthly 1).
	PeriodMonths int
}

type MarkAdminSubscriptionInvoicePaidInput struct {
	InvoiceID      common.ID
	ActorAdminUser common.ID
	Reason         string
}

type MarkAdminSubscriptionInvoiceFailedInput struct {
	InvoiceID      common.ID
	ActorAdminUser common.ID
	Reason         string
}

type RunAdminSubscriptionBillingSweepInput struct {
	ActorAdminUser common.ID
	Reason         string
}

type AdminSubscriptionBillingSweepRecord struct {
	OverdueInvoicesFailed int
	SubscriptionsCanceled int
	BusinessesTouched     int
	RanAt                 time.Time
}

type AdminSubscriptionRecurringSweepRecord struct {
	DueSubscriptions  int
	ChargesAttempted  int
	ChargesPaid       int
	ChargesPending    int
	ChargesFailed     int
	ChargesSkipped    int
	RemindersEnqueued int
	RanAt             time.Time
}

// EnqueueSubscriptionRenewalReminderInput carries everything the outbox row and
// the idempotency log need for one renewal reminder. DedupKey and PeriodKey are
// derived by the caller from the reminder Kind, the subscription, and the
// billing period so the same reminder is never enqueued twice.
type EnqueueSubscriptionRenewalReminderInput struct {
	SubscriptionID     common.ID
	BusinessID         common.ID
	Kind               string
	PeriodKey          string
	DedupKey           string
	Channel            string
	Recipient          string
	PlanName           string
	RenewalAmountMinor int64
	RenewalAt          time.Time
	GraceEndsAt        *time.Time
	RepayURL           string
}

// SubscriptionRenewalReminderResult reports whether a new reminder was enqueued.
// Enqueued is false when the (subscription, period, kind) reminder was already
// recorded — the enqueue is a no-op in that case.
type SubscriptionRenewalReminderResult struct {
	Enqueued bool
}

type AdminPlanRecord struct {
	PlanID                  common.ID
	Code                    string
	Name                    string
	MonthlyFeeMinor         int64
	YearlyFeeMinor          int64
	CommissionBPS           int
	DesignLimit             *int
	Features                map[string]bool
	IsActive                bool
	BusinessCount           int
	ActiveSubscriptionCount int
	EstimatedMRRMinor       int64
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

type CreateAdminPlanInput struct {
	Code            string
	Name            string
	MonthlyFeeMinor int64
	YearlyFeeMinor  int64
	CommissionBPS   int
	DesignLimit     *int
	Features        map[string]bool
}

type UpdateAdminPlanInput struct {
	PlanID          common.ID
	Name            string
	MonthlyFeeMinor int64
	YearlyFeeMinor  int64
	CommissionBPS   int
	DesignLimit     *int
	Features        map[string]bool
	IsActive        bool
}

type ArchiveAdminPlanInput struct {
	PlanID common.ID
}

type AdminPlanEntitlementFeatureRecord struct {
	FeatureKey  string
	Label       string
	Description string
	Category    string
	ValueType   string
	Unit        string
	SortOrder   int
	IsActive    bool
	Values      []AdminPlanEntitlementValueRecord
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type AdminPlanEntitlementValueRecord struct {
	PlanID     common.ID
	PlanCode   string
	Enabled    bool
	LimitValue *int
	UpdatedAt  time.Time
}

type AdminPlanEntitlementValueInput struct {
	PlanID     common.ID
	FeatureKey string
	Enabled    bool
	LimitValue *int
}

type UpdateAdminPlanEntitlementsInput struct {
	ActorAdminUser common.ID
	Values         []AdminPlanEntitlementValueInput
}

type AdminSubscriptionDiscountCodeRecord struct {
	DiscountCodeID      common.ID
	Code                string
	DiscountType        string
	DiscountValue       int
	EligiblePlans       []string
	EligibleCadences    []string
	FirstPurchaseOnly   bool
	MaxRedemptionsTotal *int
	MaxPerAccount       int
	ValidFrom           *time.Time
	ValidUntil          *time.Time
	Active              bool
	OwnerName           string
	BatchLabel          string
	Stackable           bool
	ArchivedAt          *time.Time
	RedemptionCount     int
	AppliedCount        int
	DiscountMinor       int64
	RecentRedemptions   []AdminSubscriptionDiscountRedemptionRecord
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type AdminSubscriptionDiscountRedemptionRecord struct {
	RedemptionID  common.ID
	BusinessID    common.ID
	BusinessName  string
	PlanCode      string
	Cadence       string
	AccountKey    string
	Status        string
	DiscountMinor int64
	CreatedAt     time.Time
	AppliedAt     *time.Time
}

type CreateAdminSubscriptionDiscountCodeInput struct {
	DiscountCodeID      common.ID
	Code                string
	DiscountType        string
	DiscountValue       int
	EligiblePlans       []string
	EligibleCadences    []string
	FirstPurchaseOnly   bool
	MaxRedemptionsTotal *int
	MaxPerAccount       int
	ValidFrom           *time.Time
	ValidUntil          *time.Time
	Active              bool
	OwnerName           string
	BatchLabel          string
	Stackable           bool
	ActorAdminUser      common.ID
}

type UpdateAdminSubscriptionDiscountCodeInput struct {
	DiscountCodeID      common.ID
	Code                string
	DiscountType        string
	DiscountValue       int
	EligiblePlans       []string
	EligibleCadences    []string
	FirstPurchaseOnly   bool
	MaxRedemptionsTotal *int
	MaxPerAccount       int
	ValidFrom           *time.Time
	ValidUntil          *time.Time
	Active              bool
	OwnerName           string
	BatchLabel          string
	Stackable           bool
	ActorAdminUser      common.ID
}

type ArchiveAdminSubscriptionDiscountCodeInput struct {
	DiscountCodeID common.ID
	ActorAdminUser common.ID
}

type AdminPromotionRecord struct {
	PromotionID           common.ID
	BusinessID            *common.ID
	BusinessName          string
	BusinessHandle        string
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	RedemptionCount       int
	DiscountRedeemedMinor int64
	RecentRedemptions     []AdminPromotionRedemptionRecord
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type AdminPromotionRedemptionRecord struct {
	PromotionRedemptionID common.ID
	PromotionID           common.ID
	BusinessID            common.ID
	OrderID               *common.ID
	CustomerID            *common.ID
	CustomerName          string
	DiscountMinor         int64
	Status                string
	RedeemedAt            *time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type CreateAdminPromotionInput struct {
	PromotionID           common.ID
	BusinessID            *common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	ActorAdminUser        common.ID
}

type UpdateAdminPromotionInput struct {
	PromotionID           common.ID
	BusinessID            *common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	ActorAdminUser        common.ID
}

type ArchiveAdminPromotionInput struct {
	PromotionID    common.ID
	ActorAdminUser common.ID
}

type AdminAdCampaignRecord struct {
	CampaignID      common.ID
	BusinessID      common.ID
	BusinessName    string
	BusinessHandle  string
	PlacementType   string
	TargetRefID     string
	TargetLabel     string
	Headline        string
	Description     string
	Status          string
	PricingModel    string
	BudgetMinor     int64
	SpendMinor      int64
	DailyCapMinor   *int64
	StartsAt        time.Time
	EndsAt          time.Time
	ImpressionCount int
	ClickCount      int
	ClickRateBPS    int
	ReviewNote      string
	RecentPayments  []AdminAdCampaignPaymentRecord
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type AdminAdCampaignPaymentRecord struct {
	PaymentID         common.ID
	CampaignID        common.ID
	BusinessID        common.ID
	Provider          string
	ProviderReference string
	PaymentURL        string
	AmountMinor       int64
	Currency          string
	Status            string
	PaidAt            *time.Time
	FailedAt          *time.Time
	FailureReason     string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type AdminAdCampaignPaymentIntentRecord struct {
	CampaignID   common.ID
	BusinessID   common.ID
	BusinessName string
	OwnerEmail   string
	Headline     string
	BudgetMinor  int64
	PaidMinor    int64
	DueMinor     int64
	OpenPayment  *AdminAdCampaignPaymentRecord
}

type CreateAdminAdCampaignInput struct {
	CampaignID     common.ID
	BusinessID     common.ID
	PlacementType  string
	TargetRefID    string
	Headline       string
	Description    string
	Status         string
	PricingModel   string
	BudgetMinor    int64
	DailyCapMinor  *int64
	StartsAt       time.Time
	EndsAt         time.Time
	ReviewNote     string
	ActorAdminUser common.ID
}

type UpdateAdminAdCampaignInput struct {
	CampaignID     common.ID
	BusinessID     common.ID
	PlacementType  string
	TargetRefID    string
	Headline       string
	Description    string
	Status         string
	PricingModel   string
	BudgetMinor    int64
	DailyCapMinor  *int64
	StartsAt       time.Time
	EndsAt         time.Time
	ReviewNote     string
	ActorAdminUser common.ID
}

type ArchiveAdminAdCampaignInput struct {
	CampaignID     common.ID
	ActorAdminUser common.ID
}

type CreateAdminAdCampaignPaymentInput struct {
	PaymentID         common.ID
	CampaignID        common.ID
	BusinessID        common.ID
	ProviderReference string
	PaymentURL        string
	AmountMinor       int64
	Currency          string
	ActorAdminUser    common.ID
}

type AdminAffiliateRecord struct {
	AffiliateID      common.ID
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type CreateAdminAffiliateInput struct {
	AffiliateID      common.ID
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	ActorAdminUser   common.ID
}

type UpdateAdminAffiliateInput struct {
	AffiliateID      common.ID
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	ActorAdminUser   common.ID
}

type ArchiveAdminAffiliateInput struct {
	AffiliateID    common.ID
	ActorAdminUser common.ID
}

type AdminAffiliateAttributionRecord struct {
	AffiliateID             common.ID
	Code                    string
	DisplayName             string
	ClickCount              int64
	ConversionCount         int64
	PendingConversionCount  int64
	ApprovedConversionCount int64
	SettledConversionCount  int64
	ReversedConversionCount int64
	GrossMinor              int64
	CommissionMinor         int64
	RecentConversions       []AdminAffiliateConversionRecord
	RecentPayouts           []AdminAffiliatePayoutRecord
	LastActivityAt          *time.Time
}

type AdminAffiliateConversionRecord struct {
	ConversionID     common.ID
	AffiliateID      common.ID
	BusinessID       common.ID
	BusinessName     string
	OrderID          common.ID
	GrossMinor       int64
	CommissionMinor  int64
	Status           string
	AttributionModel string
	HoldUntil        *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type UpdateAdminAffiliateConversionStatusInput struct {
	ConversionID   common.ID
	Status         string
	Reason         string
	ActorAdminUser common.ID
}

type AdminAffiliatePayoutRecord struct {
	PayoutBatchID   common.ID
	AffiliateID     common.ID
	DisplayName     string
	PayoutMode      string
	PayoutReference string
	ConversionCount int
	GrossMinor      int64
	CommissionMinor int64
	Status          string
	Notes           string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type CreateAdminAffiliatePayoutInput struct {
	PayoutBatchID   common.ID
	AffiliateID     common.ID
	PayoutReference string
	Notes           string
	ActorAdminUser  common.ID
}

type AdminReferralProgrammeRecord struct {
	ProgrammeID             common.ID
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	RecentCodes             []AdminReferralCodeRecord
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

type AdminReferralCodeRecord struct {
	ReferralCodeID  common.ID
	ProgrammeID     common.ID
	BusinessID      *common.ID
	BusinessName    string
	BusinessHandle  string
	OwnerType       string
	OwnerBusinessID *common.ID
	OwnerCustomerID *common.ID
	OwnerLabel      string
	Code            string
	Status          string
	ReferralCount   int
	QualifiedCount  int
	RewardedCount   int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type CreateAdminReferralProgrammeInput struct {
	ProgrammeID             common.ID
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	ActorAdminUser          common.ID
}

type UpdateAdminReferralProgrammeInput struct {
	ProgrammeID             common.ID
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	ActorAdminUser          common.ID
}

type ArchiveAdminReferralProgrammeInput struct {
	ProgrammeID    common.ID
	ActorAdminUser common.ID
}

type CreateAdminReferralCodeInput struct {
	ReferralCodeID common.ID
	ProgrammeID    common.ID
	BusinessID     *common.ID
	OwnerType      string
	Code           string
	Status         string
	ActorAdminUser common.ID
}

type IssueAdminReferralRewardsInput struct {
	ActorAdminUser common.ID
	Limit          int
}

type AdminReferralRewardIssueRecord struct {
	ReferralCount         int
	RewardCount           int
	VoucherCount          int
	CommissionRebateCount int
	TotalRewardMinor      int64
	IssuedAt              time.Time
}

type AdminMoneyReplayRequestRecord struct {
	ReplayRequestID   common.ID
	ProviderReference string
	PaymentID         common.ID
	BusinessName      string
	Reason            string
	Status            string
	CreatedAt         time.Time
}

type QueueAdminMoneyReplayInput struct {
	ReplayRequestID   common.ID
	ProviderReference string
	RequestedByUserID common.ID
	Reason            string
}

type AdminMoneyReversalRecord struct {
	PaymentID                common.ID
	ProviderReference        string
	BusinessID               common.ID
	BusinessName             string
	OrderID                  *common.ID
	PaymentReversed          bool
	PromotionRedemptionCount int
	AffiliateConversionCount int
	ReferralCount            int
	ReferralRewardCount      int
	GeneratedPromotionCount  int
	Reason                   string
	ReversedAt               time.Time
}

type ReverseAdminMoneyPaymentInput struct {
	ProviderReference string
	ActorAdminUser    common.ID
	Reason            string
}

type SetAdminSettlementReviewHoldInput struct {
	BusinessID     common.ID
	Hold           bool
	Reason         string
	ActorAdminUser common.ID
}

type AdminRiskReviewRecord struct {
	ReviewKey    string
	BusinessID   common.ID
	Title        string
	BusinessName string
	Level        string
	Reason       string
	Owner        string
	Status       string
	UpdatedAt    time.Time
}

type SetAdminRiskReviewStatusInput struct {
	ReviewKey      string
	Status         string
	Reason         string
	ActorAdminUser common.ID
}

type AdminSupportTicketRecord struct {
	TicketKey           string
	BusinessID          common.ID
	Subject             string
	BusinessName        string
	Priority            string
	Summary             string
	Category            string
	Status              string
	AssignedAdminUserID common.ID
	AssignedAdminEmail  string
	AssignedAdminName   string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type UpdateAdminSupportTicketInput struct {
	TicketKey      string
	Status         string
	Assignment     string
	Note           string
	ActorAdminUser common.ID
}

type AdminSessionRepository interface {
	Create(ctx context.Context, input CreateAdminSessionInput) error
	FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (AdminSessionWithUser, error)
	Revoke(ctx context.Context, sessionID common.ID) error
}

type CreateAdminSessionInput struct {
	SessionID        common.ID
	AdminUserID      common.ID
	RefreshTokenHash string
	UserAgent        string
	IPAddress        string
	ExpiresAt        time.Time
}

type AdminSessionWithUser struct {
	SessionID    common.ID
	AdminUserID  common.ID
	Email        string
	DisplayName  string
	Role         admindomain.Role
	UserIsActive bool
	Revoked      bool
	ExpiresAt    time.Time
}

type AdminTokenIssuer interface {
	IssueAdminAccessToken(ctx context.Context, input AdminAccessTokenInput) (string, error)
}

type AdminTokenVerifier interface {
	VerifyAdminAccessToken(ctx context.Context, token string) (VerifiedAdminAccessToken, error)
}

type AdminAccessTokenInput struct {
	Subject   common.ID
	Role      admindomain.Role
	IssuedAt  time.Time
	ExpiresAt time.Time
}

type VerifiedAdminAccessToken struct {
	Subject common.ID
	Role    admindomain.Role
}
