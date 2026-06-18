package paystack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

const defaultBaseURL = "https://api.paystack.co"

// Client talks to the live Paystack API. It is wired only when a secret key is
// configured; otherwise DevProvider is used. The request shapes follow
// Paystack's documented transaction/subaccount endpoints and must be validated
// against a Paystack test account before going live (settlement-bank mapping
// for mobile money in particular is deployment-specific).
type Client struct {
	secretKey     string
	webhookSecret string
	baseURL       string
	httpClient    *http.Client
}

func NewClient(secretKey string, webhookSecret string) Client {
	return Client{
		secretKey:     secretKey,
		webhookSecret: webhookSecret,
		baseURL:       defaultBaseURL,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (c Client) VerifyWebhookSignature(payload []byte, signature string) bool {
	return verifyWebhookSignature(c.webhookSecret, payload, signature)
}

func (c Client) ParseChargeEvent(payload []byte) (ports.ProviderChargeEvent, error) {
	return parseChargeEvent(payload)
}

func (c Client) CreateBusinessSubaccount(ctx context.Context, input ports.CreateBusinessSubaccountInput) (ports.CreateBusinessSubaccountResult, error) {
	var response struct {
		Status bool `json:"status"`
		Data   struct {
			SubaccountCode string `json:"subaccount_code"`
		} `json:"data"`
	}
	if err := c.post(ctx, "/subaccount", map[string]any{
		"business_name":     input.BusinessName,
		"account_number":    input.SettlementAccount,
		"percentage_charge": 0,
	}, &response); err != nil {
		return ports.CreateBusinessSubaccountResult{}, err
	}

	return ports.CreateBusinessSubaccountResult{ProviderReference: response.Data.SubaccountCode}, nil
}

func (c Client) InitializeTransaction(ctx context.Context, input ports.InitializeTransactionInput) (ports.InitializeTransactionResult, error) {
	var response struct {
		Status bool `json:"status"`
		Data   struct {
			AuthorizationURL string `json:"authorization_url"`
			AccessCode       string `json:"access_code"`
			Reference        string `json:"reference"`
		} `json:"data"`
	}
	body := map[string]any{
		"email":     input.CustomerEmail,
		"amount":    input.AmountMinor,
		"currency":  input.Currency,
		"reference": input.Reference,
	}
	if input.SubaccountRef != "" {
		body["subaccount"] = input.SubaccountRef
		body["transaction_charge"] = input.CommissionMinor
		body["bearer"] = "subaccount"
	}
	if err := c.post(ctx, "/transaction/initialize", body, &response); err != nil {
		return ports.InitializeTransactionResult{}, err
	}

	return ports.InitializeTransactionResult{
		AuthorizationURL:  response.Data.AuthorizationURL,
		AccessCode:        response.Data.AccessCode,
		ProviderReference: response.Data.Reference,
	}, nil
}

func (c Client) ChargeAuthorization(ctx context.Context, input ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error) {
	var response struct {
		Status bool `json:"status"`
		Data   struct {
			Amount    int64  `json:"amount"`
			Currency  string `json:"currency"`
			Status    string `json:"status"`
			Reference string `json:"reference"`
		} `json:"data"`
	}
	if err := c.post(ctx, "/transaction/charge_authorization", map[string]any{
		"authorization_code": input.AuthorizationCode,
		"email":              input.CustomerEmail,
		"amount":             input.AmountMinor,
		"currency":           input.Currency,
		"reference":          input.Reference,
	}, &response); err != nil {
		return ports.ChargeAuthorizationResult{}, err
	}

	reference := response.Data.Reference
	if reference == "" {
		reference = input.Reference
	}
	currency := response.Data.Currency
	if currency == "" {
		currency = input.Currency
	}
	return ports.ChargeAuthorizationResult{
		ProviderReference: reference,
		Status:            response.Data.Status,
		AmountMinor:       response.Data.Amount,
		Currency:          currency,
	}, nil
}

func (c Client) post(ctx context.Context, path string, body any, out any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+c.secretKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("paystack %s: unexpected status %d", path, response.StatusCode)
	}

	return json.NewDecoder(response.Body).Decode(out)
}
