package paystack

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"testing"
)

func sign(secret string, payload string) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyWebhookSignature(t *testing.T) {
	t.Parallel()

	secret := "whsec_test"
	payload := []byte(`{"event":"charge.success","data":{"reference":"xt_1"}}`)
	valid := sign(secret, string(payload))

	if !verifyWebhookSignature(secret, payload, valid) {
		t.Fatal("expected valid signature to verify")
	}
	if verifyWebhookSignature(secret, payload, "00bad00") {
		t.Fatal("expected wrong signature to be rejected")
	}
	if verifyWebhookSignature(secret, payload, "") {
		t.Fatal("expected empty signature to be rejected")
	}
	if verifyWebhookSignature("", payload, valid) {
		t.Fatal("expected verification to fail without a secret")
	}
	if verifyWebhookSignature(secret, []byte(`{"event":"tampered"}`), valid) {
		t.Fatal("expected tampered payload to be rejected")
	}
}

func TestParseChargeEvent(t *testing.T) {
	t.Parallel()

	success, err := parseChargeEvent([]byte(`{"event":"charge.success","data":{"reference":"xt_1","status":"success","amount":20000}}`))
	if err != nil {
		t.Fatalf("parse success event: %v", err)
	}
	if !success.Succeeded {
		t.Fatal("expected charge.success/success to be succeeded")
	}
	if success.ProviderReference != "xt_1" || success.AmountMinor != 20000 {
		t.Fatalf("unexpected parsed event: %+v", success)
	}
	if success.Signature != "paystack:charge.success:xt_1" {
		t.Fatalf("unexpected dedupe signature: %q", success.Signature)
	}

	failed, err := parseChargeEvent([]byte(`{"event":"charge.success","data":{"reference":"xt_2","status":"failed","amount":20000}}`))
	if err != nil {
		t.Fatalf("parse failed event: %v", err)
	}
	if failed.Succeeded {
		t.Fatal("expected non-success data status to be not succeeded")
	}

	if _, err := parseChargeEvent([]byte(`{"event":"","data":{}}`)); !errors.Is(err, ErrUnparseableEvent) {
		t.Fatalf("expected unparseable event error, got %v", err)
	}
	if _, err := parseChargeEvent([]byte(`{`)); err == nil {
		t.Fatal("expected error for malformed json")
	}
}

// §3.2: the provider-REPORTED fee rides the webhook payload ("fees") so it can
// be persisted verbatim; fees_split.subaccount is the fallback when the
// top-level figure is absent (split transactions).
func TestParseChargeEventCarriesProviderFee(t *testing.T) {
	t.Parallel()

	withFees, err := parseChargeEvent([]byte(
		`{"event":"charge.success","data":{"reference":"xt_f1","status":"success","amount":20000,"fees":390}}`))
	if err != nil {
		t.Fatalf("parse event with fees: %v", err)
	}
	if withFees.FeeMinor != 390 {
		t.Fatalf("expected the reported fee 390, got %d", withFees.FeeMinor)
	}

	withSplit, err := parseChargeEvent([]byte(
		`{"event":"charge.success","data":{"reference":"xt_f2","status":"success","amount":20000,"fees_split":{"integration":50,"subaccount":340}}}`))
	if err != nil {
		t.Fatalf("parse event with fees_split: %v", err)
	}
	if withSplit.FeeMinor != 340 {
		t.Fatalf("expected the subaccount-borne fee 340 from fees_split, got %d", withSplit.FeeMinor)
	}

	without, err := parseChargeEvent([]byte(
		`{"event":"charge.success","data":{"reference":"xt_f3","status":"success","amount":20000}}`))
	if err != nil {
		t.Fatalf("parse event without fees: %v", err)
	}
	if without.FeeMinor != 0 {
		t.Fatalf("expected 0 (not reported) when the payload carries no fee, got %d", without.FeeMinor)
	}
}

// §4.10: transfer.* webhooks parse with the subaccount they name (the store to
// refresh), tolerating both the object and flat code shapes.
func TestParseTransferEvent(t *testing.T) {
	t.Parallel()

	event, err := parseTransferEvent([]byte(
		`{"event":"transfer.success","data":{"reference":"TRF_1","status":"success","amount":97000,"subaccount":{"subaccount_code":"ACCT_1"}}}`))
	if err != nil {
		t.Fatalf("parse transfer event: %v", err)
	}
	if !event.Succeeded || event.SubaccountCode != "ACCT_1" || event.AmountMinor != 97000 {
		t.Fatalf("unexpected transfer event: %+v", event)
	}
	if event.Signature != "paystack:transfer.success:TRF_1" {
		t.Fatalf("unexpected dedupe signature: %q", event.Signature)
	}

	failed, err := parseTransferEvent([]byte(
		`{"event":"transfer.failed","data":{"reference":"TRF_2","status":"failed","amount":1000,"subaccount_code":"ACCT_2"}}`))
	if err != nil {
		t.Fatalf("parse failed transfer: %v", err)
	}
	if failed.Succeeded || failed.SubaccountCode != "ACCT_2" {
		t.Fatalf("unexpected failed transfer event: %+v", failed)
	}

	if _, err := parseTransferEvent([]byte(`{"event":"transfer.success","data":{}}`)); !errors.Is(err, ErrUnparseableEvent) {
		t.Fatalf("expected unparseable event error, got %v", err)
	}
}

func TestPeekEventType(t *testing.T) {
	t.Parallel()

	if got := peekEventType([]byte(`{"event":"transfer.success","data":{}}`)); got != "transfer.success" {
		t.Fatalf("expected the discriminator read, got %q", got)
	}
	if got := peekEventType([]byte(`{`)); got != "" {
		t.Fatalf("expected empty for malformed json, got %q", got)
	}
}
