package adminauth

import (
	"context"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

type GetPlatformMetricsCommand struct {
	ActorRole admindomain.Role
}

type GetOperationsHealthCommand struct {
	ActorRole admindomain.Role
}

type OperationsHealthResult struct {
	HealthScore          int
	BlockedCount         int
	WatchCount           int
	PaymentHealthBPS     int
	FailedWebhooks       int
	PayoutHolds          int
	OpenRiskReviews      int
	OpenSupportTickets   int
	UrgentSupportTickets int
	AuditEvents          int
	CriticalAuditEvents  int
	Signals              []OperationsHealthSignal
	UpdatedAt            time.Time
}

type OperationsHealthSignal struct {
	ID          string
	Label       string
	Value       string
	Helper      string
	Status      string
	Target      string
	TargetLabel string
}

type GetAdminNotificationsCommand struct {
	ActorRole admindomain.Role
}

type AdminNotificationsResult struct {
	Notifications []AdminNotificationRecord
	UpdatedAt     time.Time
}

type AdminNotificationRecord struct {
	ID          string
	Tone        string
	Category    string
	Title       string
	Helper      string
	Meta        string
	Source      string
	Target      string
	TargetLabel string
}

type GetAdminReportsCommand struct {
	ActorRole admindomain.Role
}

type AdminReportsResult struct {
	Items     []AdminReportRecord
	UpdatedAt time.Time
}

type AdminReportRecord struct {
	ID          string
	Label       string
	Value       string
	Helper      string
	Status      string
	Target      string
	TargetLabel string
}

func (s Service) GetPlatformMetrics(ctx context.Context, cmd GetPlatformMetricsCommand) (ports.AdminPlatformMetricsRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlatformMetricsRecord{}, authdomain.ErrForbidden
	}

	return s.businesses.GetAdminPlatformMetrics(ctx)
}

