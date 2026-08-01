package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// NotificationRepository is the read side of the message outbox: a business's
// own log of the messages its orders have produced. Producing messages is not
// here — it happens transactionally inside the state changes that cause them.
type NotificationRepository interface {
	ListMessages(ctx context.Context, scope common.TenantScope) ([]MessageSummary, error)
	// CountUnreadOwnerAlerts returns how many owner-directed alerts (a new order
	// arriving) have been recorded since this operator last opened the messages
	// view. Derived from the read timestamp rather than a per-message read flag,
	// so a new order never fans out a row per operator.
	CountUnreadOwnerAlerts(ctx context.Context, scope common.TenantScope, userID common.ID) (int, error)
	// MarkNotificationsRead moves this operator's read marker to now. Idempotent:
	// opening the view twice is not an error.
	MarkNotificationsRead(ctx context.Context, scope common.TenantScope, userID common.ID, now time.Time) error
}

// MessageSummary is one row of a business's notification log.
type MessageSummary struct {
	MessageID common.ID
	Channel   string
	Kind      string
	Recipient string
	Status    string
	Attempts  int
	CreatedAt time.Time
}
