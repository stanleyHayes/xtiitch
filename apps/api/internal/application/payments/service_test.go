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
	// Verified here means ADMIN-APPROVED identity verification (§2.2) — the only
	// state in which payout setup may run at all.
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Name: "Ama", Verified: true}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "MTN",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if !provider.subaccountCreated {
		t.Fatal("expected provider subaccount creation")
	}
	if otp.verifiedNumber != "0240000000" || otp.verifiedCode != "123456" {
		t.Fatalf("expected the payout number to be proved, got number=%q code=%q", otp.verifiedNumber, otp.verifiedCode)
	}
	// §2.1: the subaccount is named after the MoMo-REGISTERED wallet name, not
	// the shop's trading name — settlement resolves against the wallet's name.
	if provider.createInput.BusinessName != "Ama Serwaa Mensah" {
		t.Fatalf("expected the wallet name as the subaccount name, got %q", provider.createInput.BusinessName)
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
	if businesses.provisionedAs.SettlementAccountName != "Ama Serwaa Mensah" {
		t.Fatalf("unexpected settlement account name: %q", businesses.provisionedAs.SettlementAccountName)
	}
}

// §2.2: payout setup must REJECT a business with no admin-approved Ghana Card
// verification — before any OTP is checked, any provider is called, or anything
// is saved. Verification comes only from the approved Ghana Card check.
func TestVerifyBusinessRejectsWithoutIdentityVerification(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_new"}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: false}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "MTN",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "123456",
	})
	if !errors.Is(err, ErrIdentityVerificationRequired) {
		t.Fatalf("expected ErrIdentityVerificationRequired, got %v", err)
	}
	if otp.verifiedNumber != "" || provider.subaccountCreated || provider.subaccountUpdated || businesses.provisioned {
		t.Fatalf("expected payout setup to stop at the identity gate, otp=%q created=%v updated=%v provisioned=%v",
			otp.verifiedNumber, provider.subaccountCreated, provider.subaccountUpdated, businesses.provisioned)
	}
}

// §2.2: the OTP request rejects the same way, so the UI cannot even send a code
// to an unverified business.
func TestRequestPayoutOTPRejectsWithoutIdentityVerification(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: false}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: &fakeProvider{}, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	err := service.RequestPayoutOTP(context.Background(), RequestPayoutOTPCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementAccount: "0240000000",
	})
	if !errors.Is(err, ErrIdentityVerificationRequired) {
		t.Fatalf("expected ErrIdentityVerificationRequired, got %v", err)
	}
	if otp.requestedNumber != "" {
		t.Fatalf("expected no code sent to an unverified business, got %q", otp.requestedNumber)
	}
}

// §2.1: the payout number must normalize to EXACTLY 10 local digits
// (0XXXXXXXXX). The bare 9-digit form sign-in tolerates is not good enough for
// a payout destination.
func TestVerifyBusinessRejectsNonTenDigitPayoutNumber(t *testing.T) {
	t.Parallel()

	for _, number := range []string{"", "024000000", "02400000001", "1234567890", "23324000", "abc"} {
		businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true}}
		otp := &fakeMoMoOTP{}
		service := NewService(Dependencies{
			Provider: &fakeProvider{}, Payments: &fakePaymentRepo{}, Businesses: businesses,
			IDs: &sequenceIDs{}, OTP: otp,
		})
		err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
			BusinessID:            "business-1",
			ActorRole:             business.UserRoleOwner,
			SettlementBank:        "MTN",
			SettlementAccount:     number,
			SettlementAccountName: "Ama Serwaa Mensah",
			OTPCode:               "123456",
		})
		if !errors.Is(err, ErrInvalidPayoutNumber) {
			t.Fatalf("expected ErrInvalidPayoutNumber for %q, got %v", number, err)
		}
		if otp.verifiedNumber != "" || businesses.provisioned {
			t.Fatalf("expected an invalid number to stop before OTP/save: otp=%q provisioned=%v", otp.verifiedNumber, businesses.provisioned)
		}
	}
}

func TestRequestPayoutOTPRejectsNonTenDigitPayoutNumber(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: &fakeProvider{}, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	err := service.RequestPayoutOTP(context.Background(), RequestPayoutOTPCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementAccount: "024000000",
	})
	if !errors.Is(err, ErrInvalidPayoutNumber) {
		t.Fatalf("expected ErrInvalidPayoutNumber, got %v", err)
	}
	if otp.requestedNumber != "" {
		t.Fatalf("expected no code sent for an invalid number, got %q", otp.requestedNumber)
	}
}

// The international form (233XXXXXXXXX) normalizes to the 10-digit local form
// and is accepted; the normalized local number is what gets proved and stored.
func TestVerifyBusinessNormalizesInternationalPayoutNumber(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_new"}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "MTN",
		SettlementAccount:     "+233 24 000 0000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if otp.verifiedNumber != "0240000000" {
		t.Fatalf("expected the normalized local number to be proved, got %q", otp.verifiedNumber)
	}
	if businesses.provisionedAs.SettlementAccount != "0240000000" {
		t.Fatalf("expected the normalized local number to be stored, got %q", businesses.provisionedAs.SettlementAccount)
	}
}

