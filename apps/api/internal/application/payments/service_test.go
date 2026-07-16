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
	service := NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestInitiateMarketplaceChargeBuildsSplitAcrossShops(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/mp"}}
	payments := &fakePaymentRepo{}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments, Businesses: &fakeChargeRepo{},
		IDs: &sequenceIDs{ids: []common.ID{"m1", "m2", "ref", "charge"}},
	})

	result, err := service.InitiateMarketplaceCharge(context.Background(), InitiateMarketplaceChargeCommand{
		CustomerEmail: "buyer@example.com",
		Method:        money.PaymentMethodMomo,
		Stores: []MarketplaceStoreCharge{
			{BusinessID: "b1", SubaccountRef: "sub_1", CheckoutGroupID: "g1", AnchorOrderID: "o1", NetMinor: 9700, CommissionMinor: 300},
			{BusinessID: "b2", SubaccountRef: "sub_2", CheckoutGroupID: "g2", AnchorOrderID: "o2", NetMinor: 4850, CommissionMinor: 150},
		},
	})
	if err != nil {
		t.Fatalf("initiate marketplace charge: %v", err)
	}
	if result.AuthorizationURL != "https://pay/mp" {
		t.Fatalf("expected auth url passthrough, got %q", result.AuthorizationURL)
	}
	// Total = each shop's (net + commission), summed: 10000 + 5000.
	if provider.initInput.AmountMinor != 15000 {
		t.Fatalf("expected charge total 15000, got %d", provider.initInput.AmountMinor)
	}
	// The single-subaccount fields must be unused; the split carries each shop's net.
	if provider.initInput.SubaccountRef != "" {
		t.Fatalf("marketplace split must not set a single subaccount, got %q", provider.initInput.SubaccountRef)
	}
	if len(provider.initInput.Splits) != 2 ||
		provider.initInput.Splits[0].SubaccountRef != "sub_1" || provider.initInput.Splits[0].ShareMinor != 9700 ||
		provider.initInput.Splits[1].SubaccountRef != "sub_2" || provider.initInput.Splits[1].ShareMinor != 4850 {
		t.Fatalf("unexpected splits: %+v", provider.initInput.Splits)
	}
	if len(payments.marketplace) != 1 {
		t.Fatalf("expected one marketplace charge recorded, got %d", len(payments.marketplace))
	}
	charge := payments.marketplace[0]
	if charge.TotalMinor != 15000 || charge.ProviderReference != "xt_ref" || len(charge.Members) != 2 {
		t.Fatalf("unexpected marketplace charge: %+v", charge)
	}
	if charge.Members[0].BusinessID != "b1" || charge.Members[0].NetMinor != 9700 || charge.Members[0].CommissionMinor != 300 {
		t.Fatalf("unexpected member 0: %+v", charge.Members[0])
	}
}

func TestInitiateMarketplaceChargeRejectsSingleShop(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Provider: &fakeProvider{verifySig: true}, Payments: &fakePaymentRepo{}, Businesses: &fakeChargeRepo{},
		IDs: &sequenceIDs{ids: []common.ID{"a", "b", "c", "d"}},
	})
	_, err := service.InitiateMarketplaceCharge(context.Background(), InitiateMarketplaceChargeCommand{
		CustomerEmail: "buyer@example.com",
		Method:        money.PaymentMethodMomo,
		Stores: []MarketplaceStoreCharge{
			{BusinessID: "b1", SubaccountRef: "sub_1", NetMinor: 1000, CommissionMinor: 0},
		},
	})
	if !errors.Is(err, ErrInvalidCharge) {
		t.Fatalf("expected a single-shop marketplace charge to be rejected, got %v", err)
	}
}

