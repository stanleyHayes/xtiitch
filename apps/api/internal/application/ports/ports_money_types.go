package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type CreateBusinessSubaccountInput struct {
	BusinessID common.ID
	// BusinessName is the name Paystack records on the subaccount. Per §2.1 it
	// is the MoMo-REGISTERED wallet name the owner supplied ("the exact legal
	// name that pops up when someone sends money to this number"), because
	// settlement resolves against the wallet's registered name — the store's
	// trading name is only a fallback for legacy rows that never collected one.
	BusinessName string
	// SettlementBank is the provider's settlement-bank code — for Ghana mobile
	// money the network code (MTN / VOD / ATL), or a bank code. Paystack REQUIRES
	// it on /subaccount; without it the subaccount is rejected ("Bank code is
	// required").
	SettlementBank    string
	SettlementAccount string
}

// UpdateBusinessSubaccountInput repoints an existing subaccount at new payout
// details, for an owner changing where their money lands.
type UpdateBusinessSubaccountInput struct {
	BusinessID common.ID
	// SubaccountRef is the provider's code for the subaccount to repoint.
	SubaccountRef string
	// BusinessName re-points the subaccount's display name at the wallet's
	// registered name (§2.1), same rule as CreateBusinessSubaccountInput.
	BusinessName      string
	SettlementBank    string
	SettlementAccount string
}

