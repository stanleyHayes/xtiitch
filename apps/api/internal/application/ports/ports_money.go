package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type PaymentProvider interface {
	CreateBusinessSubaccount(ctx context.Context, input CreateBusinessSubaccountInput) (CreateBusinessSubaccountResult, error)
	// UpdateBusinessSubaccount repoints an existing subaccount at new payout
	// details, so changing them moves the money rather than creating a second
	// subaccount alongside the old one.
	UpdateBusinessSubaccount(ctx context.Context, input UpdateBusinessSubaccountInput) error
	InitializeTransaction(ctx context.Context, input InitializeTransactionInput) (InitializeTransactionResult, error)
	InitializeAuthorization(ctx context.Context, input InitializeAuthorizationInput) (InitializeAuthorizationResult, error)
	VerifyAuthorization(ctx context.Context, input VerifyAuthorizationInput) (VerifyAuthorizationResult, error)
	ChargeAuthorization(ctx context.Context, input ChargeAuthorizationInput) (ChargeAuthorizationResult, error)
	// ListSettlements pulls the provider's settlement (payout) records for one
	// subaccount — the §3.2 ground truth for what actually settled to a store.
	ListSettlements(ctx context.Context, input ListSettlementsInput) ([]ProviderSettlement, error)
	// VerifyWebhookSignature checks a raw webhook body against its signature
	// header. It operates on bytes, never a decoded value, so the signature is
	// verified over exactly what the provider signed.
	VerifyWebhookSignature(payload []byte, signature string) bool
	// PeekEventType reads only the event discriminator of a webhook body, so the
	// handler can route charge.* to confirmation and transfer.* to the payout
	// refresh. It performs no validation beyond the JSON parse.
	PeekEventType(payload []byte) string
	ParseChargeEvent(payload []byte) (ProviderChargeEvent, error)
	// ParseTransferEvent reads a transfer.* webhook (transfer.success /
	// transfer.failed / transfer.reversed) — the §4.10 payout-landed signal used
	// to trigger a settlement refresh for the affected store.
	ParseTransferEvent(payload []byte) (ProviderTransferEvent, error)
}

type PaymentRepository interface {
	Create(ctx context.Context, input CreatePaymentInput) error
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
	// RecordProviderEvent writes the webhook idempotency row for a non-charge
	// event (transfer.*) and reports whether this was a first delivery, so a
	// re-delivered event is a no-op. Same ledger ConfirmFromProvider uses.
	RecordProviderEvent(ctx context.Context, input RecordProviderEventInput) (bool, error)
	// FindBusinessBySubaccount resolves the business that owns a provider
	// subaccount code. It runs cross-tenant (the webhook arrives without a
	// tenant context), like the provider-reference lookup.
	FindBusinessBySubaccount(ctx context.Context, subaccountCode string) (common.ID, bool, error)
	// UpsertProviderSettlements idempotently mirrors the provider's settlement
	// rows for a business (§3.3), keyed on the provider settlement reference.
	UpsertProviderSettlements(ctx context.Context, businessID common.ID, settlements []ProviderSettlementInput) (int, error)
	// ListProviderSettlements lists a business's mirrored settlement (payout)
	// rows, most recent first, paged by limit/offset.
	ListProviderSettlements(ctx context.Context, scope common.TenantScope, limit int, offset int) ([]ProviderSettlementRecord, error)
	// MarkSettlementsSynced stamps the business's settlement-sync watermark,
	// which throttles read-path syncs (§3.3).
	MarkSettlementsSynced(ctx context.Context, businessID common.ID) error
}

type BusinessChargeRepository interface {
	GetChargeContext(ctx context.Context, scope common.TenantScope) (BusinessChargeContext, error)
	ProvisionSubaccount(ctx context.Context, input ProvisionSubaccountInput) error
}
