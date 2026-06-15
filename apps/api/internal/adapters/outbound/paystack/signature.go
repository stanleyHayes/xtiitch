package paystack

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

var ErrUnparseableEvent = errors.New("unparseable paystack event")

// verifyWebhookSignature checks Paystack's x-paystack-signature header, which is
// the HMAC-SHA512 of the raw request body keyed by the secret. Comparison is
// constant-time.
func verifyWebhookSignature(secret string, payload []byte, signature string) bool {
	if secret == "" || signature == "" {
		return false
	}

	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(signature))
}

type webhookEnvelope struct {
	Event string `json:"event"`
	Data  struct {
		Reference string `json:"reference"`
		Status    string `json:"status"`
		Amount    int64  `json:"amount"`
	} `json:"data"`
}

// parseChargeEvent reads a Paystack webhook body. A payment is treated as
// succeeded only for a charge.success event whose data status is "success".
// The dedupe signature combines event type and reference.
func parseChargeEvent(payload []byte) (ports.ProviderChargeEvent, error) {
	var envelope webhookEnvelope
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return ports.ProviderChargeEvent{}, err
	}
	if envelope.Event == "" || envelope.Data.Reference == "" {
		return ports.ProviderChargeEvent{}, ErrUnparseableEvent
	}

	return ports.ProviderChargeEvent{
		EventType:         envelope.Event,
		ProviderReference: envelope.Data.Reference,
		Succeeded:         envelope.Event == "charge.success" && envelope.Data.Status == "success",
		AmountMinor:       envelope.Data.Amount,
		Signature:         "paystack:" + envelope.Event + ":" + envelope.Data.Reference,
	}, nil
}
