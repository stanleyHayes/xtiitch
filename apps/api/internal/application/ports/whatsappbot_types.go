package ports

import (
	"time"
)

// WhatsAppSession is one sender's conversation state. State is an opaque JSON
// blob owned by the conversation engine (current step + partial order).
type WhatsAppSession struct {
	WaID       string
	BusinessID string // empty until a shop is resolved
	State      []byte // JSON
	ExpiresAt  time.Time
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
