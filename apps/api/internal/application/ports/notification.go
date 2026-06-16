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
