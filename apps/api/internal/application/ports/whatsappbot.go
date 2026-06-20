package ports

import (
	"context"
	"time"
)

// WhatsAppSessionRepository persists the per-sender conversation state for the
// inbound bot. Sessions are global (keyed by the sender's WhatsApp id) and carry
// a TTL so abandoned chats restart cleanly.
type WhatsAppSessionRepository interface {
	// GetSession returns the live (non-expired) session for a sender, if any.
	GetSession(ctx context.Context, waID string) (WhatsAppSession, bool, error)
	// SaveSession upserts the session (create or update by wa_id).
	SaveSession(ctx context.Context, session WhatsAppSession) error
	// DeleteSession ends a conversation (e.g. on STOP or completion).
	DeleteSession(ctx context.Context, waID string) error
}

// WhatsAppSession is one sender's conversation state. State is an opaque JSON
// blob owned by the conversation engine (current step + partial order).
type WhatsAppSession struct {
	WaID       string
	BusinessID string // empty until a shop is resolved
	State      []byte // JSON
	ExpiresAt  time.Time
}

// WhatsAppDedupeStore records processed inbound message ids so Meta's webhook
// retries are ignored.
type WhatsAppDedupeStore interface {
	// MarkProcessed records the message id and reports whether it was already
	// seen. The check-and-record is atomic (insert-on-conflict).
	MarkProcessed(ctx context.Context, messageID string) (alreadySeen bool, err error)
}

// WhatsAppSender sends outbound replies via the WhatsApp Cloud API. A dev
// implementation logs instead of calling Meta when credentials are unset.
type WhatsAppSender interface {
	SendText(ctx context.Context, toWaID, body string) error
}