func TestInitiateChargeCapsCommissionPerDesignLine(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Name: "Ama", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}
	service := NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

	// Three GHS 2,000 designs on the Free plan (3%). Each design's raw fee is 6000,
	// over the GHS 50 (5000) cap, so the cart pays 3 × 5000 = 15000 — one cap per
	// design, summed — NOT a single 5000 cap on the 600000 total.
	result, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:            common.TenantScope{BusinessID: "business-1"},
		Purpose:          money.PaymentPurposeCartFull,
		AmountMinor:      600000,
		LineAmountsMinor: []int64{200000, 200000, 200000},
		Method:           money.PaymentMethodMomo,
		CustomerEmail:    "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if result.CommissionMinor != 15000 {
		t.Fatalf("expected 3 per-design GHS 50 caps summed (15000), got %d", result.CommissionMinor)
	}
	// The split's transaction_charge must equal the summed per-design commission.
	if provider.initInput.CommissionMinor != 15000 {
		t.Fatalf("expected the split transaction_charge to equal the summed per-design commission, got %d", provider.initInput.CommissionMinor)
	}
	if len(payments.created) != 1 || payments.created[0].CommissionMinor != 15000 {
		t.Fatalf("expected the recorded payment to carry the summed per-design commission, got %+v", payments.created)
	}
	// Contrast with the pre-fix bug: one commission on the whole 600000 total would
	// hit the single GHS 50 cap at 5000, a third of the correct per-design fee.
	if money.Commission(600000, 300) != 5000 {
		t.Fatalf("sanity: the whole-total commission should have hit the single GHS 50 cap at 5000")
	}
}

// A bespoke balance is its own Paystack transaction and is fee'd like the deposit
// (P0.6b): InitiateCharge levies the store's per-design commission at its plan
// rate, capped at GHS 50, and settles it to Xtiitch in the split.
func TestInitiateChargeAppliesCappedCommissionToBespokeBalance(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Name: "Ama", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}
	service := NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

	// A GHS 2,000 balance at 3% raw-fees 6000, capped to the GHS 50 (5000) cap.
	result, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeBalance,
		AmountMinor:   200000,
		Method:        money.PaymentMethodMomo,
		CustomerEmail: "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if result.CommissionMinor != 5000 {
		t.Fatalf("expected the balance commission capped at GHS 50 (5000), got %d", result.CommissionMinor)
	}
	if provider.initInput.CommissionMinor != 5000 || payments.created[0].CommissionMinor != 5000 {
		t.Fatalf("expected the balance fee settled to Xtiitch in the split, provider=%+v payment=%+v", provider.initInput, payments.created[0])
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
	service := NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

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
	service := NewService(Dependencies{
		Provider:   &fakeProvider{},
		Payments:   &fakePaymentRepo{},
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

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
	service := NewService(Dependencies{
		Provider:   &fakeProvider{},
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
	})

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
	service := NewService(Dependencies{
		Provider:   &fakeProvider{},
		Payments:   &fakePaymentRepo{},
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"a", "b"}},
	})

	_, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeStandardFull,
		AmountMinor:   0,
		CustomerEmail: "buyer@example.com",
	})
	if !errors.Is(err, ErrInvalidCharge) {
		t.Fatalf("expected invalid charge for non-positive amount, got %v", err)
	}
}

func TestLogManualTakingRecordsOffPlatformSale(t *testing.T) {
	t.Parallel()

	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "b1", CommissionBps: 300}}
	service := NewService(Dependencies{
		Provider:   &fakeProvider{},
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"taking-1"}},
	})

	result, err := service.LogManualTaking(context.Background(), LogManualTakingCommand{
		Scope:       common.TenantScope{BusinessID: "b1"},
		ActorRole:   business.UserRoleAdmin,
		AmountMinor: 5000,
		Method:      "cash",
		WhatFor:     "  alteration  ",
	})
	if err != nil {
		t.Fatalf("log manual taking: %v", err)
	}
	if result.TakingID != "taking-1" || payments.taking.TakingID != "taking-1" || payments.taking.BusinessID != "b1" {
		t.Fatalf("unexpected taking ids: %+v", payments.taking)
	}
	if payments.taking.AmountMinor != 5000 || payments.taking.Method != "cash" || payments.taking.WhatFor != "alteration" {
		t.Fatalf("unexpected taking content: %+v", payments.taking)
	}
	// Off-platform takings are fee-free: no commission is deducted or accrued,
	// regardless of the plan's through-platform commission rate.
	if payments.taking.CommissionBps != 0 || payments.taking.CommissionMinor != 0 || payments.taking.CommissionStatus != "not_applicable" {
		t.Fatalf("expected fee-free offline taking, got %+v", payments.taking)
	}
	if result.CommissionMinor != 0 || result.CommissionStatus != "not_applicable" {
		t.Fatalf("expected fee-free commission result, got %+v", result)
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
		service := NewService(Dependencies{
			Provider:   &fakeProvider{},
			Payments:   payments,
			Businesses: &fakeChargeRepo{},
			IDs:        &sequenceIDs{ids: []common.ID{"taking-1"}},
		})
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
	service := NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"taking-1"}},
	})

	err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleStaff,
		SettlementBank:    "MTN",
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
		t.Fatalf(
			"expected staff protected checkout to stop before provider/repository, provider=%v payments=%d",
			provider.initCalled, len(payments.created),
		)
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
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}, OTP: otp})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
		OTPCode:           "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if !provider.subaccountCreated {
		t.Fatal("expected provider subaccount creation")
	}
	if otp.verifiedNumber != "0240000000" || otp.verifiedCode != "123456" {
		t.Fatalf("expected the payout number to be proved, got number=%q code=%q", otp.verifiedNumber, otp.verifiedCode)
	}
	// Assert each field individually: bank and account are both strings, so a
	// transposition would still "provision" and only show up as a swapped pair.
	if businesses.provisionedAs.SubaccountRef != "sub_new" {
		t.Fatalf("unexpected subaccount ref: %q", businesses.provisionedAs.SubaccountRef)
	}
	if businesses.provisionedAs.SettlementAccount != "0240000000" {
		t.Fatalf("unexpected settlement account: %q", businesses.provisionedAs.SettlementAccount)
	}
	if businesses.provisionedAs.SettlementBank != "MTN" {
		t.Fatalf("unexpected settlement bank: %q", businesses.provisionedAs.SettlementBank)
	}
}

