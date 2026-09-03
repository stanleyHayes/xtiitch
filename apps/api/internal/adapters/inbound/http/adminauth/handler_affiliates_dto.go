package adminauthhttp

type affiliateApplicationDecisionRequest struct {
	Decision                   string `json:"decision"`
	ReviewNote                 string `json:"review_note"`
	PurchaseCommissionBPS      int    `json:"purchase_commission_bps"`
	FirstPaidPlanCommissionBPS int    `json:"first_paid_plan_commission_bps"`
	CookieWindowDays           int    `json:"cookie_window_days"`
	PayoutMode                 string `json:"payout_mode"`
}

type affiliateApplicationResponse struct {
	ApplicationID     string   `json:"application_id"`
	ApplicantType     string   `json:"applicant_type"`
	DisplayName       string   `json:"display_name"`
	ContactName       string   `json:"contact_name"`
	Email             string   `json:"email"`
	Phone             string   `json:"phone"`
	WebsiteURL        string   `json:"website_url"`
	RequestedCode     string   `json:"requested_code"`
	AudienceSummary   string   `json:"audience_summary"`
	PromotionChannels []string `json:"promotion_channels"`
	Status            string   `json:"status"`
	AffiliateID       string   `json:"affiliate_id,omitempty"`
	ReviewNote        string   `json:"review_note"`
	ReviewedAt        string   `json:"reviewed_at,omitempty"`
	CreatedAt         string   `json:"created_at"`
	UpdatedAt         string   `json:"updated_at"`
}

type affiliateUpsertRequest struct {
	EntityType                 string `json:"entity_type"`
	Code                       string `json:"code"`
	DisplayName                string `json:"display_name"`
	ContactName                string `json:"contact_name"`
	Email                      string `json:"email"`
	Phone                      string `json:"phone"`
	WebsiteURL                 string `json:"website_url"`
	CommissionModel            string `json:"commission_model"`
	CommissionRate             int64  `json:"commission_rate"`
	PurchaseCommissionBPS      int    `json:"purchase_commission_bps"`
	FirstPaidPlanCommissionBPS int    `json:"first_paid_plan_commission_bps"`
	CookieWindowDays           int    `json:"cookie_window_days"`
	PayoutMode                 string `json:"payout_mode"`
	PayoutReference            string `json:"payout_reference"`
	Status                     string `json:"status"`
	Notes                      string `json:"notes"`
	Reason                     string `json:"reason"`
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

type affiliateResponse struct {
	AffiliateID                string `json:"affiliate_id"`
	AffiliateProgrammeID       string `json:"affiliate_programme_id"`
	ProgrammeName              string `json:"programme_name"`
	OwnerType                  string `json:"owner_type"`
	OwnerBusinessID            string `json:"owner_business_id,omitempty"`
	OwnerBusinessName          string `json:"owner_business_name,omitempty"`
	EntityType                 string `json:"entity_type"`
	Code                       string `json:"code"`
	DisplayName                string `json:"display_name"`
	ContactName                string `json:"contact_name"`
	Email                      string `json:"email"`
	Phone                      string `json:"phone"`
	WebsiteURL                 string `json:"website_url"`
	CommissionModel            string `json:"commission_model"`
	CommissionRate             int64  `json:"commission_rate"`
	PurchaseCommissionBPS      int    `json:"purchase_commission_bps"`
	FirstPaidPlanCommissionBPS int    `json:"first_paid_plan_commission_bps"`
	CookieWindowDays           int    `json:"cookie_window_days"`
	PayoutMode                 string `json:"payout_mode"`
	PayoutReference            string `json:"payout_reference"`
	Status                     string `json:"status"`
	Notes                      string `json:"notes"`
	TargetScope                string `json:"target_scope"`
	TargetRefID                string `json:"target_ref_id,omitempty"`
	CreatedAt                  string `json:"created_at"`
	UpdatedAt                  string `json:"updated_at"`
}

type affiliateAttributionResponse struct {
	AffiliateID             string                                  `json:"affiliate_id"`
	Code                    string                                  `json:"code"`
	DisplayName             string                                  `json:"display_name"`
	ClickCount              int64                                   `json:"click_count"`
	ConversionCount         int64                                   `json:"conversion_count"`
	PendingConversionCount  int64                                   `json:"pending_conversion_count"`
	ApprovedConversionCount int64                                   `json:"approved_conversion_count"`
	SettledConversionCount  int64                                   `json:"settled_conversion_count"`
	ReversedConversionCount int64                                   `json:"reversed_conversion_count"`
	GrossMinor              int64                                   `json:"gross_minor"`
	CommissionMinor         int64                                   `json:"commission_minor"`
	RecentConversions       []affiliateConversionResponse           `json:"recent_conversions"`
	RecentPayouts           []affiliatePayoutResponse               `json:"recent_payouts"`
	MilestoneAchievements   []affiliateMilestoneAchievementResponse `json:"milestone_achievements"`
	LastActivityAt          string                                  `json:"last_activity_at,omitempty"`
}

type affiliateMilestoneAchievementRequest struct {
	RewardStatus   string `json:"reward_status"`
	FulfilmentNote string `json:"fulfilment_note"`
	Reason         string `json:"reason"`
}
type affiliateMilestoneAchievementResponse struct {
	AchievementID     string `json:"achievement_id"`
	AffiliateID       string `json:"affiliate_id"`
	Threshold         int    `json:"threshold"`
	Title             string `json:"title"`
	RewardDescription string `json:"reward_description"`
	RewardStatus      string `json:"reward_status"`
	FulfilmentNote    string `json:"fulfilment_note"`
	AchievedAt        string `json:"achieved_at"`
	FulfilledAt       string `json:"fulfilled_at,omitempty"`
}

type affiliateConversionResponse struct {
	ConversionID     string `json:"conversion_id"`
	AffiliateID      string `json:"affiliate_id"`
	BusinessID       string `json:"business_id"`
	BusinessName     string `json:"business_name"`
	ConversionType   string `json:"conversion_type"`
	OrderID          string `json:"order_id,omitempty"`
	SubscriptionID   string `json:"subscription_id,omitempty"`
	PaymentReference string `json:"payment_reference,omitempty"`
	GrossMinor       int64  `json:"gross_minor"`
	CommissionMinor  int64  `json:"commission_minor"`
	Status           string `json:"status"`
	AttributionModel string `json:"attribution_model"`
	HoldUntil        string `json:"hold_until,omitempty"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}
type affiliateAttributionCorrectionRequest struct {
	AffiliateID string `json:"affiliate_id"`
	Reason      string `json:"reason"`
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
