package paymentsapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

var (
	ErrBusinessNotVerified = errors.New("business is not verified for payments")
	ErrInvalidCharge       = errors.New("invalid charge request")
	ErrInvalidSignature    = errors.New("invalid webhook signature")
	ErrInvalidTaking       = errors.New("invalid manual taking")
	// ErrIdentityVerificationRequired means payout setup was attempted before an
	// admin approved the business's Ghana Card verification. §2.2 fixes the
	// sequence: identity submission → admin approval → ONLY THEN payout details.
	// A business must never become payable — or look verified — from payout
	// setup alone, so both the OTP request and the save fail closed on this.
	ErrIdentityVerificationRequired = errors.New("admin-approved identity verification is required before payout setup")
	// ErrInvalidPayoutNumber means the payout number does not normalize to a
	// 10-digit Ghana local MoMo number (0XXXXXXXXX, §2.1). Distinct from
	// authapp.ErrInvalidPhone ("invalid_phone") so the settings form can point
	// at the payout-number field specifically.
	ErrInvalidPayoutNumber = errors.New("payout number must be a 10-digit Ghana mobile money number")
	// ErrOTPUnavailable means payout-number verification is not wired, so a payout
	// number cannot be proved. VerifyBusiness fails closed on it rather than
	// saving unproven details: the OTP is the evidence that settles payment
	// disputes, and silently skipping it would leave that evidence missing exactly
	// when it is needed.
	ErrOTPUnavailable = errors.New("payout number verification is not available")
)

// MoMoOTP sends and checks the one-time code that proves a payout mobile-money
// number. It is satisfied by the auth service, which owns the challenge store
// and the TTL / attempt-cap / consume rules; payments delegates rather than
// reimplementing them so every OTP flow shares one set of rules. Declared here,
// in the consumer, to keep the dependency narrow (same shape as
// adminauth.PlanChangeApplier).
type MoMoOTP interface {
	RequestBusinessPhoneOTP(ctx context.Context, number string) error
	VerifyBusinessPhoneOTP(ctx context.Context, number string, code string) error
}

type Service struct {
	provider   ports.PaymentProvider
	payments   ports.PaymentRepository
	businesses ports.BusinessChargeRepository
	ids        ports.IDGenerator
	otp        MoMoOTP
	// vatRates reads the live admin-editable VAT rate (§4.1) at charge time;
	// vatRateBps is the configured seed/fallback used when no reader is wired
	// or the read fails. 0 disables VAT on the Xtiitch fee.
	vatRates   VATRateReader
	vatRateBps int
}

type Dependencies struct {
	Provider   ports.PaymentProvider
	Payments   ports.PaymentRepository
	Businesses ports.BusinessChargeRepository
	IDs        ports.IDGenerator
	// OTP verifies the payout number before payout details are saved. Unlike the
	// other optional dependencies in this codebase, a nil OTP does NOT disable the
	// step — VerifyBusiness rejects with ErrOTPUnavailable. A misconfiguration must
	// not quietly turn the gate off.
	OTP MoMoOTP
	// VATRates reads the live VAT rate from the platform settings (§4.1).
	// Optional; VATRateBps is the seed/fallback default (the
	// XTIITCH_SUBSCRIPTION_VAT_RATE_BPS env value), used only when no reader is
	// wired or the read fails.
	VATRates   VATRateReader
	VATRateBps int
}

func NewService(deps Dependencies) Service {
	return Service{
		provider:   deps.Provider,
		payments:   deps.Payments,
		businesses: deps.Businesses,
		ids:        deps.IDs,
		otp:        deps.OTP,
		vatRates:   deps.VATRates,
		vatRateBps: deps.VATRateBps,
	}
}

// RequestPayoutOTPCommand asks for a code to be sent to a candidate payout
// number, so the owner can prove it before saving it.
type RequestPayoutOTPCommand struct {
	BusinessID        common.ID
	ActorRole         business.UserRole
	SettlementAccount string
}

