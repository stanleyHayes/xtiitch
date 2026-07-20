package paymentsapp

import (
	"context"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// §5.2: the storefront's callback_url rides the charge all the way to the
// provider initialize call, so Paystack returns the customer to the cart after
// they pay one store basket.
func TestInitiateChargePassesCallbackURLToProvider(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	service := NewService(Dependencies{
		Provider: provider,
		Payments: &fakePaymentRepo{},
		Businesses: &fakeChargeRepo{context: ports.BusinessChargeContext{
			BusinessID: "business-1", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
		}},
		IDs: &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

	_, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeCartFull,
		AmountMinor:   20000,
		Method:        money.PaymentMethodMomo,
		CustomerEmail: "buyer@example.com",
		CallbackURL:   "https://store.xtiitch.com/cart",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if provider.initInput.CallbackURL != "https://store.xtiitch.com/cart" {
		t.Fatalf("expected the callback forwarded to the provider, got %+v", provider.initInput)
	}
}

// An absent callback stays absent end-to-end — the provider then applies its
// dashboard default, exactly the behaviour from before the field existed.
func TestInitiateChargeLeavesCallbackEmptyWhenUnset(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	service := NewService(Dependencies{
		Provider: provider,
		Payments: &fakePaymentRepo{},
		Businesses: &fakeChargeRepo{context: ports.BusinessChargeContext{
			BusinessID: "business-1", Verified: true, SubaccountRef: "sub_1",
		}},
		IDs: &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

	_, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeStandardFull,
		AmountMinor:   20000,
		Method:        money.PaymentMethodMomo,
		CustomerEmail: "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if provider.initInput.CallbackURL != "" {
		t.Fatalf("an unset callback must reach the provider empty, got %q", provider.initInput.CallbackURL)
	}
}
