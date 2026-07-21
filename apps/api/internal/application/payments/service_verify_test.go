package paymentsapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func verifyTestService(provider *fakeProvider, payments *fakePaymentRepo) Service {
	return NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: &fakeChargeRepo{},
		IDs:        &sequenceIDs{},
	})
}

func initiatedPayment() ports.PaymentRecord {
	return ports.PaymentRecord{
		PaymentID:         "pay-1",
		BusinessID:        "business-1",
		Purpose:           "standard_full",
		AmountMinor:       5283,
		ProviderReference: "xt_ref-1",
		Status:            "initiated",
	}
}

// A payment the webhook already settled answers straight from the ledger — no
// provider call, no second confirmation.
func TestVerifyPaymentAlreadySucceededIsIdempotent(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{}
	payments := &fakePaymentRepo{byReference: map[string]ports.PaymentRecord{
		"xt_ref-1": {ProviderReference: "xt_ref-1", Status: "succeeded"},
	}}
	service := verifyTestService(provider, payments)

	result, err := service.VerifyPayment(context.Background(), VerifyPaymentCommand{
		Scope:             common.TenantScope{BusinessID: "business-1"},
		ProviderReference: "xt_ref-1",
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if result.Status != "succeeded" {
		t.Fatalf("expected succeeded, got %q", result.Status)
	}
	if payments.confirmCalled {
		t.Fatal("an already-succeeded payment must not be re-confirmed")
	}
}

// A reference the store does not own (or that does not exist) is a plain
// not-found — never a peek across tenants.
func TestVerifyPaymentUnknownReferenceIsNotFound(t *testing.T) {
	t.Parallel()

	service := verifyTestService(&fakeProvider{}, &fakePaymentRepo{})

	_, err := service.VerifyPayment(context.Background(), VerifyPaymentCommand{
		Scope:             common.TenantScope{BusinessID: "business-1"},
		ProviderReference: "xt_elsewhere",
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

// Provider says success with the full amount: the payment is confirmed through
// the shared webhook path (exactly-once) and reported succeeded.
func TestVerifyPaymentConfirmsProviderSuccess(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifyResult: ports.VerifyAuthorizationResult{
		Succeeded: true, Status: "success", AmountMinor: 5283, FeeMinor: 103,
	}}
	payments := &fakePaymentRepo{byReference: map[string]ports.PaymentRecord{
		"xt_ref-1": initiatedPayment(),
	}}
	service := verifyTestService(provider, payments)

	result, err := service.VerifyPayment(context.Background(), VerifyPaymentCommand{
		Scope:             common.TenantScope{BusinessID: "business-1"},
		ProviderReference: "xt_ref-1",
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if result.Status != "succeeded" {
		t.Fatalf("expected succeeded, got %q", result.Status)
	}
	input := payments.confirmInput
	if !payments.confirmCalled || !input.Succeeded || input.PaidAmountMinor != 5283 || input.ProviderFeeMinor != 103 {
		t.Fatalf("expected the shared confirmation path with provider figures, got %+v", input)
	}
	if input.EventSignature != "paystack:verify:charge.success:xt_ref-1" {
		t.Fatalf("expected a reference-derived idempotency signature, got %q", input.EventSignature)
	}
}

// A "success" that collected LESS than the expected amount is a failure, never
// a settlement — the same underpayment rule the webhook applies.
func TestVerifyPaymentTreatsUnderpaymentAsFailure(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifyResult: ports.VerifyAuthorizationResult{
		Succeeded: true, Status: "success", AmountMinor: 5000,
	}}
	payments := &fakePaymentRepo{byReference: map[string]ports.PaymentRecord{
		"xt_ref-1": initiatedPayment(),
	}}
	service := verifyTestService(provider, payments)

	result, err := service.VerifyPayment(context.Background(), VerifyPaymentCommand{
		Scope:             common.TenantScope{BusinessID: "business-1"},
		ProviderReference: "xt_ref-1",
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if result.Status != "failed" {
		t.Fatalf("expected failed for an underpayment, got %q", result.Status)
	}
	if payments.confirmInput.Succeeded {
		t.Fatal("an underpayment must go down the failure path")
	}
}

// An abandoned checkout fails the payment through the same path as a
// charge.failed webhook (releasing the order's reservations) and is reported
// failed, so the customer can re-pay the draft.
func TestVerifyPaymentFailsAbandonedTransaction(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifyResult: ports.VerifyAuthorizationResult{
		Succeeded: false, Status: "abandoned",
	}}
	payments := &fakePaymentRepo{byReference: map[string]ports.PaymentRecord{
		"xt_ref-1": initiatedPayment(),
	}}
	service := verifyTestService(provider, payments)

	result, err := service.VerifyPayment(context.Background(), VerifyPaymentCommand{
		Scope:             common.TenantScope{BusinessID: "business-1"},
		ProviderReference: "xt_ref-1",
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if result.Status != "failed" {
		t.Fatalf("expected failed, got %q", result.Status)
	}
	if payments.confirmInput.Succeeded || payments.confirmInput.EventSignature != "paystack:verify:charge.failed:xt_ref-1" {
		t.Fatalf("expected the failure path, got %+v", payments.confirmInput)
	}
}

// A still-open transaction changes nothing: the payment stays initiated for
// the webhook (or a later verify) to settle.
func TestVerifyPaymentLeavesOpenTransactionPending(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifyResult: ports.VerifyAuthorizationResult{
		Succeeded: false, Status: "pending",
	}}
	payments := &fakePaymentRepo{byReference: map[string]ports.PaymentRecord{
		"xt_ref-1": initiatedPayment(),
	}}
	service := verifyTestService(provider, payments)

	result, err := service.VerifyPayment(context.Background(), VerifyPaymentCommand{
		Scope:             common.TenantScope{BusinessID: "business-1"},
		ProviderReference: "xt_ref-1",
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if result.Status != "pending" {
		t.Fatalf("expected pending, got %q", result.Status)
	}
	if payments.confirmCalled {
		t.Fatal("a pending transaction must not mutate the payment")
	}
}
