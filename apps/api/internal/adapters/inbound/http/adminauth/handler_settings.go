package adminauthhttp

import (
	"net/http"
	"time"

	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type updatePlatformSettingsRequest struct {
	PlatformName                 string `json:"platform_name"`
	SupportEmail                 string `json:"support_email"`
	VerificationSLAHours         int    `json:"verification_sla_hours"`
	PayoutReviewThresholdPesewas int    `json:"payout_review_threshold_pesewas"`
	MaintenanceMode              bool   `json:"maintenance_mode"`
	BrandLogoURL                 string `json:"brand_logo_url"`
	AIAssistantAddonEnabled      bool   `json:"ai_assistant_addon_enabled"`
}

type platformSettingsResponse struct {
	PlatformName                 string                 `json:"platform_name"`
	SupportEmail                 string                 `json:"support_email"`
	VerificationSLAHours         int                    `json:"verification_sla_hours"`
	PayoutReviewThresholdPesewas int                    `json:"payout_review_threshold_pesewas"`
	MaintenanceMode              bool                   `json:"maintenance_mode"`
	BrandLogoURL                 string                 `json:"brand_logo_url"`
	MarketingFlags               marketingFlagsResponse `json:"marketing_flags"`
	AIAssistantAddonEnabled      bool                   `json:"ai_assistant_addon_enabled"`
	UpdatedAt                    string                 `json:"updated_at,omitempty"`
}

// marketingFlagsResponse mirrors the four marketing launch flags. Each reports
// whether that not-yet-launched marketing surface should be shown.
type marketingFlagsResponse struct {
	BrowseStore bool `json:"browse_store"`
	Discover    bool `json:"discover"`
	CreateStore bool `json:"create_store"`
	Pricing     bool `json:"pricing"`
}

// updateMarketingFlagsRequest is a partial update: an omitted key leaves that
// flag unchanged, so pointers distinguish "not provided" from "set to false".
type updateMarketingFlagsRequest struct {
	BrowseStore *bool `json:"browse_store"`
	Discover    *bool `json:"discover"`
	CreateStore *bool `json:"create_store"`
	Pricing     *bool `json:"pricing"`
}

type brandingUploadSignatureResponse struct {
	Signature string `json:"signature"`
	Timestamp int64  `json:"timestamp"`
	CloudName string `json:"cloud_name"`
	APIKey    string `json:"api_key"`
	Folder    string `json:"folder"`
}

type publicBrandingResponse struct {
	PlatformName string `json:"platform_name"`
	LogoURL      string `json:"logo_url"`
	// WhatsAppEnabled is true only when WhatsApp Cloud credentials are configured to
	// actually send customer OTPs.
	WhatsAppEnabled bool `json:"whatsapp_enabled"`
	// SMSEnabled is true when SMS (Arkesel) is configured to send OTPs.
	SMSEnabled bool `json:"sms_enabled"`
	// PhoneOTPEnabled is true when a code can be delivered to a phone at all — over
	// SMS OR WhatsApp. Storefronts/dashboards gate the phone sign-in on THIS so it
	// shows whenever it works (SMS is the default channel now), not only for WhatsApp.
	PhoneOTPEnabled bool `json:"phone_otp_enabled"`
	// MarketingFlags tell the marketing site which not-yet-launched surfaces to show.
	MarketingFlags marketingFlagsResponse `json:"marketing_flags"`
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

type operationsHealthResponse struct {
	HealthScore          int                      `json:"health_score"`
	BlockedCount         int                      `json:"blocked_count"`
	WatchCount           int                      `json:"watch_count"`
	PaymentHealthBPS     int                      `json:"payment_health_bps"`
	FailedWebhooks       int                      `json:"failed_webhooks"`
	PayoutHolds          int                      `json:"payout_holds"`
	OpenRiskReviews      int                      `json:"open_risk_reviews"`
	OpenSupportTickets   int                      `json:"open_support_tickets"`
	UrgentSupportTickets int                      `json:"urgent_support_tickets"`
	AuditEvents          int                      `json:"audit_events"`
	CriticalAuditEvents  int                      `json:"critical_audit_events"`
	Signals              []operationsHealthSignal `json:"signals"`
	UpdatedAt            string                   `json:"updated_at"`
}

type operationsHealthSignal struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Value       string `json:"value"`
	Helper      string `json:"helper"`
	Status      string `json:"status"`
	Target      string `json:"target"`
	TargetLabel string `json:"target_label"`
}

type adminNotificationsResponse struct {
	Notifications []adminNotificationResponse `json:"notifications"`
	UpdatedAt     string                      `json:"updated_at"`
}

type adminNotificationResponse struct {
	ID          string `json:"id"`
	Tone        string `json:"tone"`
	Category    string `json:"category"`
	Title       string `json:"title"`
	Helper      string `json:"helper"`
	Meta        string `json:"meta"`
	Source      string `json:"source"`
	Target      string `json:"target"`
	TargetLabel string `json:"target_label"`
}

type adminReportsResponse struct {
	Items     []adminReportResponse `json:"items"`
	UpdatedAt string                `json:"updated_at"`
}

type adminReportResponse struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Value       string `json:"value"`
	Helper      string `json:"helper"`
	Status      string `json:"status"`
	Target      string `json:"target"`
	TargetLabel string `json:"target_label"`
}

