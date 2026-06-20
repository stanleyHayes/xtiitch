// Package whatsappbot is the inbound WhatsApp ordering bot's conversation
// engine. Phase 0 establishes the spine — dedupe, session load/save, and reply
// dispatch — with an echo/health flow. Later phases replace the echo step with
// the browse → order → pay → track state machine over the catalogue, checkout,
// and payments services.
package whatsappbot

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// sessionTTL is how long a conversation stays live between messages before it
// restarts from the greeting.
const sessionTTL = 30 * time.Minute

// optOutKeyword ends a conversation and stops auto-replies (WhatsApp etiquette).
const optOutKeyword = "STOP"

type Service struct {
	sessions ports.WhatsAppSessionRepository
	dedupe   ports.WhatsAppDedupeStore
	sender   ports.WhatsAppSender
	clock    ports.Clock
}

type Dependencies struct {
	Sessions ports.WhatsAppSessionRepository
	Dedupe   ports.WhatsAppDedupeStore
	Sender   ports.WhatsAppSender
	Clock    ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{
		sessions: deps.Sessions,
		dedupe:   deps.Dedupe,
		sender:   deps.Sender,
		clock:    deps.Clock,
	}
}

// InboundMessage is one normalized message lifted from a Meta webhook payload.
type InboundMessage struct {
	WaID        string // sender's WhatsApp id (their phone, e.g. 233244000111)
	MessageID   string // Meta message id (wamid...), used for dedupe
	Type        string // "text", "interactive", ...
	Text        string // text body or interactive reply id/title
	ContactName string // sender's WhatsApp profile name, if provided
}

// conversationState is the opaque per-sender state persisted as JSON. Phase 0
// only tracks turns; later phases add the step + partial order.
type conversationState struct {
	Turns    int    `json:"turns"`
	LastText string `json:"last_text,omitempty"`
}

// HandleInbound advances one inbound message: dedupe, load/seed the session,
// compute the reply, persist, and send. It is the single entry point the webhook
// calls per message. Returns nil for ignored (duplicate/empty) messages.
func (s Service) HandleInbound(ctx context.Context, msg InboundMessage) error {
	if strings.TrimSpace(msg.WaID) == "" {
		return nil
	}
	if msg.MessageID != "" {
		seen, err := s.dedupe.MarkProcessed(ctx, msg.MessageID)
		if err != nil {
			return err
		}
		if seen {
			return nil // Meta retried a message we already handled.
		}
	}

	if strings.EqualFold(strings.TrimSpace(msg.Text), optOutKeyword) {
		if err := s.sessions.DeleteSession(ctx, msg.WaID); err != nil {
			return err
		}
		return s.sender.SendText(ctx, msg.WaID, "You're opted out and won't get more messages. Send any message to start again.")
	}

	session, existed, err := s.sessions.GetSession(ctx, msg.WaID)
	if err != nil {
		return err
	}
	state := decodeState(session.State)

	reply := s.composeReply(existed, state, msg)
	state.Turns++
	state.LastText = msg.Text

	encoded, err := json.Marshal(state)
	if err != nil {
		return err
	}
	if err := s.sessions.SaveSession(ctx, ports.WhatsAppSession{
		WaID:       msg.WaID,
		BusinessID: session.BusinessID,
		State:      encoded,
		ExpiresAt:  s.now().Add(sessionTTL),
	}); err != nil {
		return err
	}

	return s.sender.SendText(ctx, msg.WaID, reply)
}

// composeReply is the Phase 0 flow: greet on the first turn, then echo with a
// turn count. This is the seam the real state machine replaces in Phase 1.
func (s Service) composeReply(existed bool, state conversationState, msg InboundMessage) string {
	if !existed {
		name := strings.TrimSpace(msg.ContactName)
		if name == "" {
			name = "there"
		}
		return fmt.Sprintf(
			"Hi %s! 👋 This is the Xtiitch shopping assistant. Soon you'll be able to browse a shop and order right here. "+
				"Reply with a shop name to get started, or send STOP to opt out.",
			name,
		)
	}
	body := strings.TrimSpace(msg.Text)
	if body == "" {
		return "I can only read text messages for now. Try sending the name of the shop you'd like to browse."
	}
	return fmt.Sprintf("Got it (message #%d): \"%s\". Ordering opens here soon — for now you can shop at your store's Xtiitch link.", state.Turns+1, body)
}

func decodeState(raw []byte) conversationState {
	var state conversationState
	if len(raw) == 0 {
		return state
	}
	_ = json.Unmarshal(raw, &state)
	return state
}

func (s Service) now() time.Time {
	if s.clock != nil {
		return s.clock.Now()
	}
	return time.Now()
}
