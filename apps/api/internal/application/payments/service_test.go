package paymentsapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

func TestInitiateChargeComputesSplitAndRecordsPayment(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Name: "Ama", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}
	service := NewService(Dependencies{Provider: provider, Payments: payments, Businesses: businesses, IDs: &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}}})

	result, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeStandardFull,
		AmountMinor:   20000,
		Method:        money.PaymentMethodMomo,
		CustomerEmail: "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if result.CommissionMinor != 600 {
		t.Fatalf("expected 3%% commission of 600, got %d", result.CommissionMinor)
	}
	if result.AuthorizationURL != "https://pay/x" {
		t.Fatalf("expected authorization url passthrough, got %q", result.AuthorizationURL)
	}
	if len(payments.created) != 1 {
		t.Fatalf("expected one payment recorded, got %d", len(payments.created))
	}
	created := payments.created[0]
	if created.CommissionMinor != 600 || created.Purpose != "standard_full" || created.ProviderReference != "xt_ref-1" {
		t.Fatalf("unexpected payment record: %+v", created)
	}
	if provider.initInput.CommissionMinor != 600 || provider.initInput.SubaccountRef != "sub_1" {
		t.Fatalf("expected split passed to provider, got %+v", provider.initInput)
	}
}

func TestInitiateChargeAcceptsCommissionOverride(t *testing.T) {
	t.Parallel()

	override := int64(1500)
	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Name: "Ama", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}
	service := NewService(Dependencies{Provider: provider, Payments: payments, Businesses: businesses, IDs: &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}}})

	result, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:                   common.TenantScope{BusinessID: "business-1"},
		Purpose:                 money.PaymentPurposeStandardFull,
		AmountMinor:             45000,
		CommissionMinorOverride: &override,
		Method:                  money.PaymentMethodMomo,
		CustomerEmail:           "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if result.CommissionMinor != override {
		t.Fatalf("expected override commission %d, got %d", override, result.CommissionMinor)
	}
	if provider.initInput.CommissionMinor != override || payments.created[0].CommissionMinor != override {
		t.Fatalf("expected override to reach provider and payment row, provider=%+v payment=%+v", provider.initInput, payments.created[0])
	}
}

func TestInitiateChargeRejectsInvalidCommissionOverride(t *testing.T) {
	t.Parallel()

	override := int64(6000)
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}
	service := NewService(Dependencies{Provider: &fakeProvider{}, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}}})

	_, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:                   common.TenantScope{BusinessID: "business-1"},
		Purpose:                 money.PaymentPurposeStandardFull,
		AmountMinor:             5000,
		CommissionMinorOverride: &override,
		Method:                  money.PaymentMethodMomo,
		CustomerEmail:           "buyer@example.com",
	})
	if !errors.Is(err, ErrInvalidCharge) {
		t.Fatalf("expected invalid charge for oversized commission override, got %v", err)
	}
}

func TestInitiateChargeRejectsUnverifiedBusiness(t *testing.T) {
	t.Parallel()

	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: false}}
	service := NewService(Dependencies{Provider: &fakeProvider{}, Payments: payments, Businesses: businesses, IDs: &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}}})

	_, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, Purpose: money.PaymentPurposeStandardFull, AmountMinor: 20000,
		Method: money.PaymentMethodMomo, CustomerEmail: "buyer@example.com",
	})
	if !errors.Is(err, ErrBusinessNotVerified) {
		t.Fatalf("expected business-not-verified, got %v", err)
	}
	if len(payments.created) != 0 {
		t.Fatal("expected no payment for unverified business")
	}
}

func TestInitiateChargeRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{Verified: true, SubaccountRef: "sub_1"}}
	service := NewService(Dependencies{Provider: &fakeProvider{}, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{ids: []common.ID{"a", "b"}}})

	_, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, Purpose: money.PaymentPurposeStandardFull, AmountMinor: 0, CustomerEmail: "buyer@example.com",
	})
	if !errors.Is(err, ErrInvalidCharge) {
		t.Fatalf("expected invalid charge for non-positive amount, got %v", err)
	}
}