type launchReadinessResponse struct {
	Environment  string                         `json:"environment"`
	ReadyCount   int                            `json:"ready_count"`
	WatchCount   int                            `json:"watch_count"`
	BlockedCount int                            `json:"blocked_count"`
	Checks       []launchReadinessCheckResponse `json:"checks"`
	UpdatedAt    string                         `json:"updated_at"`
}

type launchReadinessCheckResponse struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Label       string `json:"label"`
	Status      string `json:"status"`
	Summary     string `json:"summary"`
	Detail      string `json:"detail"`
	Action      string `json:"action"`
	Target      string `json:"target"`
	TargetLabel string `json:"target_label"`
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
		BrandLogoURL:                 request.BrandLogoURL,
		AIAssistantAddonEnabled:      request.AIAssistantAddonEnabled,
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

func (handler Handler) updateMarketingFlags(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateMarketingFlagsRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	settings, err := handler.service.UpdateMarketingFlags(r.Context(), adminauthapp.UpdateMarketingFlagsCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		BrowseStore: request.BrowseStore,
		Discover:    request.Discover,
		CreateStore: request.CreateStore,
		Pricing:     request.Pricing,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlatformSettingsResponse(settings))
}

func (handler Handler) signBrandingUpload(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	signed, err := handler.service.SignBrandingUpload(r.Context(), adminauthapp.SignBrandingUploadCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, brandingUploadSignatureResponse{
		Signature: signed.Signature,
		Timestamp: signed.Timestamp,
		CloudName: signed.CloudName,
		APIKey:    signed.APIKey,
		Folder:    signed.Folder,
	})
}

// branding is a public, unauthenticated endpoint so the marketing site,
// business dashboard, and storefronts can render the current platform logo.
func (handler Handler) branding(w http.ResponseWriter, r *http.Request) {
	settings, err := handler.service.GetPlatformSettings(r.Context())
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, publicBrandingResponse{
		PlatformName:    settings.PlatformName,
		LogoURL:         settings.BrandLogoURL,
		WhatsAppEnabled: handler.service.WhatsAppEnabled(),
		SMSEnabled:      handler.service.SMSEnabled(),
		PhoneOTPEnabled: handler.service.PhoneOTPEnabled(),
		MarketingFlags:  newMarketingFlagsResponse(settings.MarketingFlags),
	})
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

func (handler Handler) operationsHealth(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	health, err := handler.service.GetOperationsHealth(r.Context(), adminauthapp.GetOperationsHealthCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newOperationsHealthResponse(health))
}

func (handler Handler) adminNotifications(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	notifications, err := handler.service.GetAdminNotifications(r.Context(), adminauthapp.GetAdminNotificationsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdminNotificationsResponse(notifications))
}

func (handler Handler) adminReports(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	reports, err := handler.service.GetAdminReports(r.Context(), adminauthapp.GetAdminReportsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdminReportsResponse(reports))
}

func (handler Handler) launchReadiness(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	readiness, err := handler.service.GetLaunchReadiness(r.Context(), adminauthapp.GetLaunchReadinessCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newLaunchReadinessResponse(readiness))
}

