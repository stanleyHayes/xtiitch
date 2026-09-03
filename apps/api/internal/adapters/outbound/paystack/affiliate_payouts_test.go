package paystack

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func TestCreateAffiliateTransferRecipientUsesGhanaPayoutRail(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/transferrecipient" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if body["type"] != "mobile_money" || body["bank_code"] != "MTN" ||
			body["account_number"] != "0241234567" || body["currency"] != "GHS" {
			t.Fatalf("unexpected recipient request: %#v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":true,"data":{"recipient_code":"RCP_live"}}`))
	}))
	defer server.Close()

	client := NewClient("test-secret", "test-webhook")
	client.baseURL = server.URL
	result, err := client.CreateAffiliateTransferRecipient(context.Background(),
		ports.CreateAffiliateTransferRecipientInput{
			RecipientType: "mobile_money", AccountName: "Ama Mensah",
			AccountNumber: "0241234567", BankCode: "MTN",
		})
	if err != nil {
		t.Fatalf("create recipient: %v", err)
	}
	if result.RecipientCode != "RCP_live" {
		t.Fatalf("unexpected recipient code %q", result.RecipientCode)
	}
}

func TestInitiateAffiliateTransferUsesBalanceAndDeterministicReference(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/transfer" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["source"] != "balance" || body["recipient"] != "RCP_live" || body["reference"] != "affiliate-batch-1" || body["amount"] != float64(2500) || body["currency"] != "GHS" {
			t.Fatalf("unexpected transfer request: %#v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":true,"data":{"transfer_code":"TRF_live","status":"pending"}}`))
	}))
	defer server.Close()
	client := newTestClient(server.URL)
	result, err := client.InitiateAffiliateTransfer(context.Background(), ports.InitiateAffiliateTransferInput{AmountMinor: 2500, RecipientCode: "RCP_live", Reference: "affiliate-batch-1", Reason: "Affiliate payout"})
	if err != nil {
		t.Fatal(err)
	}
	if result.TransferCode != "TRF_live" || result.Status != "pending" {
		t.Fatalf("unexpected result: %+v", result)
	}
}
