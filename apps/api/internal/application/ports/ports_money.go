package ports

import (
	"context"
	"time"

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
type CreateBusinessSubaccountInput struct {
	BusinessID   common.ID
	BusinessName string
	// SettlementBank is the provider's settlement-bank code — for Ghana mobile
	// money the network code (MTN / VOD / ATL), or a bank code. Paystack REQUIRES
	// it on /subaccount; without it the subaccount is rejected ("Bank code is
	// required").
	SettlementBank    string
	SettlementAccount string
}
type CreateBusinessSubaccountResult struct {
	ProviderReference string
}
type InitializeTransactionInput struct {
	BusinessID      common.ID
	SubaccountRef   string
	CustomerEmail   string
	AmountMinor     int64
	CommissionMinor int64
	Currency        string
	Reference       string
	// Splits, when set, routes ONE charge across several merchants' subaccounts
	// (the §4 marketplace basket). Each entry is a merchant's net share; the
	// platform receives the remainder (total charge minus the summed shares) as
	// its commission. When Splits is empty the single SubaccountRef path is used.
	Splits []SubaccountSplit
}

// SubaccountSplit is one merchant's net share (minor units) of a marketplace
// split charge, settled to that merchant's subaccount.
type SubaccountSplit struct {
	SubaccountRef string
	ShareMinor    int64
}
type InitializeTransactionResult struct {
	AuthorizationURL  string
	AccessCode        string
	ProviderReference string
}

// InitializeAuthorizationInput opens a STANDARD Paystack checkout that charges
// the first period AND (for a card) yields a reusable authorization for later
// recurring charges. It replaces the old direct-debit "mandate" link, which was
// a dead page for this MoMo-first account. AmountMinor is the first-period
// charge (already discount-adjusted by the caller).
type InitializeAuthorizationInput struct {
	BusinessID    common.ID
	CustomerEmail string
	AmountMinor   int64
	Currency      string
	Reference     string
	CallbackURL   string
}
type InitializeAuthorizationResult struct {
	RedirectURL string
	AccessCode  string
	Reference   string
}
type VerifyAuthorizationInput struct {
	Reference string
}

// VerifyAuthorizationResult reads back the checkout transaction: whether it was
// paid (Succeeded), the amount, and the reusable authorization captured for
// recurring (AuthorizationCode + Reusable; MoMo authorizations are typically not
// reusable, so the renewal sweep re-prompts instead of silently charging).
type VerifyAuthorizationResult struct {
	Succeeded         bool
	AmountMinor       int64
	AuthorizationCode string
	CustomerCode      string
	CustomerEmail     string
	Channel           string
	Bank              string
	Reusable          bool
	// Active is true when the transaction succeeded and a reusable authorization
	// came back; retained for callers that only check that an authorization exists.
	Active bool
}
type ChargeAuthorizationInput struct {
	BusinessID        common.ID
	AuthorizationCode string
	CustomerEmail     string
	AmountMinor       int64
	Currency          string
	Reference         string
}
type ChargeAuthorizationResult struct {
	ProviderReference string
	Status            string
	AmountMinor       int64
	Currency          string
}
type ProviderChargeEvent struct {
	EventType         string
	ProviderReference string
	Succeeded         bool
	AmountMinor       int64
	// Signature is the idempotency key for this event (provider + reference +
	// type), used to make a re-delivered confirmation a no-op.
	Signature string
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
type ManualTakingInput struct {
	TakingID         common.ID
	BusinessID       common.ID
	OrderID          *common.ID
	AmountMinor      int64
	Method           string
	WhatFor          string
	CommissionBps    int
	CommissionMinor  int64
	CommissionStatus string
	CommissionNote   string
}
type ManualTakingRecord struct {
	TakingID         common.ID
	AmountMinor      int64
	Method           string
	WhatFor          string
	CommissionBps    int
	CommissionMinor  int64
	CommissionStatus string
	CommissionNote   string
	TakenAt          time.Time
}

// MoneySummary is the business's income overview, all in GHS pesewas. Net income
// is what the business keeps: through-platform settlements (gross minus the
// platform commission) plus off-platform takings, less accrued offline platform
// commission that still needs later invoice/reconciliation.
type MoneySummary struct {
	ThroughPlatformMinor      int64
	CommissionMinor           int64
	ManualTakingsMinor        int64
	OfflineCommissionDueMinor int64
	NetIncomeMinor            int64
}
type CreatePaymentInput struct {
	PaymentID         common.ID
	BusinessID        common.ID
	OrderID           *common.ID
	BookingID         *common.ID
	Purpose           string
	AmountMinor       int64
	Currency          string
	Method            string
	ProviderReference string
	CommissionMinor   int64
	// SettleAmountMinor is the portion of this payment that counts toward the
	// order's settled_minor: the order amount WITHOUT any buyer-borne platform fee
	// (equals AmountMinor when the merchant absorbs the fee). 0 falls back to
	// AmountMinor at settlement, so a buyer-borne fee never inflates the balance.
	SettleAmountMinor int64
}

// MarketplaceChargeInput records one combined multi-store split charge: the
// parent (keyed by the Paystack provider reference) plus a member per shop in
// the basket. TotalMinor is the whole charge; each member's NetMinor is that
// shop's flat split share and CommissionMinor the platform's cut for it.
type MarketplaceChargeInput struct {
	ChargeID          common.ID
	ProviderReference string
	CustomerEmail     string
	TotalMinor        int64
	Members           []MarketplaceChargeMember
}
type MarketplaceChargeMember struct {
	MemberID        common.ID
	BusinessID      common.ID
	CheckoutGroupID common.ID
	AnchorOrderID   common.ID
	NetMinor        int64
	CommissionMinor int64
}
type ConfirmPaymentInput struct {
	EventSignature    string
	EventType         string
	ProviderReference string
	Succeeded         bool
	// PaidAmountMinor is the amount the provider reports it actually collected, used
	// as a defense-in-depth reconciliation against the payment's expected amount so
	// an underpayment never settles an order in full. 0 means "not reported" (skip
	// the check), preserving behaviour for events without an amount.
	PaidAmountMinor int64
}
type ConfirmPaymentResult struct {
	AlreadyProcessed         bool
	PaymentFound             bool
	SubscriptionInvoiceFound bool
	AdCampaignPaymentFound   bool
	BusinessID               common.ID
}
type PaymentRecord struct {
	PaymentID         common.ID
	BusinessID        common.ID
	Purpose           string
	AmountMinor       int64
	Currency          string
	Method            string
	ProviderReference string
	Status            string
	CommissionMinor   int64
}
type BusinessChargeRepository interface {
	GetChargeContext(ctx context.Context, scope common.TenantScope) (BusinessChargeContext, error)
	ProvisionSubaccount(ctx context.Context, businessID common.ID, subaccountRef string, settlementAccount string) error
}
type BusinessChargeContext struct {
	BusinessID    common.ID
	Name          string
	Verified      bool
	SubaccountRef string
	CommissionBps int
	// FeePassToBuyer: when true the buyer pays the platform fee on top of the
	// order total and the merchant nets the full total (Pricing Book §3).
	FeePassToBuyer bool
}
