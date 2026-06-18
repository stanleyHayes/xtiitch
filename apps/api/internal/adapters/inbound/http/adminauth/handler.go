package adminauthhttp

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service interface {
	Login(ctx context.Context, command adminauthapp.LoginCommand) (adminauthapp.AuthResult, error)
	Refresh(ctx context.Context, command adminauthapp.RefreshCommand) (adminauthapp.AuthResult, error)
	Logout(ctx context.Context, command adminauthapp.LogoutCommand) error
	Me(ctx context.Context, adminUserID common.ID) (ports.AdminUserRecord, error)
	GetProfileSettings(ctx context.Context, adminUserID common.ID) (adminauthapp.ProfileSettingsResult, error)
	UpdateProfile(ctx context.Context, command adminauthapp.UpdateProfileCommand) (ports.AdminUserRecord, error)
	UpdatePreferences(ctx context.Context, command adminauthapp.UpdatePreferencesCommand) (ports.AdminPreferencesRecord, error)
	GetPlatformSettings(ctx context.Context) (ports.AdminPlatformSettingsRecord, error)
	UpdatePlatformSettings(ctx context.Context, command adminauthapp.UpdatePlatformSettingsCommand) (ports.AdminPlatformSettingsRecord, error)
	ListBusinessVerifications(ctx context.Context, command adminauthapp.ListBusinessVerificationsCommand) ([]ports.AdminVerificationCaseRecord, error)
	DecideBusinessVerification(ctx context.Context, command adminauthapp.DecideBusinessVerificationCommand) (ports.AdminVerificationCaseRecord, error)
	ListBusinesses(ctx context.Context, command adminauthapp.ListBusinessesCommand) ([]ports.AdminBusinessRecord, error)
	UpdateBusinessStatus(ctx context.Context, command adminauthapp.UpdateBusinessStatusCommand) (ports.AdminBusinessRecord, error)
	GetPlatformMetrics(ctx context.Context, command adminauthapp.GetPlatformMetricsCommand) (ports.AdminPlatformMetricsRecord, error)
	GetMoneyRails(ctx context.Context, command adminauthapp.GetMoneyRailsCommand) (ports.AdminMoneyRailsRecord, error)
	ListSubscriptions(ctx context.Context, command adminauthapp.ListSubscriptionsCommand) ([]ports.AdminSubscriptionRecord, error)
	UpdateSubscription(ctx context.Context, command adminauthapp.UpdateSubscriptionCommand) (ports.AdminSubscriptionRecord, error)
	IssueSubscriptionInvoice(ctx context.Context, command adminauthapp.IssueSubscriptionInvoiceCommand) (ports.AdminSubscriptionRecord, error)
	MarkSubscriptionInvoicePaid(ctx context.Context, command adminauthapp.MarkSubscriptionInvoicePaidCommand) (ports.AdminSubscriptionRecord, error)
	MarkSubscriptionInvoiceFailed(ctx context.Context, command adminauthapp.MarkSubscriptionInvoiceFailedCommand) (ports.AdminSubscriptionRecord, error)
	RunSubscriptionBillingSweep(ctx context.Context, command adminauthapp.RunSubscriptionBillingSweepCommand) (ports.AdminSubscriptionBillingSweepRecord, error)
	ListPlans(ctx context.Context, command adminauthapp.ListPlansCommand) ([]ports.AdminPlanRecord, error)
	CreatePlan(ctx context.Context, command adminauthapp.CreatePlanCommand) (ports.AdminPlanRecord, error)
	UpdatePlan(ctx context.Context, command adminauthapp.UpdatePlanCommand) (ports.AdminPlanRecord, error)
	ArchivePlan(ctx context.Context, command adminauthapp.ArchivePlanCommand) (ports.AdminPlanRecord, error)
	ListPromotions(ctx context.Context, command adminauthapp.ListPromotionsCommand) ([]ports.AdminPromotionRecord, error)
	CreatePromotion(ctx context.Context, command adminauthapp.CreatePromotionCommand) (ports.AdminPromotionRecord, error)
	UpdatePromotion(ctx context.Context, command adminauthapp.UpdatePromotionCommand) (ports.AdminPromotionRecord, error)
	ArchivePromotion(ctx context.Context, command adminauthapp.ArchivePromotionCommand) (ports.AdminPromotionRecord, error)
	ListAdCampaigns(ctx context.Context, command adminauthapp.ListAdCampaignsCommand) ([]ports.AdminAdCampaignRecord, error)
	CreateAdCampaign(ctx context.Context, command adminauthapp.CreateAdCampaignCommand) (ports.AdminAdCampaignRecord, error)
	UpdateAdCampaign(ctx context.Context, command adminauthapp.UpdateAdCampaignCommand) (ports.AdminAdCampaignRecord, error)
	ArchiveAdCampaign(ctx context.Context, command adminauthapp.ArchiveAdCampaignCommand) (ports.AdminAdCampaignRecord, error)
	CollectAdCampaignPayment(ctx context.Context, command adminauthapp.CollectAdCampaignPaymentCommand) (adminauthapp.AdCampaignPaymentResult, error)
	ListAffiliates(ctx context.Context, command adminauthapp.ListAffiliatesCommand) ([]ports.AdminAffiliateRecord, error)
	ListAffiliateAttribution(ctx context.Context, command adminauthapp.ListAffiliateAttributionCommand) ([]ports.AdminAffiliateAttributionRecord, error)
	UpdateAffiliateConversionStatus(ctx context.Context, command adminauthapp.UpdateAffiliateConversionStatusCommand) (ports.AdminAffiliateConversionRecord, error)
	CreateAffiliatePayout(ctx context.Context, command adminauthapp.CreateAffiliatePayoutCommand) (ports.AdminAffiliatePayoutRecord, error)
	CreateAffiliate(ctx context.Context, command adminauthapp.CreateAffiliateCommand) (ports.AdminAffiliateRecord, error)
	UpdateAffiliate(ctx context.Context, command adminauthapp.UpdateAffiliateCommand) (ports.AdminAffiliateRecord, error)
	ArchiveAffiliate(ctx context.Context, command adminauthapp.ArchiveAffiliateCommand) (ports.AdminAffiliateRecord, error)
	ListReferralProgrammes(ctx context.Context, command adminauthapp.ListReferralProgrammesCommand) ([]ports.AdminReferralProgrammeRecord, error)
	CreateReferralProgramme(ctx context.Context, command adminauthapp.CreateReferralProgrammeCommand) (ports.AdminReferralProgrammeRecord, error)
	UpdateReferralProgramme(ctx context.Context, command adminauthapp.UpdateReferralProgrammeCommand) (ports.AdminReferralProgrammeRecord, error)
	ArchiveReferralProgramme(ctx context.Context, command adminauthapp.ArchiveReferralProgrammeCommand) (ports.AdminReferralProgrammeRecord, error)
	CreateReferralCode(ctx context.Context, command adminauthapp.CreateReferralCodeCommand) (ports.AdminReferralCodeRecord, error)
	IssueReferralRewards(ctx context.Context, command adminauthapp.IssueReferralRewardsCommand) (ports.AdminReferralRewardIssueRecord, error)
	QueueMoneyReplay(ctx context.Context, command adminauthapp.QueueMoneyReplayCommand) (ports.AdminMoneyReplayRequestRecord, error)
	ReverseMoneyPayment(ctx context.Context, command adminauthapp.ReverseMoneyPaymentCommand) (ports.AdminMoneyReversalRecord, error)
	SetSettlementReviewHold(ctx context.Context, command adminauthapp.SetSettlementReviewHoldCommand) (ports.AdminMoneyPayoutReviewRecord, error)
	ListRiskReviews(ctx context.Context, command adminauthapp.ListRiskReviewsCommand) ([]ports.AdminRiskReviewRecord, error)
	SetRiskReviewStatus(ctx context.Context, command adminauthapp.SetRiskReviewStatusCommand) (ports.AdminRiskReviewRecord, error)
	ListSupportTickets(ctx context.Context, command adminauthapp.ListSupportTicketsCommand) ([]ports.AdminSupportTicketRecord, error)
	UpdateSupportTicket(ctx context.Context, command adminauthapp.UpdateSupportTicketCommand) (ports.AdminSupportTicketRecord, error)
	ListAuditEvents(ctx context.Context, command adminauthapp.ListAuditEventsCommand) ([]ports.AdminAuditEventRecord, error)
	ListRolePermissions(ctx context.Context) ([]ports.AdminRolePermissionsRecord, error)
	UpdateRolePermissions(ctx context.Context, command adminauthapp.UpdateRolePermissionsCommand) (ports.AdminRolePermissionsRecord, error)
	ListUsers(ctx context.Context, command adminauthapp.ListUsersCommand) ([]ports.AdminUserRecord, error)
	CreateUser(ctx context.Context, command adminauthapp.CreateUserCommand) (ports.AdminUserRecord, error)
	UpdateUser(ctx context.Context, command adminauthapp.UpdateUserCommand) (ports.AdminUserRecord, error)
}

type Handler struct {
	service       Service
	authenticator Authenticator
}

func NewHandler(service Service, authenticator Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/admin/auth/login", handler.login)
	router.Post("/admin/auth/refresh", handler.refresh)
	router.Post("/admin/auth/logout", handler.logout)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/admin/auth/me", handler.me)
		protected.Get("/admin/settings/profile", handler.profileSettings)
		protected.Patch("/admin/settings/profile", handler.updateProfile)
		protected.Patch("/admin/settings/preferences", handler.updatePreferences)
		protected.Get("/admin/settings/platform", handler.platformSettings)
		protected.Patch("/admin/settings/platform", handler.updatePlatformSettings)
		protected.Get("/admin/business-verifications", handler.businessVerifications)
		protected.Post("/admin/business-verifications/{id}/decision", handler.decideBusinessVerification)
		protected.Get("/admin/platform-metrics", handler.platformMetrics)
		protected.Get("/admin/money-rails", handler.moneyRails)
		protected.Get("/admin/subscriptions", handler.subscriptions)
		protected.Post("/admin/subscriptions/billing-sweeps", handler.runSubscriptionBillingSweep)
		protected.Patch("/admin/subscriptions/businesses/{id}", handler.updateSubscription)
		protected.Post("/admin/subscriptions/businesses/{id}/invoices", handler.issueSubscriptionInvoice)
		protected.Post("/admin/subscriptions/invoices/{id}/paid", handler.markSubscriptionInvoicePaid)
		protected.Post("/admin/subscriptions/invoices/{id}/failed", handler.markSubscriptionInvoiceFailed)
		protected.Get("/admin/plans", handler.plans)
		protected.Post("/admin/plans", handler.createPlan)
		protected.Patch("/admin/plans/{id}", handler.updatePlan)
		protected.Post("/admin/plans/{id}/archive", handler.archivePlan)
		protected.Get("/admin/promotions", handler.promotions)
		protected.Post("/admin/promotions", handler.createPromotion)
		protected.Patch("/admin/promotions/{id}", handler.updatePromotion)
		protected.Post("/admin/promotions/{id}/archive", handler.archivePromotion)
		protected.Get("/admin/ad-campaigns", handler.adCampaigns)
		protected.Post("/admin/ad-campaigns", handler.createAdCampaign)
		protected.Patch("/admin/ad-campaigns/{id}", handler.updateAdCampaign)
		protected.Post("/admin/ad-campaigns/{id}/payments", handler.collectAdCampaignPayment)
		protected.Post("/admin/ad-campaigns/{id}/archive", handler.archiveAdCampaign)
		protected.Get("/admin/affiliates", handler.affiliates)
		protected.Get("/admin/affiliate-attribution", handler.affiliateAttribution)
		protected.Patch("/admin/affiliate-conversions/{id}/status", handler.updateAffiliateConversionStatus)
		protected.Post("/admin/affiliates/{id}/payouts", handler.createAffiliatePayout)
		protected.Post("/admin/affiliates", handler.createAffiliate)
		protected.Patch("/admin/affiliates/{id}", handler.updateAffiliate)
		protected.Post("/admin/affiliates/{id}/archive", handler.archiveAffiliate)
		protected.Get("/admin/referral-programmes", handler.referralProgrammes)
		protected.Post("/admin/referral-programmes", handler.createReferralProgramme)
		protected.Patch("/admin/referral-programmes/{id}", handler.updateReferralProgramme)
		protected.Post("/admin/referral-programmes/{id}/codes", handler.createReferralCode)
		protected.Post("/admin/referral-programmes/{id}/archive", handler.archiveReferralProgramme)
		protected.Post("/admin/referral-rewards/issue", handler.issueReferralRewards)
		protected.Post("/admin/money-rails/replay-requests", handler.queueMoneyReplay)
		protected.Post("/admin/money-rails/payment-reversals", handler.reverseMoneyPayment)
		protected.Patch("/admin/money-rails/businesses/{id}/settlement-hold", handler.setSettlementReviewHold)
		protected.Get("/admin/risk-reviews", handler.riskReviews)
		protected.Patch("/admin/risk-reviews/{key}", handler.updateRiskReviewStatus)
		protected.Get("/admin/support-tickets", handler.supportTickets)
		protected.Patch("/admin/support-tickets/{key}", handler.updateSupportTicket)
		protected.Get("/admin/businesses", handler.businesses)
		protected.Patch("/admin/businesses/{id}/status", handler.updateBusinessStatus)
		protected.Get("/admin/audit-events", handler.auditEvents)
		protected.Get("/admin/exports/{dataset}.csv", handler.exportDatasetCSV)
		protected.Get("/admin/roles", handler.roles)
		protected.Patch("/admin/roles/{role}", handler.updateRolePermissions)
		protected.Get("/admin/users", handler.listUsers)
		protected.Post("/admin/users", handler.createUser)
		protected.Patch("/admin/users/{id}", handler.updateUser)
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type createUserRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

type updateUserRequest struct {
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
}

type updateRolePermissionsRequest struct {
	Permissions []string `json:"permissions"`
}

type updateProfileRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

type updatePreferencesRequest struct {
	Timezone           string `json:"timezone"`
	PhoneNumber        string `json:"phone_number"`
	NotifyEmail        bool   `json:"notify_email"`
	NotifySMS          bool   `json:"notify_sms"`
	AlertVerifications bool   `json:"alert_verifications"`
	AlertMoneyRails    bool   `json:"alert_money_rails"`
	AlertSubscriptions bool   `json:"alert_subscriptions"`
	AlertPromotions    bool   `json:"alert_promotions"`
	AlertRisk          bool   `json:"alert_risk"`
	AlertSupport       bool   `json:"alert_support"`
	DailyDigestTime    string `json:"daily_digest_time"`
}

type updatePlatformSettingsRequest struct {
	PlatformName                 string `json:"platform_name"`
	SupportEmail                 string `json:"support_email"`
	VerificationSLAHours         int    `json:"verification_sla_hours"`
	PayoutReviewThresholdPesewas int    `json:"payout_review_threshold_pesewas"`
	MaintenanceMode              bool   `json:"maintenance_mode"`
}

type businessVerificationDecisionRequest struct {
	Decision string `json:"decision"`
	Note     string `json:"note"`
}

type updateBusinessStatusRequest struct {
	OperationalStatus string `json:"operational_status"`
	Reason            string `json:"reason"`
}

type queueMoneyReplayRequest struct {
	ProviderReference string `json:"provider_reference"`
	Reason            string `json:"reason"`
}

type reverseMoneyPaymentRequest struct {
	ProviderReference string `json:"provider_reference"`
	Reason            string `json:"reason"`
}

type settlementReviewHoldRequest struct {
	Hold   bool   `json:"hold"`
	Reason string `json:"reason"`
}

type subscriptionUpdateRequest struct {
	Status                  string `json:"status"`
	BillingMode             string `json:"billing_mode"`
	ProviderCustomerRef     string `json:"provider_customer_ref"`
	ProviderSubscriptionRef string `json:"provider_subscription_ref"`
	Reason                  string `json:"reason"`
}

type subscriptionInvoiceIssueRequest struct {
	ProviderInvoiceRef string     `json:"provider_invoice_ref"`
	PaymentURL         string     `json:"payment_url"`
	DueAt              *time.Time `json:"due_at"`
	Reason             string     `json:"reason"`
}

type subscriptionInvoiceDecisionRequest struct {
	Reason string `json:"reason"`
}

type subscriptionBillingSweepRequest struct {
	Reason string `json:"reason"`
}

type planCreateRequest struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	MonthlyFeeMinor int64  `json:"monthly_fee_minor"`
	CommissionBPS   int    `json:"commission_bps"`
	DesignLimit     *int   `json:"design_limit"`
}

