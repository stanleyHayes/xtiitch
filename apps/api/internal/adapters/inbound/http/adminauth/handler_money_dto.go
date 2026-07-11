package adminauthhttp

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

type riskReviewStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
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
