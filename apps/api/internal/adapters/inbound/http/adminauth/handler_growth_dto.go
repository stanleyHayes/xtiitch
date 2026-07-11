package adminauthhttp

import (
	"time"
)

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