func TestVerifyBusinessRequiresOTPBeforeSavingPayoutDetails(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_new"}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: false}}
	otp := &fakeMoMoOTP{verifyErr: errors.New("bad code")}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}, OTP: otp})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
		OTPCode:           "wrong",
	}); err == nil {
		t.Fatal("expected a failed OTP to reject the payout details")
	}
	if provider.subaccountCreated {
		t.Fatal("expected no subaccount for an unproved number")
	}
	if businesses.provisioned {
		t.Fatal("expected unproved payout details NOT to be saved")
	}
}

// A nil OTP dependency must reject rather than skip the gate: silently saving
// unproven payout details is the exact failure the gate exists to prevent.
func TestVerifyBusinessFailsClosedWithoutOTPVerifier(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_new"}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: false}}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}})

	err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
		OTPCode:           "123456",
	})
	if !errors.Is(err, ErrOTPUnavailable) {
		t.Fatalf("expected ErrOTPUnavailable, got %v", err)
	}
	if businesses.provisioned {
		t.Fatal("expected no payout details saved without a verifier")
	}
}

func TestVerifyBusinessIsIdempotentWhenDetailsAreUnchanged(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID:        "business-1",
		Verified:          true,
		SubaccountRef:     "sub_existing",
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}, OTP: otp})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleAdmin,
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if provider.subaccountCreated || provider.subaccountUpdated {
		t.Fatal("expected no provider call for unchanged details")
	}
	if businesses.provisioned {
		t.Fatal("expected no re-provisioning for unchanged details")
	}
	if otp.verifiedNumber != "" {
		t.Fatal("expected no OTP demanded for a repeat submit that changes nothing")
	}
}

// Changing the payout destination must REPOINT the existing subaccount. Creating
// a second one would leave Paystack settling to the old number while the UI
// showed the new one.
func TestVerifyBusinessRepointsExistingSubaccountOnChange(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_should_not_be_used"}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID:        "business-1",
		Verified:          true,
		SubaccountRef:     "sub_existing",
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}, OTP: otp})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementBank:    "VOD",
		SettlementAccount: "0500000000",
		OTPCode:           "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if provider.subaccountCreated {
		t.Fatal("expected the existing subaccount to be repointed, not a second one created")
	}
	if !provider.subaccountUpdated {
		t.Fatal("expected the existing subaccount to be repointed")
	}
	if provider.updateInput.SubaccountRef != "sub_existing" {
		t.Fatalf("expected the existing ref to be repointed, got %q", provider.updateInput.SubaccountRef)
	}
	if otp.verifiedNumber != "0500000000" {
		t.Fatalf("expected the NEW number to be proved, got %q", otp.verifiedNumber)
	}
	if businesses.provisionedAs.SettlementBank != "VOD" || businesses.provisionedAs.SettlementAccount != "0500000000" {
		t.Fatalf("unexpected saved details: %+v", businesses.provisionedAs)
	}
	if businesses.provisionedAs.SubaccountRef != "sub_existing" {
		t.Fatalf("expected the subaccount ref to be preserved, got %q", businesses.provisionedAs.SubaccountRef)
	}
}

