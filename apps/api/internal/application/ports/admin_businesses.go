package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
	RunAdminSubscriptionBillingSweep(
		ctx context.Context,
		input RunAdminSubscriptionBillingSweepInput,
	) (AdminSubscriptionBillingSweepRecord, error)
	// EnqueueSubscriptionRenewalReminder writes a renewal-reminder intent to the
	// notification outbox (WhatsApp) alongside a dedup log row in one transaction,
	// so each (subscription, period, kind) reminder is enqueued at most once. The
	// result reports whether a new reminder was enqueued (false = already sent).
	EnqueueSubscriptionRenewalReminder(
		ctx context.Context,
		input EnqueueSubscriptionRenewalReminderInput,
	) (SubscriptionRenewalReminderResult, error)
	ListAdminPlans(ctx context.Context) ([]AdminPlanRecord, error)
	CreateAdminPlan(ctx context.Context, input CreateAdminPlanInput) (AdminPlanRecord, error)
	UpdateAdminPlan(ctx context.Context, input UpdateAdminPlanInput) (AdminPlanRecord, error)
	ArchiveAdminPlan(ctx context.Context, input ArchiveAdminPlanInput) (AdminPlanRecord, error)
	ListAdminPlanEntitlements(ctx context.Context) ([]AdminPlanEntitlementFeatureRecord, error)
	UpdateAdminPlanEntitlements(ctx context.Context, input UpdateAdminPlanEntitlementsInput) ([]AdminPlanEntitlementFeatureRecord, error)
	ListAdminSubscriptionDiscountCodes(ctx context.Context) ([]AdminSubscriptionDiscountCodeRecord, error)
	CreateAdminSubscriptionDiscountCode(
		ctx context.Context,
		input CreateAdminSubscriptionDiscountCodeInput,
	) (AdminSubscriptionDiscountCodeRecord, error)
	UpdateAdminSubscriptionDiscountCode(
		ctx context.Context,
		input UpdateAdminSubscriptionDiscountCodeInput,
	) (AdminSubscriptionDiscountCodeRecord, error)
	ArchiveAdminSubscriptionDiscountCode(
		ctx context.Context,
		input ArchiveAdminSubscriptionDiscountCodeInput,
	) (AdminSubscriptionDiscountCodeRecord, error)
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
	UpdateAdminAffiliateConversionStatus(
		ctx context.Context,
		input UpdateAdminAffiliateConversionStatusInput,
	) (AdminAffiliateConversionRecord, error)
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
