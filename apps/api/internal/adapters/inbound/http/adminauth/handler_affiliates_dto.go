package adminauthhttp

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
