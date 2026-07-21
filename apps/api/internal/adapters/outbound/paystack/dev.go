package paystack

import (
	"context"
	"net/url"
	"sync"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// DevProvider is the payment provider used when no live Paystack secret key is
// configured (local development, CI, end-to-end tests). It stubs the outbound
// HTTP calls deterministically but performs real webhook-signature verification
// and event parsing, so the money-confirmation path is exercised exactly as in
// production.
type DevProvider struct {
	webhookSecret string
	// amounts remembers what each stub checkout was initialized for, shared by
	// pointer across the provider's value copies.
	amounts *devAmounts
}

// devAmounts records the amount of each initialized transaction by reference,
// so VerifyAuthorization can report the REAL amount for a known reference
// instead of a flat placeholder (a basket over the placeholder size would
// otherwise trip the underpayment rule in local/e2e runs of the store-sale
// verify path).
type devAmounts struct {
	mu    sync.Mutex
	byRef map[string]int64
}

func (store *devAmounts) record(reference string, amountMinor int64) {
	if reference == "" || amountMinor <= 0 {
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.byRef[reference] = amountMinor
}

func (store *devAmounts) lookup(reference string) (int64, bool) {
	store.mu.Lock()
	defer store.mu.Unlock()
	amountMinor, ok := store.byRef[reference]
	return amountMinor, ok
}

func NewDevProvider(webhookSecret string) DevProvider {
	return DevProvider{
		webhookSecret: webhookSecret,
		amounts:       &devAmounts{byRef: map[string]int64{}},
	}
}

func (p DevProvider) CreateBusinessSubaccount(
	_ context.Context,
	input ports.CreateBusinessSubaccountInput) (ports.CreateBusinessSubaccountResult,
	error,
) {
	return ports.CreateBusinessSubaccountResult{
		ProviderReference: "DEV_SUB_" + input.BusinessID.String(),
	}, nil
}

// UpdateBusinessSubaccount accepts any repoint. The stub keeps no subaccount
// state, so there is nothing to mutate — the caller's own row is the record.
func (p DevProvider) UpdateBusinessSubaccount(_ context.Context, _ ports.UpdateBusinessSubaccountInput) error {
	return nil
}

func (p DevProvider) InitializeTransaction(
	_ context.Context,
	input ports.InitializeTransactionInput) (ports.InitializeTransactionResult,
	error,
) {
	authorizationURL := "https://dev.local/pay/" + input.Reference
	if input.CallbackURL != "" {
		// Accept + echo the §5.2 callback: the dev checkout page is a stub, so
		// the return URL rides the authorization URL as a query parameter —
		// observable end-to-end in local/e2e runs exactly like the live
		// provider's callback_url field.
		authorizationURL += "?callback_url=" + url.QueryEscape(input.CallbackURL)
	}
	p.amounts.record(input.Reference, input.AmountMinor)
	return ports.InitializeTransactionResult{
		AuthorizationURL:  authorizationURL,
		AccessCode:        "dev_access_" + input.Reference,
		ProviderReference: input.Reference,
	}, nil
}

func (p DevProvider) InitializeAuthorization(
	_ context.Context,
	input ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult,
	error,
) {
	reference := "dev_auth_" + input.BusinessID.String()
	p.amounts.record(reference, input.AmountMinor)
	return ports.InitializeAuthorizationResult{
		RedirectURL: "https://dev.local/authorize/" + reference,
		AccessCode:  "dev_access_" + reference,
		Reference:   reference,
	}, nil
}

func (p DevProvider) VerifyAuthorization(_ context.Context, input ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error) {
	// The dev checkout always "succeeds" and returns a reusable card authorization,
	// so the subscription/add-on activation path runs end-to-end locally. A
	// reference this provider initialized reports the amount it was initialized
	// for; an unknown reference falls back to a positive PLACEHOLDER (the booked
	// invoice must satisfy the amount_minor > 0 DB check, and the exact figure is
	// irrelevant offline). Real runs use the live Paystack client, whose
	// /transaction/verify returns the actual amount collected.
	amountMinor := int64(10000)
	if initialized, ok := p.amounts.lookup(input.Reference); ok {
		amountMinor = initialized
	}
	return ports.VerifyAuthorizationResult{
		Succeeded:         true,
		Status:            "success",
		AmountMinor:       amountMinor,
		FeeMinor:          devProviderFee(amountMinor),
		AuthorizationCode: "AUTH_" + input.Reference,
		CustomerCode:      "CUS_" + input.Reference,
		CustomerEmail:     "owner@example.com",
		Channel:           "card",
		Bank:              "Dev Bank",
		Reusable:          true,
		Active:            true,
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

func (p DevProvider) PeekEventType(payload []byte) string {
	return peekEventType(payload)
}

func (p DevProvider) ParseChargeEvent(payload []byte) (ports.ProviderChargeEvent, error) {
	event, err := parseChargeEvent(payload)
	if err != nil {
		return ports.ProviderChargeEvent{}, err
	}
	// The dev provider reports a DETERMINISTIC fee — the modeled 1.95% Paystack
	// rate, half-up, mirroring money.Percentage(amount, 195) — when the crafted
	// payload carried none, so local/test confirms persist a provider fee exactly
	// like live ones (§3.2). A payload that sets "fees" explicitly wins.
	if event.FeeMinor == 0 && event.AmountMinor > 0 {
		event.FeeMinor = devProviderFee(event.AmountMinor)
	}
	return event, nil
}

func (p DevProvider) ParseTransferEvent(payload []byte) (ports.ProviderTransferEvent, error) {
	return parseTransferEvent(payload)
}

// ListSettlements returns no settlements: the dev provider is stateless and
// never settles, so a dev sync is a correct no-op (the Money Desk then shows
// zero settled payouts locally). Tests exercise the sync over fakes.
func (p DevProvider) ListSettlements(_ context.Context, _ ports.ListSettlementsInput) ([]ports.ProviderSettlement, error) {
	return nil, nil
}

// devProviderFee is the dev provider's deterministic stand-in for Paystack's
// reported fee: 1.95% of the amount, rounded half-up (money.PaystackFeeRateBps).
func devProviderFee(amountMinor int64) int64 {
	return money.Percentage(amountMinor, money.PaystackFeeRateBps)
}
