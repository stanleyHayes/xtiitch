package paystack

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (c Client) CreateAffiliateTransferRecipient(
	ctx context.Context,
	input ports.CreateAffiliateTransferRecipientInput,
) (ports.CreateAffiliateTransferRecipientResult, error) {
	var response struct {
		Status bool `json:"status"`
		Data   struct {
			RecipientCode string `json:"recipient_code"`
		} `json:"data"`
	}
	if err := c.post(ctx, "/transferrecipient", map[string]any{
		"type": input.RecipientType, "name": input.AccountName,
		"account_number": input.AccountNumber, "bank_code": input.BankCode,
		"currency": "GHS",
	}, &response); err != nil {
		return ports.CreateAffiliateTransferRecipientResult{}, err
	}
	if strings.TrimSpace(response.Data.RecipientCode) == "" {
		return ports.CreateAffiliateTransferRecipientResult{}, errors.New("paystack transfer recipient response omitted recipient code")
	}
	return ports.CreateAffiliateTransferRecipientResult{
		RecipientCode: response.Data.RecipientCode,
	}, nil
}