func (s Service) GetOperationsHealth(
	ctx context.Context,
	cmd GetOperationsHealthCommand,
) (OperationsHealthResult, error) {
	if !cmd.ActorRole.Valid() {
		return OperationsHealthResult{}, authdomain.ErrForbidden
	}
	permissions, err := s.permissionsForRole(ctx, cmd.ActorRole)
	if err != nil {
		return OperationsHealthResult{}, err
	}
	allowed := adminPermissionSet(permissions)
	result := OperationsHealthResult{
		HealthScore: 100,
		UpdatedAt:   s.clock.Now(),
	}

	if operationsHealthNeedsBusinessRepo(allowed) {
		if s.businesses == nil {
			return OperationsHealthResult{}, authdomain.ErrForbidden
		}
	}

	var platformMetrics ports.AdminPlatformMetricsRecord
	if allowed[admindomain.PermissionReviewBusinesses] {
		platformMetrics, err = s.businesses.GetAdminPlatformMetrics(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		result.PaymentHealthBPS = platformMetrics.PaymentHealthBPS

		verificationCases, err := s.businesses.ListAdminVerificationCases(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		pendingKYC := 0
		for _, item := range verificationCases {
			if item.VerificationStatus == business.VerificationStatusPending ||
				item.VerificationStatus == business.VerificationStatusUnverified {
				pendingKYC++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "kyc",
			Label:       "Business verification",
			Value:       intString(pendingKYC) + " pending",
			Helper:      healthPlural(pendingKYC, "business verification case") + " waiting for operator review.",
			Status:      healthStatus(pendingKYC > 0, false),
			Target:      "verification",
			TargetLabel: "Open KYC",
		})

		businesses, err := s.businesses.ListAdminBusinesses(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		suspended := 0
		for _, record := range businesses {
			if record.OperationalStatus == business.OperationalStatusSuspended {
				suspended++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "tenants",
			Label:       "Tenant operations",
			Value:       intString(suspended) + " suspended",
			Helper:      tenantOperationsHealthHelper(suspended),
			Status:      healthStatus(false, suspended > 0),
			Target:      "businesses",
			TargetLabel: "Open businesses",
		})
	}

	if allowed[admindomain.PermissionManageMoneyRails] {
		moneyRails, err := s.businesses.GetAdminMoneyRails(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		for _, event := range moneyRails.WebhookEvents {
			if event.Status == "failed" {
				result.FailedWebhooks++
			}
		}
		for _, review := range moneyRails.PayoutReviews {
			if review.HoldActive || review.Status == "blocked" {
				result.PayoutHolds++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "payments",
			Label:       "Payment rails",
			Value:       percentBPSLabel(result.PaymentHealthBPS),
			Helper:      paymentRailsHealthHelper(result.FailedWebhooks, platformMetrics.FailedPayments30d),
			Status:      healthStatus(result.FailedWebhooks > 0 || result.PayoutHolds > 0, platformMetrics.FailedPayments30d > 0),
			Target:      "money",
			TargetLabel: "Open money rails",
		})
	}

	if allowed[admindomain.PermissionManageSubscriptions] {
		subscriptions, err := s.businesses.ListAdminSubscriptions(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		atRisk := 0
		onWatch := 0
		for _, subscription := range subscriptions {
			if subscription.Status == "past_due" ||
				subscription.Status == "grace_period" ||
				subscriptionOverDesignLimit(subscription) {
				atRisk++
				continue
			}
			if subscription.Status == "cancel_at_period_end" {
				onWatch++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "subscriptions",
			Label:       "Subscription health",
			Value:       intString(atRisk) + " at risk",
			Helper:      subscriptionHealthHelper(atRisk, onWatch),
			Status:      healthStatus(atRisk > 0, onWatch > 0),
			Target:      "subscriptions",
			TargetLabel: "Open subscriptions",
		})
	}

	if allowed[admindomain.PermissionManagePromotions] {
		promotions, err := s.businesses.ListAdminPromotions(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		active := 0
		pendingRedemptions := 0
		for _, promotion := range promotions {
			if promotion.Status == "active" {
				active++
			}
			for _, redemption := range promotion.RecentRedemptions {
				if redemption.Status == "pending" {
					pendingRedemptions++
				}
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "promotions",
			Label:       "Promotion controls",
			Value:       intString(active) + " active",
			Helper:      promotionHealthHelper(pendingRedemptions),
			Status:      healthStatus(false, pendingRedemptions > 0),
			Target:      "promotions",
			TargetLabel: "Open promotions",
		})
	}

	if allowed[admindomain.PermissionManageAds] {
		campaigns, err := s.businesses.ListAdminAdCampaigns(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		pending := 0
		active := 0
		for _, campaign := range campaigns {
			switch campaign.Status {
			case "pending_review":
				pending++
			case "active":
				active++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "ads",
			Label:       "Sponsored placements",
			Value:       intString(pending) + " pending",
			Helper:      adHealthHelper(pending, active),
			Status:      healthStatus(false, pending > 0),
			Target:      "ads",
			TargetLabel: "Open ads",
		})
	}

	if allowed[admindomain.PermissionManageGrowth] {
		affiliates, err := s.businesses.ListAdminAffiliates(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		pendingAffiliates := 0
		activeAffiliates := 0
		manualPayoutAffiliates := 0
		for _, affiliate := range affiliates {
			switch affiliate.Status {
			case "pending_review":
				pendingAffiliates++
			case "active":
				activeAffiliates++
			}
			if affiliate.PayoutMode == "manual" {
				manualPayoutAffiliates++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "affiliates",
			Label:       "Affiliate programmes",
			Value:       intString(pendingAffiliates) + " pending",
			Helper:      affiliateHealthHelper(pendingAffiliates, activeAffiliates, manualPayoutAffiliates),
			Status:      healthStatus(false, pendingAffiliates > 0 || manualPayoutAffiliates > 0),
			Target:      "affiliates",
			TargetLabel: "Open affiliates",
		})

		referralProgrammes, err := s.businesses.ListAdminReferralProgrammes(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		activeReferrals := 0
		draftReferrals := 0
		pausedReferrals := 0
		for _, programme := range referralProgrammes {
			switch programme.Status {
			case "active":
				activeReferrals++
			case "draft":
				draftReferrals++
			case "paused":
				pausedReferrals++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "referrals",
			Label:       "Referral programmes",
			Value:       intString(activeReferrals) + " active",
			Helper:      referralHealthHelper(draftReferrals, pausedReferrals),
			Status:      healthStatus(false, draftReferrals > 0),
			Target:      "referrals",
			TargetLabel: "Open referrals",
		})
	}

	if allowed[admindomain.PermissionManageRisk] {
		riskReviews, err := s.businesses.ListAdminRiskReviews(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		for _, review := range riskReviews {
			if review.Status != "open" {
				continue
			}
			result.OpenRiskReviews++
		}
	}
	if allowed[admindomain.PermissionManageSupport] {
		supportTickets, err := s.businesses.ListAdminSupportTickets(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		for _, ticket := range supportTickets {
			if ticket.Status != "open" {
				continue
			}
			result.OpenSupportTickets++
			if ticket.Priority == "urgent" {
				result.UrgentSupportTickets++
			}
		}
	}
	if allowed[admindomain.PermissionManageRisk] || allowed[admindomain.PermissionManageSupport] {
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "trust",
			Label:       "Risk and support",
			Value:       intString(result.OpenRiskReviews+result.OpenSupportTickets) + " open",
			Helper:      trustHealthHelper(result.OpenRiskReviews, result.OpenSupportTickets, result.UrgentSupportTickets),
			Status:      healthStatus(result.UrgentSupportTickets > 0, result.OpenRiskReviews+result.OpenSupportTickets > 0),
			Target:      trustHealthTarget(result.OpenRiskReviews, result.OpenSupportTickets),
			TargetLabel: "Open queue",
		})
	}

	if allowed[admindomain.PermissionViewAudit] {
		if s.audits == nil {
			return OperationsHealthResult{}, authdomain.ErrForbidden
		}
		auditEvents, err := s.audits.ListAdminAuditEvents(ctx, ports.ListAdminAuditEventsInput{Limit: 200})
		if err != nil {
			return OperationsHealthResult{}, err
		}
		result.AuditEvents = len(auditEvents)
		for _, event := range auditEvents {
			if event.Severity == admindomain.AuditSeverityCritical {
				result.CriticalAuditEvents++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "audit",
			Label:       "Audit evidence",
			Value:       intString(result.AuditEvents) + " events",
			Helper:      auditHealthHelper(result.CriticalAuditEvents),
			Status:      healthStatus(result.CriticalAuditEvents > 0, result.AuditEvents == 0),
			Target:      "audit",
			TargetLabel: "Open audit",
		})
	}

	if allowed[admindomain.PermissionManageSettings] {
		settings, err := s.users.GetAdminPlatformSettings(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "policy",
			Label:       "Platform policy",
			Value:       platformPolicyValue(settings.MaintenanceMode),
			Helper:      platformPolicyHelper(settings.VerificationSLAHours),
			Status:      healthStatus(false, settings.MaintenanceMode),
			Target:      "settings",
			TargetLabel: "Open settings",
		})
	}

	if allowed[admindomain.PermissionManageAdminUsers] {
		users, err := s.users.ListAdminUsers(ctx)
		if err != nil {
			return OperationsHealthResult{}, err
		}
		inactiveUsers := 0
		for _, user := range users {
			if !user.IsActive {
				inactiveUsers++
			}
		}
		addHealthSignal(&result, OperationsHealthSignal{
			ID:          "access",
			Label:       "Operator access",
			Value:       intString(len(users)) + " users",
			Helper:      operatorAccessHealthHelper(inactiveUsers),
			Status:      healthStatus(false, inactiveUsers > 0),
			Target:      "users",
			TargetLabel: "Open users",
		})
	}

	if len(result.Signals) == 0 {
		return OperationsHealthResult{}, authdomain.ErrForbidden
	}
	addHealthSignal(&result, OperationsHealthSignal{
		ID:          "exports",
		Label:       "Export readiness",
		Value:       "Ready",
		Helper:      "CSV snapshots are available for report posture and admin queues.",
		Status:      "ready",
		Target:      "exports",
		TargetLabel: "Open exports",
	})
	finalizeOperationsHealth(&result)
	return result, nil
}

func (s Service) GetAdminNotifications(
	ctx context.Context,
	cmd GetAdminNotificationsCommand,
) (AdminNotificationsResult, error) {
	health, err := s.GetOperationsHealth(ctx, GetOperationsHealthCommand{
		ActorRole: cmd.ActorRole,
	})
	if err != nil {
		return AdminNotificationsResult{}, err
	}

	result := AdminNotificationsResult{UpdatedAt: health.UpdatedAt}
	for _, status := range []string{"blocked", "watch"} {
		for _, signal := range health.Signals {
			if signal.Status != status {
				continue
			}
			result.Notifications = append(result.Notifications, AdminNotificationRecord{
				ID:          "health-" + signal.ID,
				Tone:        notificationToneForSignal(signal.Status),
				Category:    notificationCategoryForTarget(signal.Target),
				Title:       signal.Label,
				Helper:      signal.Helper,
				Meta:        signal.Value,
				Source:      "Operations health",
				Target:      signal.Target,
				TargetLabel: signal.TargetLabel,
			})
		}
	}
	if len(result.Notifications) == 0 {
		result.Notifications = append(result.Notifications, AdminNotificationRecord{
			ID:          "all-clear",
			Tone:        "success",
			Category:    "platform",
			Title:       "No admin alerts waiting",
			Helper:      "Verification, money rails, subscriptions, growth, risk, support, and audit signals are clear right now.",
			Meta:        "Live queue",
			Source:      "Admin console",
			Target:      "overview",
			TargetLabel: "Back to overview",
		})
	}
	if len(result.Notifications) > 18 {
		result.Notifications = result.Notifications[:18]
	}
	return result, nil
}

func (s Service) GetAdminReports(
	ctx context.Context,
	cmd GetAdminReportsCommand,
) (AdminReportsResult, error) {
	health, err := s.GetOperationsHealth(ctx, GetOperationsHealthCommand{
		ActorRole: cmd.ActorRole,
	})
	if err != nil {
		return AdminReportsResult{}, err
	}
	result := AdminReportsResult{UpdatedAt: health.UpdatedAt}
	for _, signal := range health.Signals {
		result.Items = append(result.Items, AdminReportRecord{
			ID:          signal.ID,
			Label:       signal.Label,
			Value:       signal.Value,
			Helper:      signal.Helper,
			Status:      signal.Status,
			Target:      signal.Target,
			TargetLabel: signal.TargetLabel,
		})
	}
	return result, nil
}

func (s Service) GetLaunchReadiness(
	ctx context.Context,
	cmd GetLaunchReadinessCommand,
) (LaunchReadinessResult, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSettings); err != nil {
		return LaunchReadinessResult{}, err
	}

	checks := s.launchReadinessChecks()
	result := LaunchReadinessResult{
		Environment: strings.TrimSpace(s.readiness.Environment),
		Checks:      checks,
		UpdatedAt:   s.clock.Now(),
	}
	if result.Environment == "" {
		result.Environment = "development"
	}
	for _, check := range checks {
		switch check.Status {
		case "blocked":
			result.BlockedCount++
		case "watch":
			result.WatchCount++
		default:
			result.ReadyCount++
		}
	}
	return result, nil
}
func adminPermissionSet(permissions []admindomain.Permission) map[admindomain.Permission]bool {
	out := make(map[admindomain.Permission]bool, len(permissions))
	for _, permission := range permissions {
		out[permission] = true
	}
	return out
}

func operationsHealthNeedsBusinessRepo(allowed map[admindomain.Permission]bool) bool {
	return allowed[admindomain.PermissionReviewBusinesses] ||
		allowed[admindomain.PermissionManageMoneyRails] ||
		allowed[admindomain.PermissionManageSubscriptions] ||
		allowed[admindomain.PermissionManagePromotions] ||
		allowed[admindomain.PermissionManageAds] ||
		allowed[admindomain.PermissionManageGrowth] ||
		allowed[admindomain.PermissionManageRisk] ||
		allowed[admindomain.PermissionManageSupport]
}