// §2.1: the MoMo account name is collected alongside network + number and is
// required — the subaccount is built from these fields.
func TestVerifyBusinessRequiresSettlementAccountName(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: &fakeProvider{}, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
		OTPCode:           "123456",
	})
	if !errors.Is(err, ErrInvalidCharge) {
		t.Fatalf("expected ErrInvalidCharge for a missing account name, got %v", err)
	}
	if otp.verifiedNumber != "" || businesses.provisioned {
		t.Fatal("expected a missing account name to stop before OTP/save")
	}
}

func TestVerifyBusinessRequiresOTPBeforeSavingPayoutDetails(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{subaccountRef: "sub_new"}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true}}
	otp := &fakeMoMoOTP{verifyErr: errors.New("bad code")}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "MTN",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "wrong",
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
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true}}
	service := NewService(Dependencies{Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses, IDs: &sequenceIDs{}})

	err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "MTN",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "123456",
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
		MoMoAccountName:   "Ama Serwaa Mensah",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleAdmin,
		SettlementBank:        "MTN",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
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
		MoMoAccountName:   "Ama Serwaa Mensah",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "VOD",
		SettlementAccount:     "0500000000",
		SettlementAccountName: "Ama S Mensah",
		OTPCode:               "123456",
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
	// §2.1: a repoint also re-names the subaccount after the NEW wallet name.
	if provider.updateInput.BusinessName != "Ama S Mensah" {
		t.Fatalf("expected the repoint to carry the new wallet name, got %q", provider.updateInput.BusinessName)
	}
	if otp.verifiedNumber != "0500000000" {
		t.Fatalf("expected the NEW number to be proved, got %q", otp.verifiedNumber)
	}
	if businesses.provisionedAs.SettlementBank != "VOD" || businesses.provisionedAs.SettlementAccount != "0500000000" {
		t.Fatalf("unexpected saved details: %+v", businesses.provisionedAs)
	}
	if businesses.provisionedAs.SettlementAccountName != "Ama S Mensah" {
		t.Fatalf("expected the new wallet name to be saved, got %q", businesses.provisionedAs.SettlementAccountName)
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
		MoMoAccountName:   "Ama Serwaa Mensah",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	// Same number, different network.
	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "VOD",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "123456",
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
		MoMoAccountName:   "Ama Serwaa Mensah",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "MTN",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if !businesses.provisioned || businesses.provisionedAs.SettlementBank != "MTN" {
		t.Fatalf("expected the network to be backfilled, got %+v", businesses.provisionedAs)
	}
}

// Same backfill pattern for the §2.1 wallet name: a business provisioned before
// migration 000098 has no saved MoMo account name, so an otherwise-unchanged
// resubmit must still repoint (re-naming the subaccount after the wallet) and
// store the name rather than no-op.
func TestVerifyBusinessBackfillsMissingAccountNameForLegacyBusiness(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID:        "business-1",
		Verified:          true,
		SubaccountRef:     "sub_existing",
		SettlementBank:    "MTN",
		SettlementAccount: "0240000000",
		MoMoAccountName:   "",
	}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.VerifyBusiness(context.Background(), VerifyBusinessCommand{
		BusinessID:            "business-1",
		ActorRole:             business.UserRoleOwner,
		SettlementBank:        "MTN",
		SettlementAccount:     "0240000000",
		SettlementAccountName: "Ama Serwaa Mensah",
		OTPCode:               "123456",
	}); err != nil {
		t.Fatalf("verify business: %v", err)
	}
	if !provider.subaccountUpdated || provider.updateInput.BusinessName != "Ama Serwaa Mensah" {
		t.Fatalf("expected the subaccount to be re-named after the wallet, got %+v", provider.updateInput)
	}
	if !businesses.provisioned || businesses.provisionedAs.SettlementAccountName != "Ama Serwaa Mensah" {
		t.Fatalf("expected the wallet name to be backfilled, got %+v", businesses.provisionedAs)
	}
}

// §2.1, happy path: an admin-verified business gets its code sent to the
// normalized 10-digit local number.
func TestRequestPayoutOTPSendsCodeToNormalizedNumber(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{BusinessID: "business-1", Verified: true}}
	otp := &fakeMoMoOTP{}
	service := NewService(Dependencies{
		Provider: &fakeProvider{}, Payments: &fakePaymentRepo{}, Businesses: businesses,
		IDs: &sequenceIDs{}, OTP: otp,
	})

	if err := service.RequestPayoutOTP(context.Background(), RequestPayoutOTPCommand{
		BusinessID:        "business-1",
		ActorRole:         business.UserRoleOwner,
		SettlementAccount: "+233 24 000 0000",
	}); err != nil {
		t.Fatalf("request payout otp: %v", err)
	}
	if otp.requestedNumber != "0240000000" {
		t.Fatalf("expected the normalized local number to receive the code, got %q", otp.requestedNumber)
	}
}
