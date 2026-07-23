package paystack

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// ListSettlements must call Paystack's Settlements API with the subaccount
// filter (the §3.2 ground-truth pull), walk its pages, and map each record
// (amount already in pesewas, settled_at fallbacks, raw payload preserved).
func TestClientListSettlementsFiltersPagesAndMaps(t *testing.T) {
	from := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 7, 19, 0, 0, 0, 0, time.UTC)

	var paths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/settlement") {
			t.Errorf("expected /settlement, hit %q", r.URL.Path)
		}
		query := r.URL.Query()
		if query.Get("subaccount") != "ACCT_1" {
			t.Errorf("expected the subaccount filter ACCT_1, got %q", query.Get("subaccount"))
		}
		if query.Get("from") != "2026-07-01" || query.Get("to") != "2026-07-19" || query.Get("status") != "success" {
			t.Errorf("unexpected date-range/status filters: %s", r.URL.RawQuery)
		}
		paths = append(paths, r.URL.RawQuery)
		switch query.Get("page") {
		case "1":
			_, _ = w.Write([]byte(`{"status":true,"data":[
				{"id": 901, "amount": 9700, "status": "success", "settled_at": "2026-07-18T09:30:00.000Z",
					"created_at": "2026-07-18T08:00:00.000Z", "subaccount": {"subaccount_code": "ACCT_1"}}
			],"meta":{"page":1,"pageCount":2}}`))
		case "2":
			_, _ = w.Write([]byte(`{"status":true,"data":[
				{"id": 902, "effective_amount": 4850, "total_amount": 5000, "status": "pending", "created_at": "2026-07-19T08:00:00.000Z"}
			],"meta":{"page":2,"pageCount":2}}`))
		default:
			t.Errorf("unexpected page %q", query.Get("page"))
		}
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	settlements, err := client.ListSettlements(context.Background(), ports.ListSettlementsInput{
		SubaccountRef: "ACCT_1",
		From:          &from,
		To:            &to,
		Status:        "success",
	})
	if err != nil {
		t.Fatalf("list settlements: %v", err)
	}
	if len(paths) != 2 {
		t.Fatalf("expected the walk to fetch 2 pages, got %d (%v)", len(paths), paths)
	}
	if len(settlements) != 2 {
		t.Fatalf("expected 2 settlements, got %+v", settlements)
	}

	first := settlements[0]
	if first.ProviderReference != "paystack_settlement:901" {
		t.Fatalf("expected the settlement id as a prefixed provider reference, got %q", first.ProviderReference)
	}
	if first.AmountMinor != 9700 || first.Status != "success" || first.SubaccountCode != "ACCT_1" {
		t.Fatalf("unexpected settlement mapping: %+v", first)
	}
	if first.SettledAt == nil || first.SettledAt.Year() != 2026 || first.SettledAt.Day() != 18 {
		t.Fatalf("expected settled_at parsed, got %+v", first.SettledAt)
	}
	if !strings.Contains(string(first.RawPayload), `"id":901`) {
		t.Fatalf("expected the raw payload preserved, got %s", first.RawPayload)
	}

	// The second record has no settled_at: the mapping falls back to created_at.
	second := settlements[1]
	if second.AmountMinor != 4850 {
		t.Fatalf("expected effective_amount fallback for settlement amount, got %+v", second)
	}
	if second.SettledAt == nil || second.SettledAt.Day() != 19 {
		t.Fatalf("expected the created_at fallback for an unsettled row, got %+v", second.SettledAt)
	}
}

// A short first page (fewer rows than perPage) ends the walk without a meta
// block, so a minimal/proxied response shape never loops.
func TestClientListSettlementsStopsOnShortPage(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"status":true,"data":[{"id":1,"amount":100,"status":"success"}]}`))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	settlements, err := client.ListSettlements(context.Background(), ports.ListSettlementsInput{SubaccountRef: "ACCT_1"})
	if err != nil {
		t.Fatalf("list settlements: %v", err)
	}
	if calls != 1 || len(settlements) != 1 {
		t.Fatalf("expected a single page fetched once, got %d calls / %+v", calls, settlements)
	}
}

// A non-2xx from Paystack surfaces as an error so the caller can treat the
// sync as failed (and the Money Desk read keeps serving the last mirror).
func TestClientListSettlementsSurfacesHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	if _, err := client.ListSettlements(context.Background(), ports.ListSettlementsInput{SubaccountRef: "ACCT_1"}); err == nil {
		t.Fatal("expected an error on a 401 from the provider")
	}
}

func Example_settlementReference() {
	reference, _ := settlementReference([]byte(`901`))
	fmt.Println(reference)
	// Output: paystack_settlement:901
}
