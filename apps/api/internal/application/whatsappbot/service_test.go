package whatsappbot

import (
	"context"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type fakeSessions struct {
	store map[string]ports.WhatsAppSession
}

func newFakeSessions() *fakeSessions { return &fakeSessions{store: map[string]ports.WhatsAppSession{}} }

func (f *fakeSessions) GetSession(_ context.Context, waID string) (ports.WhatsAppSession, bool, error) {
	s, ok := f.store[waID]
	return s, ok, nil
}

func (f *fakeSessions) SaveSession(_ context.Context, session ports.WhatsAppSession) error {
	f.store[session.WaID] = session
	return nil
}

func (f *fakeSessions) DeleteSession(_ context.Context, waID string) error {
	delete(f.store, waID)
	return nil
}

type fakeDedupe struct{ seen map[string]bool }

func newFakeDedupe() *fakeDedupe { return &fakeDedupe{seen: map[string]bool{}} }

func (f *fakeDedupe) MarkProcessed(_ context.Context, id string) (bool, error) {
	if f.seen[id] {
		return true, nil
	}
	f.seen[id] = true
	return false, nil
}

type fakeSender struct{ sent []string }

func (f *fakeSender) SendText(_ context.Context, _, body string) error {
	f.sent = append(f.sent, body)
	return nil
}

func (f *fakeSender) last() string {
	if len(f.sent) == 0 {
		return ""
	}
	return f.sent[len(f.sent)-1]
}

// fakeCatalogue serves one shop ("demo-atelier") with two designs and one order.
// onlineOrdering toggles the plan benefit; placed records bot orders.
type fakeCatalogue struct {
	onlineOrdering bool
	placed         []ports.BotOrderRequest
}

func (f *fakeCatalogue) ResolveShop(_ context.Context, handle string) (ports.BotShop, error) {
	if handle != "demo-atelier" {
		return ports.BotShop{}, ports.ErrNotFound
	}
	return ports.BotShop{BusinessID: "biz-1", Name: "Demo Atelier", Handle: "demo-atelier", OnlineOrdering: f.onlineOrdering}, nil
}

func (f *fakeCatalogue) ListDesigns(_ context.Context, businessID string) ([]ports.BotDesign, error) {
	if businessID != "biz-1" {
		return nil, nil
	}
	return []ports.BotDesign{
		{Title: "Kente Wrap Dress", Handle: "kente-wrap-dress", FromPriceMinor: 45000, Sizes: []ports.BotSizeBand{
			{ID: "band-s", Label: "S", PriceMinor: 45000},
			{ID: "band-m", Label: "M", PriceMinor: 50000},
			{ID: "band-l", Label: "L", PriceMinor: 55000},
		}},
		{Title: "Ankara Blazer", Handle: "ankara-blazer", FromPriceMinor: 60000, Sizes: []ports.BotSizeBand{
			{ID: "band-m2", Label: "M", PriceMinor: 60000},
			{ID: "band-l2", Label: "L", PriceMinor: 65000},
		}},
	}, nil
}

func (f *fakeCatalogue) TrackOrder(_ context.Context, code string) (ports.BotOrder, error) {
	if code != "ORDER123" {
		return ports.BotOrder{}, ports.ErrNotFound
	}
	return ports.BotOrder{DesignTitle: "Kente Wrap Dress", StoreName: "Demo Atelier", Status: "awaiting_deposit", Stage: "Deposit", Colour: "yellow"}, nil
}

func (f *fakeCatalogue) PlaceStandardOrder(_ context.Context, req ports.BotOrderRequest) (ports.BotOrderDraft, error) {
	if !f.onlineOrdering {
		return ports.BotOrderDraft{}, ports.ErrOrderingUnavailable
	}
	f.placed = append(f.placed, req)
	return ports.BotOrderDraft{OrderID: "order-xyz", AuthorizationURL: "https://paystack.test/pay/abc", AmountMinor: 50000}, nil
}

func newService() (Service, *fakeSessions, *fakeSender) {
	svc, sessions, sender, _ := newServiceWith(true)
	return svc, sessions, sender
}

func newServiceWith(onlineOrdering bool) (Service, *fakeSessions, *fakeSender, *fakeCatalogue) {
	sessions := newFakeSessions()
	sender := &fakeSender{}
	cat := &fakeCatalogue{onlineOrdering: onlineOrdering}
	svc := NewService(Dependencies{
		Sessions:       sessions,
		Dedupe:         newFakeDedupe(),
		Sender:         sender,
		Catalogue:      cat,
		StorefrontBase: "https://shop.xtiitch.com",
	})
	return svc, sessions, sender, cat
}

// send is a tiny helper to drive a turn with a unique message id.
func send(t *testing.T, svc Service, wa, id, text string) {
	t.Helper()
	if err := svc.HandleInbound(context.Background(), InboundMessage{WaID: wa, MessageID: id, Type: "text", Text: text, ContactName: "Ama"}); err != nil {
		t.Fatalf("HandleInbound(%q): %v", text, err)
	}
}

func TestFirstMessageGreetsAndPersistsSession(t *testing.T) {
	svc, sessions, sender := newService()
	send(t, svc, "233244000111", "m1", "hi")

	if !strings.Contains(sender.last(), "Ama") {
		t.Fatalf("expected a personalised greeting, got %q", sender.last())
	}
	if _, ok := sessions.store["233244000111"]; !ok {
		t.Fatal("expected a session to be persisted")
	}
}

func TestDuplicateMessageIsIgnored(t *testing.T) {
	svc, _, sender := newService()
	send(t, svc, "233244000111", "dup", "hi")
	send(t, svc, "233244000111", "dup", "hi")
	if len(sender.sent) != 1 {
		t.Fatalf("duplicate message should not produce a second reply, got %d", len(sender.sent))
	}
}

func TestBrowseFlowResolvesShopAndListsDesigns(t *testing.T) {
	svc, _, sender := newService()
	send(t, svc, "233244000111", "m1", "hi")           // greeting → awaiting_shop
	send(t, svc, "233244000111", "m2", "Demo Atelier") // resolves shop → menu
	if !strings.Contains(sender.last(), "Demo Atelier") {
		t.Fatalf("expected shop menu, got %q", sender.last())
	}
	send(t, svc, "233244000111", "m3", "browse") // lists designs
	listing := sender.last()
	if !strings.Contains(listing, "Kente Wrap Dress") || !strings.Contains(listing, "GHS 450") {
		t.Fatalf("expected the design list with prices, got %q", listing)
	}
	send(t, svc, "233244000111", "m4", "1") // detail of design #1
	detail := sender.last()
	if !strings.Contains(detail, "Kente Wrap Dress") || !strings.Contains(detail, "Sizes: S, M, L") {
		t.Fatalf("expected design detail with sizes, got %q", detail)
	}
}

func TestUnknownShopAsksAgain(t *testing.T) {
	svc, _, sender := newService()
	send(t, svc, "233244000111", "m1", "hi")
	send(t, svc, "233244000111", "m2", "no-such-shop")
	if !strings.Contains(strings.ToLower(sender.last()), "couldn't find") {
		t.Fatalf("expected a not-found prompt, got %q", sender.last())
	}
}

func TestTrackOrderByCode(t *testing.T) {
	svc, _, sender := newService()
	send(t, svc, "233244000111", "m1", "hi")
	send(t, svc, "233244000111", "m2", "demo-atelier")
	send(t, svc, "233244000111", "m3", "track ORDER123")
	reply := sender.last()
	if !strings.Contains(reply, "Kente Wrap Dress") || !strings.Contains(strings.ToLower(reply), "awaiting deposit") {
		t.Fatalf("expected the order status, got %q", reply)
	}
}

func TestTrackUnknownOrder(t *testing.T) {
	svc, _, sender := newService()
	send(t, svc, "233244000111", "m1", "hi")
	send(t, svc, "233244000111", "m2", "demo-atelier")
	send(t, svc, "233244000111", "m3", "track NOPE")
	if !strings.Contains(strings.ToLower(sender.last()), "couldn't find an order") {
		t.Fatalf("expected order not-found, got %q", sender.last())
	}
}

func TestOrderFlowPlacesOrderAndSendsPaymentLink(t *testing.T) {
	svc, _, sender, cat := newServiceWith(true)
	send(t, svc, "233244000111", "m1", "hi")
	send(t, svc, "233244000111", "m2", "demo-atelier")
	send(t, svc, "233244000111", "m3", "browse")
	send(t, svc, "233244000111", "m4", "1") // open Kente Wrap Dress
	if !strings.Contains(strings.ToUpper(sender.last()), "ORDER") {
		t.Fatalf("expected an ORDER prompt on the detail, got %q", sender.last())
	}
	send(t, svc, "233244000111", "m5", "order") // → list sizes
	if !strings.Contains(sender.last(), "Which size") {
		t.Fatalf("expected size prompt, got %q", sender.last())
	}
	send(t, svc, "233244000111", "m6", "2") // pick size M
	if !strings.Contains(strings.ToLower(sender.last()), "name") {
		t.Fatalf("expected a name prompt, got %q", sender.last())
	}
	send(t, svc, "233244000111", "m7", "Ama Mensah") // give name → place order

	if len(cat.placed) != 1 {
		t.Fatalf("expected exactly one placed order, got %d", len(cat.placed))
	}
	req := cat.placed[0]
	if req.StoreHandle != "demo-atelier" || req.DesignHandle != "kente-wrap-dress" || req.SizeBandID != "band-m" {
		t.Fatalf("order request mismatch: %+v", req)
	}
	if req.CustomerName != "Ama Mensah" || req.CustomerPhone != "233244000111" {
		t.Fatalf("customer details mismatch: %+v", req)
	}
	if req.CustomerEmail == "" {
		t.Fatal("expected a synthesised email for Paystack")
	}
	if !strings.Contains(sender.last(), "https://paystack.test/pay/abc") {
		t.Fatalf("expected the payment link in the reply, got %q", sender.last())
	}
}

func TestOrderRefusedWhenOnlineOrderingOff(t *testing.T) {
	svc, _, sender, cat := newServiceWith(false)
	send(t, svc, "233244000111", "m1", "hi")
	send(t, svc, "233244000111", "m2", "demo-atelier")
	send(t, svc, "233244000111", "m3", "browse")
	send(t, svc, "233244000111", "m4", "1")
	// Detail should NOT show the ORDER prompt for a non-ordering shop.
	if strings.Contains(strings.ToUpper(sender.last()), "REPLY *ORDER*") {
		t.Fatalf("did not expect an ORDER prompt when ordering is off, got %q", sender.last())
	}
	send(t, svc, "233244000111", "m5", "order")
	if len(cat.placed) != 0 {
		t.Fatal("no order should be placed when online ordering is off")
	}
	if !strings.Contains(strings.ToLower(sender.last()), "isn't taking online orders") {
		t.Fatalf("expected a refusal pointing to the shop page, got %q", sender.last())
	}
}

func TestStopOptsOutAndClearsSession(t *testing.T) {
	svc, sessions, sender := newService()
	send(t, svc, "233244000111", "m1", "hi")
	send(t, svc, "233244000111", "m2", "STOP")
	if _, ok := sessions.store["233244000111"]; ok {
		t.Fatal("STOP should delete the session")
	}
	if !strings.Contains(strings.ToLower(sender.last()), "opted out") {
		t.Fatalf("expected an opt-out confirmation, got %q", sender.last())
	}
}
