package paymentsapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// VerifyPaymentCommand asks for the ground-truth status of one payment,
// identified by its provider reference and scoped to the store that owns it.
type VerifyPaymentCommand struct {
	Scope             common.TenantScope
	ProviderReference string
}

// VerifyPaymentResult is the customer-facing status of a payment:
// "succeeded", "pending", or "failed".
type VerifyPaymentResult struct {
	Status string
}

// VerifyPayment settles what a webhook may have missed. A customer who backs
// out of the Paystack checkout leaves a draft order and an 'initiated' payment
// behind; on return the storefront asks here instead of assuming anything —
// the provider's Verify API is the ground truth. The mutation goes through
// ConfirmFromProvider, the SAME idempotent, exactly-once path the webhook
// uses, so a verify racing a webhook can never double-settle (or fail a
// payment the webhook just confirmed).
//
// The reference is resolved under the caller's tenant scope, so a reference
// naming another store's payment is indistinguishable from an unknown one.
func (s Service) VerifyPayment(ctx context.Context, cmd VerifyPaymentCommand) (VerifyPaymentResult, error) {
	reference := strings.TrimSpace(cmd.ProviderReference)
	if cmd.Scope.BusinessID.IsZero() || reference == "" {
		return VerifyPaymentResult{}, ErrInvalidCharge
	}

	payment, err := s.payments.FindByProviderReference(ctx, cmd.Scope, reference)
	if err != nil {
		return VerifyPaymentResult{}, err
	}

	// Already resolved — the webhook (or an earlier verify) beat us. Idempotent.
	switch payment.Status {
	case string(money.PaymentStatusSucceeded):
		return VerifyPaymentResult{Status: string(money.PaymentStatusSucceeded)}, nil
	case string(money.PaymentStatusFailed), string(money.PaymentStatusReversed):
		return VerifyPaymentResult{Status: string(money.PaymentStatusFailed)}, nil
	}

	verify, err := s.provider.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: reference})
	if err != nil {
		return VerifyPaymentResult{}, err
	}

	switch {
	case verify.Succeeded:
		// The same underpayment rule applyConfirmation enforces for webhooks: a
		// "success" that collected LESS than the expected amount is a failure,
		// never a settlement.
		succeeded := verify.AmountMinor <= 0 || verify.AmountMinor >= payment.AmountMinor
		return s.applyVerifiedOutcome(ctx, reference, succeeded, verify)
	case isFailedTransactionStatus(verify.Status):
		return s.applyVerifiedOutcome(ctx, reference, false, verify)
	default:
		// Still open at the provider (pending/ongoing/processing/...) — change
		// nothing; the customer can retry or the webhook can still land.
		return VerifyPaymentResult{Status: "pending"}, nil
	}
}

// applyVerifiedOutcome advances the payment through the shared webhook
// confirmation path with an event signature derived from the reference, so a
// repeat verify is deduped by the provider-event ledger exactly like a
// re-delivered webhook.
func (s Service) applyVerifiedOutcome(
	ctx context.Context,
	reference string,
	succeeded bool,
	verify ports.VerifyAuthorizationResult,
) (VerifyPaymentResult, error) {
	eventType := "charge.failed"
	if succeeded {
		eventType = "charge.success"
	}
	if _, err := s.payments.ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature:    "paystack:verify:" + eventType + ":" + reference,
		EventType:         eventType,
		ProviderReference: reference,
		Succeeded:         succeeded,
		PaidAmountMinor:   verify.AmountMinor,
		ProviderFeeMinor:  verify.FeeMinor,
	}); err != nil {
		return VerifyPaymentResult{}, err
	}
	if succeeded {
		return VerifyPaymentResult{Status: string(money.PaymentStatusSucceeded)}, nil
	}
	return VerifyPaymentResult{Status: string(money.PaymentStatusFailed)}, nil
}

// isFailedTransactionStatus reports whether the provider's raw transaction
// status names a terminal non-success. Anything else (pending, ongoing,
// processing, queued) is still open.
func isFailedTransactionStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "failed", "abandoned", "reversed":
		return true
	default:
		return false
	}
}
