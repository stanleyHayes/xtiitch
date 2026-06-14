package money

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusSucceeded PaymentStatus = "succeeded"
	PaymentStatusFailed    PaymentStatus = "failed"
)

type Payment struct {
	ID                 common.ID
	BusinessID         common.ID
	ProviderReference  string
	Status             PaymentStatus
	Amount             common.Money
	CommissionAmount   common.Money
	ThroughPlatform    bool
	ProviderWebhookRef string
}
