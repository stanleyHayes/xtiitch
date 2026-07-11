package adminauth

import (
	"context"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminLaunchReadinessConfig struct {
	Environment                   string
	AdminBootstrapOwnerConfigured bool
	CloudinaryConfigured          bool
	ExpoAccessTokenConfigured     bool
	GrowthPolicyConfirmed         bool
	JWTSigningKeyDefault          bool
	LegalReviewConfirmed          bool
	MarketingWaitlistEmailReady   bool
	MarketingWaitlistWebhookReady bool
	NotificationHTTPReady         bool
	NotificationWhatsAppReady     bool
	NotificationTransport         string
	PaystackSecretConfigured      bool
	PaystackWebhookConfigured     bool
	ResendConfigured              bool
	SonarHostConfigured           bool
	SonarOrganizationConfigured   bool
	SonarTokenConfigured          bool
}

type GetLaunchReadinessCommand struct {
	ActorRole admindomain.Role
}

type LaunchReadinessResult struct {
	Environment  string
	ReadyCount   int
	WatchCount   int
	BlockedCount int
	Checks       []LaunchReadinessCheck
	UpdatedAt    time.Time
}

type LaunchReadinessCheck struct {
	ID          string
	Category    string
	Label       string
	Status      string
	Summary     string
	Detail      string
	Action      string
	Target      string
	TargetLabel string
}
type ListSupportTicketsCommand struct {
	ActorRole admindomain.Role
}

type UpdateSupportTicketCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	TicketKey   string
	Status      string
	Assignment  string
	Note        string
	UserAgent   string
	IPAddress   string
}

func (s Service) ListSupportTickets(
	ctx context.Context,
	cmd ListSupportTicketsCommand,
) ([]ports.AdminSupportTicketRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSupport); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminSupportTickets(ctx)
}