func TestLogManualTakingRecordsOffPlatformSale(t *testing.T) {
	t.Parallel()

	payments := &fakePaymentRepo{}
	service := NewService(Dependencies{Provider: &fakeProvider{}, Payments: payments, Businesses: &fakeChargeRepo{}, IDs: &sequenceIDs{ids: []common.ID{"taking-1"}}})

	id, err := service.LogManualTaking(context.Background(), LogManualTakingCommand{
		Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleAdmin, AmountMinor: 5000, Method: "cash", WhatFor: "  alteration  ",
	})
	if err != nil {
		t.Fatalf("log manual taking: %v", err)
	}
	if id != "taking-1" || payments.taking.TakingID != "taking-1" || payments.taking.BusinessID != "b1" {
		t.Fatalf("unexpected taking ids: %+v", payments.taking)
	}
	if payments.taking.AmountMinor != 5000 || payments.taking.Method != "cash" || payments.taking.WhatFor != "alteration" {
		t.Fatalf("unexpected taking content: %+v", payments.taking)
	}
}

func TestLogManualTakingRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	cases := []LogManualTakingCommand{
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, AmountMinor: 0, Method: "cash"},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, AmountMinor: -10, Method: "cash"},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, AmountMinor: 5000, Method: "card"},
		{Scope: common.TenantScope{BusinessID: "b1"}, ActorRole: business.UserRoleOwner, AmountMinor: 5000, Method: ""},
	}
	for _, cmd := range cases {
		payments := &fakePaymentRepo{}
		service := NewService(Dependencies{Provider: &fakeProvider{}, Payments: payments, Businesses: &fakeChargeRepo{}, IDs: &sequenceIDs{ids: []common.ID{"taking-1"}}})
		if _, err := service.LogManualTaking(context.Background(), cmd); !errors.Is(err, ErrInvalidTaking) {
			t.Fatalf("expected ErrInvalidTaking for %+v, got %v", cmd, err)
		}
		if payments.taking.TakingID != "" {
			t.Fatalf("an invalid taking must not be recorded: %+v", payments.taking)
		}
	}
}

func TestMoneyManagementRequiresOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_new"}
	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Name: "Ama", Verified: false}}
	service := NewService(Dependencies{Provider: provider, Payments: payments, Businesses: businesses, IDs: &sequenceIDs{ids: []common.ID{"taking-1"}}})

	err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleStaff,
		SettlementAccount: "0240000000",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff verification to be forbidden, got %v", err)
	}
	if provider.subaccountCreated {
		t.Fatal("expected staff verification to stop before provider provisioning")
	}

	_, err = service.LogManualTaking(context.Background(), LogManualTakingCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleStaff,
		AmountMinor: 5000,
		Method:      "cash",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff manual taking to be forbidden, got %v", err)
	}
	if payments.taking.TakingID != "" {
		t.Fatalf("expected staff manual taking to stop before repository write: %+v", payments.taking)
	}

	_, err = service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:                      common.TenantScope{BusinessID: "business-1"},
		ActorRole:                  business.UserRoleStaff,
		RequireMoneyManagementRole: true,
		Purpose:                    money.PaymentPurposeStandardFull,
		AmountMinor:                20000,
		Method:                     money.PaymentMethodMomo,
		CustomerEmail:              "buyer@example.com",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff protected checkout to be forbidden, got %v", err)
	}
	if provider.initCalled || len(payments.created) != 0 {
		t.Fatalf("expected staff protected checkout to stop before provider/repository, provider=%v payments=%d", provider.initCalled, len(payments.created))
	}
}

func TestHandleProviderEventRejectsBadSignature(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: false}
	payments := &fakePaymentRepo{}
	service := NewService(Dependencies{Provider: provider, Payments: payments, Businesses: &fakeChargeRepo{}, IDs: &sequenceIDs{}})

	err := service.HandleProviderEvent(context.Background(), []byte(`{}`), "bad")
	if !errors.Is(err, ErrInvalidSignature) {
		t.Fatalf("expected invalid signature, got %v", err)
	}
	if payments.confirmCalled {
		t.Fatal("expected no confirmation on bad signature")
	}
}

func TestHandleProviderEventConfirmsVerifiedEvent(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, event: ports.ProviderChargeEvent{
		EventType: "charge.success", ProviderReference: "xt_1", Succeeded: true, Signature: "paystack:charge.success:xt_1",
	}}
	payments := &fakePaymentRepo{}
	service := NewService(Dependencies{Provider: provider, Payments: payments, Businesses: &fakeChargeRepo{}, IDs: &sequenceIDs{}})

	if err := service.HandleProviderEvent(context.Background(), []byte(`{}`), "good"); err != nil {
		t.Fatalf("handle event: %v", err)
	}
	if !payments.confirmCalled {
		t.Fatal("expected confirmation to be attempted")
	}
	if payments.confirmInput.EventSignature != "paystack:charge.success:xt_1" || !payments.confirmInput.Succeeded {
		t.Fatalf("unexpected confirm input: %+v", payments.confirmInput)
	}
}