// Changing ONLY the network is a change of payout destination like any other:
// it must reach the provider and demand a fresh code. The client's "does this
// need a code" check has to agree with this condition or the form and the server
// disagree about what is being asked for.
func TestVerifyBusinessTreatsNetworkOnlyChangeAsAChange(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID:        "business-1",
		Verified:          true,
		SubaccountRef:     "sub_existing",
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}, OTP: otp})

	// Same number, different network.
	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementBank:    "VOD",
		SettlementAccount: "0240000000",
		OTPCode:           "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if !provider.subaccountUpdated {
		t.Fatal("expected a network-only change to reach the provider, not be swallowed")
	}
	if businesses.provisionedAs.SettlementBank != "VOD" {
		t.Fatalf("expected the new network to be saved, got %q", businesses.provisionedAs.SettlementBank)
	}
	if otp.verifiedCode != "123456" {
		t.Fatal("expected a network-only change to still demand a code")
	}
}

// A business provisioned before migration 000087 has no saved network, so its
// first resubmit must fall through and backfill it rather than no-op.
func TestVerifyBusinessBackfillsMissingNetworkForLegacyBusiness(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID:        "business-1",
		Verified:          true,
		SubaccountRef:     "sub_existing",
		SettlementBank:    "",
		SettlementAccount: "0240000000",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}, OTP: otp})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
		OTPCode:           "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if !businesses.provisioned || businesses.provisionedAs.SettlementBank != "MTN" {
		t.Fatalf("expected the network to be backfilled, got %+v", businesses.provisionedAs)
	}
}

type fakeProvider struct {
	subaccountRef     string
	subaccountCreated bool
	subaccountUpdated bool
	updateInput       ports.UpdateBusinessSubaccountInput
	initCalled        bool
	verifySig         bool
	event             ports.ProviderChargeEvent
	initResult        ports.InitializeTransactionResult
	initInput         ports.InitializeTransactionInput
}

func (p *fakeProvider) CreateBusinessSubaccount(
	_ context.Context,
	_ ports.CreateBusinessSubaccountInput,
) (ports.CreateBusinessSubaccountResult, error) {
	p.subaccountCreated = true
	return ports.CreateBusinessSubaccountResult{ProviderReference: p.subaccountRef}, nil
}

func (p *fakeProvider) UpdateBusinessSubaccount(_ context.Context, input ports.UpdateBusinessSubaccountInput) error {
	p.subaccountUpdated = true
	p.updateInput = input
	return nil
}

type fakeMoMoOTP struct {
	requestedNumber string
	verifiedNumber  string
	verifiedCode    string
	requestErr      error
	verifyErr       error
}

func (f *fakeMoMoOTP) RequestBusinessPhoneOTP(_ context.Context, number string) error {
	f.requestedNumber = number
	return f.requestErr
}

func (f *fakeMoMoOTP) VerifyBusinessPhoneOTP(_ context.Context, number string, code string) error {
	if f.verifyErr != nil {
		return f.verifyErr
	}
	f.verifiedNumber = number
	f.verifiedCode = code
	return nil
}

func (p *fakeProvider) InitializeTransaction(
	_ context.Context,
	input ports.InitializeTransactionInput,
) (ports.InitializeTransactionResult, error) {
	p.initCalled = true
	p.initInput = input
	return p.initResult, nil
}

func (p *fakeProvider) InitializeAuthorization(
	context.Context,
	ports.InitializeAuthorizationInput,
) (ports.InitializeAuthorizationResult, error) {
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
	marketplace   []ports.MarketplaceChargeInput
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

func (r *fakePaymentRepo) CreateMarketplaceCharge(_ context.Context, input ports.MarketplaceChargeInput) error {
	r.marketplace = append(r.marketplace, input)
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
	context       ports.BusinessChargeContext
	provisioned   bool
	provisionedAs ports.ProvisionSubaccountInput
}

func (r *fakeChargeRepo) GetChargeContext(_ context.Context, _ common.TenantScope) (ports.BusinessChargeContext, error) {
	return r.context, nil
}

func (r *fakeChargeRepo) ProvisionSubaccount(_ context.Context, input ports.ProvisionSubaccountInput) error {
	r.provisioned = true
	r.provisionedAs = input
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
