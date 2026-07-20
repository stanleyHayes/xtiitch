package paystack

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// newTestClient points a real Client at an httptest server so the request shapes
// and response parsing are exercised exactly as against live Paystack.
func newTestClient(baseURL string) Client {
	c := NewClient("sk_test_x", "whsec")
	c.baseURL = baseURL
	return c
}

// InitializeAuthorization must open a STANDARD checkout: POST /transaction/initialize
// carrying the first-period amount/currency/reference, and return the checkout URL.
func TestClientInitializeAuthorizationOpensStandardCheckout(t *testing.T) {
	var gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &gotBody)
		_, _ = w.Write([]byte(`{"status":true,"data":{` +
			`"authorization_url":"https://checkout.paystack.com/abc",` +
			`"access_code":"abc","reference":"ref-1"}}`))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	result, err := client.InitializeAuthorization(context.Background(), ports.InitializeAuthorizationInput{
		BusinessID:    common.ID("biz-1"),
		CustomerEmail: "owner@example.com",
		CallbackURL:   "https://x/cb",
		AmountMinor:   23800,
		Currency:      "GHS",
		Reference:     "ref-1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotPath != "/transaction/initialize" {
		t.Fatalf("expected a standard-checkout initialize, hit %q", gotPath)
	}
	// Paystack requires amount/currency/reference for a real checkout; JSON numbers
	// decode to float64.
	if gotBody["amount"].(float64) != 23800 || gotBody["currency"] != "GHS" || gotBody["reference"] != "ref-1" {
		t.Fatalf("checkout must carry the first-period amount/currency/reference, got %+v", gotBody)
	}
	if !strings.HasPrefix(result.RedirectURL, "https://checkout.paystack.com/") {
		t.Fatalf("expected a checkout.paystack.com redirect, got %q", result.RedirectURL)
	}
}

// VerifyAuthorization must read the paid transaction: succeeded, amount, the reusable
// authorization, and the customer code — which Paystack's /transaction/verify returns
// as "customer_code" (a regression guard: parsing it as "code" silently loses it).
func TestClientVerifyAuthorizationParsesTransactionVerify(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/transaction/verify/") {
			t.Errorf("expected /transaction/verify, hit %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{
			"status": true,
			"data": {
				"status": "success",
				"amount": 23800,
				"currency": "GHS",
				"customer": {"customer_code": "CUS_abc", "email": "owner@example.com"},
				"authorization": {"authorization_code": "AUTH_abc", "channel": "card", "bank": "Test Bank", "reusable": true}
			}
		}`))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	result, err := client.VerifyAuthorization(context.Background(), ports.VerifyAuthorizationInput{Reference: "ref-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Succeeded || result.AmountMinor != 23800 {
		t.Fatalf("expected a succeeded 23800 transaction, got %+v", result)
	}
	if result.CustomerCode != "CUS_abc" {
		t.Fatalf("customer code must be parsed from customer_code, got %q", result.CustomerCode)
	}
	if result.AuthorizationCode != "AUTH_abc" || result.Channel != "card" || !result.Reusable {
		t.Fatalf("expected the reusable card authorization parsed, got %+v", result)
	}
	if !result.Active {
		t.Fatalf("a succeeded transaction with an authorization must be Active, got %+v", result)
	}
}

// A transaction that did not succeed must report not-succeeded/not-active so the
// caller leaves the subscription unpaid.
func TestClientVerifyAuthorizationReportsUnpaid(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":true,"data":{"status":"abandoned","amount":23800,"customer":{"customer_code":"CUS_abc"}}}`))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	result, err := client.VerifyAuthorization(context.Background(), ports.VerifyAuthorizationInput{Reference: "ref-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Succeeded || result.Active {
		t.Fatalf("an abandoned transaction must be neither succeeded nor active, got %+v", result)
	}
}

// InitializeTransaction must forward the §5.2 callback_url (where the customer
// returns after paying a store basket) and use ONLY the single-store split —
// no multi-store split object may ever leave this client again.
func TestClientInitializeTransactionSendsCallbackURLAndSingleStoreSplit(t *testing.T) {
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/transaction/initialize" {
			t.Errorf("expected /transaction/initialize, hit %q", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &gotBody)
		_, _ = w.Write([]byte(`{"status":true,"data":{` +
			`"authorization_url":"https://checkout.paystack.com/xyz",` +
			`"access_code":"xyz","reference":"ref-9"}}`))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	result, err := client.InitializeTransaction(context.Background(), ports.InitializeTransactionInput{
		BusinessID:      common.ID("biz-1"),
		SubaccountRef:   "ACCT_store1",
		CustomerEmail:   "buyer@example.com",
		AmountMinor:     25000,
		CommissionMinor: 750,
		Currency:        "GHS",
		Reference:       "ref-9",
		CallbackURL:     "https://store.xtiitch.com/cart",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotBody["callback_url"] != "https://store.xtiitch.com/cart" {
		t.Fatalf("expected the callback_url forwarded verbatim, got %+v", gotBody)
	}
	if gotBody["subaccount"] != "ACCT_store1" || gotBody["bearer"] != "subaccount" {
		t.Fatalf("expected the single-store split fields, got %+v", gotBody)
	}
	if _, hasSplit := gotBody["split"]; hasSplit {
		t.Fatalf("§5.2: no multi-store split object may be sent, got %+v", gotBody["split"])
	}
	if result.ProviderReference != "ref-9" {
		t.Fatalf("expected the provider reference parsed, got %+v", result)
	}
}

// Without a callback_url the initialize body must not carry the key at all —
// Paystack then applies the dashboard default, exactly the pre-§5.2 behaviour.
func TestClientInitializeTransactionOmitsEmptyCallbackURL(t *testing.T) {
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &gotBody)
		_, _ = w.Write([]byte(`{"status":true,"data":{"authorization_url":"https://x","access_code":"a","reference":"r"}}`))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	if _, err := client.InitializeTransaction(context.Background(), ports.InitializeTransactionInput{
		CustomerEmail: "buyer@example.com",
		AmountMinor:   1000,
		Currency:      "GHS",
		Reference:     "r",
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, has := gotBody["callback_url"]; has {
		t.Fatalf("an empty callback must be omitted, got %+v", gotBody)
	}
}
