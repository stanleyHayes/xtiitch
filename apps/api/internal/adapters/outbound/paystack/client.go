package paystack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
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

func (c Client) CreateBusinessSubaccount(
	ctx context.Context,
	input ports.CreateBusinessSubaccountInput) (ports.CreateBusinessSubaccountResult,
	error,
) {
	var response struct {
		Status bool `json:"status"`
		Data   struct {
			SubaccountCode string `json:"subaccount_code"`
		} `json:"data"`
	}
	if err := c.post(ctx, "/subaccount", map[string]any{
		"business_name":     input.BusinessName,
		"settlement_bank":   input.SettlementBank,
		"account_number":    input.SettlementAccount,
		"percentage_charge": 0,
	}, &response); err != nil {
		return ports.CreateBusinessSubaccountResult{}, err
	}

	return ports.CreateBusinessSubaccountResult{ProviderReference: response.Data.SubaccountCode}, nil
}

func (c Client) InitializeTransaction(
	ctx context.Context,
	input ports.InitializeTransactionInput) (ports.InitializeTransactionResult,
	error,
) {
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
	switch {
	case len(input.Splits) > 0:
		// Marketplace split (§4 / P0.4): route ONE charge across several
		// merchants' subaccounts. Each subaccount receives its flat net share;
		// the platform (main account) gets the remainder (= its summed
		// commission). "all-proportional" spreads the Paystack processing fee
		// across all parties in proportion to their share, mirroring the
		// single-store "bearer=subaccount" intent (the merchant bears the fee).
		// The exact split-object shape must be validated against a Paystack test
		// account before going live, like the single-subaccount path above.
		subaccounts := make([]map[string]any, 0, len(input.Splits))
		for _, split := range input.Splits {
			subaccounts = append(subaccounts, map[string]any{
				"subaccount": split.SubaccountRef,
				"share":      split.ShareMinor,
			})
		}
		body["split"] = map[string]any{
			"type":        "flat",
			"currency":    input.Currency,
			"bearer_type": "all-proportional",
			"subaccounts": subaccounts,
		}
	case input.SubaccountRef != "":
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

// InitializeAuthorization opens a STANDARD Paystack checkout (checkout.paystack.com)
// for the first-period charge. The customer pays by MoMo or card; a card payment
// also yields a reusable authorization (read back in VerifyAuthorization) for
// later recurring charges. This replaces the old direct-debit mandate link, which
// resolved to a dead page for this account.
func (c Client) InitializeAuthorization(
	ctx context.Context,
	input ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult,
	error,
) {
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
	if input.CallbackURL != "" {
		body["callback_url"] = input.CallbackURL
	}
	if err := c.post(ctx, "/transaction/initialize", body, &response); err != nil {
		return ports.InitializeAuthorizationResult{}, err
	}
	return ports.InitializeAuthorizationResult{
		RedirectURL: response.Data.AuthorizationURL,
		AccessCode:  response.Data.AccessCode,
		Reference:   response.Data.Reference,
	}, nil
}

// VerifyAuthorization reads back the checkout transaction created by
// InitializeAuthorization: whether it was paid, the amount, and the reusable
// authorization captured for recurring charges.
func (c Client) VerifyAuthorization(ctx context.Context, input ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error) {
	var response struct {
		Status bool `json:"status"`
		Data   struct {
			Status   string `json:"status"`
			Amount   int64  `json:"amount"`
			Customer struct {
				// Paystack's /transaction/verify returns the customer code as
				// "customer_code" (the /customer endpoints use "code").
				Code  string `json:"customer_code"`
				Email string `json:"email"`
			} `json:"customer"`
			Authorization struct {
				AuthorizationCode string `json:"authorization_code"`
				Bank              string `json:"bank"`
				Channel           string `json:"channel"`
				Reusable          bool   `json:"reusable"`
			} `json:"authorization"`
		} `json:"data"`
	}
	if err := c.get(ctx, "/transaction/verify/"+url.PathEscape(input.Reference), &response); err != nil {
		return ports.VerifyAuthorizationResult{}, err
	}
	succeeded := response.Data.Status == "success"
	authCode := strings.TrimSpace(response.Data.Authorization.AuthorizationCode)
	return ports.VerifyAuthorizationResult{
		Succeeded:         succeeded,
		AmountMinor:       response.Data.Amount,
		AuthorizationCode: authCode,
		CustomerCode:      response.Data.Customer.Code,
		CustomerEmail:     response.Data.Customer.Email,
		Channel:           response.Data.Authorization.Channel,
		Bank:              response.Data.Authorization.Bank,
		Reusable:          response.Data.Authorization.Reusable,
		Active:            succeeded && authCode != "",
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

func (c Client) get(ctx context.Context, path string, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+c.secretKey)

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