// RequestPayoutOTP sends a one-time code to a candidate payout number.
//
// This exists rather than reusing the signup code-send because that route is
// public by necessity (no account exists yet), and pointing an authenticated
// payout flow at it would widen an unauthenticated path that already sends paid
// SMS to any Ghana number. Here the caller must hold a session AND the
// money-management role, which bounds the abuse to authenticated owners.
//
// §2.2: the business must be admin-identity-verified before payout details can
// be set up at all, so the code is not even sent until then.
func (s Service) RequestPayoutOTP(ctx context.Context, cmd RequestPayoutOTPCommand) error {
	if err := authorizeMoneyManagement(common.TenantScope{BusinessID: cmd.BusinessID}, cmd.ActorRole); err != nil {
		return err
	}
	info, err := s.businesses.GetChargeContext(ctx, common.TenantScope{BusinessID: cmd.BusinessID})
	if err != nil {
		return err
	}
	if !info.Verified {
		return ErrIdentityVerificationRequired
	}
	number, err := normalizePayoutMoMoNumber(cmd.SettlementAccount)
	if err != nil {
		return err
	}
	if s.otp == nil {
		return ErrOTPUnavailable
	}
	return s.otp.RequestBusinessPhoneOTP(ctx, number)
}

type VerifyBusinessCommand struct {
	BusinessID        common.ID
	ActorRole         business.UserRole
	SettlementBank    string
	SettlementAccount string
	// SettlementAccountName is the MoMo-REGISTERED wallet name (§2.1): "the
	// exact legal name that pops up when someone tries to send money to this
	// MoMo number." It becomes the Paystack subaccount's business_name, because
	// settlement resolves against the wallet's registered name, not the shop's
	// trading name.
	SettlementAccountName string
	// OTPCode is the one-time code sent to SettlementAccount. It proves the payout
	// number is live and belongs to the owner submitting it — the evidence that
	// settles a later "I never gave you that number" dispute (Testing Report §3.1).
	OTPCode string
}

// VerifyBusiness saves the business's payout details and provisions or repoints
// its payment-provider subaccount. It runs ONLY after an admin has approved the
// business's Ghana Card verification (§2.2) — payout setup neither grants nor
// implies verification. Until both are in place, charging is gated (Technical
// Specification sections 5.2, 10.2).
//
// Resubmitting UNCHANGED details is a no-op. Submitting CHANGED details repoints
// the existing subaccount rather than creating a second one, and requires a fresh
// OTP on the new number: changing where money lands is exactly the action worth
// proving.
//
//nolint:gocyclo // verification deliberately keeps role, identity, OTP, and payout-detail guards together
func (s Service) VerifyBusiness(ctx context.Context, cmd VerifyBusinessCommand) error {
	if err := authorizeMoneyManagement(common.TenantScope{BusinessID: cmd.BusinessID}, cmd.ActorRole); err != nil {
		return err
	}
	// §2.1: the wallet name is collected alongside network + number and is
	// required — the subaccount is built from these fields, so they must be
	// captured and validated correctly before the subaccount is created.
	accountName := strings.TrimSpace(cmd.SettlementAccountName)
	if cmd.SettlementBank == "" || accountName == "" || len(accountName) > maxPayoutAccountNameLength {
		return ErrInvalidCharge
	}
	// §2.1: exactly 10 digits in local form (0XXXXXXXXX). The normalized value is
	// what gets OTP-proved, sent to the provider, and stored.
	account, err := normalizePayoutMoMoNumber(cmd.SettlementAccount)
	if err != nil {
		return err
	}

	scope := common.TenantScope{BusinessID: cmd.BusinessID}
	info, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return err
	}

	// §2.2: Ghana Card verification comes FIRST. Verified is true only when an
	// admin approved the identity submission — nothing on this path sets it.
	if !info.Verified {
		return ErrIdentityVerificationRequired
	}

	// Compare the submitted details against the saved ones, rather than returning
	// early on "verified" alone. A business that is already provisioned may still
	// be CHANGING its payout destination, and that change has to reach both the
	// provider and the businesses row. Note settlement_bank is empty for
	// businesses provisioned before migration 000087 mirrored it locally, and
	// settlement_momo_account_name for those before 000098, so their first
	// resubmit falls through and backfills the missing field.
	if info.SubaccountRef != "" &&
		info.SettlementAccount == account &&
		info.SettlementBank == cmd.SettlementBank &&
		info.MoMoAccountName == accountName {
		return nil
	}

	// Fail closed: without a verifier we cannot prove the number, and saving
	// unproven payout details is the failure this gate exists to prevent.
	if s.otp == nil {
		return ErrOTPUnavailable
	}
	if err := s.otp.VerifyBusinessPhoneOTP(ctx, account, cmd.OTPCode); err != nil {
		return err
	}

	subaccountRef := info.SubaccountRef
	if subaccountRef == "" {
		result, err := s.provider.CreateBusinessSubaccount(ctx, ports.CreateBusinessSubaccountInput{
			BusinessID:        cmd.BusinessID,
			BusinessName:      accountName,
			SettlementBank:    cmd.SettlementBank,
			SettlementAccount: account,
		})
		if err != nil {
			return err
		}
		subaccountRef = result.ProviderReference
	} else if err := s.provider.UpdateBusinessSubaccount(ctx, ports.UpdateBusinessSubaccountInput{
		BusinessID:        cmd.BusinessID,
		SubaccountRef:     subaccountRef,
		BusinessName:      accountName,
		SettlementBank:    cmd.SettlementBank,
		SettlementAccount: account,
	}); err != nil {
		return err
	}

	// Persist only after the provider accepted the details, so a provider failure
	// never leaves the row claiming a payout destination that will not settle.
	return s.businesses.ProvisionSubaccount(ctx, ports.ProvisionSubaccountInput{
		BusinessID:            cmd.BusinessID,
		SubaccountRef:         subaccountRef,
		SettlementAccountName: accountName,
		SettlementBank:        cmd.SettlementBank,
		SettlementAccount:     account,
	})
}

