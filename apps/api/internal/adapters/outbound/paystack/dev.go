package paystack

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// DevProvider is the payment provider used when no live Paystack secret key is
// configured (local development, CI, end-to-end tests). It stubs the outbound
// HTTP calls deterministically but performs real webhook-signature verification
// and event parsing, so the money-confirmation path is exercised exactly as in
// production.
type DevProvider struct {
	webhookSecret string
}

func NewDevProvider(webhookSecret string) DevProvider {
	return DevProvider{webhookSecret: webhookSecret}
}

func (p DevProvider) CreateBusinessSubaccount(_ context.Context, input ports.CreateBusinessSubaccountInput) (ports.CreateBusinessSubaccountResult, error) {
	return ports.CreateBusinessSubaccountResult{
		ProviderReference: "DEV_SUB_" + input.BusinessID.String(),
	}, nil
}

func (p DevProvider) InitializeTransaction(_ context.Context, input ports.InitializeTransactionInput) (ports.InitializeTransactionResult, error) {
	return ports.InitializeTransactionResult{
		AuthorizationURL:  "https://dev.local/pay/" + input.Reference,
		AccessCode:        "dev_access_" + input.Reference,
		ProviderReference: input.Reference,
	}, nil
}

func (p DevProvider) ChargeAuthorization(_ context.Context, input ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error) {
	return ports.ChargeAuthorizationResult{
		ProviderReference: input.Reference,
		Status:            "success",
		AmountMinor:       input.AmountMinor,
		Currency:          input.Currency,
	}, nil
}

func (p DevProvider) VerifyWebhookSignature(payload []byte, signature string) bool {
	return verifyWebhookSignature(p.webhookSecret, payload, signature)
}

func (p DevProvider) ParseChargeEvent(payload []byte) (ports.ProviderChargeEvent, error) {
	return parseChargeEvent(payload)
}
