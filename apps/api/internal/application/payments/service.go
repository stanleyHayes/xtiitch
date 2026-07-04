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
	if cmd.SettlementAccount == "" {
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
	Method                     money.PaymentMethod
	CustomerEmail              string
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

	commission := money.Commission(cmd.AmountMinor, info.CommissionBps)
	if cmd.CommissionMinorOverride != nil {
		if *cmd.CommissionMinorOverride < 0 || *cmd.CommissionMinorOverride > cmd.AmountMinor {
			return ChargeResult{}, ErrInvalidCharge
		}
		commission = *cmd.CommissionMinorOverride
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
	}); err != nil {
		return ChargeResult{}, err
	}

	return ChargeResult{
		Reference:        providerReference,
		AuthorizationURL: result.AuthorizationURL,
		CommissionMinor:  commission,
	}, nil
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