func TestVerifyBusinessProvisionsSubaccount(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_new"}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Name: "Ama", Verified: false}}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementAccount: "0240000000",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if !provider.subaccountCreated {
		t.Fatal("expected provider subaccount creation")
	}
	if businesses.provisionRef != "sub_new" || businesses.provisionAccount != "0240000000" {
		t.Fatalf("unexpected provisioning: ref=%q account=%q", businesses.provisionRef, businesses.provisionAccount)
	}
}

func TestVerifyBusinessIsIdempotentWhenAlreadyVerified(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true, SubaccountRef: "sub_existing"}}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleAdmin,
		SettlementAccount: "0240000000",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if provider.subaccountCreated {
		t.Fatal("expected no new subaccount for already-verified business")
	}
	if businesses.provisioned {
		t.Fatal("expected no re-provisioning for already-verified business")
	}
}

type fakeProvider struct {
	subaccountRef     string
	subaccountCreated bool
	initCalled        bool
	verifySig         bool
	event             ports.ProviderChargeEvent
	initResult        ports.InitializeTransactionResult
	initInput         ports.InitializeTransactionInput
}

func (p *fakeProvider) CreateBusinessSubaccount(_ context.Context, _ ports.CreateBusinessSubaccountInput) (ports.CreateBusinessSubaccountResult, error) {
	p.subaccountCreated = true
	return ports.CreateBusinessSubaccountResult{ProviderReference: p.subaccountRef}, nil
}

func (p *fakeProvider) InitializeTransaction(_ context.Context, input ports.InitializeTransactionInput) (ports.InitializeTransactionResult, error) {
	p.initCalled = true
	p.initInput = input
	return p.initResult, nil
}

func (p *fakeProvider) InitializeAuthorization(context.Context, ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult, error) {
	return ports.InitializeAuthorizationResult{}, nil
}

func (p *fakeProvider) VerifyAuthorization(context.Context, ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error) {
	return ports.VerifyAuthorizationResult{}, nil
}

func (p *fakeProvider) ChargeAuthorization(context.Context, ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error) {
	return ports.ChargeAuthorizationResult{}, nil
}

func (p *fakeProvider) VerifyWebhookSignature(_ []byte, _ string) bool { return p.verifySig }

func (p *fakeProvider) ParseChargeEvent(_ []byte) (ports.ProviderChargeEvent, error) {
	return p.event, nil
}

type fakePaymentRepo struct {
	created       []ports.CreatePaymentInput
	confirmCalled bool
	confirmInput  ports.ConfirmPaymentInput
	confirmResult ports.ConfirmPaymentResult
	list          []ports.PaymentRecord
	taking        ports.ManualTakingInput
}

func (r *fakePaymentRepo) Create(_ context.Context, input ports.CreatePaymentInput) error {
	r.created = append(r.created, input)
	return nil
}

func (r *fakePaymentRepo) ConfirmFromProvider(_ context.Context, input ports.ConfirmPaymentInput) (ports.ConfirmPaymentResult, error) {
	r.confirmCalled = true
	r.confirmInput = input
	return r.confirmResult, nil
}

func (r *fakePaymentRepo) ListByBusiness(_ context.Context, _ common.TenantScope) ([]ports.PaymentRecord, error) {
	return r.list, nil
}

func (r *fakePaymentRepo) RecordManualTaking(_ context.Context, _ common.TenantScope, input ports.ManualTakingInput) error {
	r.taking = input
	return nil
}

func (r *fakePaymentRepo) ListManualTakings(_ context.Context, _ common.TenantScope) ([]ports.ManualTakingRecord, error) {
	return nil, nil
}

func (r *fakePaymentRepo) MoneySummary(_ context.Context, _ common.TenantScope) (ports.MoneySummary, error) {
	return ports.MoneySummary{}, nil
}

type fakeChargeRepo struct {
	context          ports.BusinessChargeContext
	provisioned      bool
	provisionRef     string
	provisionAccount string
}

func (r *fakeChargeRepo) GetChargeContext(_ context.Context, _ common.TenantScope) (ports.BusinessChargeContext, error) {
	return r.context, nil
}

func (r *fakeChargeRepo) ProvisionSubaccount(_ context.Context, _ common.ID, subaccountRef string, settlementAccount string) error {
	r.provisioned = true
	r.provisionRef = subaccountRef
	r.provisionAccount = settlementAccount
	return nil
}

type sequenceIDs struct {
	ids []common.ID
}

func (s *sequenceIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