type planUpdateRequest struct {
	Name            string `json:"name"`
	MonthlyFeeMinor int64  `json:"monthly_fee_minor"`
	CommissionBPS   int    `json:"commission_bps"`
	DesignLimit     *int   `json:"design_limit"`
	IsActive        bool   `json:"is_active"`
}

type planArchiveRequest struct {
	Reason string `json:"reason"`
}

type promotionUpsertRequest struct {
	BusinessID            string     `json:"business_id"`
	TargetCollectionID    string     `json:"target_collection_id"`
	TargetDesignID        string     `json:"target_design_id"`
	Code                  string     `json:"code"`
	Title                 string     `json:"title"`
	Description           string     `json:"description"`
	DiscountType          string     `json:"discount_type"`
	DiscountValue         int64      `json:"discount_value"`
	MaxDiscountMinor      *int64     `json:"max_discount_minor"`
	MinSpendMinor         int64      `json:"min_spend_minor"`
	UsageLimitGlobal      *int       `json:"usage_limit_global"`
	UsageLimitPerCustomer *int       `json:"usage_limit_per_customer"`
	FundingSource         string     `json:"funding_source"`
	Scope                 string     `json:"scope"`
	Status                string     `json:"status"`
	StartsAt              *time.Time `json:"starts_at"`
	EndsAt                *time.Time `json:"ends_at"`
}

type promotionArchiveRequest struct {
	Reason string `json:"reason"`
}

type adCampaignUpsertRequest struct {
	BusinessID    string     `json:"business_id"`
	PlacementType string     `json:"placement_type"`
	TargetRefID   string     `json:"target_ref_id"`
	Headline      string     `json:"headline"`
	Description   string     `json:"description"`
	Status        string     `json:"status"`
	PricingModel  string     `json:"pricing_model"`
	BudgetMinor   int64      `json:"budget_minor"`
	DailyCapMinor *int64     `json:"daily_cap_minor"`
	StartsAt      *time.Time `json:"starts_at"`
	EndsAt        *time.Time `json:"ends_at"`
	ReviewNote    string     `json:"review_note"`
}

type adCampaignArchiveRequest struct {
	Reason string `json:"reason"`
}

type adCampaignPaymentRequest struct {
	CustomerEmail string `json:"customer_email"`
}

type affiliateUpsertRequest struct {
	EntityType       string `json:"entity_type"`
	Code             string `json:"code"`
	DisplayName      string `json:"display_name"`
	ContactName      string `json:"contact_name"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	WebsiteURL       string `json:"website_url"`
	CommissionModel  string `json:"commission_model"`
	CommissionRate   int64  `json:"commission_rate"`
	CookieWindowDays int    `json:"cookie_window_days"`
	PayoutMode       string `json:"payout_mode"`
	PayoutReference  string `json:"payout_reference"`
	Status           string `json:"status"`
	Notes            string `json:"notes"`
}

type affiliateArchiveRequest struct {
	Reason string `json:"reason"`
}

type affiliateConversionStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type affiliatePayoutRequest struct {
	PayoutReference string `json:"payout_reference"`
	Notes           string `json:"notes"`
}

type referralProgrammeUpsertRequest struct {
	Title                   string     `json:"title"`
	CodePrefix              string     `json:"code_prefix"`
	Audience                string     `json:"audience"`
	ReferrerRewardKind      string     `json:"referrer_reward_kind"`
	RefereeRewardKind       string     `json:"referee_reward_kind"`
	RewardType              string     `json:"reward_type"`
	RewardValue             int64      `json:"reward_value"`
	MaxRewardMinor          *int64     `json:"max_reward_minor"`
	QualifyingOrderMinMinor int64      `json:"qualifying_order_min_minor"`
	RewardHoldDays          int        `json:"reward_hold_days"`
	Status                  string     `json:"status"`
	StartsAt                *time.Time `json:"starts_at"`
	EndsAt                  *time.Time `json:"ends_at"`
	Notes                   string     `json:"notes"`
}

type referralProgrammeArchiveRequest struct {
	Reason string `json:"reason"`
}

type referralCodeCreateRequest struct {
	BusinessID string `json:"business_id"`
	OwnerType  string `json:"owner_type"`
	Code       string `json:"code"`
	Status     string `json:"status"`
}

type referralRewardIssueRequest struct {
	Limit int `json:"limit"`
}

type riskReviewStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type supportTicketUpdateRequest struct {
	Status     string `json:"status"`
	Assignment string `json:"assignment"`
	Note       string `json:"note"`
}

type adminUserResponse struct {
	AdminUserID string `json:"admin_user_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
	CreatedAt   string `json:"created_at,omitempty"`
	UpdatedAt   string `json:"updated_at,omitempty"`
}

type roleResponse struct {
	Role        string   `json:"role"`
	Label       string   `json:"label"`
	Permissions []string `json:"permissions"`
}

type permissionResponse struct {
	Permission string `json:"permission"`
	Label      string `json:"label"`
}

type adminPreferencesResponse struct {
	Timezone           string `json:"timezone"`
	PhoneNumber        string `json:"phone_number"`
	NotifyEmail        bool   `json:"notify_email"`
	NotifySMS          bool   `json:"notify_sms"`
	AlertVerifications bool   `json:"alert_verifications"`
	AlertMoneyRails    bool   `json:"alert_money_rails"`
	AlertSubscriptions bool   `json:"alert_subscriptions"`
	AlertPromotions    bool   `json:"alert_promotions"`
	AlertRisk          bool   `json:"alert_risk"`
	AlertSupport       bool   `json:"alert_support"`
	DailyDigestTime    string `json:"daily_digest_time"`
	UpdatedAt          string `json:"updated_at,omitempty"`
}

type profileSettingsResponse struct {
	User        adminUserResponse        `json:"user"`
	Preferences adminPreferencesResponse `json:"preferences"`
}

type platformSettingsResponse struct {
	PlatformName                 string `json:"platform_name"`
	SupportEmail                 string `json:"support_email"`
	VerificationSLAHours         int    `json:"verification_sla_hours"`
	PayoutReviewThresholdPesewas int    `json:"payout_review_threshold_pesewas"`
	MaintenanceMode              bool   `json:"maintenance_mode"`
	UpdatedAt                    string `json:"updated_at,omitempty"`
}

type auditEventResponse struct {
	AuditEventID string `json:"audit_event_id"`
	ActorEmail   string `json:"actor_email"`
	ActorRole    string `json:"actor_role"`
	Action       string `json:"action"`
	TargetType   string `json:"target_type"`
	TargetID     string `json:"target_id"`
	TargetLabel  string `json:"target_label"`
	Summary      string `json:"summary"`
	Severity     string `json:"severity"`
	CreatedAt    string `json:"created_at"`
}

type businessVerificationResponse struct {
	BusinessID   string   `json:"business_id"`
	BusinessName string   `json:"business_name"`
	Handle       string   `json:"handle"`
	OwnerName    string   `json:"owner_name"`
	OwnerEmail   string   `json:"owner_email"`
	SubmittedAt  string   `json:"submitted_at"`
	UpdatedAt    string   `json:"updated_at"`
	Plan         string   `json:"plan"`
	Status       string   `json:"status"`
	RiskLevel    string   `json:"risk_level"`
	Documents    []string `json:"documents"`
	Checks       []string `json:"checks"`
	Evidence     []string `json:"evidence"`
	Notes        string   `json:"notes"`
}

type businessResponse struct {
	BusinessID         string `json:"business_id"`
	Name               string `json:"name"`
	Handle             string `json:"handle"`
	OwnerName          string `json:"owner_name"`
	OwnerEmail         string `json:"owner_email"`
	Status             string `json:"status"`
	VerificationStatus string `json:"verification_status"`
	OperationalStatus  string `json:"operational_status"`
	Plan               string `json:"plan"`
	Orders             int    `json:"orders"`
	GMVMinor           int64  `json:"gmv_minor"`
	CommissionMinor    int64  `json:"commission_minor"`
	RiskLevel          string `json:"risk_level"`
	LastActive         string `json:"last_active"`
	SubaccountRef      string `json:"subaccount_ref"`
	SuspensionReason   string `json:"suspension_reason"`
	SuspendedAt        string `json:"suspended_at,omitempty"`
	UpdatedAt          string `json:"updated_at"`
}

type platformMetricsResponse struct {
	GMVMonthMinor             int64  `json:"gmv_month_minor"`
	PlatformRevenueMonthMinor int64  `json:"platform_revenue_month_minor"`
	ActiveBusinesses          int    `json:"active_businesses"`
	TotalBusinesses           int    `json:"total_businesses"`
	PendingVerifications      int    `json:"pending_verifications"`
	SuspendedBusinesses       int    `json:"suspended_businesses"`
	PaymentHealthBPS          int    `json:"payment_health_bps"`
	FailedPayments30d         int    `json:"failed_payments_30d"`
	TotalPayments30d          int    `json:"total_payments_30d"`
	UpdatedAt                 string `json:"updated_at"`
}

type moneyRailsResponse struct {
	WebhookEvents []moneyWebhookEventResponse `json:"webhook_events"`
	PayoutReviews []moneyPayoutReviewResponse `json:"payout_reviews"`
	UpdatedAt     string                      `json:"updated_at"`
}

type moneyWebhookEventResponse struct {
	ID                string `json:"id"`
	ProviderReference string `json:"provider_reference"`
	Business          string `json:"business"`
	Status            string `json:"status"`
	Purpose           string `json:"purpose"`
	AmountMinor       int64  `json:"amount_minor"`
	Attempts          int    `json:"attempts"`
	ReceivedAt        string `json:"received_at"`
	Note              string `json:"note"`
}

type moneyPayoutReviewResponse struct {
	ID              string `json:"id"`
	Business        string `json:"business"`
	SubaccountRef   string `json:"subaccount_ref"`
	Status          string `json:"status"`
	SettlementMinor int64  `json:"settlement_minor"`
	CommissionMinor int64  `json:"commission_minor"`
	NextAction      string `json:"next_action"`
	HoldActive      bool   `json:"hold_active"`
	HoldReason      string `json:"hold_reason"`
	HoldUpdatedAt   string `json:"hold_updated_at,omitempty"`
}

type moneyReplayRequestResponse struct {
	ReplayRequestID   string `json:"replay_request_id"`
	ProviderReference string `json:"provider_reference"`
	PaymentID         string `json:"payment_id,omitempty"`
	Business          string `json:"business"`
	Reason            string `json:"reason"`
	Status            string `json:"status"`
	CreatedAt         string `json:"created_at"`
}

type moneyReversalResponse struct {
	PaymentID                string `json:"payment_id"`
	ProviderReference        string `json:"provider_reference"`
	BusinessID               string `json:"business_id"`
	Business                 string `json:"business"`
	OrderID                  string `json:"order_id,omitempty"`
	PaymentReversed          bool   `json:"payment_reversed"`
	PromotionRedemptionCount int    `json:"promotion_redemption_count"`
	AffiliateConversionCount int    `json:"affiliate_conversion_count"`
	ReferralCount            int    `json:"referral_count"`
	ReferralRewardCount      int    `json:"referral_reward_count"`
	GeneratedPromotionCount  int    `json:"generated_promotion_count"`
	Reason                   string `json:"reason"`
	ReversedAt               string `json:"reversed_at"`
}

type subscriptionResponse struct {
	SubscriptionID          string                        `json:"subscription_id,omitempty"`
	BusinessID              string                        `json:"business_id"`
	BusinessName            string                        `json:"business_name"`
	Handle                  string                        `json:"handle"`
	OwnerEmail              string                        `json:"owner_email"`
	PlanCode                string                        `json:"plan_code"`
	PlanName                string                        `json:"plan_name"`
	MonthlyFeeMinor         int64                         `json:"monthly_fee_minor"`
	CommissionBPS           int                           `json:"commission_bps"`
	DesignLimit             *int                          `json:"design_limit,omitempty"`
	DesignCount             int                           `json:"design_count"`
	Status                  string                        `json:"status"`
	BillingMode             string                        `json:"billing_mode"`
	Provider                string                        `json:"provider"`
	ProviderCustomerRef     string                        `json:"provider_customer_ref"`
	ProviderSubscriptionRef string                        `json:"provider_subscription_ref"`
	CurrentPeriodStart      string                        `json:"current_period_start"`
	CurrentPeriodEnd        string                        `json:"current_period_end"`
	TrialEndsAt             string                        `json:"trial_ends_at,omitempty"`
	GraceEndsAt             string                        `json:"grace_ends_at,omitempty"`
	CancelAtPeriodEnd       bool                          `json:"cancel_at_period_end"`
	CanceledAt              string                        `json:"canceled_at,omitempty"`
	FailedPaymentCount      int                           `json:"failed_payment_count"`
	LastInvoiceRef          string                        `json:"last_invoice_ref"`
	LastPaymentAt           string                        `json:"last_payment_at,omitempty"`
	NextBillingAt           string                        `json:"next_billing_at,omitempty"`
	Orders                  int                           `json:"orders"`
	GMVMinor                int64                         `json:"gmv_minor"`
	CommissionMinor         int64                         `json:"commission_minor"`
	UpdatedAt               string                        `json:"updated_at"`
	Events                  []subscriptionEventResponse   `json:"events"`
	Invoices                []subscriptionInvoiceResponse `json:"invoices"`
}

