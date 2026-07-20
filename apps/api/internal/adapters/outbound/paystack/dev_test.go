package paystack

import (
	"context"
	"strconv"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// The dev provider's fee is DETERMINISTIC: the modeled 1.95% Paystack rate,
// half-up — mirroring money.Percentage(amount, 195) — so local/test confirms
// persist a provider fee exactly like live ones (§3.2).
func TestDevProviderFeeIsDeterministic(t *testing.T) {
	t.Parallel()

	provider := NewDevProvider("whsec")

	cases := []struct {
		amountMinor int64
		wantFee     int64
	}{
		{20000, 390}, // 1.95% of GHS 200.00 = GHS 3.90
		{10000, 195}, // the VerifyAuthorization placeholder amount
		{250, 5},     // 4.875 pesewas rounds half-up to 5
		{10001, 195}, // 195.0195 rounds down to 195
	}
	for _, testCase := range cases {
		payload := []byte(`{"event":"charge.success","data":{"reference":"xt_d","status":"success","amount":` +
			strconv.FormatInt(testCase.amountMinor, 10) + `}}`)
		event, err := provider.ParseChargeEvent(payload)
		if err != nil {
			t.Fatalf("parse dev event: %v", err)
		}
		if event.FeeMinor != testCase.wantFee {
			t.Fatalf("amount %d: expected fee %d, got %d", testCase.amountMinor, testCase.wantFee, event.FeeMinor)
		}
		if event.FeeMinor != money.Percentage(testCase.amountMinor, money.PaystackFeeRateBps) {
			t.Fatalf("amount %d: dev fee must mirror money.Percentage, got %d", testCase.amountMinor, event.FeeMinor)
		}
	}
}

// A payload that carries the fee explicitly wins over the computed stand-in —
// the dev provider never overwrites a reported figure.
func TestDevProviderKeepsPayloadFee(t *testing.T) {
	t.Parallel()

	provider := NewDevProvider("whsec")
	event, err := provider.ParseChargeEvent([]byte(
		`{"event":"charge.success","data":{"reference":"xt_d","status":"success","amount":20000,"fees":123}}`))
	if err != nil {
		t.Fatalf("parse dev event: %v", err)
	}
	if event.FeeMinor != 123 {
		t.Fatalf("expected the payload fee 123 to win, got %d", event.FeeMinor)
	}
}

func TestDevProviderVerifyAuthorizationReportsDeterministicFee(t *testing.T) {
	t.Parallel()

	provider := NewDevProvider("whsec")
	result, err := provider.VerifyAuthorization(context.Background(), ports.VerifyAuthorizationInput{Reference: "ref-1"})
	if err != nil {
		t.Fatalf("verify authorization: %v", err)
	}
	if result.FeeMinor != money.Percentage(result.AmountMinor, money.PaystackFeeRateBps) {
		t.Fatalf("expected the deterministic fee on the placeholder amount, got %+v", result)
	}
}

// The dev provider holds no settlement state: a dev sync mirrors nothing.
func TestDevProviderListSettlementsIsEmpty(t *testing.T) {
	t.Parallel()

	provider := NewDevProvider("whsec")
	settlements, err := provider.ListSettlements(context.Background(), ports.ListSettlementsInput{SubaccountRef: "DEV_SUB_1"})
	if err != nil || len(settlements) != 0 {
		t.Fatalf("expected an empty dev settlement list, got %+v / %v", settlements, err)
	}
}

// The dev provider accepts + echoes the §5.2 callback_url: it rides the stub
// authorization URL as a query parameter so local/e2e runs observe it exactly
// like the live provider's callback_url field.
func TestDevProviderInitializeTransactionEchoesCallbackURL(t *testing.T) {
	t.Parallel()

	provider := NewDevProvider("whsec")
	result, err := provider.InitializeTransaction(context.Background(), ports.InitializeTransactionInput{
		Reference:   "xt_ref",
		CallbackURL: "https://store.xtiitch.com/cart?paid=1",
	})
	if err != nil {
		t.Fatalf("initialize: %v", err)
	}
	want := "https://dev.local/pay/xt_ref?callback_url=" + "https%3A%2F%2Fstore.xtiitch.com%2Fcart%3Fpaid%3D1"
	if result.AuthorizationURL != want {
		t.Fatalf("expected the callback echoed on the dev URL, got %q", result.AuthorizationURL)
	}

	plain, err := provider.InitializeTransaction(context.Background(), ports.InitializeTransactionInput{Reference: "xt_ref"})
	if err != nil {
		t.Fatalf("initialize: %v", err)
	}
	if plain.AuthorizationURL != "https://dev.local/pay/xt_ref" {
		t.Fatalf("no callback must mean the plain dev URL, got %q", plain.AuthorizationURL)
	}
}
