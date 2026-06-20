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
type fakeCatalogue struct{}

func (fakeCatalogue) ResolveShop(_ context.Context, handle string) (ports.BotShop, error) {
	if handle != "demo-atelier" {
		return ports.BotShop{}, ports.ErrNotFound
	}
	return ports.BotShop{BusinessID: "biz-1", Name: "Demo Atelier", Handle: "demo-atelier", OnlineOrdering: true}, nil
}

func (fakeCatalogue) ListDesigns(_ context.Context, businessID string) ([]ports.BotDesign, error) {
	if businessID != "biz-1" {
		return nil, nil
	}
	return []ports.BotDesign{
		{Title: "Kente Wrap Dress", Handle: "kente-wrap-dress", FromPriceMinor: 45000, Sizes: []string{"S", "M", "L"}},
		{Title: "Ankara Blazer", Handle: "ankara-blazer", FromPriceMinor: 60000, Sizes: []string{"M", "L"}},
	}, nil
}

func (fakeCatalogue) TrackOrder(_ context.Context, code string) (ports.BotOrder, error) {
	if code != "ORDER123" {
		return ports.BotOrder{}, ports.ErrNotFound
	}
	return ports.BotOrder{DesignTitle: "Kente Wrap Dress", StoreName: "Demo Atelier", Status: "awaiting_deposit", Stage: "Deposit", Colour: "yellow"}, nil
}

func newService() (Service, *fakeSessions, *fakeSender) {
	sessions := newFakeSessions()
	sender := &fakeSender{}
	svc := NewService(Dependencies{
		Sessions:       sessions,
		Dedupe:         newFakeDedupe(),
		Sender:         sender,
		Catalogue:      fakeCatalogue{},
		StorefrontBase: "https://shop.xtiitch.com",
	})
	return svc, sessions, sender
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