type subscriptionInvoiceResponse struct {
	InvoiceID          string `json:"invoice_id"`
	SubscriptionID     string `json:"subscription_id"`
	InvoiceRef         string `json:"invoice_ref"`
	Status             string `json:"status"`
	BillingMode        string `json:"billing_mode"`
	Provider           string `json:"provider"`
	ProviderInvoiceRef string `json:"provider_invoice_ref"`
	PaymentURL         string `json:"payment_url"`
	AmountMinor        int64  `json:"amount_minor"`
	Currency           string `json:"currency"`
	PeriodStart        string `json:"period_start"`
	PeriodEnd          string `json:"period_end"`
	DueAt              string `json:"due_at"`
	PaidAt             string `json:"paid_at,omitempty"`
	FailedAt           string `json:"failed_at,omitempty"`
	FailureReason      string `json:"failure_reason"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

type subscriptionBillingSweepResponse struct {
	OverdueInvoicesFailed int    `json:"overdue_invoices_failed"`
	SubscriptionsCanceled int    `json:"subscriptions_canceled"`
	BusinessesTouched     int    `json:"businesses_touched"`
	RanAt                 string `json:"ran_at"`
}

type planResponse struct {
	PlanID                  string `json:"plan_id"`
	Code                    string `json:"code"`
	Name                    string `json:"name"`
	MonthlyFeeMinor         int64  `json:"monthly_fee_minor"`
	CommissionBPS           int    `json:"commission_bps"`
	DesignLimit             *int   `json:"design_limit,omitempty"`
	IsActive                bool   `json:"is_active"`
	BusinessCount           int    `json:"business_count"`
	ActiveSubscriptionCount int    `json:"active_subscription_count"`
	EstimatedMRRMinor       int64  `json:"estimated_mrr_minor"`
	CreatedAt               string `json:"created_at"`
	UpdatedAt               string `json:"updated_at"`
}

type promotionResponse struct {
	PromotionID           string                        `json:"promotion_id"`
	BusinessID            string                        `json:"business_id,omitempty"`
	BusinessName          string                        `json:"business_name"`
	BusinessHandle        string                        `json:"business_handle"`
	Code                  string                        `json:"code"`
	Title                 string                        `json:"title"`
	Description           string                        `json:"description"`
	DiscountType          string                        `json:"discount_type"`
	DiscountValue         int64                         `json:"discount_value"`
	MaxDiscountMinor      *int64                        `json:"max_discount_minor,omitempty"`
	MinSpendMinor         int64                         `json:"min_spend_minor"`
	UsageLimitGlobal      *int                          `json:"usage_limit_global,omitempty"`
	UsageLimitPerCustomer *int                          `json:"usage_limit_per_customer,omitempty"`
	FundingSource         string                        `json:"funding_source"`
	Scope                 string                        `json:"scope"`
	TargetCollectionID    string                        `json:"target_collection_id,omitempty"`
	TargetDesignID        string                        `json:"target_design_id,omitempty"`
	Status                string                        `json:"status"`
	StartsAt              string                        `json:"starts_at,omitempty"`
	EndsAt                string                        `json:"ends_at,omitempty"`
	RedemptionCount       int                           `json:"redemption_count"`
	DiscountRedeemedMinor int64                         `json:"discount_redeemed_minor"`
	RecentRedemptions     []promotionRedemptionResponse `json:"recent_redemptions"`
	CreatedAt             string                        `json:"created_at"`
	UpdatedAt             string                        `json:"updated_at"`
}

type promotionRedemptionResponse struct {
	PromotionRedemptionID string `json:"promotion_redemption_id"`
	PromotionID           string `json:"promotion_id"`
	BusinessID            string `json:"business_id"`
	OrderID               string `json:"order_id,omitempty"`
	CustomerID            string `json:"customer_id,omitempty"`
	CustomerName          string `json:"customer_name"`
	DiscountMinor         int64  `json:"discount_minor"`
	Status                string `json:"status"`
	RedeemedAt            string `json:"redeemed_at,omitempty"`
	CreatedAt             string `json:"created_at"`
	UpdatedAt             string `json:"updated_at"`
}

type adCampaignResponse struct {
	CampaignID      string                      `json:"campaign_id"`
	BusinessID      string                      `json:"business_id"`
	BusinessName    string                      `json:"business_name"`
	BusinessHandle  string                      `json:"business_handle"`
	PlacementType   string                      `json:"placement_type"`
	TargetRefID     string                      `json:"target_ref_id"`
	TargetLabel     string                      `json:"target_label"`
	Headline        string                      `json:"headline"`
	Description     string                      `json:"description"`
	Status          string                      `json:"status"`
	PricingModel    string                      `json:"pricing_model"`
	BudgetMinor     int64                       `json:"budget_minor"`
	SpendMinor      int64                       `json:"spend_minor"`
	DailyCapMinor   *int64                      `json:"daily_cap_minor,omitempty"`
	StartsAt        string                      `json:"starts_at"`
	EndsAt          string                      `json:"ends_at"`
	ImpressionCount int                         `json:"impression_count"`
	ClickCount      int                         `json:"click_count"`
	ClickRateBPS    int                         `json:"click_rate_bps"`
	ReviewNote      string                      `json:"review_note"`
	Payments        []adCampaignPaymentResponse `json:"payments"`
	CreatedAt       string                      `json:"created_at"`
	UpdatedAt       string                      `json:"updated_at"`
}

type adCampaignPaymentResponse struct {
	PaymentID         string `json:"payment_id"`
	CampaignID        string `json:"campaign_id"`
	BusinessID        string `json:"business_id"`
	Provider          string `json:"provider"`
	ProviderReference string `json:"provider_reference"`
	PaymentURL        string `json:"payment_url"`
	AmountMinor       int64  `json:"amount_minor"`
	Currency          string `json:"currency"`
	Status            string `json:"status"`
	PaidAt            string `json:"paid_at,omitempty"`
	FailedAt          string `json:"failed_at,omitempty"`
	FailureReason     string `json:"failure_reason"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at"`
}

type adCampaignPaymentCollectResponse struct {
	Payment          adCampaignPaymentResponse `json:"payment"`
	Created          bool                      `json:"created"`
	AuthorizationURL string                    `json:"authorization_url"`
}

