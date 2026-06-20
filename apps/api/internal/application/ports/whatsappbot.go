package ports

import (
	"context"
	"errors"
	"time"
)

// ErrOrderingUnavailable means the shop's plan does not grant online ordering, so
// the bot can browse/track but not place & pay. Mapped from the checkout gate.
var ErrOrderingUnavailable = errors.New("online ordering unavailable")

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

// BotCatalogue is the narrow read surface the bot's conversation engine needs.
// It adapts the existing storefront/order repositories to small, chat-shaped
// structs so the engine stays decoupled from the full catalogue domain. Lookups
// return ErrNotFound when the shop/order does not exist.
type BotCatalogue interface {
	ResolveShop(ctx context.Context, handle string) (BotShop, error)
	ListDesigns(ctx context.Context, businessID string) ([]BotDesign, error)
	TrackOrder(ctx context.Context, code string) (BotOrder, error)
	// PlaceStandardOrder creates a draft order and returns a Paystack payment link.
	// Reuses the storefront checkout path; returns ErrOrderingUnavailable when the
	// shop's plan lacks online_ordering. Xtiitch never holds funds — the link
	// settles to the business's subaccount.
	PlaceStandardOrder(ctx context.Context, req BotOrderRequest) (BotOrderDraft, error)
}

type BotShop struct {
	BusinessID     string
	Name           string
	Handle         string
	OnlineOrdering bool
}

type BotDesign struct {
	Title          string
	Handle         string
	FromPriceMinor int64
	Sizes          []BotSizeBand
}

type BotSizeBand struct {
	ID         string
	Label      string
	PriceMinor int64
}

type BotOrderRequest struct {
	StoreHandle   string
	DesignHandle  string
	SizeBandID    string
	CustomerName  string
	CustomerPhone string
	CustomerEmail string
}

type BotOrderDraft struct {
	OrderID          string
	AuthorizationURL string
	AmountMinor      int64
}

type BotOrder struct {
	DesignTitle string
	StoreName   string
	Status      string
	Stage       string
	Colour      string
}