// maxPayoutAccountNameLength bounds the MoMo account-name field; wallet names
// are far shorter, this only stops abuse payloads.
const maxPayoutAccountNameLength = 200

// normalizePayoutMoMoNumber coerces a payout number to canonical LOCAL form and
// enforces §2.1's exactly-10-digits rule (0XXXXXXXXX, e.g. 024XXXXXXX). It
// accepts the local form and the international 233XXXXXXXXX form (rebased to
// local) and rejects everything else — including the bare 9-digit form the
// shared common.NormalizeGhanaPhone tolerates for sign-in, because a payout
// destination must be unambiguous about which wallet it names.
func normalizePayoutMoMoNumber(raw string) (string, error) {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	// Fail closed on the ambiguous bare 9-digit form before the shared
	// normalizer can accept it (§2.1 strictness on top of the shared rules).
	if b.Len() == 9 {
		return "", ErrInvalidPayoutNumber
	}
	canonical, err := common.NormalizeGhanaPhone(raw)
	if err != nil {
		return "", ErrInvalidPayoutNumber
	}
	return "0" + canonical[3:], nil
}

type InitiateChargeCommand struct {
	Scope                      common.TenantScope
	ActorRole                  business.UserRole
	RequireMoneyManagementRole bool
	OrderID                    *common.ID
	BookingID                  *common.ID
	Purpose                    money.PaymentPurpose
	AmountMinor                int64
	CommissionMinorOverride    *int64
	// LineAmountsMinor, when set, charges and caps the platform commission PER
	// DESIGN — each amount gets its own GHS 50 cap and the capped fees are summed
	// — instead of one cap on the whole charge. A bulk cart passes one amount per
	// design, so an N-design cart pays N separately-capped fees rather than a
	// single GHS 50 cap on the total (Pricing Book §3 / P0.6a). Single-design
	// charges leave it empty and are commissioned once on AmountMinor.
	LineAmountsMinor []int64
	Method           money.PaymentMethod
	CustomerEmail    string
	// CallbackURL is where the provider returns the customer after they pay
	// (§5.2: back to the storefront cart so they can settle the next store
	// basket). Empty keeps the provider default — behaviour from before the
	// field existed. Callers validate it before it gets here.
	CallbackURL string
}