type affiliateResponse struct {
	AffiliateID      string `json:"affiliate_id"`
	EntityType       string `json:"entity_type"`
	Code             string `json:"code"`
	DisplayName      string `json:"display_name"`
	ContactName      string `json:"contact_name"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	WebsiteURL       string `json:"website_url"`
	CommissionModel  string `json:"commission_model"`
	CommissionRate   int64  `json:"commission_rate"`
	CookieWindowDays int    `json:"cookie_window_days"`
	PayoutMode       string `json:"payout_mode"`
	PayoutReference  string `json:"payout_reference"`
	Status           string `json:"status"`
	Notes            string `json:"notes"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

type affiliateAttributionResponse struct {
	AffiliateID             string                        `json:"affiliate_id"`
	Code                    string                        `json:"code"`
	DisplayName             string                        `json:"display_name"`
	ClickCount              int64                         `json:"click_count"`
	ConversionCount         int64                         `json:"conversion_count"`
	PendingConversionCount  int64                         `json:"pending_conversion_count"`
	ApprovedConversionCount int64                         `json:"approved_conversion_count"`
	SettledConversionCount  int64                         `json:"settled_conversion_count"`
	ReversedConversionCount int64                         `json:"reversed_conversion_count"`
	GrossMinor              int64                         `json:"gross_minor"`
	CommissionMinor         int64                         `json:"commission_minor"`
	RecentConversions       []affiliateConversionResponse `json:"recent_conversions"`
	RecentPayouts           []affiliatePayoutResponse     `json:"recent_payouts"`
	LastActivityAt          string                        `json:"last_activity_at,omitempty"`
}

type affiliateConversionResponse struct {
	ConversionID     string `json:"conversion_id"`
	AffiliateID      string `json:"affiliate_id"`
	BusinessID       string `json:"business_id"`
	BusinessName     string `json:"business_name"`
	OrderID          string `json:"order_id"`
	GrossMinor       int64  `json:"gross_minor"`
	CommissionMinor  int64  `json:"commission_minor"`
	Status           string `json:"status"`
	AttributionModel string `json:"attribution_model"`
	HoldUntil        string `json:"hold_until,omitempty"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

type affiliatePayoutResponse struct {
	PayoutBatchID   string `json:"payout_batch_id"`
	AffiliateID     string `json:"affiliate_id"`
	DisplayName     string `json:"display_name"`
	PayoutMode      string `json:"payout_mode"`
	PayoutReference string `json:"payout_reference"`
	ConversionCount int    `json:"conversion_count"`
	GrossMinor      int64  `json:"gross_minor"`
	CommissionMinor int64  `json:"commission_minor"`
	Status          string `json:"status"`
	Notes           string `json:"notes"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

type referralRewardIssueResponse struct {
	ReferralCount         int    `json:"referral_count"`
	RewardCount           int    `json:"reward_count"`
	VoucherCount          int    `json:"voucher_count"`
	CommissionRebateCount int    `json:"commission_rebate_count"`
	TotalRewardMinor      int64  `json:"total_reward_minor"`
	IssuedAt              string `json:"issued_at"`
}

type referralProgrammeResponse struct {
	ProgrammeID             string                 `json:"programme_id"`
	Title                   string                 `json:"title"`
	CodePrefix              string                 `json:"code_prefix"`
	Audience                string                 `json:"audience"`
	ReferrerRewardKind      string                 `json:"referrer_reward_kind"`
	RefereeRewardKind       string                 `json:"referee_reward_kind"`
	RewardType              string                 `json:"reward_type"`
	RewardValue             int64                  `json:"reward_value"`
	MaxRewardMinor          *int64                 `json:"max_reward_minor,omitempty"`
	QualifyingOrderMinMinor int64                  `json:"qualifying_order_min_minor"`
	RewardHoldDays          int                    `json:"reward_hold_days"`
	Status                  string                 `json:"status"`
	StartsAt                string                 `json:"starts_at,omitempty"`
	EndsAt                  string                 `json:"ends_at,omitempty"`
	Notes                   string                 `json:"notes"`
	Codes                   []referralCodeResponse `json:"codes"`
	CreatedAt               string                 `json:"created_at"`
	UpdatedAt               string                 `json:"updated_at"`
}

type referralCodeResponse struct {
	ReferralCodeID  string `json:"referral_code_id"`
	ProgrammeID     string `json:"programme_id"`
	BusinessID      string `json:"business_id,omitempty"`
	BusinessName    string `json:"business_name"`
	BusinessHandle  string `json:"business_handle"`
	OwnerType       string `json:"owner_type"`
	OwnerBusinessID string `json:"owner_business_id,omitempty"`
	OwnerCustomerID string `json:"owner_customer_id,omitempty"`
	OwnerLabel      string `json:"owner_label"`
	Code            string `json:"code"`
	Status          string `json:"status"`
	ReferralCount   int    `json:"referral_count"`
	QualifiedCount  int    `json:"qualified_count"`
	RewardedCount   int    `json:"rewarded_count"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

type subscriptionEventResponse struct {
	SubscriptionEventID string `json:"subscription_event_id"`
	EventType           string `json:"event_type"`
	Summary             string `json:"summary"`
	ActorEmail          string `json:"actor_email"`
	CreatedAt           string `json:"created_at"`
}

type riskReviewResponse struct {
	ReviewKey  string `json:"review_key"`
	BusinessID string `json:"business_id"`
	Title      string `json:"title"`
	Business   string `json:"business"`
	Level      string `json:"level"`
	Reason     string `json:"reason"`
	Owner      string `json:"owner"`
	Status     string `json:"status"`
	UpdatedAt  string `json:"updated_at"`
}

type supportTicketResponse struct {
	TicketKey           string `json:"ticket_key"`
	BusinessID          string `json:"business_id"`
	Subject             string `json:"subject"`
	Business            string `json:"business"`
	Priority            string `json:"priority"`
	Summary             string `json:"summary"`
	Category            string `json:"category"`
	Status              string `json:"status"`
	AssignedAdminUserID string `json:"assigned_admin_user_id,omitempty"`
	AssignedAdminEmail  string `json:"assigned_admin_email,omitempty"`
	AssignedAdminName   string `json:"assigned_admin_name,omitempty"`
	CreatedAt           string `json:"created_at"`
	UpdatedAt           string `json:"updated_at"`
}

type roleCatalogResponse struct {
	Roles       []roleResponse       `json:"roles"`
	Permissions []permissionResponse `json:"permissions"`
}

type authResponse struct {
	AdminUserID      string `json:"admin_user_id"`
	Email            string `json:"email"`
	DisplayName      string `json:"display_name"`
	Role             string `json:"role"`
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	AccessExpiresAt  string `json:"access_expires_at"`
	RefreshExpiresAt string `json:"refresh_expires_at"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func (handler Handler) login(w http.ResponseWriter, r *http.Request) {
	var request loginRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.Login(r.Context(), adminauthapp.LoginCommand{
		Email:     request.Email,
		Password:  request.Password,
		UserAgent: r.UserAgent(),
		IPAddress: requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

func (handler Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var request refreshRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.Refresh(r.Context(), adminauthapp.RefreshCommand{
		RefreshToken: request.RefreshToken,
		UserAgent:    r.UserAgent(),
		IPAddress:    requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

func (handler Handler) logout(w http.ResponseWriter, r *http.Request) {
	var request logoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.Logout(r.Context(), adminauthapp.LogoutCommand{
		RefreshToken: request.RefreshToken,
		UserAgent:    r.UserAgent(),
		IPAddress:    requestIP(r),
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) me(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	user, err := handler.service.Me(r.Context(), principal.AdminUserID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdminUserResponse(user))
}

func (handler Handler) profileSettings(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	result, err := handler.service.GetProfileSettings(r.Context(), principal.AdminUserID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, profileSettingsResponse{
		User:        newAdminUserResponse(result.User),
		Preferences: newPreferencesResponse(result.Preferences),
	})
}

func (handler Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateProfileRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.UpdateProfile(r.Context(), adminauthapp.UpdateProfileCommand{
		ActorUserID: principal.AdminUserID,
		DisplayName: request.DisplayName,
		Email:       request.Email,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdminUserResponse(user))
}

func (handler Handler) updatePreferences(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updatePreferencesRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	preferences, err := handler.service.UpdatePreferences(r.Context(), adminauthapp.UpdatePreferencesCommand{
		ActorUserID:        principal.AdminUserID,
		ActorRole:          principal.Role,
		Timezone:           request.Timezone,
		PhoneNumber:        request.PhoneNumber,
		NotifyEmail:        request.NotifyEmail,
		NotifySMS:          request.NotifySMS,
		AlertVerifications: request.AlertVerifications,
		AlertMoneyRails:    request.AlertMoneyRails,
		AlertSubscriptions: request.AlertSubscriptions,
		AlertPromotions:    request.AlertPromotions,
		AlertRisk:          request.AlertRisk,
		AlertSupport:       request.AlertSupport,
		DailyDigestTime:    request.DailyDigestTime,
		UserAgent:          r.UserAgent(),
		IPAddress:          requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPreferencesResponse(preferences))
}

func (handler Handler) platformSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := handler.service.GetPlatformSettings(r.Context())
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlatformSettingsResponse(settings))
}

func (handler Handler) updatePlatformSettings(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updatePlatformSettingsRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	settings, err := handler.service.UpdatePlatformSettings(r.Context(), adminauthapp.UpdatePlatformSettingsCommand{
		ActorUserID:                  principal.AdminUserID,
		ActorRole:                    principal.Role,
		PlatformName:                 request.PlatformName,
		SupportEmail:                 request.SupportEmail,
		VerificationSLAHours:         request.VerificationSLAHours,
		PayoutReviewThresholdPesewas: request.PayoutReviewThresholdPesewas,
		MaintenanceMode:              request.MaintenanceMode,
		UserAgent:                    r.UserAgent(),
		IPAddress:                    requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlatformSettingsResponse(settings))
}

func (handler Handler) businessVerifications(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListBusinessVerifications(r.Context(), adminauthapp.ListBusinessVerificationsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]businessVerificationResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newBusinessVerificationResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]businessVerificationResponse{"cases": out})
}

func (handler Handler) decideBusinessVerification(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request businessVerificationDecisionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.DecideBusinessVerification(r.Context(), adminauthapp.DecideBusinessVerificationCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		BusinessID:  common.ID(chi.URLParam(r, "id")),
		Decision:    adminauthapp.BusinessVerificationDecision(request.Decision),
		Note:        request.Note,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newBusinessVerificationResponse(record))
}

func (handler Handler) platformMetrics(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	metrics, err := handler.service.GetPlatformMetrics(r.Context(), adminauthapp.GetPlatformMetricsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlatformMetricsResponse(metrics))
}

func (handler Handler) moneyRails(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	moneyRails, err := handler.service.GetMoneyRails(r.Context(), adminauthapp.GetMoneyRailsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newMoneyRailsResponse(moneyRails))
}

func (handler Handler) subscriptions(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListSubscriptions(r.Context(), adminauthapp.ListSubscriptionsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]subscriptionResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newSubscriptionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]subscriptionResponse{"subscriptions": out})
}

func (handler Handler) updateSubscription(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionUpdateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateSubscription(r.Context(), adminauthapp.UpdateSubscriptionCommand{
		ActorUserID:             principal.AdminUserID,
		ActorRole:               principal.Role,
		BusinessID:              common.ID(chi.URLParam(r, "id")),
		Status:                  request.Status,
		BillingMode:             request.BillingMode,
		ProviderCustomerRef:     request.ProviderCustomerRef,
		ProviderSubscriptionRef: request.ProviderSubscriptionRef,
		Reason:                  request.Reason,
		UserAgent:               r.UserAgent(),
		IPAddress:               requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionResponse(record))
}

func (handler Handler) issueSubscriptionInvoice(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionInvoiceIssueRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.IssueSubscriptionInvoice(r.Context(), adminauthapp.IssueSubscriptionInvoiceCommand{
		ActorUserID:        principal.AdminUserID,
		ActorRole:          principal.Role,
		BusinessID:         common.ID(chi.URLParam(r, "id")),
		ProviderInvoiceRef: request.ProviderInvoiceRef,
		PaymentURL:         request.PaymentURL,
		DueAt:              request.DueAt,
		Reason:             request.Reason,
		UserAgent:          r.UserAgent(),
		IPAddress:          requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newSubscriptionResponse(record))
}

func (handler Handler) markSubscriptionInvoicePaid(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionInvoiceDecisionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.MarkSubscriptionInvoicePaid(r.Context(), adminauthapp.MarkSubscriptionInvoicePaidCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		InvoiceID:   common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionResponse(record))
}

func (handler Handler) markSubscriptionInvoiceFailed(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionInvoiceDecisionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.MarkSubscriptionInvoiceFailed(r.Context(), adminauthapp.MarkSubscriptionInvoiceFailedCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		InvoiceID:   common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionResponse(record))
}

func (handler Handler) runSubscriptionBillingSweep(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionBillingSweepRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.RunSubscriptionBillingSweep(r.Context(), adminauthapp.RunSubscriptionBillingSweepCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionBillingSweepResponse(record))
}

func (handler Handler) plans(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListPlans(r.Context(), adminauthapp.ListPlansCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]planResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newPlanResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]planResponse{"plans": out})
}

func (handler Handler) createPlan(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request planCreateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreatePlan(r.Context(), adminauthapp.CreatePlanCommand{
		ActorUserID:     principal.AdminUserID,
		ActorRole:       principal.Role,
		Code:            request.Code,
		Name:            request.Name,
		MonthlyFeeMinor: request.MonthlyFeeMinor,
		CommissionBPS:   request.CommissionBPS,
		DesignLimit:     request.DesignLimit,
		UserAgent:       r.UserAgent(),
		IPAddress:       requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newPlanResponse(record))
}

func (handler Handler) updatePlan(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request planUpdateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdatePlan(r.Context(), adminauthapp.UpdatePlanCommand{
		ActorUserID:     principal.AdminUserID,
		ActorRole:       principal.Role,
		PlanID:          common.ID(chi.URLParam(r, "id")),
		Name:            request.Name,
		MonthlyFeeMinor: request.MonthlyFeeMinor,
		CommissionBPS:   request.CommissionBPS,
		DesignLimit:     request.DesignLimit,
		IsActive:        request.IsActive,
		UserAgent:       r.UserAgent(),
		IPAddress:       requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlanResponse(record))
}

func (handler Handler) archivePlan(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request planArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchivePlan(r.Context(), adminauthapp.ArchivePlanCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		PlanID:      common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlanResponse(record))
}

func (handler Handler) promotions(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListPromotions(r.Context(), adminauthapp.ListPromotionsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]promotionResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newPromotionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]promotionResponse{"promotions": out})
}

func (handler Handler) createPromotion(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request promotionUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreatePromotion(r.Context(), adminauthapp.CreatePromotionCommand{
		ActorUserID:           principal.AdminUserID,
		ActorRole:             principal.Role,
		BusinessID:            promotionBusinessID(request.BusinessID),
		Code:                  request.Code,
		Title:                 request.Title,
		Description:           request.Description,
		DiscountType:          request.DiscountType,
		DiscountValue:         request.DiscountValue,
		MaxDiscountMinor:      request.MaxDiscountMinor,
		MinSpendMinor:         request.MinSpendMinor,
		UsageLimitGlobal:      request.UsageLimitGlobal,
		UsageLimitPerCustomer: request.UsageLimitPerCustomer,
		FundingSource:         request.FundingSource,
		Scope:                 request.Scope,
		TargetCollectionID:    optionalCommonID(request.TargetCollectionID),
		TargetDesignID:        optionalCommonID(request.TargetDesignID),
		Status:                request.Status,
		StartsAt:              request.StartsAt,
		EndsAt:                request.EndsAt,
		UserAgent:             r.UserAgent(),
		IPAddress:             requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newPromotionResponse(record))
}

func (handler Handler) updatePromotion(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request promotionUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdatePromotion(r.Context(), adminauthapp.UpdatePromotionCommand{
		ActorUserID:           principal.AdminUserID,
		ActorRole:             principal.Role,
		PromotionID:           common.ID(chi.URLParam(r, "id")),
		BusinessID:            promotionBusinessID(request.BusinessID),
		Code:                  request.Code,
		Title:                 request.Title,
		Description:           request.Description,
		DiscountType:          request.DiscountType,
		DiscountValue:         request.DiscountValue,
		MaxDiscountMinor:      request.MaxDiscountMinor,
		MinSpendMinor:         request.MinSpendMinor,
		UsageLimitGlobal:      request.UsageLimitGlobal,
		UsageLimitPerCustomer: request.UsageLimitPerCustomer,
		FundingSource:         request.FundingSource,
		Scope:                 request.Scope,
		TargetCollectionID:    optionalCommonID(request.TargetCollectionID),
		TargetDesignID:        optionalCommonID(request.TargetDesignID),
		Status:                request.Status,
		StartsAt:              request.StartsAt,
		EndsAt:                request.EndsAt,
		UserAgent:             r.UserAgent(),
		IPAddress:             requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPromotionResponse(record))
}

func (handler Handler) archivePromotion(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request promotionArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchivePromotion(r.Context(), adminauthapp.ArchivePromotionCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		PromotionID: common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPromotionResponse(record))
}

func (handler Handler) adCampaigns(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListAdCampaigns(r.Context(), adminauthapp.ListAdCampaignsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]adCampaignResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAdCampaignResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]adCampaignResponse{"campaigns": out})
}

func (handler Handler) createAdCampaign(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateAdCampaign(r.Context(), adminauthapp.CreateAdCampaignCommand{
		ActorUserID:   principal.AdminUserID,
		ActorRole:     principal.Role,
		BusinessID:    common.ID(strings.TrimSpace(request.BusinessID)),
		PlacementType: request.PlacementType,
		TargetRefID:   request.TargetRefID,
		Headline:      request.Headline,
		Description:   request.Description,
		Status:        request.Status,
		PricingModel:  request.PricingModel,
		BudgetMinor:   request.BudgetMinor,
		DailyCapMinor: request.DailyCapMinor,
		StartsAt:      request.StartsAt,
		EndsAt:        request.EndsAt,
		ReviewNote:    request.ReviewNote,
		UserAgent:     r.UserAgent(),
		IPAddress:     requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAdCampaignResponse(record))
}

func (handler Handler) updateAdCampaign(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateAdCampaign(r.Context(), adminauthapp.UpdateAdCampaignCommand{
		ActorUserID:   principal.AdminUserID,
		ActorRole:     principal.Role,
		CampaignID:    common.ID(chi.URLParam(r, "id")),
		BusinessID:    common.ID(strings.TrimSpace(request.BusinessID)),
		PlacementType: request.PlacementType,
		TargetRefID:   request.TargetRefID,
		Headline:      request.Headline,
		Description:   request.Description,
		Status:        request.Status,
		PricingModel:  request.PricingModel,
		BudgetMinor:   request.BudgetMinor,
		DailyCapMinor: request.DailyCapMinor,
		StartsAt:      request.StartsAt,
		EndsAt:        request.EndsAt,
		ReviewNote:    request.ReviewNote,
		UserAgent:     r.UserAgent(),
		IPAddress:     requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdCampaignResponse(record))
}

func (handler Handler) archiveAdCampaign(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchiveAdCampaign(r.Context(), adminauthapp.ArchiveAdCampaignCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		CampaignID:  common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdCampaignResponse(record))
}

func (handler Handler) collectAdCampaignPayment(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignPaymentRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	result, err := handler.service.CollectAdCampaignPayment(r.Context(), adminauthapp.CollectAdCampaignPaymentCommand{
		ActorUserID:   principal.AdminUserID,
		ActorRole:     principal.Role,
		CampaignID:    common.ID(chi.URLParam(r, "id")),
		CustomerEmail: request.CustomerEmail,
		UserAgent:     r.UserAgent(),
		IPAddress:     requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, adCampaignPaymentCollectResponse{
		Payment:          newAdCampaignPaymentResponse(result.Payment),
		Created:          result.Created,
		AuthorizationURL: result.AuthorizationURL,
	})
}

func (handler Handler) affiliates(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListAffiliates(r.Context(), adminauthapp.ListAffiliatesCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]affiliateResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAffiliateResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]affiliateResponse{"affiliates": out})
}

func (handler Handler) affiliateAttribution(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListAffiliateAttribution(r.Context(), adminauthapp.ListAffiliateAttributionCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]affiliateAttributionResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAffiliateAttributionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]affiliateAttributionResponse{"attribution": out})
}

func (handler Handler) updateAffiliateConversionStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateConversionStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateAffiliateConversionStatus(
		r.Context(),
		adminauthapp.UpdateAffiliateConversionStatusCommand{
			ActorUserID:  principal.AdminUserID,
			ActorRole:    principal.Role,
			ConversionID: common.ID(chi.URLParam(r, "id")),
			Status:       request.Status,
			Reason:       request.Reason,
			UserAgent:    r.UserAgent(),
			IPAddress:    requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAffiliateConversionResponse(record))
}

func (handler Handler) createAffiliatePayout(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliatePayoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateAffiliatePayout(
		r.Context(),
		adminauthapp.CreateAffiliatePayoutCommand{
			ActorUserID:     principal.AdminUserID,
			ActorRole:       principal.Role,
			AffiliateID:     common.ID(chi.URLParam(r, "id")),
			PayoutReference: request.PayoutReference,
			Notes:           request.Notes,
			UserAgent:       r.UserAgent(),
			IPAddress:       requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAffiliatePayoutResponse(record))
}

func (handler Handler) createAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateAffiliate(r.Context(), adminauthapp.CreateAffiliateCommand{
		ActorUserID:      principal.AdminUserID,
		ActorRole:        principal.Role,
		EntityType:       request.EntityType,
		Code:             request.Code,
		DisplayName:      request.DisplayName,
		ContactName:      request.ContactName,
		Email:            request.Email,
		Phone:            request.Phone,
		WebsiteURL:       request.WebsiteURL,
		CommissionModel:  request.CommissionModel,
		CommissionRate:   request.CommissionRate,
		CookieWindowDays: request.CookieWindowDays,
		PayoutMode:       request.PayoutMode,
		PayoutReference:  request.PayoutReference,
		Status:           request.Status,
		Notes:            request.Notes,
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAffiliateResponse(record))
}

func (handler Handler) updateAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateAffiliate(r.Context(), adminauthapp.UpdateAffiliateCommand{
		ActorUserID:      principal.AdminUserID,
		ActorRole:        principal.Role,
		AffiliateID:      common.ID(chi.URLParam(r, "id")),
		EntityType:       request.EntityType,
		Code:             request.Code,
		DisplayName:      request.DisplayName,
		ContactName:      request.ContactName,
		Email:            request.Email,
		Phone:            request.Phone,
		WebsiteURL:       request.WebsiteURL,
		CommissionModel:  request.CommissionModel,
		CommissionRate:   request.CommissionRate,
		CookieWindowDays: request.CookieWindowDays,
		PayoutMode:       request.PayoutMode,
		PayoutReference:  request.PayoutReference,
		Status:           request.Status,
		Notes:            request.Notes,
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAffiliateResponse(record))
}

func (handler Handler) archiveAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchiveAffiliate(r.Context(), adminauthapp.ArchiveAffiliateCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		AffiliateID: common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAffiliateResponse(record))
}

func (handler Handler) referralProgrammes(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListReferralProgrammes(r.Context(), adminauthapp.ListReferralProgrammesCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]referralProgrammeResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newReferralProgrammeResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]referralProgrammeResponse{"programmes": out})
}

func (handler Handler) createReferralProgramme(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralProgrammeUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateReferralProgramme(r.Context(), adminauthapp.CreateReferralProgrammeCommand{
		ActorUserID:             principal.AdminUserID,
		ActorRole:               principal.Role,
		Title:                   request.Title,
		CodePrefix:              request.CodePrefix,
		Audience:                request.Audience,
		ReferrerRewardKind:      request.ReferrerRewardKind,
		RefereeRewardKind:       request.RefereeRewardKind,
		RewardType:              request.RewardType,
		RewardValue:             request.RewardValue,
		MaxRewardMinor:          request.MaxRewardMinor,
		QualifyingOrderMinMinor: request.QualifyingOrderMinMinor,
		RewardHoldDays:          request.RewardHoldDays,
		Status:                  request.Status,
		StartsAt:                request.StartsAt,
		EndsAt:                  request.EndsAt,
		Notes:                   request.Notes,
		UserAgent:               r.UserAgent(),
		IPAddress:               requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newReferralProgrammeResponse(record))
}

func (handler Handler) updateReferralProgramme(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralProgrammeUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateReferralProgramme(r.Context(), adminauthapp.UpdateReferralProgrammeCommand{
		ActorUserID:             principal.AdminUserID,
		ActorRole:               principal.Role,
		ProgrammeID:             common.ID(chi.URLParam(r, "id")),
		Title:                   request.Title,
		CodePrefix:              request.CodePrefix,
		Audience:                request.Audience,
		ReferrerRewardKind:      request.ReferrerRewardKind,
		RefereeRewardKind:       request.RefereeRewardKind,
		RewardType:              request.RewardType,
		RewardValue:             request.RewardValue,
		MaxRewardMinor:          request.MaxRewardMinor,
		QualifyingOrderMinMinor: request.QualifyingOrderMinMinor,
		RewardHoldDays:          request.RewardHoldDays,
		Status:                  request.Status,
		StartsAt:                request.StartsAt,
		EndsAt:                  request.EndsAt,
		Notes:                   request.Notes,
		UserAgent:               r.UserAgent(),
		IPAddress:               requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newReferralProgrammeResponse(record))
}

func (handler Handler) createReferralCode(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralCodeCreateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateReferralCode(r.Context(), adminauthapp.CreateReferralCodeCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		ProgrammeID: common.ID(chi.URLParam(r, "id")),
		BusinessID:  optionalCommonID(request.BusinessID),
		OwnerType:   request.OwnerType,
		Code:        request.Code,
		Status:      request.Status,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newReferralCodeResponse(record))
}

func (handler Handler) archiveReferralProgramme(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralProgrammeArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchiveReferralProgramme(r.Context(), adminauthapp.ArchiveReferralProgrammeCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		ProgrammeID: common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newReferralProgrammeResponse(record))
}

func (handler Handler) issueReferralRewards(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralRewardIssueRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.IssueReferralRewards(r.Context(), adminauthapp.IssueReferralRewardsCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Limit:       request.Limit,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newReferralRewardIssueResponse(record))
}

func (handler Handler) queueMoneyReplay(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request queueMoneyReplayRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.QueueMoneyReplay(r.Context(), adminauthapp.QueueMoneyReplayCommand{
		ActorUserID:       principal.AdminUserID,
		ActorRole:         principal.Role,
		ProviderReference: request.ProviderReference,
		Reason:            request.Reason,
		UserAgent:         r.UserAgent(),
		IPAddress:         requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newMoneyReplayRequestResponse(record))
}

func (handler Handler) reverseMoneyPayment(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request reverseMoneyPaymentRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ReverseMoneyPayment(r.Context(), adminauthapp.ReverseMoneyPaymentCommand{
		ActorUserID:       principal.AdminUserID,
		ActorRole:         principal.Role,
		ProviderReference: request.ProviderReference,
		Reason:            request.Reason,
		UserAgent:         r.UserAgent(),
		IPAddress:         requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newMoneyReversalResponse(record))
}

func (handler Handler) setSettlementReviewHold(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request settlementReviewHoldRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.SetSettlementReviewHold(
		r.Context(),
		adminauthapp.SetSettlementReviewHoldCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			BusinessID:  common.ID(chi.URLParam(r, "id")),
			Hold:        request.Hold,
			Reason:      request.Reason,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newMoneyPayoutReviewResponse(record))
}

func (handler Handler) riskReviews(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListRiskReviews(r.Context(), adminauthapp.ListRiskReviewsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]riskReviewResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newRiskReviewResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]riskReviewResponse{"reviews": out})
}

func (handler Handler) updateRiskReviewStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request riskReviewStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	reviewKey, err := url.PathUnescape(chi.URLParam(r, "key"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input")
		return
	}

	record, err := handler.service.SetRiskReviewStatus(
		r.Context(),
		adminauthapp.SetRiskReviewStatusCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			ReviewKey:   reviewKey,
			Status:      request.Status,
			Reason:      request.Reason,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newRiskReviewResponse(record))
}

func (handler Handler) supportTickets(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListSupportTickets(r.Context(), adminauthapp.ListSupportTicketsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]supportTicketResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newSupportTicketResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]supportTicketResponse{"tickets": out})
}

func (handler Handler) updateSupportTicket(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request supportTicketUpdateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	ticketKey, err := url.PathUnescape(chi.URLParam(r, "key"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input")
		return
	}

	record, err := handler.service.UpdateSupportTicket(
		r.Context(),
		adminauthapp.UpdateSupportTicketCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			TicketKey:   ticketKey,
			Status:      request.Status,
			Assignment:  request.Assignment,
			Note:        request.Note,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSupportTicketResponse(record))
}

func (handler Handler) businesses(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListBusinesses(r.Context(), adminauthapp.ListBusinessesCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]businessResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newBusinessResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]businessResponse{"businesses": out})
}

func (handler Handler) updateBusinessStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateBusinessStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.UpdateBusinessStatus(r.Context(), adminauthapp.UpdateBusinessStatusCommand{
		ActorUserID:       principal.AdminUserID,
		ActorRole:         principal.Role,
		BusinessID:        common.ID(chi.URLParam(r, "id")),
		OperationalStatus: business.OperationalStatus(request.OperationalStatus),
		Reason:            request.Reason,
		UserAgent:         r.UserAgent(),
		IPAddress:         requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newBusinessResponse(record))
}

func (handler Handler) auditEvents(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	events, err := handler.service.ListAuditEvents(r.Context(), adminauthapp.ListAuditEventsCommand{
		ActorRole: principal.Role,
		Severity:  admindomain.AuditSeverity(strings.TrimSpace(r.URL.Query().Get("severity"))),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]auditEventResponse, 0, len(events))
	for _, event := range events {
		out = append(out, newAuditEventResponse(event))
	}
	writeJSON(w, http.StatusOK, map[string][]auditEventResponse{"events": out})
}

func (handler Handler) exportDatasetCSV(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	dataset := strings.TrimSpace(chi.URLParam(r, "dataset"))
	rows, err := handler.exportDatasetRows(r.Context(), principal, dataset)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	if len(rows) == 0 {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}

	writeCSV(w, "xtiitch-admin-"+safeExportName(dataset)+".csv", rows)
}

func (handler Handler) exportDatasetRows(
	ctx context.Context,
	principal Principal,
	dataset string,
) ([][]string, error) {
	switch dataset {
	case "report-posture":
		metrics, err := handler.service.GetPlatformMetrics(ctx, adminauthapp.GetPlatformMetricsCommand{
			ActorRole: principal.Role,
		})
		if err != nil {
			return nil, err
		}
		settings, err := handler.service.GetPlatformSettings(ctx)
		if err != nil {
			return nil, err
		}
		return [][]string{
			{"Metric", "Value", "Detail"},
			{"GMV this month", moneyCSV(metrics.GMVMonthMinor), "Succeeded platform payments"},
			{"Commission", moneyCSV(metrics.PlatformRevenueMonthMinor), "Platform revenue month to date"},
			{"Active businesses", fmt.Sprint(metrics.ActiveBusinesses), fmt.Sprintf("%d total tenants", metrics.TotalBusinesses)},
			{"Pending KYC", fmt.Sprint(metrics.PendingVerifications), "Business verification backlog"},
			{"Suspended businesses", fmt.Sprint(metrics.SuspendedBusinesses), "Operational holds"},
			{"Payment health", fmt.Sprintf("%.2f%%", float64(metrics.PaymentHealthBPS)/100), fmt.Sprintf("%d failed of %d payments in 30 days", metrics.FailedPayments30d, metrics.TotalPayments30d)},
			{"Platform policy", boolCSV(!settings.MaintenanceMode, "Live", "Maintenance"), fmt.Sprintf("%dh verification SLA", settings.VerificationSLAHours)},
			{"Payout review threshold", moneyCSV(int64(settings.PayoutReviewThresholdPesewas)), "Admin settlement review threshold"},
		}, nil
	case "businesses":
		records, err := handler.service.ListBusinesses(ctx, adminauthapp.ListBusinessesCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Business", "Handle", "Owner", "Status", "Operational", "Plan", "Orders", "GMV", "Commission", "Risk", "Subaccount", "Last active"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.Name,
				record.Handle,
				fallbackText(record.OwnerEmail, record.OwnerName),
				businessListStatus(record),
				string(record.OperationalStatus),
				fallbackText(record.PlanName, record.PlanCode),
				fmt.Sprint(record.OrdersCount),
				moneyCSV(record.GMVMinor),
				moneyCSV(record.CommissionMinor),
				businessRiskLevel(record),
				record.SettlementSubaccount,
				timeCSV(record.LastActiveAt),
			})
		}
		return rows, nil
	case "verification":
		records, err := handler.service.ListBusinessVerifications(ctx, adminauthapp.ListBusinessVerificationsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Business", "Handle", "Owner", "Email", "Status", "Risk", "Plan", "Documents", "Submitted", "Updated", "Notes"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.BusinessName,
				record.Handle,
				record.OwnerName,
				record.OwnerEmail,
				string(record.VerificationStatus),
				verificationRiskLevel(record),
				fallbackText(record.PlanName, record.PlanCode),
				strings.Join(verificationDocuments(record), "; "),
				timeCSV(record.SubmittedAt),
				timeCSV(record.UpdatedAt),
				verificationNotes(record),
			})
		}
		return rows, nil
	case "money":
		record, err := handler.service.GetMoneyRails(ctx, adminauthapp.GetMoneyRailsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Kind", "Business", "Reference", "Status", "Amount", "Attempts", "Received/Updated", "Note"}}
		for _, event := range record.WebhookEvents {
			rows = append(rows, []string{"Webhook", event.BusinessName, event.ProviderReference, event.Status, moneyCSV(event.AmountMinor), fmt.Sprint(event.Attempts), timeCSV(event.ReceivedAt), event.Note})
		}
		for _, review := range record.PayoutReviews {
			status := review.Status
			if review.HoldActive {
				status = "held"
			}
			rows = append(rows, []string{"Settlement", review.BusinessName, review.SubaccountRef, status, moneyCSV(review.SettlementMinor), "", optionalTimeCSV(review.HoldUpdatedAt), fallbackText(review.HoldReason, review.NextAction)})
		}
		return rows, nil
	case "risk":
		records, err := handler.service.ListRiskReviews(ctx, adminauthapp.ListRiskReviewsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Title", "Business", "Level", "Status", "Owner", "Updated", "Reason"}}
		for _, record := range records {
			rows = append(rows, []string{record.Title, record.BusinessName, record.Level, record.Status, record.Owner, timeCSV(record.UpdatedAt), record.Reason})
		}
		return rows, nil
	case "support":
		records, err := handler.service.ListSupportTickets(ctx, adminauthapp.ListSupportTicketsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Subject", "Business", "Category", "Priority", "Status", "Assigned", "Created", "Updated", "Summary"}}
		for _, record := range records {
			rows = append(rows, []string{record.Subject, record.BusinessName, record.Category, record.Priority, record.Status, fallbackText(record.AssignedAdminName, record.AssignedAdminEmail), timeCSV(record.CreatedAt), timeCSV(record.UpdatedAt), record.Summary})
		}
		return rows, nil
	case "audit":
		records, err := handler.service.ListAuditEvents(ctx, adminauthapp.ListAuditEventsCommand{
			ActorRole: principal.Role,
			Limit:     500,
		})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Action", "Actor", "Role", "Severity", "Target", "Created", "Detail"}}
		for _, record := range records {
			rows = append(rows, []string{record.Action, record.ActorEmail, string(record.ActorRole), string(record.Severity), fallbackText(record.TargetLabel, record.TargetID), timeCSV(record.CreatedAt), record.Summary})
		}
		return rows, nil
	case "users":
		records, err := handler.service.ListUsers(ctx, adminauthapp.ListUsersCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Name", "Email", "Role", "Active", "Created", "Updated"}}
		for _, record := range records {
			rows = append(rows, []string{record.DisplayName, record.Email, string(record.Role), boolCSV(record.IsActive, "Active", "Inactive"), timeCSV(record.CreatedAt), timeCSV(record.UpdatedAt)})
		}
		return rows, nil
	case "roles":
		records, err := handler.service.ListRolePermissions(ctx)
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Role", "Label", "Permission count", "Permissions"}}
		for _, record := range records {
			permissions := make([]string, 0, len(record.Permissions))
			for _, permission := range record.Permissions {
				permissions = append(permissions, permissionLabel(permission))
			}
			rows = append(rows, []string{
				string(record.Role),
				roleLabel(record.Role),
				fmt.Sprint(len(record.Permissions)),
				strings.Join(permissions, "; "),
			})
		}
		return rows, nil
	case "settings":
		profile, err := handler.service.GetProfileSettings(ctx, principal.AdminUserID)
		if err != nil {
			return nil, err
		}
		settings, err := handler.service.GetPlatformSettings(ctx)
		if err != nil {
			return nil, err
		}
		preferences := profile.Preferences
		return [][]string{
			{"Area", "Setting", "Value", "Detail"},
			{"Operator profile", "Display name", profile.User.DisplayName, profile.User.Email},
			{"Operator profile", "Role", string(profile.User.Role), boolCSV(profile.User.IsActive, "Active", "Inactive")},
			{"Notification preferences", "Email alerts", boolCSV(preferences.NotifyEmail, "On", "Off"), "Primary operator delivery route"},
			{"Notification preferences", "SMS alerts", boolCSV(preferences.NotifySMS, "On", "Off"), fallbackText(preferences.PhoneNumber, "No phone number")},
			{"Notification preferences", "Daily digest", preferences.DailyDigestTime, preferences.Timezone},
			{"Notification preferences", "Verification alerts", boolCSV(preferences.AlertVerifications, "Watched", "Muted"), "Business verification queue"},
			{"Notification preferences", "Money rail alerts", boolCSV(preferences.AlertMoneyRails, "Watched", "Muted"), "Payment, payout, and webhook queue"},
			{"Notification preferences", "Subscription alerts", boolCSV(preferences.AlertSubscriptions, "Watched", "Muted"), "Subscription billing and plan usage"},
			{"Notification preferences", "Promotion alerts", boolCSV(preferences.AlertPromotions, "Watched", "Muted"), "Promotion redemption activity"},
			{"Notification preferences", "Risk alerts", boolCSV(preferences.AlertRisk, "Watched", "Muted"), "Risk review queue"},
			{"Notification preferences", "Support alerts", boolCSV(preferences.AlertSupport, "Watched", "Muted"), "Support queue"},
			{"Platform policy", "Platform name", settings.PlatformName, settings.SupportEmail},
			{"Platform policy", "Maintenance mode", boolCSV(settings.MaintenanceMode, "On", "Off"), "Global operator-controlled maintenance flag"},
			{"Platform policy", "Verification SLA", fmt.Sprintf("%dh", settings.VerificationSLAHours), "Target KYC review window"},
			{"Platform policy", "Payout review threshold", moneyCSV(int64(settings.PayoutReviewThresholdPesewas)), "Settlement review threshold"},
		}, nil
	case "subscriptions":
		records, err := handler.service.ListSubscriptions(ctx, adminauthapp.ListSubscriptionsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Business", "Handle", "Plan", "Status", "Billing mode", "Monthly fee", "Last invoice", "Last payment", "Next billing"}}
		for _, record := range records {
			rows = append(rows, []string{record.BusinessName, record.Handle, record.PlanName, record.Status, record.BillingMode, moneyCSV(record.MonthlyFeeMinor), record.LastInvoiceRef, optionalTimeCSV(record.LastPaymentAt), optionalTimeCSV(record.NextBillingAt)})
		}
		return rows, nil
	case "plans":
		records, err := handler.service.ListPlans(ctx, adminauthapp.ListPlansCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Name", "Code", "Active", "Monthly fee", "Commission", "Design limit", "Businesses", "Active subscriptions", "Estimated MRR", "Created", "Updated"}}
		for _, record := range records {
			designLimit := "Unlimited"
			if record.DesignLimit != nil {
				designLimit = fmt.Sprint(*record.DesignLimit)
			}
			rows = append(rows, []string{
				record.Name,
				record.Code,
				boolCSV(record.IsActive, "Active", "Archived"),
				moneyCSV(record.MonthlyFeeMinor),
				fmt.Sprintf("%.2f%%", float64(record.CommissionBPS)/100),
				designLimit,
				fmt.Sprint(record.BusinessCount),
				fmt.Sprint(record.ActiveSubscriptionCount),
				moneyCSV(record.EstimatedMRRMinor),
				timeCSV(record.CreatedAt),
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "promotions":
		records, err := handler.service.ListPromotions(ctx, adminauthapp.ListPromotionsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Title", "Code", "Business", "Status", "Type", "Value", "Funding", "Scope", "Redemptions", "Discount redeemed"}}
		for _, record := range records {
			rows = append(rows, []string{record.Title, record.Code, fallbackText(record.BusinessName, "Platform-wide"), record.Status, record.DiscountType, fmt.Sprint(record.DiscountValue), record.FundingSource, record.Scope, fmt.Sprint(record.RedemptionCount), moneyCSV(record.DiscountRedeemedMinor)})
		}
		return rows, nil
	case "ad-campaigns":
		records, err := handler.service.ListAdCampaigns(ctx, adminauthapp.ListAdCampaignsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Campaign", "Business", "Handle", "Placement", "Target", "Status", "Pricing", "Budget", "Spend", "Daily cap", "Starts", "Ends", "Impressions", "Clicks", "CTR", "Review note", "Updated"}}
		for _, record := range records {
			dailyCap := ""
			if record.DailyCapMinor != nil {
				dailyCap = moneyCSV(*record.DailyCapMinor)
			}
			rows = append(rows, []string{
				record.Headline,
				record.BusinessName,
				record.BusinessHandle,
				record.PlacementType,
				fallbackText(record.TargetLabel, record.TargetRefID),
				record.Status,
				record.PricingModel,
				moneyCSV(record.BudgetMinor),
				moneyCSV(record.SpendMinor),
				dailyCap,
				timeCSV(record.StartsAt),
				timeCSV(record.EndsAt),
				fmt.Sprint(record.ImpressionCount),
				fmt.Sprint(record.ClickCount),
				fmt.Sprintf("%.2f%%", float64(record.ClickRateBPS)/100),
				record.ReviewNote,
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "affiliates":
		records, err := handler.service.ListAffiliates(ctx, adminauthapp.ListAffiliatesCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Affiliate", "Code", "Entity", "Contact", "Email", "Phone", "Website", "Commission", "Cookie window", "Payout mode", "Payout reference", "Status", "Notes", "Updated"}}
		for _, record := range records {
			commission := moneyCSV(record.CommissionRate)
			if record.CommissionModel == "percentage" {
				commission = fmt.Sprintf("%.2f%%", float64(record.CommissionRate)/100)
			}
			rows = append(rows, []string{
				record.DisplayName,
				record.Code,
				record.EntityType,
				record.ContactName,
				record.Email,
				record.Phone,
				record.WebsiteURL,
				commission,
				fmt.Sprintf("%d days", record.CookieWindowDays),
				record.PayoutMode,
				record.PayoutReference,
				record.Status,
				record.Notes,
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "referral-programmes":
		records, err := handler.service.ListReferralProgrammes(ctx, adminauthapp.ListReferralProgrammesCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Programme", "Code prefix", "Audience", "Referrer reward", "New customer reward", "Reward", "Reward cap", "Minimum order", "Hold days", "Status", "Starts", "Ends", "Notes", "Updated"}}
		for _, record := range records {
			reward := moneyCSV(record.RewardValue)
			if record.RewardType == "percentage" {
				reward = fmt.Sprintf("%.2f%%", float64(record.RewardValue)/100)
			}
			rewardCap := ""
			if record.MaxRewardMinor != nil {
				rewardCap = moneyCSV(*record.MaxRewardMinor)
			}
			rows = append(rows, []string{
				record.Title,
				record.CodePrefix,
				record.Audience,
				record.ReferrerRewardKind,
				record.RefereeRewardKind,
				reward,
				rewardCap,
				moneyCSV(record.QualifyingOrderMinMinor),
				fmt.Sprintf("%d days", record.RewardHoldDays),
				record.Status,
				optionalTimeCSV(record.StartsAt),
				optionalTimeCSV(record.EndsAt),
				record.Notes,
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "promotion-redemptions":
		records, err := handler.service.ListPromotions(ctx, adminauthapp.ListPromotionsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Promotion", "Code", "Business", "Business ID", "Customer", "Customer ID", "Order ID", "Status", "Discount", "Redeemed at", "Created at", "Updated at"}}
		for _, record := range records {
			for _, redemption := range record.RecentRedemptions {
				customerID := ""
				if redemption.CustomerID != nil {
					customerID = redemption.CustomerID.String()
				}
				orderID := ""
				if redemption.OrderID != nil {
					orderID = redemption.OrderID.String()
				}
				rows = append(rows, []string{
					record.Title,
					record.Code,
					fallbackText(record.BusinessName, "Platform-wide"),
					redemption.BusinessID.String(),
					fallbackText(redemption.CustomerName, "Unknown customer"),
					customerID,
					orderID,
					redemption.Status,
					moneyCSV(redemption.DiscountMinor),
					optionalTimeCSV(redemption.RedeemedAt),
					timeCSV(redemption.CreatedAt),
					timeCSV(redemption.UpdatedAt),
				})
			}
		}
		return rows, nil
	default:
		return nil, ports.ErrNotFound
	}
}

func (handler Handler) roles(w http.ResponseWriter, r *http.Request) {
	records, err := handler.service.ListRolePermissions(r.Context())
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	roles := make([]roleResponse, 0, len(records))
	for _, record := range records {
		roles = append(roles, newRoleResponse(record.Role, record.Permissions))
	}

	permissions := make([]permissionResponse, 0, len(admindomain.PermissionCatalog()))
	for _, permission := range admindomain.PermissionCatalog() {
		permissions = append(permissions, newPermissionResponse(permission))
	}

	writeJSON(w, http.StatusOK, roleCatalogResponse{
		Roles:       roles,
		Permissions: permissions,
	})
}

func (handler Handler) updateRolePermissions(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateRolePermissionsRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	permissions := make([]admindomain.Permission, 0, len(request.Permissions))
	for _, permission := range request.Permissions {
		permissions = append(permissions, admindomain.Permission(permission))
	}

	record, err := handler.service.UpdateRolePermissions(r.Context(), adminauthapp.UpdateRolePermissionsCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Role:        admindomain.Role(chi.URLParam(r, "role")),
		Permissions: permissions,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newRoleResponse(record.Role, record.Permissions))
}

func (handler Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	users, err := handler.service.ListUsers(r.Context(), adminauthapp.ListUsersCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]adminUserResponse, 0, len(users))
	for _, user := range users {
		out = append(out, newAdminUserResponse(user))
	}
	writeJSON(w, http.StatusOK, map[string][]adminUserResponse{"users": out})
}

func (handler Handler) createUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request createUserRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.CreateUser(r.Context(), adminauthapp.CreateUserCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		DisplayName: request.DisplayName,
		Email:       request.Email,
		Password:    request.Password,
		Role:        admindomain.Role(request.Role),
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAdminUserResponse(user))
}

func (handler Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateUserRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.UpdateUser(r.Context(), adminauthapp.UpdateUserCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		UserID:      common.ID(chi.URLParam(r, "id")),
		DisplayName: request.DisplayName,
		Role:        admindomain.Role(request.Role),
		IsActive:    request.IsActive,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdminUserResponse(user))
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}

	var trailing struct{}
	if err := decoder.Decode(&trailing); err != io.EOF {
		return errors.New("request body must contain a single JSON object")
	}

	return nil
}

func promotionBusinessID(value string) *common.ID {
	return optionalCommonID(value)
}

func optionalCommonID(value string) *common.ID {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	id := common.ID(trimmed)
	return &id
}

func newAuthResponse(result adminauthapp.AuthResult) authResponse {
	return authResponse{
		AdminUserID:      result.AdminUserID.String(),
		Email:            result.Email,
		DisplayName:      result.DisplayName,
		Role:             string(result.Role),
		AccessToken:      result.AccessToken,
		RefreshToken:     result.RefreshToken,
		AccessExpiresAt:  result.AccessExpiresAt.Format(time.RFC3339),
		RefreshExpiresAt: result.RefreshExpiresAt.Format(time.RFC3339),
	}
}

func newAdminUserResponse(user ports.AdminUserRecord) adminUserResponse {
	return adminUserResponse{
		AdminUserID: user.UserID.String(),
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Role:        string(user.Role),
		IsActive:    user.IsActive,
		CreatedAt:   user.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   user.UpdatedAt.Format(time.RFC3339),
	}
}

func newPreferencesResponse(preferences ports.AdminPreferencesRecord) adminPreferencesResponse {
	return adminPreferencesResponse{
		Timezone:           preferences.Timezone,
		PhoneNumber:        preferences.PhoneNumber,
		NotifyEmail:        preferences.NotifyEmail,
		NotifySMS:          preferences.NotifySMS,
		AlertVerifications: preferences.AlertVerifications,
		AlertMoneyRails:    preferences.AlertMoneyRails,
		AlertSubscriptions: preferences.AlertSubscriptions,
		AlertPromotions:    preferences.AlertPromotions,
		AlertRisk:          preferences.AlertRisk,
		AlertSupport:       preferences.AlertSupport,
		DailyDigestTime:    preferences.DailyDigestTime,
		UpdatedAt:          preferences.UpdatedAt.Format(time.RFC3339),
	}
}

func newPlatformSettingsResponse(settings ports.AdminPlatformSettingsRecord) platformSettingsResponse {
	return platformSettingsResponse{
		PlatformName:                 settings.PlatformName,
		SupportEmail:                 settings.SupportEmail,
		VerificationSLAHours:         settings.VerificationSLAHours,
		PayoutReviewThresholdPesewas: settings.PayoutReviewThresholdPesewas,
		MaintenanceMode:              settings.MaintenanceMode,
		UpdatedAt:                    settings.UpdatedAt.Format(time.RFC3339),
	}
}

func newAuditEventResponse(event ports.AdminAuditEventRecord) auditEventResponse {
	return auditEventResponse{
		AuditEventID: event.AuditEventID.String(),
		ActorEmail:   event.ActorEmail,
		ActorRole:    string(event.ActorRole),
		Action:       event.Action,
		TargetType:   event.TargetType,
		TargetID:     event.TargetID,
		TargetLabel:  event.TargetLabel,
		Summary:      event.Summary,
		Severity:     string(event.Severity),
		CreatedAt:    event.CreatedAt.Format(time.RFC3339),
	}
}

func newBusinessVerificationResponse(record ports.AdminVerificationCaseRecord) businessVerificationResponse {
	return businessVerificationResponse{
		BusinessID:   record.BusinessID.String(),
		BusinessName: record.BusinessName,
		Handle:       record.Handle,
		OwnerName:    fallbackText(record.OwnerName, "Owner pending"),
		OwnerEmail:   fallbackText(record.OwnerEmail, "owner email pending"),
		SubmittedAt:  record.SubmittedAt.Format(time.RFC3339),
		UpdatedAt:    record.UpdatedAt.Format(time.RFC3339),
		Plan:         fallbackText(record.PlanName, record.PlanCode),
		Status:       string(record.VerificationStatus),
		RiskLevel:    verificationRiskLevel(record),
		Documents:    verificationDocuments(record),
		Checks:       verificationChecks(record),
		Evidence:     verificationEvidence(record),
		Notes:        verificationNotes(record),
	}
}

func newBusinessResponse(record ports.AdminBusinessRecord) businessResponse {
	suspendedAt := ""
	if record.SuspendedAt != nil {
		suspendedAt = record.SuspendedAt.Format(time.RFC3339)
	}

	return businessResponse{
		BusinessID:         record.BusinessID.String(),
		Name:               record.Name,
		Handle:             record.Handle,
		OwnerName:          fallbackText(record.OwnerName, "Owner pending"),
		OwnerEmail:         fallbackText(record.OwnerEmail, "owner email pending"),
		Status:             businessListStatus(record),
		VerificationStatus: string(record.VerificationStatus),
		OperationalStatus:  string(record.OperationalStatus),
		Plan:               fallbackText(record.PlanName, record.PlanCode),
		Orders:             record.OrdersCount,
		GMVMinor:           record.GMVMinor,
		CommissionMinor:    record.CommissionMinor,
		RiskLevel:          businessRiskLevel(record),
		LastActive:         record.LastActiveAt.Format(time.RFC3339),
		SubaccountRef:      record.SettlementSubaccount,
		SuspensionReason:   record.SuspensionReason,
		SuspendedAt:        suspendedAt,
		UpdatedAt:          record.UpdatedAt.Format(time.RFC3339),
	}
}

func newPlatformMetricsResponse(record ports.AdminPlatformMetricsRecord) platformMetricsResponse {
	return platformMetricsResponse{
		GMVMonthMinor:             record.GMVMonthMinor,
		PlatformRevenueMonthMinor: record.PlatformRevenueMonthMinor,
		ActiveBusinesses:          record.ActiveBusinesses,
		TotalBusinesses:           record.TotalBusinesses,
		PendingVerifications:      record.PendingVerifications,
		SuspendedBusinesses:       record.SuspendedBusinesses,
		PaymentHealthBPS:          record.PaymentHealthBPS,
		FailedPayments30d:         record.FailedPayments30d,
		TotalPayments30d:          record.TotalPayments30d,
		UpdatedAt:                 record.UpdatedAt.Format(time.RFC3339),
	}
}

func newMoneyRailsResponse(record ports.AdminMoneyRailsRecord) moneyRailsResponse {
	webhookEvents := make([]moneyWebhookEventResponse, 0, len(record.WebhookEvents))
	for _, event := range record.WebhookEvents {
		webhookEvents = append(webhookEvents, moneyWebhookEventResponse{
			ID:                event.ID,
			ProviderReference: event.ProviderReference,
			Business:          event.BusinessName,
			Status:            event.Status,
			Purpose:           event.Purpose,
			AmountMinor:       event.AmountMinor,
			Attempts:          event.Attempts,
			ReceivedAt:        event.ReceivedAt.Format(time.RFC3339),
			Note:              event.Note,
		})
	}

	payoutReviews := make([]moneyPayoutReviewResponse, 0, len(record.PayoutReviews))
	for _, review := range record.PayoutReviews {
		payoutReviews = append(payoutReviews, newMoneyPayoutReviewResponse(review))
	}

	return moneyRailsResponse{
		WebhookEvents: webhookEvents,
		PayoutReviews: payoutReviews,
		UpdatedAt:     record.UpdatedAt.Format(time.RFC3339),
	}
}

func newMoneyPayoutReviewResponse(record ports.AdminMoneyPayoutReviewRecord) moneyPayoutReviewResponse {
	holdUpdatedAt := ""
	if record.HoldUpdatedAt != nil {
		holdUpdatedAt = record.HoldUpdatedAt.Format(time.RFC3339)
	}

	return moneyPayoutReviewResponse{
		ID:              record.ID,
		Business:        record.BusinessName,
		SubaccountRef:   record.SubaccountRef,
		Status:          record.Status,
		SettlementMinor: record.SettlementMinor,
		CommissionMinor: record.CommissionMinor,
		NextAction:      record.NextAction,
		HoldActive:      record.HoldActive,
		HoldReason:      record.HoldReason,
		HoldUpdatedAt:   holdUpdatedAt,
	}
}

func newMoneyReplayRequestResponse(record ports.AdminMoneyReplayRequestRecord) moneyReplayRequestResponse {
	return moneyReplayRequestResponse{
		ReplayRequestID:   record.ReplayRequestID.String(),
		ProviderReference: record.ProviderReference,
		PaymentID:         record.PaymentID.String(),
		Business:          record.BusinessName,
		Reason:            record.Reason,
		Status:            record.Status,
		CreatedAt:         record.CreatedAt.Format(time.RFC3339),
	}
}

func newMoneyReversalResponse(record ports.AdminMoneyReversalRecord) moneyReversalResponse {
	response := moneyReversalResponse{
		PaymentID:                record.PaymentID.String(),
		ProviderReference:        record.ProviderReference,
		BusinessID:               record.BusinessID.String(),
		Business:                 record.BusinessName,
		PaymentReversed:          record.PaymentReversed,
		PromotionRedemptionCount: record.PromotionRedemptionCount,
		AffiliateConversionCount: record.AffiliateConversionCount,
		ReferralCount:            record.ReferralCount,
		ReferralRewardCount:      record.ReferralRewardCount,
		GeneratedPromotionCount:  record.GeneratedPromotionCount,
		Reason:                   record.Reason,
		ReversedAt:               record.ReversedAt.Format(time.RFC3339),
	}
	if record.OrderID != nil {
		response.OrderID = record.OrderID.String()
	}
	return response
}

func newSubscriptionResponse(record ports.AdminSubscriptionRecord) subscriptionResponse {
	events := make([]subscriptionEventResponse, 0, len(record.Events))
	for _, event := range record.Events {
		events = append(events, subscriptionEventResponse{
			SubscriptionEventID: event.SubscriptionEventID.String(),
			EventType:           event.EventType,
			Summary:             event.Summary,
			ActorEmail:          event.ActorEmail,
			CreatedAt:           event.CreatedAt.Format(time.RFC3339),
		})
	}
	invoices := make([]subscriptionInvoiceResponse, 0, len(record.Invoices))
	for _, invoice := range record.Invoices {
		invoices = append(invoices, subscriptionInvoiceResponse{
			InvoiceID:          invoice.InvoiceID.String(),
			SubscriptionID:     invoice.SubscriptionID.String(),
			InvoiceRef:         invoice.InvoiceRef,
			Status:             invoice.Status,
			BillingMode:        invoice.BillingMode,
			Provider:           invoice.Provider,
			ProviderInvoiceRef: invoice.ProviderInvoiceRef,
			PaymentURL:         invoice.PaymentURL,
			AmountMinor:        invoice.AmountMinor,
			Currency:           invoice.Currency,
			PeriodStart:        invoice.PeriodStart.Format(time.RFC3339),
			PeriodEnd:          invoice.PeriodEnd.Format(time.RFC3339),
			DueAt:              invoice.DueAt.Format(time.RFC3339),
			PaidAt:             optionalTimeString(invoice.PaidAt),
			FailedAt:           optionalTimeString(invoice.FailedAt),
			FailureReason:      invoice.FailureReason,
			CreatedAt:          invoice.CreatedAt.Format(time.RFC3339),
			UpdatedAt:          invoice.UpdatedAt.Format(time.RFC3339),
		})
	}

	return subscriptionResponse{
		SubscriptionID:          record.SubscriptionID.String(),
		BusinessID:              record.BusinessID.String(),
		BusinessName:            record.BusinessName,
		Handle:                  record.Handle,
		OwnerEmail:              record.OwnerEmail,
		PlanCode:                record.PlanCode,
		PlanName:                record.PlanName,
		MonthlyFeeMinor:         record.MonthlyFeeMinor,
		CommissionBPS:           record.CommissionBPS,
		DesignLimit:             record.DesignLimit,
		DesignCount:             record.DesignCount,
		Status:                  record.Status,
		BillingMode:             record.BillingMode,
		Provider:                record.Provider,
		ProviderCustomerRef:     record.ProviderCustomerRef,
		ProviderSubscriptionRef: record.ProviderSubscriptionRef,
		CurrentPeriodStart:      record.CurrentPeriodStart.Format(time.RFC3339),
		CurrentPeriodEnd:        record.CurrentPeriodEnd.Format(time.RFC3339),
		TrialEndsAt:             optionalTimeString(record.TrialEndsAt),
		GraceEndsAt:             optionalTimeString(record.GraceEndsAt),
		CancelAtPeriodEnd:       record.CancelAtPeriodEnd,
		CanceledAt:              optionalTimeString(record.CanceledAt),
		FailedPaymentCount:      record.FailedPaymentCount,
		LastInvoiceRef:          record.LastInvoiceRef,
		LastPaymentAt:           optionalTimeString(record.LastPaymentAt),
		NextBillingAt:           optionalTimeString(record.NextBillingAt),
		Orders:                  record.OrdersCount,
		GMVMinor:                record.GMVMinor,
		CommissionMinor:         record.CommissionMinor,
		UpdatedAt:               record.UpdatedAt.Format(time.RFC3339),
		Events:                  events,
		Invoices:                invoices,
	}
}

func newSubscriptionBillingSweepResponse(
	record ports.AdminSubscriptionBillingSweepRecord,
) subscriptionBillingSweepResponse {
	return subscriptionBillingSweepResponse{
		OverdueInvoicesFailed: record.OverdueInvoicesFailed,
		SubscriptionsCanceled: record.SubscriptionsCanceled,
		BusinessesTouched:     record.BusinessesTouched,
		RanAt:                 record.RanAt.Format(time.RFC3339),
	}
}

func newPlanResponse(record ports.AdminPlanRecord) planResponse {
	return planResponse{
		PlanID:                  record.PlanID.String(),
		Code:                    record.Code,
		Name:                    record.Name,
		MonthlyFeeMinor:         record.MonthlyFeeMinor,
		CommissionBPS:           record.CommissionBPS,
		DesignLimit:             record.DesignLimit,
		IsActive:                record.IsActive,
		BusinessCount:           record.BusinessCount,
		ActiveSubscriptionCount: record.ActiveSubscriptionCount,
		EstimatedMRRMinor:       record.EstimatedMRRMinor,
		CreatedAt:               record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:               record.UpdatedAt.Format(time.RFC3339),
	}
}

func newPromotionResponse(record ports.AdminPromotionRecord) promotionResponse {
	businessID := ""
	if record.BusinessID != nil {
		businessID = record.BusinessID.String()
	}
	redemptions := make([]promotionRedemptionResponse, 0, len(record.RecentRedemptions))
	for _, redemption := range record.RecentRedemptions {
		orderID := ""
		if redemption.OrderID != nil {
			orderID = redemption.OrderID.String()
		}
		customerID := ""
		if redemption.CustomerID != nil {
			customerID = redemption.CustomerID.String()
		}
		redemptions = append(redemptions, promotionRedemptionResponse{
			PromotionRedemptionID: redemption.PromotionRedemptionID.String(),
			PromotionID:           redemption.PromotionID.String(),
			BusinessID:            redemption.BusinessID.String(),
			OrderID:               orderID,
			CustomerID:            customerID,
			CustomerName:          redemption.CustomerName,
			DiscountMinor:         redemption.DiscountMinor,
			Status:                redemption.Status,
			RedeemedAt:            optionalTimeString(redemption.RedeemedAt),
			CreatedAt:             redemption.CreatedAt.Format(time.RFC3339),
			UpdatedAt:             redemption.UpdatedAt.Format(time.RFC3339),
		})
	}
	return promotionResponse{
		PromotionID:           record.PromotionID.String(),
		BusinessID:            businessID,
		BusinessName:          record.BusinessName,
		BusinessHandle:        record.BusinessHandle,
		Code:                  record.Code,
		Title:                 record.Title,
		Description:           record.Description,
		DiscountType:          record.DiscountType,
		DiscountValue:         record.DiscountValue,
		MaxDiscountMinor:      record.MaxDiscountMinor,
		MinSpendMinor:         record.MinSpendMinor,
		UsageLimitGlobal:      record.UsageLimitGlobal,
		UsageLimitPerCustomer: record.UsageLimitPerCustomer,
		FundingSource:         record.FundingSource,
		Scope:                 record.Scope,
		TargetCollectionID:    optionalIDString(record.TargetCollectionID),
		TargetDesignID:        optionalIDString(record.TargetDesignID),
		Status:                record.Status,
		StartsAt:              optionalTimeString(record.StartsAt),
		EndsAt:                optionalTimeString(record.EndsAt),
		RedemptionCount:       record.RedemptionCount,
		DiscountRedeemedMinor: record.DiscountRedeemedMinor,
		RecentRedemptions:     redemptions,
		CreatedAt:             record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:             record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAdCampaignResponse(record ports.AdminAdCampaignRecord) adCampaignResponse {
	payments := make([]adCampaignPaymentResponse, 0, len(record.RecentPayments))
	for _, payment := range record.RecentPayments {
		payments = append(payments, newAdCampaignPaymentResponse(payment))
	}
	return adCampaignResponse{
		CampaignID:      record.CampaignID.String(),
		BusinessID:      record.BusinessID.String(),
		BusinessName:    record.BusinessName,
		BusinessHandle:  record.BusinessHandle,
		PlacementType:   record.PlacementType,
		TargetRefID:     record.TargetRefID,
		TargetLabel:     record.TargetLabel,
		Headline:        record.Headline,
		Description:     record.Description,
		Status:          record.Status,
		PricingModel:    record.PricingModel,
		BudgetMinor:     record.BudgetMinor,
		SpendMinor:      record.SpendMinor,
		DailyCapMinor:   record.DailyCapMinor,
		StartsAt:        record.StartsAt.Format(time.RFC3339),
		EndsAt:          record.EndsAt.Format(time.RFC3339),
		ImpressionCount: record.ImpressionCount,
		ClickCount:      record.ClickCount,
		ClickRateBPS:    record.ClickRateBPS,
		ReviewNote:      record.ReviewNote,
		Payments:        payments,
		CreatedAt:       record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAdCampaignPaymentResponse(record ports.AdminAdCampaignPaymentRecord) adCampaignPaymentResponse {
	return adCampaignPaymentResponse{
		PaymentID:         record.PaymentID.String(),
		CampaignID:        record.CampaignID.String(),
		BusinessID:        record.BusinessID.String(),
		Provider:          record.Provider,
		ProviderReference: record.ProviderReference,
		PaymentURL:        record.PaymentURL,
		AmountMinor:       record.AmountMinor,
		Currency:          record.Currency,
		Status:            record.Status,
		PaidAt:            optionalTimeString(record.PaidAt),
		FailedAt:          optionalTimeString(record.FailedAt),
		FailureReason:     record.FailureReason,
		CreatedAt:         record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAffiliateResponse(record ports.AdminAffiliateRecord) affiliateResponse {
	return affiliateResponse{
		AffiliateID:      record.AffiliateID.String(),
		EntityType:       record.EntityType,
		Code:             record.Code,
		DisplayName:      record.DisplayName,
		ContactName:      record.ContactName,
		Email:            record.Email,
		Phone:            record.Phone,
		WebsiteURL:       record.WebsiteURL,
		CommissionModel:  record.CommissionModel,
		CommissionRate:   record.CommissionRate,
		CookieWindowDays: record.CookieWindowDays,
		PayoutMode:       record.PayoutMode,
		PayoutReference:  record.PayoutReference,
		Status:           record.Status,
		Notes:            record.Notes,
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAffiliateAttributionResponse(record ports.AdminAffiliateAttributionRecord) affiliateAttributionResponse {
	response := affiliateAttributionResponse{
		AffiliateID:             record.AffiliateID.String(),
		Code:                    record.Code,
		DisplayName:             record.DisplayName,
		ClickCount:              record.ClickCount,
		ConversionCount:         record.ConversionCount,
		PendingConversionCount:  record.PendingConversionCount,
		ApprovedConversionCount: record.ApprovedConversionCount,
		SettledConversionCount:  record.SettledConversionCount,
		ReversedConversionCount: record.ReversedConversionCount,
		GrossMinor:              record.GrossMinor,
		CommissionMinor:         record.CommissionMinor,
		RecentConversions:       make([]affiliateConversionResponse, 0, len(record.RecentConversions)),
		RecentPayouts:           make([]affiliatePayoutResponse, 0, len(record.RecentPayouts)),
	}
	if record.LastActivityAt != nil {
		response.LastActivityAt = record.LastActivityAt.Format(time.RFC3339)
	}
	for _, conversion := range record.RecentConversions {
		response.RecentConversions = append(response.RecentConversions, newAffiliateConversionResponse(conversion))
	}
	for _, payout := range record.RecentPayouts {
		response.RecentPayouts = append(response.RecentPayouts, newAffiliatePayoutResponse(payout))
	}
	return response
}

func newAffiliateConversionResponse(record ports.AdminAffiliateConversionRecord) affiliateConversionResponse {
	response := affiliateConversionResponse{
		ConversionID:     record.ConversionID.String(),
		AffiliateID:      record.AffiliateID.String(),
		BusinessID:       record.BusinessID.String(),
		BusinessName:     record.BusinessName,
		OrderID:          record.OrderID.String(),
		GrossMinor:       record.GrossMinor,
		CommissionMinor:  record.CommissionMinor,
		Status:           record.Status,
		AttributionModel: record.AttributionModel,
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        record.UpdatedAt.Format(time.RFC3339),
	}
	if record.HoldUntil != nil {
		response.HoldUntil = record.HoldUntil.Format(time.RFC3339)
	}
	return response
}

func newAffiliatePayoutResponse(record ports.AdminAffiliatePayoutRecord) affiliatePayoutResponse {
	return affiliatePayoutResponse{
		PayoutBatchID:   record.PayoutBatchID.String(),
		AffiliateID:     record.AffiliateID.String(),
		DisplayName:     record.DisplayName,
		PayoutMode:      record.PayoutMode,
		PayoutReference: record.PayoutReference,
		ConversionCount: record.ConversionCount,
		GrossMinor:      record.GrossMinor,
		CommissionMinor: record.CommissionMinor,
		Status:          record.Status,
		Notes:           record.Notes,
		CreatedAt:       record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       record.UpdatedAt.Format(time.RFC3339),
	}
}

func newReferralProgrammeResponse(record ports.AdminReferralProgrammeRecord) referralProgrammeResponse {
	response := referralProgrammeResponse{
		ProgrammeID:             record.ProgrammeID.String(),
		Title:                   record.Title,
		CodePrefix:              record.CodePrefix,
		Audience:                record.Audience,
		ReferrerRewardKind:      record.ReferrerRewardKind,
		RefereeRewardKind:       record.RefereeRewardKind,
		RewardType:              record.RewardType,
		RewardValue:             record.RewardValue,
		MaxRewardMinor:          record.MaxRewardMinor,
		QualifyingOrderMinMinor: record.QualifyingOrderMinMinor,
		RewardHoldDays:          record.RewardHoldDays,
		Status:                  record.Status,
		Notes:                   record.Notes,
		CreatedAt:               record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:               record.UpdatedAt.Format(time.RFC3339),
	}
	if record.StartsAt != nil {
		response.StartsAt = record.StartsAt.Format(time.RFC3339)
	}
	if record.EndsAt != nil {
		response.EndsAt = record.EndsAt.Format(time.RFC3339)
	}
	for _, code := range record.RecentCodes {
		response.Codes = append(response.Codes, newReferralCodeResponse(code))
	}
	return response
}

func newReferralCodeResponse(record ports.AdminReferralCodeRecord) referralCodeResponse {
	response := referralCodeResponse{
		ReferralCodeID: record.ReferralCodeID.String(),
		ProgrammeID:    record.ProgrammeID.String(),
		BusinessName:   record.BusinessName,
		BusinessHandle: record.BusinessHandle,
		OwnerType:      record.OwnerType,
		OwnerLabel:     record.OwnerLabel,
		Code:           record.Code,
		Status:         record.Status,
		ReferralCount:  record.ReferralCount,
		QualifiedCount: record.QualifiedCount,
		RewardedCount:  record.RewardedCount,
		CreatedAt:      record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      record.UpdatedAt.Format(time.RFC3339),
	}
	if record.BusinessID != nil {
		response.BusinessID = record.BusinessID.String()
	}
	if record.OwnerBusinessID != nil {
		response.OwnerBusinessID = record.OwnerBusinessID.String()
	}
	if record.OwnerCustomerID != nil {
		response.OwnerCustomerID = record.OwnerCustomerID.String()
	}
	return response
}

func newReferralRewardIssueResponse(record ports.AdminReferralRewardIssueRecord) referralRewardIssueResponse {
	return referralRewardIssueResponse{
		ReferralCount:         record.ReferralCount,
		RewardCount:           record.RewardCount,
		VoucherCount:          record.VoucherCount,
		CommissionRebateCount: record.CommissionRebateCount,
		TotalRewardMinor:      record.TotalRewardMinor,
		IssuedAt:              record.IssuedAt.Format(time.RFC3339),
	}
}

func newRiskReviewResponse(record ports.AdminRiskReviewRecord) riskReviewResponse {
	return riskReviewResponse{
		ReviewKey:  record.ReviewKey,
		BusinessID: record.BusinessID.String(),
		Title:      record.Title,
		Business:   record.BusinessName,
		Level:      record.Level,
		Reason:     record.Reason,
		Owner:      record.Owner,
		Status:     record.Status,
		UpdatedAt:  record.UpdatedAt.Format(time.RFC3339),
	}
}

func newSupportTicketResponse(record ports.AdminSupportTicketRecord) supportTicketResponse {
	return supportTicketResponse{
		TicketKey:           record.TicketKey,
		BusinessID:          record.BusinessID.String(),
		Subject:             record.Subject,
		Business:            record.BusinessName,
		Priority:            record.Priority,
		Summary:             record.Summary,
		Category:            record.Category,
		Status:              record.Status,
		AssignedAdminUserID: record.AssignedAdminUserID.String(),
		AssignedAdminEmail:  record.AssignedAdminEmail,
		AssignedAdminName:   record.AssignedAdminName,
		CreatedAt:           record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           record.UpdatedAt.Format(time.RFC3339),
	}
}

func optionalTimeString(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format(time.RFC3339)
}

func optionalIDString(value *common.ID) string {
	if value == nil {
		return ""
	}
	return value.String()
}

func businessListStatus(record ports.AdminBusinessRecord) string {
	if record.OperationalStatus == business.OperationalStatusSuspended {
		return string(business.OperationalStatusSuspended)
	}
	return string(record.VerificationStatus)
}

func businessRiskLevel(record ports.AdminBusinessRecord) string {
	if record.OperationalStatus == business.OperationalStatusSuspended ||
		record.VerificationStatus == business.VerificationStatusRejected {
		return "high"
	}
	if record.VerificationStatus != business.VerificationStatusVerified ||
		strings.TrimSpace(record.SettlementSubaccount) == "" {
		return "medium"
	}
	return "low"
}

func verificationRiskLevel(record ports.AdminVerificationCaseRecord) string {
	if string(record.VerificationStatus) == "rejected" {
		return "high"
	}
	if strings.TrimSpace(record.SettlementSubaccount) == "" && strings.TrimSpace(record.SettlementAccountHint) == "" {
		return "medium"
	}
	return "low"
}

func verificationDocuments(record ports.AdminVerificationCaseRecord) []string {
	documents := []string{"Business profile", "Owner account"}
	if strings.TrimSpace(record.SettlementSubaccount) != "" || strings.TrimSpace(record.SettlementAccountHint) != "" {
		documents = append(documents, "Settlement account")
	}
	if strings.TrimSpace(record.PlanCode) != "" {
		documents = append(documents, "Plan record")
	}
	return documents
}

func verificationChecks(record ports.AdminVerificationCaseRecord) []string {
	checks := []string{
		"Store handle reserved",
		"Owner account attached",
		"Plan is active",
	}
	if strings.TrimSpace(record.SettlementSubaccount) != "" {
		checks = append(checks, "Payment subaccount connected")
	} else {
		checks = append(checks, "Payment subaccount pending")
	}
	return checks
}

func verificationEvidence(record ports.AdminVerificationCaseRecord) []string {
	evidence := []string{
		"Store handle: " + record.Handle,
		"Owner: " + fallbackText(record.OwnerEmail, "owner email pending"),
		"Plan: " + fallbackText(record.PlanName, record.PlanCode),
	}
	if strings.TrimSpace(record.SettlementSubaccount) != "" {
		evidence = append(evidence, "Provider subaccount: "+record.SettlementSubaccount)
	}
	if strings.TrimSpace(record.SettlementAccountHint) != "" {
		evidence = append(evidence, "Settlement account "+maskedAccountHint(record.SettlementAccountHint))
	}
	return evidence
}

func verificationNotes(record ports.AdminVerificationCaseRecord) string {
	switch string(record.VerificationStatus) {
	case "verified":
		return "Business verification is approved. Payments and deposit flows can stay enabled."
	case "rejected":
		return "Business verification was rejected. Reopen only after owner and settlement evidence are corrected."
	}
	if strings.TrimSpace(record.SettlementSubaccount) == "" && strings.TrimSpace(record.SettlementAccountHint) == "" {
		return "Settlement details are not connected yet. Hold before enabling payment rails."
	}
	return "Review the owner account, handle, plan, and settlement evidence before enabling money rails."
}

func maskedAccountHint(value string) string {
	trimmed := strings.TrimSpace(value)
	runes := []rune(trimmed)
	if len(runes) <= 4 {
		return trimmed
	}
	return "ending " + string(runes[len(runes)-4:])
}

func fallbackText(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func newRoleResponse(role admindomain.Role, permissions []admindomain.Permission) roleResponse {
	out := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		out = append(out, string(permission))
	}

	return roleResponse{
		Role:        string(role),
		Label:       roleLabel(role),
		Permissions: out,
	}
}

func newPermissionResponse(permission admindomain.Permission) permissionResponse {
	return permissionResponse{
		Permission: string(permission),
		Label:      permissionLabel(permission),
	}
}

func roleLabel(role admindomain.Role) string {
	switch role {
	case admindomain.RoleOwner:
		return "Owner"
	case admindomain.RoleOperator:
		return "Operator"
	case admindomain.RoleSupport:
		return "Support"
	default:
		return string(role)
	}
}

func permissionLabel(permission admindomain.Permission) string {
	switch permission {
	case admindomain.PermissionManageAdminUsers:
		return "Manage admin users"
	case admindomain.PermissionManageRoles:
		return "Manage roles"
	case admindomain.PermissionManageSettings:
		return "Platform settings"
	case admindomain.PermissionReviewBusinesses:
		return "Business review"
	case admindomain.PermissionManageMoneyRails:
		return "Money rails"
	case admindomain.PermissionManageSubscriptions:
		return "Subscriptions"
	case admindomain.PermissionManagePlans:
		return "Plan packages"
	case admindomain.PermissionManagePromotions:
		return "Promotions"
	case admindomain.PermissionManageAds:
		return "Sponsored placements"
	case admindomain.PermissionManageGrowth:
		return "Growth programmes"
	case admindomain.PermissionManageRisk:
		return "Risk review"
	case admindomain.PermissionManageSupport:
		return "Support queue"
	case admindomain.PermissionViewAudit:
		return "Audit trail"
	default:
		return string(permission)
	}
}

func authError(err error) (int, string) {
	switch {
	case errors.Is(err, authdomain.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_input"
	case errors.Is(err, authdomain.ErrInvalidCredentials):
		return http.StatusUnauthorized, "invalid_credentials"
	case errors.Is(err, authdomain.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	case errors.Is(err, admindomain.ErrUserEmailTaken):
		return http.StatusConflict, "admin_user_email_taken"
	case errors.Is(err, ports.ErrSubscriptionBillingUnavailable):
		return http.StatusConflict, "subscription_billing_unavailable"
	case errors.Is(err, ports.ErrSubscriptionInvoiceOpen):
		return http.StatusConflict, "subscription_invoice_open"
	case errors.Is(err, ports.ErrPaymentInFlight):
		return http.StatusConflict, "payment_in_flight"
	case errors.Is(err, ports.ErrNotFound):
		return http.StatusNotFound, "not_found"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func writeCSV(w http.ResponseWriter, filename string, rows [][]string) {
	var body bytes.Buffer
	writer := csv.NewWriter(&body)
	writer.WriteAll(rows)
	if err := writer.Error(); err != nil {
		writeError(w, http.StatusInternalServerError, "csv_error")
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body.Bytes())
}

func safeExportName(value string) string {
	var builder strings.Builder
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case r == '-' || r == '_':
			builder.WriteRune(r)
		}
	}
	if builder.Len() == 0 {
		return "export"
	}
	return builder.String()
}

func moneyCSV(value int64) string {
	return fmt.Sprintf("GHS %.2f", float64(value)/100)
}

func timeCSV(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}

func optionalTimeCSV(value *time.Time) string {
	if value == nil {
		return ""
	}
	return timeCSV(*value)
}

func boolCSV(value bool, trueLabel string, falseLabel string) string {
	if value {
		return trueLabel
	}
	return falseLabel
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, errorResponse{Error: code})
}

func requestIP(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}
