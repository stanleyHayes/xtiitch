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
	UpdateAdminBusinessStatus(ctx context.Context, input UpdateAdminBusinessStatusInput) (AdminBusinessRecord, error)
	GetAdminPlatformMetrics(ctx context.Context) (AdminPlatformMetricsRecord, error)
	GetAdminMoneyRails(ctx context.Context) (AdminMoneyRailsRecord, error)
	ListAdminSubscriptions(ctx context.Context) ([]AdminSubscriptionRecord, error)
	UpdateAdminSubscription(ctx context.Context, input UpdateAdminSubscriptionInput) (AdminSubscriptionRecord, error)
	ListAdminPlans(ctx context.Context) ([]AdminPlanRecord, error)
	CreateAdminPlan(ctx context.Context, input CreateAdminPlanInput) (AdminPlanRecord, error)
	UpdateAdminPlan(ctx context.Context, input UpdateAdminPlanInput) (AdminPlanRecord, error)
	ArchiveAdminPlan(ctx context.Context, input ArchiveAdminPlanInput) (AdminPlanRecord, error)
	ListAdminPromotions(ctx context.Context) ([]AdminPromotionRecord, error)
	CreateAdminPromotion(ctx context.Context, input CreateAdminPromotionInput) (AdminPromotionRecord, error)
	UpdateAdminPromotion(ctx context.Context, input UpdateAdminPromotionInput) (AdminPromotionRecord, error)
	ArchiveAdminPromotion(ctx context.Context, input ArchiveAdminPromotionInput) (AdminPromotionRecord, error)
	QueueAdminMoneyReplay(ctx context.Context, input QueueAdminMoneyReplayInput) (AdminMoneyReplayRequestRecord, error)
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
	UpdatedAt                    time.Time
}

type UpdateAdminPlatformSettingsInput struct {
	PlatformName                 string
	SupportEmail                 string
	VerificationSLAHours         int
	PayoutReviewThresholdPesewas int
	MaintenanceMode              bool
}

type AdminUserCredentials struct {
	UserID       common.ID
	Email        string
	DisplayName  string
	PasswordHash string
	Role         admindomain.Role
	IsActive     bool
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
	SubmittedAt           time.Time
	UpdatedAt             time.Time
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
	SubscriptionID          common.ID
	BusinessID              common.ID
	BusinessName            string
	Handle                  string
	OwnerEmail              string
	PlanCode                string
	PlanName                string
	MonthlyFeeMinor         int64
	CommissionBPS           int
	DesignLimit             *int
	Status                  string
	BillingMode             string
	Provider                string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
	CurrentPeriodStart      time.Time
	CurrentPeriodEnd        time.Time
	TrialEndsAt             *time.Time
	GraceEndsAt             *time.Time
	CancelAtPeriodEnd       bool
	CanceledAt              *time.Time
	FailedPaymentCount      int
	LastInvoiceRef          string
	LastPaymentAt           *time.Time
	NextBillingAt           *time.Time
	OrdersCount             int
	GMVMinor                int64
	CommissionMinor         int64
	UpdatedAt               time.Time
	Events                  []AdminSubscriptionEventRecord
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
	BusinessID     common.ID
	Status         string
	BillingMode    string
	Reason         string
	ActorAdminUser common.ID
}

type AdminPlanRecord struct {
	PlanID                  common.ID
	Code                    string
	Name                    string
	MonthlyFeeMinor         int64
	CommissionBPS           int
	DesignLimit             *int
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
	CommissionBPS   int
	DesignLimit     *int
}

type UpdateAdminPlanInput struct {
	PlanID          common.ID
	Name            string
	MonthlyFeeMinor int64
	CommissionBPS   int
	DesignLimit     *int
	IsActive        bool
}

type ArchiveAdminPlanInput struct {
	PlanID common.ID
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
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	RedemptionCount       int
	DiscountRedeemedMinor int64
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
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	ActorAdminUser        common.ID
}

type ArchiveAdminPromotionInput struct {
	PromotionID    common.ID
	ActorAdminUser common.ID
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
