package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminMoneyRailsRecord struct {
	WebhookEvents []AdminMoneyWebhookEventRecord
	PayoutReviews []AdminMoneyPayoutReviewRecord
	UpdatedAt     time.Time
}
type AdminMoneyWebhookEventRecord struct {
	ID                string
	ProviderReference string
	BusinessName      string
	Status            string
	Purpose           string
	AmountMinor       int64
	Attempts          int
	ReceivedAt        time.Time
	Note              string
}
type AdminMoneyPayoutReviewRecord struct {
	ID              string
	BusinessName    string
	SubaccountRef   string
	Status          string
	SettlementMinor int64
	CommissionMinor int64
	NextAction      string
	HoldActive      bool
	HoldReason      string
	HoldUpdatedAt   *time.Time
}
type AdminMoneyReplayRequestRecord struct {
	ReplayRequestID   common.ID
	ProviderReference string
	PaymentID         common.ID
	BusinessName      string
	Reason            string
	Status            string
	CreatedAt         time.Time
}
type QueueAdminMoneyReplayInput struct {
	ReplayRequestID   common.ID
	ProviderReference string
	RequestedByUserID common.ID
	Reason            string
}
type AdminMoneyReversalRecord struct {
	PaymentID                common.ID
	ProviderReference        string
	BusinessID               common.ID
	BusinessName             string
	OrderID                  *common.ID
	PaymentReversed          bool
	PromotionRedemptionCount int
	AffiliateConversionCount int
	ReferralCount            int
	ReferralRewardCount      int
	GeneratedPromotionCount  int
	Reason                   string
	ReversedAt               time.Time
}
type ReverseAdminMoneyPaymentInput struct {
	ProviderReference string
	ActorAdminUser    common.ID
	Reason            string
}
type SetAdminSettlementReviewHoldInput struct {
	BusinessID     common.ID
	Hold           bool
	Reason         string
	ActorAdminUser common.ID
}
