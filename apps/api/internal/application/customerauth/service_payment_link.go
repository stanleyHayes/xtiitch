package customerauth

import (
	"context"
	"errors"

	checkoutapp "github.com/xcreativs/xtiitch/apps/api/internal/application/checkout"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// ErrOrderNotPayable means a payment link was requested for an order that can
// no longer be paid online — already confirmed, fulfilled, or cancelled — or
// that has nothing left to settle. Surfaced as 409 so the UI can say "this
// order is already paid (or cancelled)" rather than raising a second charge.
var ErrOrderNotPayable = errors.New("order is not payable")

// ErrOrderPaymentPending prevents a second Paystack charge while the previous
// attempt is still open at the provider.
var ErrOrderPaymentPending = errors.New("order payment is still pending")

// PaymentInitiator is the slice of the payments use case the customer payment
// link needs (declared here, in the consumer, to keep the dependency narrow —
// same shape as checkout's Payments).
type PaymentInitiator interface {
	InitiateCharge(ctx context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error)
	VerifyPayment(ctx context.Context, command paymentsapp.VerifyPaymentCommand) (paymentsapp.VerifyPaymentResult, error)
}

// OrderPaymentLinkResult is a fresh Paystack checkout for an order the
// customer abandoned: redirect them to AuthorizationURL, then verify by
// Reference on return.
type OrderPaymentLinkResult struct {
	AuthorizationURL string
	Reference        string
}

// CreateOrderPaymentLink re-initiates a Paystack charge for one of the
// customer's DRAFT orders — the recovery path for backing out of the Paystack
// checkout, where the draft order lingers with an 'initiated' payment that can
// never settle. The charge mirrors the original: the same outstanding amount,
// the same purpose (so a success settles the order exactly as the first
// attempt would have), and for a cart basket the whole group in one combined
// charge with the same per-design commission bases. The store must still be
// able to take payments; InitiateCharge enforces that. An order that is not
// draft (or has nothing left to settle) is refused as not payable. An order
// that is not the caller's own is reported as missing, never as someone
// else's.
func (s Service) CreateOrderPaymentLink(
	ctx context.Context,
	customerID common.ID,
	orderID common.ID,
	callbackURL string,
) (OrderPaymentLinkResult, error) {
	if customerID.IsZero() || orderID.IsZero() {
		return OrderPaymentLinkResult{}, ports.ErrNotFound
	}
	cleanedCallback, err := checkoutapp.CleanCallbackURL(callbackURL)
	if err != nil {
		return OrderPaymentLinkResult{}, err
	}

	order, err := s.repo.GetCustomerOrderPaymentContext(ctx, customerID, orderID)
	if err != nil {
		return OrderPaymentLinkResult{}, err
	}
	if order.Status != "draft" || order.OutstandingMinor <= 0 {
		return OrderPaymentLinkResult{}, ErrOrderNotPayable
	}
	if order.LastPaymentStatus == string(money.PaymentStatusInitiated) && order.LastPaymentReference != "" {
		verified, verifyErr := s.payments.VerifyPayment(ctx, paymentsapp.VerifyPaymentCommand{
			Scope:             common.TenantScope{BusinessID: order.BusinessID},
			ProviderReference: order.LastPaymentReference,
		})
		if verifyErr != nil {
			return OrderPaymentLinkResult{}, verifyErr
		}
		switch verified.Status {
		case string(money.PaymentStatusSucceeded):
			return OrderPaymentLinkResult{}, ErrOrderNotPayable
		case "pending":
			return OrderPaymentLinkResult{}, ErrOrderPaymentPending
		}
	}

	email := order.CustomerEmail
	if email == "" {
		// Checkout always snapshots an email, so this is a legacy-row fallback
		// only; InitiateCharge rejects a still-empty email as an invalid charge.
		if profile, profileErr := s.repo.GetCustomerProfile(ctx, customerID); profileErr == nil {
			email = profile.Email
		}
	}

	purpose := money.PaymentPurpose(order.Purpose)
	if !purpose.Valid() {
		purpose = money.PaymentPurposeStandardFull
	}
	charge, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:            common.TenantScope{BusinessID: order.BusinessID},
		OrderID:          &orderID,
		BookingID:        order.BookingID,
		Purpose:          purpose,
		AmountMinor:      order.OutstandingMinor,
		LineAmountsMinor: order.LineAmountsMinor,
		Method:           money.PaymentMethodMomo,
		CustomerEmail:    email,
		CallbackURL:      cleanedCallback,
	})
	if err != nil {
		return OrderPaymentLinkResult{}, err
	}
	return OrderPaymentLinkResult{
		AuthorizationURL: charge.AuthorizationURL,
		Reference:        charge.Reference,
	}, nil
}
