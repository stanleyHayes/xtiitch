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

func newService() (Service, *fakeSessions, *fakeDedupe, *fakeSender) {
	sessions := newFakeSessions()
	dedupe := newFakeDedupe()
	sender := &fakeSender{}
	svc := NewService(Dependencies{Sessions: sessions, Dedupe: dedupe, Sender: sender})
	return svc, sessions, dedupe, sender
}

func TestFirstMessageGreetsAndPersistsSession(t *testing.T) {
	svc, sessions, _, sender := newService()

	err := svc.HandleInbound(context.Background(), InboundMessage{
		WaID: "233244000111", MessageID: "wamid.1", Type: "text", Text: "hi", ContactName: "Ama",
	})
	if err != nil {
		t.Fatalf("HandleInbound: %v", err)
	}
	if len(sender.sent) != 1 || !strings.Contains(sender.sent[0], "Ama") {
		t.Fatalf("expected a personalised greeting, got %v", sender.sent)
	}
	if _, ok := sessions.store["233244000111"]; !ok {
		t.Fatal("expected a session to be persisted")
	}
}

func TestDuplicateMessageIsIgnored(t *testing.T) {
	svc, _, _, sender := newService()
	msg := InboundMessage{WaID: "233244000111", MessageID: "wamid.dup", Type: "text", Text: "hi"}

	if err := svc.HandleInbound(context.Background(), msg); err != nil {
		t.Fatalf("first: %v", err)
	}
	if err := svc.HandleInbound(context.Background(), msg); err != nil {
		t.Fatalf("second: %v", err)
	}
	if len(sender.sent) != 1 {
		t.Fatalf("duplicate message should not produce a second reply, got %d", len(sender.sent))
	}
}

func TestSecondTurnEchoesWithCount(t *testing.T) {
	svc, _, _, sender := newService()
	_ = svc.HandleInbound(context.Background(), InboundMessage{WaID: "233244000111", MessageID: "m1", Type: "text", Text: "hi"})
	_ = svc.HandleInbound(context.Background(), InboundMessage{WaID: "233244000111", MessageID: "m2", Type: "text", Text: "red kente"})

	if len(sender.sent) != 2 {
		t.Fatalf("expected 2 replies, got %d", len(sender.sent))
	}
	if !strings.Contains(sender.sent[1], "red kente") {
		t.Fatalf("expected the echo to include the message, got %q", sender.sent[1])
	}
}

func TestStopOptsOutAndClearsSession(t *testing.T) {
	svc, sessions, _, sender := newService()
	_ = svc.HandleInbound(context.Background(), InboundMessage{WaID: "233244000111", MessageID: "m1", Type: "text", Text: "hi"})
	if err := svc.HandleInbound(context.Background(), InboundMessage{WaID: "233244000111", MessageID: "m2", Type: "text", Text: "STOP"}); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if _, ok := sessions.store["233244000111"]; ok {
		t.Fatal("STOP should delete the session")
	}
	if !strings.Contains(strings.ToLower(sender.sent[len(sender.sent)-1]), "opted out") {
		t.Fatalf("expected an opt-out confirmation, got %q", sender.sent[len(sender.sent)-1])
	}
}
