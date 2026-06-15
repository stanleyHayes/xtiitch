package money

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type PaymentStatus string

const (
	PaymentStatusInitiated PaymentStatus = "initiated"
	PaymentStatusSucceeded PaymentStatus = "succeeded"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusReversed  PaymentStatus = "reversed"
)

type PaymentPurpose string

const (
	PaymentPurposeStandardFull   PaymentPurpose = "standard_full"
	PaymentPurposeDeposit        PaymentPurpose = "deposit"
	PaymentPurposeBalance        PaymentPurpose = "balance"
	PaymentPurposeBookingDeposit PaymentPurpose = "booking_deposit"
)

func (p PaymentPurpose) Valid() bool {
	switch p {
	case PaymentPurposeStandardFull, PaymentPurposeDeposit, PaymentPurposeBalance, PaymentPurposeBookingDeposit:
		return true
	default:
		return false
	}
}

type PaymentMethod string

const (
	PaymentMethodMomo PaymentMethod = "momo"
	PaymentMethodCard PaymentMethod = "card"
)

type Payment struct {
	ID                common.ID
	BusinessID        common.ID
	OrderID           common.ID
	Purpose           PaymentPurpose
	Amount            common.Money
	Method            PaymentMethod
	ProviderReference string
	Status            PaymentStatus
	ThroughPlatform   bool
	CommissionAmount  common.Money
}
