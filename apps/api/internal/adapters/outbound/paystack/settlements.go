package paystack

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// settlementPageSize is the per-page size used when walking the Settlements
// API; settlementMaxPages bounds the walk so a pathological response can never
// turn a read-path sync into an unbounded loop.
const (
	settlementPageSize   = 50
	settlementMaxPages   = 20
	settlementDateFormat = "2006-01-02"
)

// settlementItem mirrors one Paystack settlement record. Amounts are already in
// the currency's minor unit (pesewas for GHS) — the same units convention the
// rest of this client uses (charges pass AmountMinor straight through). The
// exact field set must be validated against a Paystack test account before
// going live, like the subaccount endpoints above.
type settlementItem struct {
	ID              json.RawMessage `json:"id"`
	Amount          int64           `json:"amount"`
	EffectiveAmount int64           `json:"effective_amount"`
	TotalAmount     int64           `json:"total_amount"`
	Status          string          `json:"status"`
	SettledAt       *time.Time      `json:"settled_at"`
	SettlementDate  *time.Time      `json:"settlement_date"`
	CreatedAt       *time.Time      `json:"created_at"`
	Subaccount     *struct {
		SubaccountCode string `json:"subaccount_code"`
	} `json:"subaccount"`
}

// ListSettlements pulls the store's settlement (payout) records from Paystack's
// Settlements API — the §3.2 ground truth for what actually settled to the
// store — filtered by subaccount (plus optional date range and status) and
// walked page by page. Each record keeps its raw payload for dispute evidence
// (§11.5).
func (c Client) ListSettlements(ctx context.Context, input ports.ListSettlementsInput) ([]ports.ProviderSettlement, error) {
	var settlements []ports.ProviderSettlement
	for page := 1; page <= settlementMaxPages; page++ {
		result, err := c.listSettlementsPage(ctx, input, page)
		if err != nil {
			return nil, err
		}
		settlements = append(settlements, result.settlements...)
		if result.lastPage {
			return settlements, nil
		}
	}
	return settlements, nil
}

type settlementsPageResult struct {
	settlements []ports.ProviderSettlement
	lastPage    bool
}

func (c Client) listSettlementsPage(ctx context.Context, input ports.ListSettlementsInput, page int) (settlementsPageResult, error) {
	query := url.Values{}
	query.Set("perPage", strconv.Itoa(settlementPageSize))
	query.Set("page", strconv.Itoa(page))
	if input.SubaccountRef != "" {
		query.Set("subaccount", input.SubaccountRef)
	}
	if input.From != nil {
		query.Set("from", input.From.Format(settlementDateFormat))
	}
	if input.To != nil {
		query.Set("to", input.To.Format(settlementDateFormat))
	}
	if input.Status != "" {
		query.Set("status", input.Status)
	}

	var response struct {
		Status bool             `json:"status"`
		Data   []settlementItem `json:"data"`
		Meta   *struct {
			PageCount int `json:"pageCount"`
		} `json:"meta"`
	}
	if err := c.get(ctx, "/settlement?"+query.Encode(), &response); err != nil {
		return settlementsPageResult{}, err
	}

	settlements := make([]ports.ProviderSettlement, 0, len(response.Data))
	for _, item := range response.Data {
		settlement, err := mapSettlementItem(item)
		if err != nil {
			return settlementsPageResult{}, err
		}
		settlements = append(settlements, settlement)
	}

	// The walk ends on the meta-declared last page, or defensively on any short
	// page when meta is absent (an older/proxied response shape).
	lastPage := len(response.Data) < settlementPageSize
	if response.Meta != nil && response.Meta.PageCount > 0 {
		lastPage = page >= response.Meta.PageCount
	}
	return settlementsPageResult{settlements: settlements, lastPage: lastPage}, nil
}

// mapSettlementItem converts the wire shape to the port type. The provider
// reference is the settlement's own id, prefixed so it can never collide with
// a charge reference in the idempotency space; settled_at falls back to
// settlement_date then created_at, whichever Paystack populated.
func mapSettlementItem(item settlementItem) (ports.ProviderSettlement, error) {
	raw, err := json.Marshal(item)
	if err != nil {
		return ports.ProviderSettlement{}, err
	}

	reference, err := settlementReference(item.ID)
	if err != nil {
		return ports.ProviderSettlement{}, err
	}

	settledAt := item.SettledAt
	if settledAt == nil {
		settledAt = item.SettlementDate
	}
	if settledAt == nil {
		settledAt = item.CreatedAt
	}

	subaccountCode := ""
	if item.Subaccount != nil {
		subaccountCode = item.Subaccount.SubaccountCode
	}

	return ports.ProviderSettlement{
		ProviderReference: reference,
		SubaccountCode:    subaccountCode,
		AmountMinor:       settlementAmount(item),
		Status:            item.Status,
		SettledAt:         settledAt,
		RawPayload:        raw,
	}, nil
}

func settlementAmount(item settlementItem) int64 {
	if item.Amount > 0 {
		return item.Amount
	}
	if item.EffectiveAmount > 0 {
		return item.EffectiveAmount
	}
	return item.TotalAmount
}

// settlementReference normalizes the settlement id — Paystack returns it as a
// JSON number, but a string is tolerated — into a stable provider reference.
func settlementReference(raw json.RawMessage) (string, error) {
	var numeric json.Number
	if err := json.Unmarshal(raw, &numeric); err != nil {
		return "", fmt.Errorf("paystack settlement id: %w", err)
	}
	return "paystack_settlement:" + numeric.String(), nil
}