type ChargeResult struct {
	Reference        string
	AuthorizationURL string
	CommissionMinor  int64
	// Quote is the full §4.2–§4.6 fee breakdown behind the charge, so the
	// checkout response can render exactly what the customer pays (the combined
	// "Transaction fee" line, the "Tax fee" line, and the grand total).
	Quote money.StoreSaleQuote
}

// InitiateCharge raises a split charge for a verified business: the business
// receives its share to its subaccount, the platform its commission, in one
// provider transaction. The payment is recorded as initiated; it is advanced to
// succeeded only by a confirmed webhook (HandleProviderEvent).
//
//nolint:gocyclo // charge validation and provider initialization form one fail-closed payment boundary
func (s Service) InitiateCharge(ctx context.Context, cmd InitiateChargeCommand) (ChargeResult, error) {
	if cmd.RequireMoneyManagementRole {
		if err := authorizeMoneyManagement(cmd.Scope, cmd.ActorRole); err != nil {
			return ChargeResult{}, err
		}
	}
	if cmd.AmountMinor <= 0 || !cmd.Purpose.Valid() || !cmd.Method.Valid() || cmd.CustomerEmail == "" {
		return ChargeResult{}, ErrInvalidCharge
	}

	info, err := s.businesses.GetChargeContext(ctx, cmd.Scope)
	if err != nil {
		return ChargeResult{}, err
	}
	if !info.Verified || info.SubaccountRef == "" {
		return ChargeResult{}, ErrBusinessNotVerified
	}

	commissionOverride, err := validatedCommissionOverride(cmd)
	if err != nil {
		return ChargeResult{}, err
	}
	// §4.2–§4.6: quote the basket — per-design capped fees, VAT on each fee at
	// the live admin-set rate (§4.1), one Paystack fee on the total (grossed up
	// when passed down), and the store's three pass-down tick boxes deciding
	// what rides the customer's checkout lines. The customer is charged the
	// quote total; Xtiitch's share (fees + taxes) routes to the main account via
	// the split's transaction_charge; bearer stays "subaccount" even when fees
	// are passed down — the checkout lines compensate the store so it nets its
	// full price (§4.8 note). Default (all unticked): the store absorbs every
	// fee and the customer pays only AmountMinor.
	lineAmounts := cmd.LineAmountsMinor
	if len(lineAmounts) == 0 {
		lineAmounts = []int64{cmd.AmountMinor}
	}
	var linesTotal int64
	for _, lineMinor := range lineAmounts {
		linesTotal += lineMinor
	}
	// Any basket amount beyond the per-design lines (e.g. a delivery fee folded
	// into AmountMinor) is charged but never commissioned.
	uncosted := cmd.AmountMinor - linesTotal
	if uncosted < 0 {
		return ChargeResult{}, ErrInvalidCharge
	}
	quote := s.quoteStoreSale(ctx, lineAmounts, uncosted, commissionOverride, info)
	chargeAmount := quote.TotalChargeMinor
	commission := quote.PlatformShareMinor()
	reference := "xt_" + s.ids.NewID().String()

	result, err := s.provider.InitializeTransaction(ctx, ports.InitializeTransactionInput{
		BusinessID:      info.BusinessID,
		SubaccountRef:   info.SubaccountRef,
		CustomerEmail:   cmd.CustomerEmail,
		AmountMinor:     chargeAmount,
		CommissionMinor: commission,
		Currency:        common.CurrencyGHS,
		Reference:       reference,
		CallbackURL:     cmd.CallbackURL,
	})
	if err != nil {
		return ChargeResult{}, err
	}

	providerReference := result.ProviderReference
	if providerReference == "" {
		providerReference = reference
	}

	if err := s.payments.Create(ctx, ports.CreatePaymentInput{
		PaymentID:         s.ids.NewID(),
		BusinessID:        info.BusinessID,
		OrderID:           cmd.OrderID,
		BookingID:         cmd.BookingID,
		Purpose:           string(cmd.Purpose),
		AmountMinor:       chargeAmount,
		Currency:          common.CurrencyGHS,
		Method:            string(cmd.Method),
		ProviderReference: providerReference,
		CommissionMinor:   commission,
		// §3.2: the quote's VAT-on-fee is persisted with the charge so the Money
		// Desk can later split the Xtiitch fee from its tax using stored figures
		// only — never a recomputation.
		XtiitchTaxMinor: quote.TaxMinor,
		// Settle the order by its own amount, never the buyer-borne fees: with
		// pass-down (§4.4), chargeAmount = order + the passed fee/tax lines, but
		// only the order counts toward the balance (the fee lines route to
		// Xtiitch and compensate the Paystack deduction).
		SettleAmountMinor: cmd.AmountMinor,
	}); err != nil {
		return ChargeResult{}, err
	}

	return ChargeResult{
		Reference:        providerReference,
		AuthorizationURL: result.AuthorizationURL,
		CommissionMinor:  commission,
		Quote:            quote,
	}, nil
}

