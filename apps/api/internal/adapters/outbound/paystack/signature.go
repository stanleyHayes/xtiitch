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
		// Fees is the transaction fee Paystack reports it took on the charge —
		// the §3.2 figure persisted verbatim, never recomputed locally.
		Fees *int64 `json:"fees"`
		// FeesSplit breaks the fee down per party on split transactions; the
		// "subaccount" entry is what the store's subaccount bore (used when the
		// top-level fees field is absent).
		FeesSplit *struct {
			Subaccount *int64 `json:"subaccount"`
		} `json:"fees_split"`
		// Subaccount identifies the store on transfer.* events, when Paystack
		// includes it.
		Subaccount *struct {
			SubaccountCode string `json:"subaccount_code"`
		} `json:"subaccount"`
		SubaccountCode string `json:"subaccount_code"`
	} `json:"data"`
}

// peekEventType reads only the event discriminator, so the webhook handler can
// route charge.* events to confirmation and transfer.* events to the payout
// refresh without a full parse first.
func peekEventType(payload []byte) string {
	var envelope struct {
		Event string `json:"event"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return ""
	}
	return envelope.Event
}

// parseChargeEvent reads a Paystack webhook body. A payment is treated as
// succeeded only for a charge.success event whose data status is "success".
// The dedupe signature combines event type and reference. The provider-reported
// fee rides along (fees, falling back to fees_split.subaccount) so it can be
// persisted verbatim per §3.2.
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
		FeeMinor:          resolveProviderFee(envelope),
		Signature:         "paystack:" + envelope.Event + ":" + envelope.Data.Reference,
	}, nil
}

// resolveProviderFee picks the provider-reported fee: the top-level "fees"
// figure, else the subaccount-borne share from fees_split (bearer=subaccount
// makes the subaccount carry it, §4.8). 0 means Paystack reported neither.
func resolveProviderFee(envelope webhookEnvelope) int64 {
	if envelope.Data.Fees != nil {
		return *envelope.Data.Fees
	}
	if envelope.Data.FeesSplit != nil && envelope.Data.FeesSplit.Subaccount != nil {
		return *envelope.Data.FeesSplit.Subaccount
	}
	return 0
}

// parseTransferEvent reads a transfer.* webhook (transfer.success /
// transfer.failed / transfer.reversed) — the §4.10 payout signal. The
// subaccount code, when Paystack includes one, names the store whose mirrored
// settlements should be refreshed.
func parseTransferEvent(payload []byte) (ports.ProviderTransferEvent, error) {
	var envelope webhookEnvelope
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return ports.ProviderTransferEvent{}, err
	}
	if envelope.Event == "" || envelope.Data.Reference == "" {
		return ports.ProviderTransferEvent{}, ErrUnparseableEvent
	}

	subaccountCode := envelope.Data.SubaccountCode
	if envelope.Data.Subaccount != nil && envelope.Data.Subaccount.SubaccountCode != "" {
		subaccountCode = envelope.Data.Subaccount.SubaccountCode
	}

	return ports.ProviderTransferEvent{
		EventType:         envelope.Event,
		ProviderReference: envelope.Data.Reference,
		Status:            envelope.Data.Status,
		SubaccountCode:    subaccountCode,
		AmountMinor:       envelope.Data.Amount,
		Succeeded:         envelope.Event == "transfer.success" && envelope.Data.Status == "success",
		Signature:         "paystack:" + envelope.Event + ":" + envelope.Data.Reference,
	}, nil
}
