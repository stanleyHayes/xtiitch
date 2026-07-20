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
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
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
	WhatsAppEnabled() bool
	SMSEnabled() bool
	PhoneOTPEnabled() bool
	UpdatePlatformSettings(ctx context.Context, command adminauthapp.UpdatePlatformSettingsCommand) (ports.AdminPlatformSettingsRecord, error)
	UpdateMarketingFlags(ctx context.Context, command adminauthapp.UpdateMarketingFlagsCommand) (ports.AdminPlatformSettingsRecord, error)
	SignBrandingUpload(ctx context.Context, command adminauthapp.SignBrandingUploadCommand) (ports.SignedUpload, error)
	ListBusinessVerifications(
		ctx context.Context,
		command adminauthapp.ListBusinessVerificationsCommand,
	) ([]ports.AdminVerificationCaseRecord, error)
	DecideBusinessVerification(
		ctx context.Context,
		command adminauthapp.DecideBusinessVerificationCommand,
	) (ports.AdminVerificationCaseRecord, error)
	ListBusinesses(ctx context.Context, command adminauthapp.ListBusinessesCommand) ([]ports.AdminBusinessRecord, error)
	DeleteBusiness(ctx context.Context, command adminauthapp.DeleteBusinessCommand) (ports.AdminBusinessDeleteRecord, error)
	ListBusinessActivity(ctx context.Context, command adminauthapp.ListBusinessActivityCommand) ([]ports.AdminBusinessActivityRecord, error)
	ListCustomers(ctx context.Context, command adminauthapp.ListCustomersCommand) ([]ports.AdminCustomerRecord, error)
	ExportCustomerData(ctx context.Context, command adminauthapp.ExportCustomerDataCommand) (ports.AdminCustomerExportRecord, error)
	EraseCustomerData(ctx context.Context, command adminauthapp.EraseCustomerDataCommand) (ports.AdminCustomerErasureRecord, error)
	UpdateBusinessStatus(ctx context.Context, command adminauthapp.UpdateBusinessStatusCommand) (ports.AdminBusinessRecord, error)
	GetPlatformMetrics(ctx context.Context, command adminauthapp.GetPlatformMetricsCommand) (ports.AdminPlatformMetricsRecord, error)
	GetMoneyRails(ctx context.Context, command adminauthapp.GetMoneyRailsCommand) (ports.AdminMoneyRailsRecord, error)
	GetOperationsHealth(ctx context.Context, command adminauthapp.GetOperationsHealthCommand) (adminauthapp.OperationsHealthResult, error)
	GetAdminNotifications(
		ctx context.Context,
		command adminauthapp.GetAdminNotificationsCommand,
	) (adminauthapp.AdminNotificationsResult, error)
	GetAdminReports(ctx context.Context, command adminauthapp.GetAdminReportsCommand) (adminauthapp.AdminReportsResult, error)
	GetLaunchReadiness(ctx context.Context, command adminauthapp.GetLaunchReadinessCommand) (adminauthapp.LaunchReadinessResult, error)
	ListSubscriptions(ctx context.Context, command adminauthapp.ListSubscriptionsCommand) ([]ports.AdminSubscriptionRecord, error)
	UpdateSubscription(ctx context.Context, command adminauthapp.UpdateSubscriptionCommand) (ports.AdminSubscriptionRecord, error)
	IssueSubscriptionInvoice(ctx context.Context, command adminauthapp.IssueSubscriptionInvoiceCommand) (ports.AdminSubscriptionRecord, error)
	MarkSubscriptionInvoicePaid(
		ctx context.Context,
		command adminauthapp.MarkSubscriptionInvoicePaidCommand,
	) (ports.AdminSubscriptionRecord, error)
	MarkSubscriptionInvoiceFailed(
		ctx context.Context,
		command adminauthapp.MarkSubscriptionInvoiceFailedCommand,
	) (ports.AdminSubscriptionRecord, error)
	RunSubscriptionBillingSweep(
		ctx context.Context,
		command adminauthapp.RunSubscriptionBillingSweepCommand,
	) (ports.AdminSubscriptionBillingSweepRecord, error)
	RunSubscriptionRecurringSweep(
		ctx context.Context,
		command adminauthapp.RunSubscriptionRecurringSweepCommand,
	) (ports.AdminSubscriptionRecurringSweepRecord, error)
	RunSubscriptionReminderSweep(
		ctx context.Context,
		command adminauthapp.RunSubscriptionReminderSweepCommand,
	) (ports.AdminSubscriptionReminderSweepRecord, error)
	InitializeSubscriptionAuthorization(
		ctx context.Context,
		command adminauthapp.InitializeSubscriptionAuthorizationCommand,
	) (adminauthapp.SubscriptionAuthorizationLinkResult, error)
	VerifySubscriptionAuthorization(
		ctx context.Context,
		command adminauthapp.VerifySubscriptionAuthorizationCommand,
	) (ports.AdminSubscriptionRecord, error)
	ListPlans(ctx context.Context, command adminauthapp.ListPlansCommand) ([]ports.AdminPlanRecord, error)
	CreatePlan(ctx context.Context, command adminauthapp.CreatePlanCommand) (ports.AdminPlanRecord, error)
	UpdatePlan(ctx context.Context, command adminauthapp.UpdatePlanCommand) (ports.AdminPlanRecord, error)
	ArchivePlan(ctx context.Context, command adminauthapp.ArchivePlanCommand) (ports.AdminPlanRecord, error)
	ListPlanEntitlements(
		ctx context.Context,
		command adminauthapp.ListPlanEntitlementsCommand,
	) ([]ports.AdminPlanEntitlementFeatureRecord, error)
	UpdatePlanEntitlements(
		ctx context.Context,
		command adminauthapp.UpdatePlanEntitlementsCommand,
	) ([]ports.AdminPlanEntitlementFeatureRecord, error)
	ListSubscriptionDiscountCodes(
		ctx context.Context,
		command adminauthapp.ListSubscriptionDiscountCodesCommand,
	) ([]ports.AdminSubscriptionDiscountCodeRecord, error)
	CreateSubscriptionDiscountCode(
		ctx context.Context,
		command adminauthapp.CreateSubscriptionDiscountCodeCommand,
	) (ports.AdminSubscriptionDiscountCodeRecord, error)
	UpdateSubscriptionDiscountCode(
		ctx context.Context,
		command adminauthapp.UpdateSubscriptionDiscountCodeCommand,
	) (ports.AdminSubscriptionDiscountCodeRecord, error)
	ArchiveSubscriptionDiscountCode(
		ctx context.Context,
		command adminauthapp.ArchiveSubscriptionDiscountCodeCommand,
	) (ports.AdminSubscriptionDiscountCodeRecord, error)
	ListPromotions(ctx context.Context, command adminauthapp.ListPromotionsCommand) ([]ports.AdminPromotionRecord, error)
	CreatePromotion(ctx context.Context, command adminauthapp.CreatePromotionCommand) (ports.AdminPromotionRecord, error)
	UpdatePromotion(ctx context.Context, command adminauthapp.UpdatePromotionCommand) (ports.AdminPromotionRecord, error)
	ArchivePromotion(ctx context.Context, command adminauthapp.ArchivePromotionCommand) (ports.AdminPromotionRecord, error)
	ListAdCampaigns(ctx context.Context, command adminauthapp.ListAdCampaignsCommand) ([]ports.AdminAdCampaignRecord, error)
	CreateAdCampaign(ctx context.Context, command adminauthapp.CreateAdCampaignCommand) (ports.AdminAdCampaignRecord, error)
	UpdateAdCampaign(ctx context.Context, command adminauthapp.UpdateAdCampaignCommand) (ports.AdminAdCampaignRecord, error)
	ArchiveAdCampaign(ctx context.Context, command adminauthapp.ArchiveAdCampaignCommand) (ports.AdminAdCampaignRecord, error)
	CollectAdCampaignPayment(
		ctx context.Context,
		command adminauthapp.CollectAdCampaignPaymentCommand,
	) (adminauthapp.AdCampaignPaymentResult, error)
	ListAffiliates(ctx context.Context, command adminauthapp.ListAffiliatesCommand) ([]ports.AdminAffiliateRecord, error)
	ListAffiliateAttribution(
		ctx context.Context,
		command adminauthapp.ListAffiliateAttributionCommand,
	) ([]ports.AdminAffiliateAttributionRecord, error)
	UpdateAffiliateConversionStatus(
		ctx context.Context,
		command adminauthapp.UpdateAffiliateConversionStatusCommand,
	) (ports.AdminAffiliateConversionRecord, error)
	CreateAffiliatePayout(ctx context.Context, command adminauthapp.CreateAffiliatePayoutCommand) (ports.AdminAffiliatePayoutRecord, error)
	CreateAffiliate(ctx context.Context, command adminauthapp.CreateAffiliateCommand) (ports.AdminAffiliateRecord, error)
	UpdateAffiliate(ctx context.Context, command adminauthapp.UpdateAffiliateCommand) (ports.AdminAffiliateRecord, error)
	ArchiveAffiliate(ctx context.Context, command adminauthapp.ArchiveAffiliateCommand) (ports.AdminAffiliateRecord, error)
	ListReferralProgrammes(
		ctx context.Context,
		command adminauthapp.ListReferralProgrammesCommand,
	) ([]ports.AdminReferralProgrammeRecord, error)
	CreateReferralProgramme(
		ctx context.Context,
		command adminauthapp.CreateReferralProgrammeCommand,
	) (ports.AdminReferralProgrammeRecord, error)
	UpdateReferralProgramme(
		ctx context.Context,
		command adminauthapp.UpdateReferralProgrammeCommand,
	) (ports.AdminReferralProgrammeRecord, error)
	ArchiveReferralProgramme(
		ctx context.Context,
		command adminauthapp.ArchiveReferralProgrammeCommand,
	) (ports.AdminReferralProgrammeRecord, error)
	CreateReferralCode(ctx context.Context, command adminauthapp.CreateReferralCodeCommand) (ports.AdminReferralCodeRecord, error)
	IssueReferralRewards(ctx context.Context, command adminauthapp.IssueReferralRewardsCommand) (ports.AdminReferralRewardIssueRecord, error)
	QueueMoneyReplay(ctx context.Context, command adminauthapp.QueueMoneyReplayCommand) (ports.AdminMoneyReplayRequestRecord, error)
	ReverseMoneyPayment(ctx context.Context, command adminauthapp.ReverseMoneyPaymentCommand) (ports.AdminMoneyReversalRecord, error)
	SetSettlementReviewHold(
		ctx context.Context,
		command adminauthapp.SetSettlementReviewHoldCommand,
	) (ports.AdminMoneyPayoutReviewRecord, error)
	ListPayouts(ctx context.Context, command adminauthapp.ListPayoutsCommand) ([]ports.AdminPayoutRecord, error)
	GetPayoutHistory(ctx context.Context, command adminauthapp.GetPayoutHistoryCommand) ([]ports.AdminPayoutHistoryRecord, error)
	RunSettlementSync(ctx context.Context, command adminauthapp.RunSettlementSyncCommand) (ports.AdminSettlementSyncRecord, error)
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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (handler Handler) Register(router chi.Router) {
	router.Post("/admin/auth/login", handler.login)
	router.Post("/admin/auth/refresh", handler.refresh)
	router.Post("/admin/auth/logout", handler.logout)
	// Public branding so every surface can render the current platform logo.
	router.Get("/branding", handler.branding)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/admin/auth/me", handler.me)
		protected.Get("/admin/settings/profile", handler.profileSettings)
		protected.Patch("/admin/settings/profile", handler.updateProfile)
		protected.Patch("/admin/settings/preferences", handler.updatePreferences)
		protected.Get("/admin/settings/platform", handler.platformSettings)
		protected.Patch("/admin/settings/platform", handler.updatePlatformSettings)
		protected.Post("/admin/platform-settings/marketing-flags", handler.updateMarketingFlags)
		protected.Post("/admin/settings/branding/upload-signature", handler.signBrandingUpload)
		protected.Get("/admin/business-verifications", handler.businessVerifications)
		protected.Post("/admin/business-verifications/{id}/decision", handler.decideBusinessVerification)
		protected.Get("/admin/platform-metrics", handler.platformMetrics)
		protected.Get("/admin/money-rails", handler.moneyRails)
		protected.Get("/admin/operations-health", handler.operationsHealth)
		protected.Get("/admin/notifications", handler.adminNotifications)
		protected.Get("/admin/reports", handler.adminReports)
		protected.Get("/admin/launch-readiness", handler.launchReadiness)
		protected.Get("/admin/subscriptions", handler.subscriptions)
		protected.Post("/admin/subscriptions/billing-sweeps", handler.runSubscriptionBillingSweep)
		protected.Post("/admin/subscriptions/recurring-charges", handler.runSubscriptionRecurringSweep)
		protected.Post("/admin/subscriptions/renewal-reminders", handler.runSubscriptionReminderSweep)
		protected.Patch("/admin/subscriptions/businesses/{id}", handler.updateSubscription)
		protected.Post("/admin/subscriptions/businesses/{id}/authorization-link", handler.initializeSubscriptionAuthorization)
		protected.Post("/admin/subscriptions/businesses/{id}/authorization-verifications", handler.verifySubscriptionAuthorization)
		protected.Post("/admin/subscriptions/businesses/{id}/invoices", handler.issueSubscriptionInvoice)
		protected.Post("/admin/subscriptions/invoices/{id}/paid", handler.markSubscriptionInvoicePaid)
		protected.Post("/admin/subscriptions/invoices/{id}/failed", handler.markSubscriptionInvoiceFailed)
		protected.Get("/admin/subscription-discounts", handler.subscriptionDiscountCodes)
		protected.Post("/admin/subscription-discounts", handler.createSubscriptionDiscountCode)
		protected.Patch("/admin/subscription-discounts/{id}", handler.updateSubscriptionDiscountCode)
		protected.Post("/admin/subscription-discounts/{id}/archive", handler.archiveSubscriptionDiscountCode)
		protected.Get("/admin/plans", handler.plans)
		protected.Post("/admin/plans", handler.createPlan)
		protected.Patch("/admin/plans/{id}", handler.updatePlan)
		protected.Post("/admin/plans/{id}/archive", handler.archivePlan)
		protected.Get("/admin/plan-entitlements", handler.planEntitlements)
		protected.Patch("/admin/plan-entitlements", handler.updatePlanEntitlements)
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
		protected.Post("/admin/money-rails/settlement-sync", handler.settlementSync)
		protected.Get("/admin/payouts", handler.payouts)
		protected.Get("/admin/payouts/{id}/history", handler.payoutHistory)
		protected.Get("/admin/risk-reviews", handler.riskReviews)
		protected.Patch("/admin/risk-reviews/{key}", handler.updateRiskReviewStatus)
		protected.Get("/admin/support-tickets", handler.supportTickets)
		protected.Patch("/admin/support-tickets/{key}", handler.updateSupportTicket)
		protected.Get("/admin/businesses", handler.businesses)
		protected.Get("/admin/customers", handler.customers)
		protected.Get("/admin/customers/{id}/export", handler.exportCustomer)
		protected.Post("/admin/customers/{id}/erase", handler.eraseCustomer)
		protected.Patch("/admin/businesses/{id}/status", handler.updateBusinessStatus)
		protected.Delete("/admin/businesses/{id}", handler.deleteBusiness)
		protected.Get("/admin/businesses/{id}/activity", handler.businessActivity)
		protected.Get("/admin/audit-events", handler.auditEvents)
		protected.Get("/admin/exports/{dataset}.csv", handler.exportDatasetCSV)
		protected.Get("/admin/roles", handler.roles)
		protected.Patch("/admin/roles/{role}", handler.updateRolePermissions)
		protected.Get("/admin/users", handler.listUsers)
		protected.Post("/admin/users", handler.createUser)
		protected.Patch("/admin/users/{id}", handler.updateUser)
	})
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

type errorResponse struct {
	Error string `json:"error"`
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

func authError(err error) (int, string) {
	switch {
	case errors.Is(err, authdomain.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_input"
	case errors.Is(err, authdomain.ErrAccountLocked):
		return http.StatusTooManyRequests, "account_locked"
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
	if err := writer.WriteAll(rows); err != nil {
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
