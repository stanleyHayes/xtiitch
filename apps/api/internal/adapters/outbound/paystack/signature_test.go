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
