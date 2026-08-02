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

// PushDeviceRepository stores which mobile devices may receive a business's
// notifications. A device registers itself after the person using it grants
// notification permission, and unregisters on sign-out.
type PushDeviceRepository interface {
	// RegisterPushDevice records a device against this operator, or moves an
	// already-known token to them. Idempotent: the app re-registers on every
	// launch, because Expo may hand it a different token at any time.
	RegisterPushDevice(ctx context.Context, scope common.TenantScope, input RegisterPushDeviceInput) (PushDeviceRecord, error)
	// UnregisterPushDevice stops a device receiving anything further. Silent
	// when the token is already gone — signing out twice is not an error.
	UnregisterPushDevice(ctx context.Context, scope common.TenantScope, token string) error
	// ListPushDevices returns the operator's own registered devices, so a
	// settings screen can show where alerts are being delivered.
	ListPushDevices(ctx context.Context, scope common.TenantScope, userID common.ID) ([]PushDeviceRecord, error)
}

// RegisterPushDeviceInput is one device claiming its place on a business.
type RegisterPushDeviceInput struct {
	UserID common.ID
	Token  string
	// Platform and DeviceName are for the settings list only; delivery is
	// routed by token alone.
	Platform   string
	DeviceName string
	Now        time.Time
}

// PushDeviceRecord is a registered device as stored.
type PushDeviceRecord struct {
	TokenID    common.ID
	Token      string
	Platform   string
	DeviceName string
	LastSeenAt time.Time
	CreatedAt  time.Time
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
