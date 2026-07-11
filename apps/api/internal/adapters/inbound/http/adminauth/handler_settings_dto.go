package adminauthhttp

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