// validatedCommissionOverride checks an explicit commission override (used by
// promotions) against the amount being charged: it may not be negative or
// exceed the charge amount. Nil passes through unchanged.
func validatedCommissionOverride(cmd InitiateChargeCommand) (*int64, error) {
	if cmd.CommissionMinorOverride == nil {
		return nil, nil
	}
	if *cmd.CommissionMinorOverride < 0 || *cmd.CommissionMinorOverride > cmd.AmountMinor {
		return nil, ErrInvalidCharge
	}
	return cmd.CommissionMinorOverride, nil
}

// HandleProviderEvent verifies and applies a provider webhook. The signature is
// checked over the raw body; confirmation is idempotent, so a re-delivered
// event has the same effect as one delivery. charge.* events confirm payments
// (persisting the provider-reported fee, §3.2); transfer.* events are the
// payout signal (§4.10) and trigger a settlement refresh for the store they
// name.
func (s Service) HandleProviderEvent(ctx context.Context, payload []byte, signature string) error {
	if !s.provider.VerifyWebhookSignature(payload, signature) {
		return ErrInvalidSignature
	}

	if strings.HasPrefix(s.provider.PeekEventType(payload), "transfer.") {
		return s.handleTransferEvent(ctx, payload)
	}

	event, err := s.provider.ParseChargeEvent(payload)
	if err != nil {
		return err
	}

	_, err = s.payments.ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature:    event.Signature,
		EventType:         event.EventType,
		ProviderReference: event.ProviderReference,
		Succeeded:         event.Succeeded,
		PaidAmountMinor:   event.AmountMinor,
		ProviderFeeMinor:  event.FeeMinor,
	})
	return err
}

// handleTransferEvent applies a transfer.* webhook: record it idempotently,
// then refresh the named store's mirrored settlements so the payout shows on
// its Money Desk the moment it lands (§3.3/§4.10). The refresh is forced (the
// event IS the signal that something changed) but best-effort — the event is
// already recorded, and the throttled read-path sync self-heals a failed
// refresh within minutes, so a provider hiccup here must not make Paystack
// retry an event we have processed.
func (s Service) handleTransferEvent(ctx context.Context, payload []byte) error {
	event, err := s.provider.ParseTransferEvent(payload)
	if err != nil {
		return err
	}

	isNew, err := s.payments.RecordProviderEvent(ctx, ports.RecordProviderEventInput{
		EventSignature:    event.Signature,
		EventType:         event.EventType,
		ProviderReference: event.ProviderReference,
	})
	if err != nil {
		return err
	}
	if !isNew || event.SubaccountCode == "" {
		return nil
	}

	businessID, found, err := s.payments.FindBusinessBySubaccount(ctx, event.SubaccountCode)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	_, _ = s.SyncSettlements(ctx, SyncSettlementsCommand{BusinessID: businessID, Force: true})
	return nil
}

func (s Service) ListPayments(ctx context.Context, scope common.TenantScope) ([]ports.PaymentRecord, error) {
	return s.payments.ListByBusiness(ctx, scope)
}

func authorizeMoneyManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return ErrInvalidCharge
	}
	if role == business.UserRoleOwner || role == business.UserRoleAdmin {
		return nil
	}
	return authdomain.ErrForbidden
}
