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
)

type Service struct {
	provider   ports.PaymentProvider
	payments   ports.PaymentRepository
	businesses ports.BusinessChargeRepository
	ids        ports.IDGenerator
}

type Dependencies struct {
	Provider   ports.PaymentProvider
	Payments   ports.PaymentRepository
	Businesses ports.BusinessChargeRepository
	IDs        ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{
		provider:   deps.Provider,
		payments:   deps.Payments,
		businesses: deps.Businesses,
		ids:        deps.IDs,
	}
}

type VerifyBusinessCommand struct {
	BusinessID        common.ID
	ActorRole         business.UserRole
	SettlementBank    string
	SettlementAccount string
}

// VerifyBusiness provisions the business's payment-provider subaccount from its
// settlement details and marks it verified. It is idempotent: an
// already-provisioned business is left as-is. Until this runs, charging is
// gated (Technical Specification sections 5.2, 10.2).
func (s Service) VerifyBusiness(ctx context.Context, cmd VerifyBusinessCommand) error {
	if err := authorizeMoneyManagement(common.TenantScope{BusinessID: cmd.BusinessID}, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.SettlementAccount == "" || cmd.SettlementBank == "" {
		return ErrInvalidCharge
	}

	scope := common.TenantScope{BusinessID: cmd.BusinessID}
	info, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return err
	}
	if info.Verified && info.SubaccountRef != "" {
		return nil
	}

	result, err := s.provider.CreateBusinessSubaccount(ctx, ports.CreateBusinessSubaccountInput{
		BusinessID:        cmd.BusinessID,
		BusinessName:      info.Name,
		SettlementBank:    cmd.SettlementBank,
		SettlementAccount: cmd.SettlementAccount,
	})
	if err != nil {
		return err
	}

	return s.businesses.ProvisionSubaccount(ctx, cmd.BusinessID, result.ProviderReference, cmd.SettlementAccount)
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
}

type ChargeResult struct {
	Reference        string
	AuthorizationURL string
	CommissionMinor  int64
}

// InitiateCharge raises a split charge for a verified business: the business
// receives its share to its subaccount, the platform its commission, in one
// provider transaction. The payment is recorded as initiated; it is advanced to
// succeeded only by a confirmed webhook (HandleProviderEvent).
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

	commission, err := resolveCommission(cmd, info.CommissionBps)
	if err != nil {
		return ChargeResult{}, err
	}
	// Pass-to-buyer (Pricing Book §3): when the merchant opts to pass the fee to
	// the buyer, the customer is charged the order total PLUS the commission; the
	// commission still routes to the platform via the split, so the merchant nets
	// the full order total. Default: merchant absorbs (chargeAmount == AmountMinor).
	chargeAmount := cmd.AmountMinor
	if info.FeePassToBuyer {
		chargeAmount += commission
	}
	reference := "xt_" + s.ids.NewID().String()

	result, err := s.provider.InitializeTransaction(ctx, ports.InitializeTransactionInput{
		BusinessID:      info.BusinessID,
		SubaccountRef:   info.SubaccountRef,
		CustomerEmail:   cmd.CustomerEmail,
		AmountMinor:     chargeAmount,
		CommissionMinor: commission,
		Currency:        common.CurrencyGHS,
		Reference:       reference,
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
		// Settle the order by its own amount, never the buyer-borne fee: with
		// pass-to-buyer, chargeAmount = order + commission, but only the order
		// counts toward the balance (the commission routes to the platform).
		SettleAmountMinor: cmd.AmountMinor,
	}); err != nil {
		return ChargeResult{}, err
	}

	return ChargeResult{
		Reference:        providerReference,
		AuthorizationURL: result.AuthorizationURL,
		CommissionMinor:  commission,
	}, nil
}

// MarketplaceStoreCharge is one shop's slice of a combined marketplace charge:
// its net (the flat split share to its subaccount) and the platform's commission
// on it, plus the checkout group the webhook confirms on success.
type MarketplaceStoreCharge struct {
	BusinessID      common.ID
	SubaccountRef   string
	CheckoutGroupID common.ID
	AnchorOrderID   common.ID
	NetMinor        int64
	CommissionMinor int64
}

type InitiateMarketplaceChargeCommand struct {
	CustomerEmail string
	Method        money.PaymentMethod
	Stores        []MarketplaceStoreCharge
}