func newPlatformSettingsResponse(settings ports.AdminPlatformSettingsRecord) platformSettingsResponse {
	return platformSettingsResponse{
		PlatformName:                 settings.PlatformName,
		SupportEmail:                 settings.SupportEmail,
		VerificationSLAHours:         settings.VerificationSLAHours,
		PayoutReviewThresholdPesewas: settings.PayoutReviewThresholdPesewas,
		MaintenanceMode:              settings.MaintenanceMode,
		BrandLogoURL:                 settings.BrandLogoURL,
		MarketingFlags:               newMarketingFlagsResponse(settings.MarketingFlags),
		AIAssistantAddonEnabled:      settings.AIAssistantAddonEnabled,
		UpdatedAt:                    settings.UpdatedAt.Format(time.RFC3339),
	}
}

func newMarketingFlagsResponse(flags ports.MarketingFlags) marketingFlagsResponse {
	return marketingFlagsResponse{
		BrowseStore: flags.BrowseStore,
		Discover:    flags.Discover,
		CreateStore: flags.CreateStore,
		Pricing:     flags.Pricing,
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

func newOperationsHealthResponse(
	record adminauthapp.OperationsHealthResult,
) operationsHealthResponse {
	signals := make([]operationsHealthSignal, 0, len(record.Signals))
	for _, signal := range record.Signals {
		signals = append(signals, operationsHealthSignal{
			ID:          signal.ID,
			Label:       signal.Label,
			Value:       signal.Value,
			Helper:      signal.Helper,
			Status:      signal.Status,
			Target:      signal.Target,
			TargetLabel: signal.TargetLabel,
		})
	}
	return operationsHealthResponse{
		HealthScore:          record.HealthScore,
		BlockedCount:         record.BlockedCount,
		WatchCount:           record.WatchCount,
		PaymentHealthBPS:     record.PaymentHealthBPS,
		FailedWebhooks:       record.FailedWebhooks,
		PayoutHolds:          record.PayoutHolds,
		OpenRiskReviews:      record.OpenRiskReviews,
		OpenSupportTickets:   record.OpenSupportTickets,
		UrgentSupportTickets: record.UrgentSupportTickets,
		AuditEvents:          record.AuditEvents,
		CriticalAuditEvents:  record.CriticalAuditEvents,
		Signals:              signals,
		UpdatedAt:            record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAdminNotificationsResponse(
	record adminauthapp.AdminNotificationsResult,
) adminNotificationsResponse {
	notifications := make([]adminNotificationResponse, 0, len(record.Notifications))
	for _, notification := range record.Notifications {
		notifications = append(notifications, adminNotificationResponse{
			ID:          notification.ID,
			Tone:        notification.Tone,
			Category:    notification.Category,
			Title:       notification.Title,
			Helper:      notification.Helper,
			Meta:        notification.Meta,
			Source:      notification.Source,
			Target:      notification.Target,
			TargetLabel: notification.TargetLabel,
		})
	}
	return adminNotificationsResponse{
		Notifications: notifications,
		UpdatedAt:     record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAdminReportsResponse(record adminauthapp.AdminReportsResult) adminReportsResponse {
	items := make([]adminReportResponse, 0, len(record.Items))
	for _, item := range record.Items {
		items = append(items, adminReportResponse{
			ID:          item.ID,
			Label:       item.Label,
			Value:       item.Value,
			Helper:      item.Helper,
			Status:      item.Status,
			Target:      item.Target,
			TargetLabel: item.TargetLabel,
		})
	}
	return adminReportsResponse{
		Items:     items,
		UpdatedAt: record.UpdatedAt.Format(time.RFC3339),
	}
}

func newLaunchReadinessResponse(record adminauthapp.LaunchReadinessResult) launchReadinessResponse {
	checks := make([]launchReadinessCheckResponse, 0, len(record.Checks))
	for _, check := range record.Checks {
		checks = append(checks, launchReadinessCheckResponse{
			ID:          check.ID,
			Category:    check.Category,
			Label:       check.Label,
			Status:      check.Status,
			Summary:     check.Summary,
			Detail:      check.Detail,
			Action:      check.Action,
			Target:      check.Target,
			TargetLabel: check.TargetLabel,
		})
	}
	return launchReadinessResponse{
		Environment:  record.Environment,
		ReadyCount:   record.ReadyCount,
		WatchCount:   record.WatchCount,
		BlockedCount: record.BlockedCount,
		Checks:       checks,
		UpdatedAt:    record.UpdatedAt.Format(time.RFC3339),
	}
}
