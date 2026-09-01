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
