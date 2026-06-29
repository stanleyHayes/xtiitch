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
	// PaymentPurposeCartFull is the single charge that pays for a cart of several
	// made-to-wear pieces at once. Its webhook confirmation settles every order in
	// the checkout group, each by its own line total.
	PaymentPurposeCartFull PaymentPurpose = "cart_full"
)

func (p PaymentPurpose) Valid() bool {
	switch p {
	case PaymentPurposeStandardFull, PaymentPurposeDeposit, PaymentPurposeBalance, PaymentPurposeBookingDeposit, PaymentPurposeCartFull:
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

func (m PaymentMethod) Valid() bool {
	switch m {
	case PaymentMethodMomo, PaymentMethodCard:
		return true
	default:
		return false
	}
}

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
