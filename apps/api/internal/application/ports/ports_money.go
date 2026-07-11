package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type PaymentProvider interface {
	CreateBusinessSubaccount(ctx context.Context, input CreateBusinessSubaccountInput) (CreateBusinessSubaccountResult, error)
	InitializeTransaction(ctx context.Context, input InitializeTransactionInput) (InitializeTransactionResult, error)
	InitializeAuthorization(ctx context.Context, input InitializeAuthorizationInput) (InitializeAuthorizationResult, error)
	VerifyAuthorization(ctx context.Context, input VerifyAuthorizationInput) (VerifyAuthorizationResult, error)
	ChargeAuthorization(ctx context.Context, input ChargeAuthorizationInput) (ChargeAuthorizationResult, error)
	// VerifyWebhookSignature checks a raw webhook body against its signature
	// header. It operates on bytes, never a decoded value, so the signature is
	// verified over exactly what the provider signed.
	VerifyWebhookSignature(payload []byte, signature string) bool
	ParseChargeEvent(payload []byte) (ProviderChargeEvent, error)
}

type PaymentRepository interface {
	Create(ctx context.Context, input CreatePaymentInput) error
	// CreateMarketplaceCharge records a combined multi-store split charge and its
	// per-shop members (the §4 "pay once" basket), so the webhook can settle each
	// shop's checkout group when the single Paystack transaction succeeds. It is a
	// platform-level (cross-tenant) write, distinct from the per-tenant Create.
	CreateMarketplaceCharge(ctx context.Context, input MarketplaceChargeInput) error
	// ConfirmFromProvider records the provider event and advances the matching
	// payment in a single transaction, so a re-delivered event is a no-op.
	ConfirmFromProvider(ctx context.Context, input ConfirmPaymentInput) (ConfirmPaymentResult, error)
	ListByBusiness(ctx context.Context, scope common.TenantScope) ([]PaymentRecord, error)
	// RecordManualTaking logs an off-platform sale (cash/momo/other). Paystack
	// does not move this money, so any platform commission is only an accrued
	// offline receivable for later invoice/reconciliation.
	RecordManualTaking(ctx context.Context, scope common.TenantScope, input ManualTakingInput) error
	// ListManualTakings lists a business's off-platform takings, most recent first.
	ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ManualTakingRecord, error)
	// MoneySummary aggregates the business's income: succeeded through-platform
	// payments and their commission, plus off-platform manual takings.
	MoneySummary(ctx context.Context, scope common.TenantScope) (MoneySummary, error)
}

type BusinessChargeRepository interface {
	GetChargeContext(ctx context.Context, scope common.TenantScope) (BusinessChargeContext, error)
	ProvisionSubaccount(ctx context.Context, businessID common.ID, subaccountRef string, settlementAccount string) error
}
