package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