// InitiateMarketplaceCharge raises ONE Paystack transaction whose split settles
// each shop's net to its own subaccount and the platform's summed commission to
// the main account (§4 "pay once"). It records a marketplace charge + members so
// the webhook can confirm every shop's checkout group on success. It requires at
// least two shops; a single-shop basket uses the existing single-store charge.
func (s Service) InitiateMarketplaceCharge(ctx context.Context, cmd InitiateMarketplaceChargeCommand) (ChargeResult, error) {
	if cmd.CustomerEmail == "" || len(cmd.Stores) < 2 || !cmd.Method.Valid() {
		return ChargeResult{}, ErrInvalidCharge
	}

	var total int64
	splits := make([]ports.SubaccountSplit, 0, len(cmd.Stores))
	members := make([]ports.MarketplaceChargeMember, 0, len(cmd.Stores))
	for _, st := range cmd.Stores {
		if st.SubaccountRef == "" || st.NetMinor < 0 || st.CommissionMinor < 0 {
			return ChargeResult{}, ErrInvalidCharge
		}
		storeTotal := st.NetMinor + st.CommissionMinor
		if storeTotal <= 0 {
			return ChargeResult{}, ErrInvalidCharge
		}
		total += storeTotal
		splits = append(splits, ports.SubaccountSplit{SubaccountRef: st.SubaccountRef, ShareMinor: st.NetMinor})
		members = append(members, ports.MarketplaceChargeMember{
			MemberID:        s.ids.NewID(),
			BusinessID:      st.BusinessID,
			CheckoutGroupID: st.CheckoutGroupID,
			AnchorOrderID:   st.AnchorOrderID,
			NetMinor:        st.NetMinor,
			CommissionMinor: st.CommissionMinor,
		})
	}
	if total <= 0 {
		return ChargeResult{}, ErrInvalidCharge
	}

	reference := "xt_" + s.ids.NewID().String()
	result, err := s.provider.InitializeTransaction(ctx, ports.InitializeTransactionInput{
		CustomerEmail: cmd.CustomerEmail,
		AmountMinor:   total,
		Currency:      common.CurrencyGHS,
		Reference:     reference,
		Splits:        splits,
	})
	if err != nil {
		return ChargeResult{}, err
	}
	providerReference := result.ProviderReference
	if providerReference == "" {
		providerReference = reference
	}

	if err := s.payments.CreateMarketplaceCharge(ctx, ports.MarketplaceChargeInput{
		ChargeID:          s.ids.NewID(),
		ProviderReference: providerReference,
		CustomerEmail:     cmd.CustomerEmail,
		TotalMinor:        total,
		Members:           members,
	}); err != nil {
		return ChargeResult{}, err
	}

	return ChargeResult{Reference: providerReference, AuthorizationURL: result.AuthorizationURL}, nil
}

// resolveCommission determines the platform's commission for a charge. By
// default it is one capped commission on the whole amount. A bulk cart passes
// per-design line amounts, so each design is commissioned and capped separately
// (its own GHS 50 cap) and the capped fees are summed — an N-design cart pays N
// separately-capped fees, not one GHS 50 cap on the total (Pricing Book §3 /
// P0.6a). An explicit override (used by promotions) wins over both and may not
// be negative or exceed the amount being charged.
func resolveCommission(cmd InitiateChargeCommand, basisPoints int) (int64, error) {
	if cmd.CommissionMinorOverride != nil {
		if *cmd.CommissionMinorOverride < 0 || *cmd.CommissionMinorOverride > cmd.AmountMinor {
			return 0, ErrInvalidCharge
		}
		return *cmd.CommissionMinorOverride, nil
	}
	if len(cmd.LineAmountsMinor) > 0 {
		var perDesign int64
		for _, lineMinor := range cmd.LineAmountsMinor {
			perDesign += money.Commission(lineMinor, basisPoints)
		}
		return perDesign, nil
	}
	return money.Commission(cmd.AmountMinor, basisPoints), nil
}

// HandleProviderEvent verifies and applies a provider webhook. The signature is
// checked over the raw body; confirmation is idempotent, so a re-delivered
// event has the same effect as one delivery.
func (s Service) HandleProviderEvent(ctx context.Context, payload []byte, signature string) error {
	if !s.provider.VerifyWebhookSignature(payload, signature) {
		return ErrInvalidSignature
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
	})
	return err
}

func (s Service) ListPayments(ctx context.Context, scope common.TenantScope) ([]ports.PaymentRecord, error) {
	return s.payments.ListByBusiness(ctx, scope)
}

type LogManualTakingCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	OrderID     *common.ID
	AmountMinor int64
	Method      string
	WhatFor     string
}

type LogManualTakingResult struct {
	TakingID         common.ID
	CommissionMinor  int64
	CommissionStatus string
}

// LogManualTaking records an off-platform sale (cash/momo/other) for the money
// tracker. Off-platform money is always fee-free: the platform commission
// applies only to payments processed through Paystack. A manually logged taking
// never flows through the provider, so no commission is deducted or accrued —
// it carries zero commission and a "not_applicable" status.
func (s Service) LogManualTaking(ctx context.Context, cmd LogManualTakingCommand) (LogManualTakingResult, error) {
	if err := authorizeMoneyManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return LogManualTakingResult{}, err
	}
	if cmd.AmountMinor <= 0 {
		return LogManualTakingResult{}, ErrInvalidTaking
	}
	switch cmd.Method {
	case "cash", "momo", "other":
	default:
		return LogManualTakingResult{}, ErrInvalidTaking
	}

	info, err := s.businesses.GetChargeContext(ctx, cmd.Scope)
	if err != nil {
		return LogManualTakingResult{}, err
	}
	businessID := info.BusinessID
	if businessID.IsZero() {
		businessID = cmd.Scope.BusinessID
	}

	id := s.ids.NewID()
	if err := s.payments.RecordManualTaking(ctx, cmd.Scope, ports.ManualTakingInput{
		TakingID:         id,
		BusinessID:       businessID,
		OrderID:          cmd.OrderID,
		AmountMinor:      cmd.AmountMinor,
		Method:           cmd.Method,
		WhatFor:          strings.TrimSpace(cmd.WhatFor),
		CommissionBps:    0,
		CommissionMinor:  0,
		CommissionStatus: "not_applicable",
		CommissionNote:   "",
	}); err != nil {
		return LogManualTakingResult{}, err
	}
	return LogManualTakingResult{
		TakingID:         id,
		CommissionMinor:  0,
		CommissionStatus: "not_applicable",
	}, nil
}

func (s Service) ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ports.ManualTakingRecord, error) {
	return s.payments.ListManualTakings(ctx, scope)
}

func (s Service) MoneySummary(ctx context.Context, scope common.TenantScope) (ports.MoneySummary, error) {
	return s.payments.MoneySummary(ctx, scope)
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