// ProvisionSubaccountInput carries the payout facts to mirror onto the business
// row after the provider accepted the subaccount. It is a struct rather than
// positional arguments because SettlementBank and SettlementAccount are both
// strings: transposing them would write the network into the mobile-money-number
// column and corrupt the payout destination silently.
type ProvisionSubaccountInput struct {
	BusinessID    common.ID
	SubaccountRef string
	// SettlementAccountName is the MoMo-registered wallet name (§2.1), mirrored
	// locally so the dashboard can show it and later repoints can re-derive the
	// subaccount name without asking again.
	SettlementAccountName string
	SettlementBank        string
	SettlementAccount     string
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
	// CallbackURL, when set, is where the provider returns the customer after
	// they pay (§5.2: back to the storefront cart). Empty keeps the provider
	// default. It is passed to the provider verbatim, so callers must have
	// validated it already (checkout validates: absolute https, or http on
	// loopback for dev).
	CallbackURL string
	// NOTE: there is deliberately no multi-destination split here. §5.2: every
	// payment on Xtiitch is one customer → one store, so the single-store
	// SubaccountRef split (§4.8) is the only split — "no multi-store split
	// logic exists anywhere."
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

// VerifyAuthorizationResult reads back a transaction by reference: whether it
// was paid (Succeeded), the provider's raw transaction status (Status), the
// amount, and the reusable authorization captured for recurring
// (AuthorizationCode + Reusable; MoMo authorizations are typically not
// reusable, so the renewal sweep re-prompts instead of silently charging).
// Despite the name it verifies ANY transaction reference (subscriptions and
// customer order charges alike) — it is Paystack's generic
// GET /transaction/verify/{reference}.
type VerifyAuthorizationResult struct {
	Succeeded bool
	// Status is the provider's raw transaction status verbatim (e.g. "success",
	// "failed", "abandoned", "pending"), so a caller can tell a still-open
	// transaction from a genuinely failed one — Succeeded alone cannot.
	Status      string
	AmountMinor int64
	// FeeMinor is the transaction fee the provider reports on this charge (§3.2);
	// 0 means "not reported".
	FeeMinor          int64
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
	// FeeMinor is the transaction fee the PROVIDER reports it took on this
	// charge (Paystack's "fees" field, persisted verbatim per §3.2 — never
	// locally recomputed). 0 means "not reported".
	FeeMinor int64
	// Signature is the idempotency key for this event (provider + reference +
	// type), used to make a re-delivered confirmation a no-op.
	Signature string
}

// ProviderTransferEvent is a parsed transfer.* webhook: the payout-side signal
// (§4.10). SubaccountCode identifies the store whose settlements should be
// refreshed; empty means the payload did not name one (no store to refresh).
type ProviderTransferEvent struct {
	EventType         string
	ProviderReference string
	Status            string
	SubaccountCode    string
	AmountMinor       int64
	Succeeded         bool
	// Signature is the idempotency key for this event (provider + reference +
	// type), same construction as ProviderChargeEvent.
	Signature string
}

// ListSettlementsInput filters the provider's Settlements API (§3.2): by the
// store's subaccount, an optional date range and status, paginated.
type ListSettlementsInput struct {
	SubaccountRef string
	From          *time.Time
	To            *time.Time
	Status        string
}

// ProviderSettlement is one settlement (payout) record as the provider reports
// it — Paystack's Settlements data is the ground truth for what settled to a
// store (§3.2). RawPayload keeps the provider's own record verbatim for
// dispute evidence (§11.5).
type ProviderSettlement struct {
	ProviderReference string
	SubaccountCode    string
	AmountMinor       int64
	Status            string
	SettledAt         *time.Time
	RawPayload        []byte
}

// RecordProviderEventInput is one non-charge provider event delivery for the
// idempotency ledger.
type RecordProviderEventInput struct {
	EventSignature    string
	EventType         string
	ProviderReference string
}

// ProviderSettlementInput is one settlement row to mirror locally.
type ProviderSettlementInput struct {
	ProviderReference string
	SubaccountCode    string
	AmountMinor       int64
	Status            string
	SettledAt         *time.Time
	RawPayload        []byte
}

// ProviderSettlementRecord is a mirrored settlement row: the store owner's
// payout history (§3.3).
type ProviderSettlementRecord struct {
	SettlementID      common.ID
	ProviderReference string
	AmountMinor       int64
	Status            string
	SettledAt         *time.Time
	CreatedAt         time.Time
}

// MoneyPeriod bounds a Money Desk read. Nil dates mean "all time".
type MoneyPeriod struct {
	From *time.Time
	To   *time.Time
}

// MoneyTransactionRecord is one successful storefront payment as displayed in
// the business Money Desk. Every fee column is persisted provider/quote data,
// not recomputed at read time; TakeHomeMinor is a sum expression over those
// stored figures.
type MoneyTransactionRecord struct {
	PaymentID         common.ID
	OrderID           *common.ID
	ProviderReference string
	Purpose           string
	Method            string
	AmountMinor       int64
	DesignCostMinor   int64
	PaystackFeeMinor  int64
	XtiitchFeeMinor   int64
	XtiitchTaxMinor   int64
	TakeHomeMinor     int64
	DesignTitle       string
	CustomerName      string
	CreatedAt         time.Time
}

// SettlementSyncResult reports one SyncSettlements run. Skipped means no sync
// was attempted (no subaccount on file, or the per-business throttle window
// has not elapsed); Upserted counts the rows written when it did run.
type SettlementSyncResult struct {
	BusinessID common.ID
	Skipped    bool
	Upserted   int
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
	// LoggedByUserID is the staff member logging the taking (§14.1 team
	// analytics, 000109). Zero = unattributed.
	LoggedByUserID common.ID
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

// MoneySummary is the business's income overview, all in GHS pesewas. Every
// fee/settlement figure is a SQL sum over PERSISTED provider-derived columns
// (§3.2 bans deriving fees locally; sums of stored Paystack figures are the
// allowed shape). Store share per payment is defined from what we persist:
//
//	store_share = amount_minor − commission_minor − coalesce(provider_fee_minor, 0)
//
// (commission_minor already carries the Xtiitch fee + the VAT on it — that is
// the split's transaction_charge routed to the main account). AllTimeIncomeMinor
// is the store's cumulative earnings since joining (§3.1, never reduced by
// payouts); NetIncomeMinor is the amount due for payout — the same figure minus
// the settlements already paid out, so it rises with sales and drops when a
// payout lands (§3.1/§3.3).
type MoneySummary struct {
	ThroughPlatformMinor int64
	// CommissionMinor is Σ commission_minor (Xtiitch fee + tax combined), kept
	// with its existing meaning for backward compatibility.
	CommissionMinor  int64
	XtiitchFeeMinor  int64
	XtiitchTaxMinor  int64
	PaystackFeeMinor int64
	// SettledPayoutsMinor is Σ successful settlements (payouts) mirrored from
	// the provider (§3.3) — the "already paid out" side of net income.
	SettledPayoutsMinor       int64
	ManualTakingsMinor        int64
	OfflineCommissionDueMinor int64
	AllTimeIncomeMinor        int64
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
	// XtiitchTaxMinor is the VAT on the Xtiitch fee from the quote that was
	// charged (§4.2/§4.3), persisted at charge time so the Money Desk can split
	// the fee from the tax without ever recomputing either (§3.2).
	XtiitchTaxMinor int64
	// SettleAmountMinor is the portion of this payment that counts toward the
	// order's settled_minor: the order amount WITHOUT any buyer-borne platform fee
	// (equals AmountMinor when the merchant absorbs the fee). 0 falls back to
	// AmountMinor at settlement, so a buyer-borne fee never inflates the balance.
	SettleAmountMinor int64
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
	// ProviderFeeMinor is the transaction fee the provider reports it took on this
	// charge, persisted verbatim on confirmation (§3.2 — the Money Desk reads the
	// stored figure, it is never recomputed locally). 0 means "not reported":
	// the stored value is left untouched.
	ProviderFeeMinor int64
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

type BusinessChargeContext struct {
	BusinessID    common.ID
	Name          string
	Verified      bool
	SubaccountRef string
	// SettlementBank / SettlementAccount are the payout details as last saved.
	// VerifyBusiness compares against them to tell a genuine change of payout
	// destination from a repeat submit of the same details, so the former is not
	// swallowed by the idempotent early return. SettlementBank is empty for
	// businesses provisioned before the network was mirrored locally
	// (migration 000087).
	SettlementBank    string
	SettlementAccount string
	// MoMoAccountName is the MoMo-registered wallet name as last saved (§2.1).
	// Empty for businesses provisioned before migration 000098; their first
	// resubmit backfills it, and until then the store's trading name stands in
	// for the subaccount name.
	MoMoAccountName string
	// SettlementsSyncedAt is the settlement-sync watermark (§3.3): the last time
	// this store's payouts were mirrored from the provider. Nil means never
	// synced; the sync throttle compares it against the current time.
	SettlementsSyncedAt *time.Time
	CommissionBps       int
	// FeePassXtiitchFee / FeePassTax / FeePassPaystackFee are the store's three
	// fee pass-down tick boxes (§4.4): which of the Xtiitch fee, the Tax (VAT on
	// it) and the Paystack fee are charged to the customer on top of the order
	// total at checkout instead of absorbed from the store's share.
	FeePassXtiitchFee  bool
	FeePassTax         bool
	FeePassPaystackFee bool
}
