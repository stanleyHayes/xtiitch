package checkoutapp

import (
	"context"
	"errors"
	"strings"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// VerifyStorePaymentCommand names a payment by its provider reference, scoped
// to a public storefront's handle.
type VerifyStorePaymentCommand struct {
	StoreHandle       string
	ProviderReference string
}

// VerifyStorePaymentResult is the customer-facing status of a checkout
// payment: "succeeded", "pending", or "failed".
type VerifyStorePaymentResult struct {
	Status string
}

// VerifyStorePayment backs the public payments/verify endpoint: when a
// customer returns from the Paystack checkout (or backs out of it), the
// storefront verifies the payment against the provider instead of assuming —
// a confirmed success settles the order, a confirmed failure releases its
// reservations and leaves the draft re-payable, and a still-open transaction
// is reported pending. The reference must name a payment of THIS store; one
// that doesn't is a plain not-found.
func (s Service) VerifyStorePayment(ctx context.Context, cmd VerifyStorePaymentCommand) (VerifyStorePaymentResult, error) {
	if strings.TrimSpace(cmd.ProviderReference) == "" {
		return VerifyStorePaymentResult{}, ErrInvalidInput
	}
	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return VerifyStorePaymentResult{}, ErrStoreNotFound
		}
		return VerifyStorePaymentResult{}, err
	}

	result, err := s.payments.VerifyPayment(ctx, paymentsapp.VerifyPaymentCommand{
		Scope:             common.TenantScope{BusinessID: store.BusinessID},
		ProviderReference: cmd.ProviderReference,
	})
	if err != nil {
		return VerifyStorePaymentResult{}, err
	}
	return VerifyStorePaymentResult{Status: result.Status}, nil
}