func (s Service) UpdateSupportTicket(
	ctx context.Context,
	cmd UpdateSupportTicketCommand,
) (ports.AdminSupportTicketRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSupport); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrForbidden
	}

	ticketKey := strings.TrimSpace(cmd.TicketKey)
	if ticketKey == "" {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}

	status := strings.TrimSpace(cmd.Status)
	if status == "" {
		status = "open"
	}
	if status != "open" && status != "resolved" {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}

	assignment := strings.TrimSpace(cmd.Assignment)
	if assignment == "" {
		assignment = "unchanged"
	}
	if assignment != "self" && assignment != "unassigned" && assignment != "unchanged" {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}

	note := normalizeOperatorNote(cmd.Note)
	if note == "" {
		switch {
		case status == "resolved":
			note = "Operator resolved support ticket."
		case assignment == "self":
			note = "Operator assigned support ticket to self."
		case assignment == "unassigned":
			note = "Operator removed support assignment."
		default:
			note = "Operator reopened support ticket."
		}
	}

	record, err := s.businesses.UpdateAdminSupportTicket(ctx, ports.UpdateAdminSupportTicketInput{
		TicketKey:      ticketKey,
		Status:         status,
		Assignment:     assignment,
		Note:           note,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	action := supportTicketAction(status, assignment)
	severity := admindomain.AuditSeverityInfo
	if record.Priority == "urgent" && status == "open" {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "support_ticket",
		TargetID:    record.TicketKey,
		TargetLabel: fallbackString(record.BusinessName, record.Subject),
		Summary:     action + ". Note: " + note,
		Severity:    severity,
		Metadata: map[string]string{
			"assignment":  assignment,
			"business_id": record.BusinessID.String(),
			"category":    record.Category,
			"priority":    record.Priority,
			"status":      record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	return record, nil
}
func (s Service) launchReadinessChecks() []LaunchReadinessCheck {
	cfg := s.readiness
	paystackReady := cfg.PaystackSecretConfigured && cfg.PaystackWebhookConfigured
	notificationTransport := strings.TrimSpace(cfg.NotificationTransport)
	if notificationTransport == "" {
		notificationTransport = "log"
	}
	waitlistReady := cfg.MarketingWaitlistWebhookReady || cfg.MarketingWaitlistEmailReady
	notificationReady := (notificationTransport == "http" && cfg.NotificationHTTPReady) ||
		(notificationTransport == "whatsapp_cloud" && cfg.NotificationWhatsAppReady)
	notificationReadySummary := "HTTP notification provider transport is configured."
	notificationBlockedSummary := "Configure NOTIFICATION_TRANSPORT=http plus provider URL/auth, or NOTIFICATION_TRANSPORT=whatsapp_cloud plus WhatsApp Cloud credentials."
	notificationAction := "Set NOTIFICATION_HTTP_URL and NOTIFICATION_HTTP_AUTH_VALUE, or set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, and WHATSAPP_APP_SECRET."
	if notificationTransport == "whatsapp_cloud" {
		notificationReadySummary = "WhatsApp Cloud notification and inbound webhook credentials are configured."
		notificationBlockedSummary = "Configure WhatsApp Cloud phone-number, access-token, verify-token, and app-secret values."
		notificationAction = "Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, and WHATSAPP_APP_SECRET."
	}
	secureAdminAccess := cfg.AdminBootstrapOwnerConfigured && !cfg.JWTSigningKeyDefault

	sonarReady := cfg.SonarHostConfigured &&
		cfg.SonarOrganizationConfigured &&
		cfg.SonarTokenConfigured

	return []LaunchReadinessCheck{
		{
			ID:       "admin-access",
			Category: "Security",
			Label:    "Admin access hardening",
			Status:   healthStatus(!secureAdminAccess, false),
			Summary: readinessSummary(
				secureAdminAccess,
				"Bootstrap owner and non-default JWT signing key are configured.",
				"Set a bootstrap owner and replace the local JWT signing key before launch.",
			),
			Detail:      "Protects the operator console, refresh sessions, and emergency recovery path.",
			Action:      "Review ADMIN_BOOTSTRAP_* and JWT_SIGNING_KEY in the production environment.",
			Target:      "settings",
			TargetLabel: "Open settings",
		},
		{
			ID:       "paystack-credentials",
			Category: "Money rails",
			Label:    "Paystack credentials",
			Status: healthStatus(
				!cfg.PaystackSecretConfigured,
				cfg.PaystackSecretConfigured && !cfg.PaystackWebhookConfigured,
			),
			Summary: readinessSummary(
				paystackReady,
				"Secret key and webhook secret are configured.",
				"Configure PAYSTACK_SECRET_KEY and PAYSTACK_WEBHOOK_SECRET for live money rails.",
			),
			Detail:      "Checkout, subscription invoices, recurring charges, ad payments, and webhook reconciliation use this provider configuration.",
			Action:      "Add test/live Paystack credentials and verify webhook delivery.",
			Target:      "money",
			TargetLabel: "Open money rails",
		},
		{
			ID:       "paystack-sandbox",
			Category: "Money rails",
			Label:    "Paystack sandbox smoke",
			Status:   healthStatus(!paystackReady, paystackReady),
			Summary: readinessSummary(
				false,
				"",
				"Run a test charge, subaccount, webhook, and recurring authorization smoke before public launch.",
			),
			Detail:      "The code path is built; this check stays on watch until an operator validates the real Paystack account externally.",
			Action:      "Use the Subscriptions and Money rails sections with Paystack test credentials.",
			Target:      "subscriptions",
			TargetLabel: "Open subscriptions",
		},
		{
			ID:       "notification-provider",
			Category: "Notifications",
			Label:    "WhatsApp/SMS provider",
			Status:   healthStatus(!notificationReady, false),
			Summary: readinessSummary(
				notificationReady,
				notificationReadySummary,
				notificationBlockedSummary,
			),
			Detail:      "The worker can drain lifecycle notifications only when the live provider transport is configured.",
			Action:      notificationAction,
			Target:      "notifications",
			TargetLabel: "Open notifications",
		},
		{
			ID:       "marketing-intake",
			Category: "Acquisition",
			Label:    "Waitlist/contact intake",
			Status:   healthStatus(!waitlistReady, false),
			Summary: readinessSummary(
				waitlistReady,
				"Marketing intake has a webhook or email delivery route configured.",
				"Configure a waitlist webhook or Resend delivery route before launch.",
			),
			Detail:      "The public marketing site should not accept leads without a durable destination.",
			Action:      "Set MARKETING_WAITLIST_WEBHOOK_URL or RESEND_API_KEY, RESEND_FROM_EMAIL, and MARKETING_WAITLIST_EMAIL_TO.",
			Target:      "settings",
			TargetLabel: "Open settings",
		},
		{
			ID:       "media-storage",
			Category: "Media",
			Label:    "Cloudinary media storage",
			Status:   healthStatus(false, !cfg.CloudinaryConfigured),
			Summary: readinessSummary(
				cfg.CloudinaryConfigured,
				"Cloudinary signing is configured for direct design uploads.",
				"Cloudinary is using local/dev fallback until CLOUDINARY_URL is set.",
			),
			Detail:      "Business catalogue images need durable media storage outside the API process.",
			Action:      "Configure CLOUDINARY_URL in production.",
			Target:      "businesses",
			TargetLabel: "Open businesses",
		},
		{
			ID:       "push-notifications",
			Category: "Notifications",
			Label:    "Expo push token",
			Status:   healthStatus(false, !cfg.ExpoAccessTokenConfigured),
			Summary: readinessSummary(
				cfg.ExpoAccessTokenConfigured,
				"Expo access token is configured for future mobile push delivery.",
				"Expo push remains on watch until EXPO_ACCESS_TOKEN is configured.",
			),
			Detail:      "Mobile apps are later-phase surfaces, but this keeps push readiness visible before launch.",
			Action:      "Set EXPO_ACCESS_TOKEN when native push delivery is enabled.",
			Target:      "notifications",
			TargetLabel: "Open notifications",
		},
		{
			ID:       "legal-policy",
			Category: "Compliance",
			Label:    "Legal policy review",
			Status:   healthStatus(!cfg.LegalReviewConfirmed, false),
			Summary: readinessSummary(
				cfg.LegalReviewConfirmed,
				"Legal and owner sign-off is recorded for launch policy language.",
				"Privacy, terms, refund, cancellation, renewal, and chargeback language still need owner/legal sign-off.",
			),
			Detail:      "This is intentionally a human gate; the app cannot self-certify legal approval.",
			Action:      "Set XTIITCH_LEGAL_REVIEW_CONFIRMED=true only after approval is recorded.",
			Target:      "settings",
			TargetLabel: "Open settings",
		},
		{
			ID:       "growth-policy",
			Category: "Growth",
			Label:    "Growth policy decisions",
			Status:   healthStatus(!cfg.GrowthPolicyConfirmed, false),
			Summary: readinessSummary(
				cfg.GrowthPolicyConfirmed,
				"Owner sign-off is recorded for promotions, referrals, affiliates, sponsored placements, and subscription policy.",
				"Growth and monetisation owner decisions still need final sign-off before launch.",
			),
			Detail:      "Confirm funding defaults, opt-in rules, payout/KYC thresholds, sponsored pricing, voucher scope, reward precedence, and subscription timing before turning growth features public.",
			Action:      "Set XTIITCH_GROWTH_POLICY_CONFIRMED=true only after the owner decisions are recorded.",
			Target:      "promotions",
			TargetLabel: "Open promotions",
		},
		{
			ID:       "quality-scan",
			Category: "Quality",
			Label:    "SonarCloud scan",
			Status:   healthStatus(false, !sonarReady),
			Summary: readinessSummary(
				sonarReady,
				"Sonar host, token, and organization are configured; run the quality-gate scan.",
				"SonarCloud host/token/organization setup is not complete yet.",
			),
			Detail:      "The scanner wrapper passes SONAR_ORGANIZATION as sonar.organization when the environment variable is present.",
			Action:      "Set the Sonar organization/host/token and rerun pnpm sonar.",
			Target:      "audit",
			TargetLabel: "Open audit",
		},
	}
}

func readinessSummary(ready bool, readySummary string, blockedSummary string) string {
	if ready {
		return readySummary
	}
	return blockedSummary
}

func addHealthSignal(result *OperationsHealthResult, signal OperationsHealthSignal) {
	signal.Status = healthStatusValue(signal.Status)
	result.Signals = append(result.Signals, signal)
}

func finalizeOperationsHealth(result *OperationsHealthResult) {
	result.BlockedCount = 0
	result.WatchCount = 0
	for _, signal := range result.Signals {
		switch signal.Status {
		case "blocked":
			result.BlockedCount++
		case "watch":
			result.WatchCount++
		}
	}
	score := 100 - result.BlockedCount*15 - result.WatchCount*7
	if score < 0 {
		score = 0
	}
	result.HealthScore = score
}

func healthStatus(blocked bool, watch bool) string {
	if blocked {
		return "blocked"
	}
	if watch {
		return "watch"
	}
	return "ready"
}

func healthStatusValue(value string) string {
	switch strings.TrimSpace(value) {
	case "blocked", "watch":
		return strings.TrimSpace(value)
	default:
		return "ready"
	}
}

func healthPlural(count int, singular string) string {
	if count == 1 {
		return "1 " + singular
	}
	return intString(count) + " " + singular + "s"
}

func percentBPSLabel(bps int) string {
	if bps < 0 {
		bps = 0
	}
	if bps > 10000 {
		bps = 10000
	}
	whole := bps / 100
	tenths := (bps % 100) / 10
	if tenths == 0 {
		return intString(whole) + "%"
	}
	return intString(whole) + "." + intString(tenths) + "%"
}

func paymentRailsHealthHelper(failedWebhooks int, failedPayments30d int) string {
	if failedWebhooks > 0 {
		return healthPlural(failedWebhooks, "failed webhook event") + " need review."
	}
	return healthPlural(failedPayments30d, "failed payment") + " in the last 30 days."
}

func tenantOperationsHealthHelper(suspended int) string {
	if suspended > 0 {
		return "Suspended businesses need follow-up notes or reactivation review."
	}
	return "No stores are suspended right now."
}

func subscriptionHealthHelper(atRisk int, onWatch int) string {
	if atRisk > 0 {
		return "Past-due, grace-period, or over-plan businesses need follow-up."
	}
	return healthPlural(onWatch, "subscription") + " scheduled to cancel at period end."
}

func promotionHealthHelper(pendingRedemptions int) string {
	if pendingRedemptions > 0 {
		return healthPlural(pendingRedemptions, "pending redemption") + " need operator review."
	}
	return "No pending promotion redemptions are visible."
}

func adHealthHelper(pending int, active int) string {
	if pending > 0 {
		return healthPlural(pending, "advertiser placement") + " need operator approval."
	}
	return healthPlural(active, "active placement") + " cleared for approved windows."
}

func affiliateHealthHelper(pending int, active int, manualPayout int) string {
	if pending > 0 {
		return healthPlural(pending, "partner") + " need operator review before attribution."
	}
	return intString(active) + " active partners; " + intString(manualPayout) + " manual payout rails."
}

func referralHealthHelper(draft int, paused int) string {
	if draft > 0 {
		return healthPlural(draft, "draft programme") + " need operator review before launch."
	}
	return healthPlural(paused, "paused programme") + " retained for audit and future relaunch."
}

func trustHealthHelper(openRisk int, openSupport int, urgentSupport int) string {
	if urgentSupport > 0 {
		return intString(openRisk) + " risk and " + intString(urgentSupport) + " urgent support signals are open."
	}
	return intString(openRisk+openSupport) + " trust/support signals are open."
}

func trustHealthTarget(openRisk int, openSupport int) string {
	if openRisk > 0 {
		return "risk"
	}
	if openSupport > 0 {
		return "support"
	}
	return "support"
}

func auditHealthHelper(criticalAudit int) string {
	if criticalAudit > 0 {
		return healthPlural(criticalAudit, "critical audit event") + " visible."
	}
	return "Sensitive operator actions have durable trace coverage."
}

func platformPolicyValue(maintenanceMode bool) string {
	if maintenanceMode {
		return "Maintenance"
	}
	return "Live"
}

func platformPolicyHelper(verificationSLAHours int) string {
	return intString(verificationSLAHours) + "h KYC SLA is configured for operator review."
}

func operatorAccessHealthHelper(inactiveUsers int) string {
	if inactiveUsers > 0 {
		return healthPlural(inactiveUsers, "inactive operator") + " remain visible for review."
	}
	return "All loaded operator accounts are active."
}

func notificationToneForSignal(status string) string {
	switch status {
	case "blocked":
		return "critical"
	case "watch":
		return "warning"
	default:
		return "info"
	}
}

func notificationCategoryForTarget(target string) string {
	switch target {
	case "verification":
		return "verification"
	case "money":
		return "money"
	case "subscriptions":
		return "subscriptions"
	case "promotions":
		return "promotions"
	case "ads":
		return "ads"
	case "affiliates":
		return "affiliates"
	case "referrals":
		return "referrals"
	case "risk":
		return "risk"
	case "support":
		return "support"
	case "audit":
		return "audit"
	default:
		return "platform"
	}
}
func supportTicketAction(status string, assignment string) string {
	if status == "resolved" {
		return "Resolved support ticket"
	}
	if assignment == "self" {
		return "Assigned support ticket"
	}
	if assignment == "unassigned" {
		return "Unassigned support ticket"
	}
	return "Reopened support ticket"
}
