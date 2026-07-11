package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestGetPlatformMetricsRequiresReviewPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		metrics: ports.AdminPlatformMetricsRecord{
			GMVMonthMinor:        18420000,
			ActiveBusinesses:     12,
			PendingVerifications: 2,
			PaymentHealthBPS:     9910,
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	metrics, err := service.GetPlatformMetrics(context.Background(), GetPlatformMetricsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("get platform metrics: %v", err)
	}
	if metrics.GMVMonthMinor != 18420000 || metrics.PaymentHealthBPS != 9910 {
		t.Fatalf("unexpected platform metrics: %+v", metrics)
	}

	_, err = service.GetPlatformMetrics(context.Background(), GetPlatformMetricsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestGetOperationsHealthSummarizesAllowedReadModels(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 10, 0, 0, 0, time.UTC)
	designLimit := 2
	users := &fakeAdminUsers{
		users: []ports.AdminUserRecord{
			{UserID: "owner-1", Email: "owner@example.com", Role: admindomain.RoleOwner, IsActive: true},
			{UserID: "operator-1", Email: "operator@example.com", Role: admindomain.RoleOperator, IsActive: false},
		},
		platformSettings: ports.AdminPlatformSettingsRecord{
			PlatformName:         "Xtiitch",
			SupportEmail:         "support@xtiitch.com",
			VerificationSLAHours: 24,
			MaintenanceMode:      true,
		},
	}
	businesses := &fakeAdminBusinesses{
		cases: []ports.AdminVerificationCaseRecord{
			{BusinessID: "business-1", VerificationStatus: business.VerificationStatusPending},
		},
		businesses: []ports.AdminBusinessRecord{
			{BusinessID: "business-1", Name: "Ama Stitches", OperationalStatus: business.OperationalStatusSuspended},
		},
		metrics: ports.AdminPlatformMetricsRecord{
			PaymentHealthBPS:  9200,
			FailedPayments30d: 1,
			UpdatedAt:         now,
		},
		moneyRails: ports.AdminMoneyRailsRecord{
			WebhookEvents: []ports.AdminMoneyWebhookEventRecord{
				{ID: "event-1", Status: "failed"},
			},
			PayoutReviews: []ports.AdminMoneyPayoutReviewRecord{
				{ID: "business-1", Status: "blocked", HoldActive: true},
			},
			UpdatedAt: now,
		},
		subscriptions: []ports.AdminSubscriptionRecord{
			{BusinessID: "business-1", BusinessName: "Ama Stitches", Status: "past_due", DesignLimit: &designLimit, DesignCount: 3},
		},
		promotions: []ports.AdminPromotionRecord{
			{
				PromotionID: "promotion-1",
				Status:      "active",
				RecentRedemptions: []ports.AdminPromotionRedemptionRecord{
					{PromotionRedemptionID: "redemption-1", Status: "pending"},
				},
			},
		},
		adCampaigns: []ports.AdminAdCampaignRecord{
			{CampaignID: "campaign-1", Status: "pending_review"},
		},
		affiliates: []ports.AdminAffiliateRecord{
			{AffiliateID: "affiliate-1", Status: "pending_review", PayoutMode: "manual"},
		},
		referralProgrammes: []ports.AdminReferralProgrammeRecord{
			{ProgrammeID: "programme-1", Status: "draft"},
		},
		riskReviews: []ports.AdminRiskReviewRecord{
			{ReviewKey: "risk-1", Level: "high", Status: "open"},
		},
		supportTickets: []ports.AdminSupportTicketRecord{
			{TicketKey: "ticket-1", Priority: "urgent", Status: "open"},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		users,
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"unused"},
	)
	audits.events = []ports.AdminAuditEventRecord{
		{AuditEventID: "audit-1", Severity: admindomain.AuditSeverityCritical},
		{AuditEventID: "audit-2", Severity: admindomain.AuditSeverityInfo},
	}

	health, err := service.GetOperationsHealth(context.Background(), GetOperationsHealthCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get operations health: %v", err)
	}
	if health.HealthScore != 0 ||
		health.BlockedCount != 5 ||
		health.WatchCount != 7 ||
		health.FailedWebhooks != 1 ||
		health.PayoutHolds != 1 ||
		health.UrgentSupportTickets != 1 ||
		health.CriticalAuditEvents != 1 {
		t.Fatalf("unexpected owner health summary: %+v", health)
	}
	if healthSignalStatus(health, "payments") != "blocked" ||
		healthSignalStatus(health, "subscriptions") != "blocked" ||
		healthSignalStatus(health, "access") != "watch" ||
		healthSignalStatus(health, "exports") != "ready" {
		t.Fatalf("unexpected owner health signals: %+v", health.Signals)
	}

	supportHealth, err := service.GetOperationsHealth(context.Background(), GetOperationsHealthCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("get support operations health: %v", err)
	}
	if healthSignalStatus(supportHealth, "payments") != "" ||
		healthSignalStatus(supportHealth, "subscriptions") != "" ||
		healthSignalStatus(supportHealth, "trust") != "blocked" ||
		healthSignalStatus(supportHealth, "audit") != "blocked" ||
		healthSignalStatus(supportHealth, "exports") != "ready" {
		t.Fatalf("unexpected support-scoped health signals: %+v", supportHealth.Signals)
	}

	feed, err := service.GetAdminNotifications(context.Background(), GetAdminNotificationsCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get admin notifications: %v", err)
	}
	if len(feed.Notifications) == 0 ||
		feed.Notifications[0].ID != "health-kyc" ||
		feed.Notifications[0].Tone != "critical" ||
		feed.Notifications[0].Category != "verification" {
		t.Fatalf("unexpected owner notification feed: %+v", feed.Notifications)
	}

	supportFeed, err := service.GetAdminNotifications(context.Background(), GetAdminNotificationsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("get support admin notifications: %v", err)
	}
	if len(supportFeed.Notifications) != 2 ||
		supportFeed.Notifications[0].Category != "support" ||
		supportFeed.Notifications[1].Category != "audit" {
		t.Fatalf("unexpected support notification feed: %+v", supportFeed.Notifications)
	}

	reports, err := service.GetAdminReports(context.Background(), GetAdminReportsCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get admin reports: %v", err)
	}
	if len(reports.Items) == 0 ||
		reports.Items[0].ID != "kyc" ||
		reports.Items[0].Status != "blocked" ||
		healthReportStatus(reports, "exports") != "ready" {
		t.Fatalf("unexpected owner report feed: %+v", reports.Items)
	}

	supportReports, err := service.GetAdminReports(context.Background(), GetAdminReportsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("get support admin reports: %v", err)
	}
	if healthReportStatus(supportReports, "payments") != "" ||
		healthReportStatus(supportReports, "trust") != "blocked" ||
		healthReportStatus(supportReports, "audit") != "blocked" {
		t.Fatalf("unexpected support report feed: %+v", supportReports.Items)
	}
}

func TestGetLaunchReadinessRequiresSettingsAndSummarizesConfig(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 11, 0, 0, 0, time.UTC)
	service := newTestService(&fakeAdminUsers{}, &fakeAdminSessions{}, now, []common.ID{"unused"})
	service.readiness = AdminLaunchReadinessConfig{
		Environment:                   "production",
		AdminBootstrapOwnerConfigured: true,
		CloudinaryConfigured:          true,
		ExpoAccessTokenConfigured:     true,
		GrowthPolicyConfirmed:         true,
		JWTSigningKeyDefault:          false,
		LegalReviewConfirmed:          true,
		MarketingWaitlistEmailReady:   true,
		NotificationTransport:         "whatsapp_cloud",
		NotificationWhatsAppReady:     true,
		PaystackSecretConfigured:      true,
		PaystackWebhookConfigured:     true,
		SonarHostConfigured:           true,
		SonarOrganizationConfigured:   true,
		SonarTokenConfigured:          true,
	}

	result, err := service.GetLaunchReadiness(context.Background(), GetLaunchReadinessCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get launch readiness: %v", err)
	}
	if result.Environment != "production" ||
		result.ReadyCount != 9 ||
		result.WatchCount != 1 ||
		result.BlockedCount != 0 ||
		launchReadinessStatus(result, "paystack-sandbox") != "watch" ||
		launchReadinessStatus(result, "legal-policy") != "ready" ||
		launchReadinessStatus(result, "growth-policy") != "ready" {
		t.Fatalf("unexpected readiness result: %+v", result)
	}
	if !result.UpdatedAt.Equal(now) {
		t.Fatalf("expected fixed updated_at, got %v", result.UpdatedAt)
	}

	_, err = service.GetLaunchReadiness(context.Background(), GetLaunchReadinessCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support to be forbidden, got %v", err)
	}
}

func healthSignalStatus(
	record OperationsHealthResult,
	id string,
) string {
	for _, signal := range record.Signals {
		if signal.ID == id {
			return signal.Status
		}
	}
	return ""
}

func launchReadinessStatus(record LaunchReadinessResult, id string) string {
	for _, check := range record.Checks {
		if check.ID == id {
			return check.Status
		}
	}
	return ""
}

func healthReportStatus(record AdminReportsResult, id string) string {
	for _, item := range record.Items {
		if item.ID == id {
			return item.Status
		}
	}
	return ""
}

func (repo *fakeAdminBusinesses) GetAdminPlatformMetrics(context.Context) (ports.AdminPlatformMetricsRecord, error) {
	if repo.metrics.UpdatedAt.IsZero() {
		repo.metrics.UpdatedAt = time.Now()
	}
	return repo.metrics, nil
}
