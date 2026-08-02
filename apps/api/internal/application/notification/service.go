// Package notifyapp exposes a business's notification log — the read side of the
// message outbox. Messages are produced transactionally inside the state changes
// that cause them (in the postgres adapter), so there is no "send" use case here;
// the platform transport drains the outbox out of band.
package notifyapp

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service struct {
	messages ports.NotificationRepository
	devices  ports.PushDeviceRepository
}

type Dependencies struct {
	Messages ports.NotificationRepository
	Devices  ports.PushDeviceRepository
}

func NewService(deps Dependencies) Service {
	return Service{messages: deps.Messages, devices: deps.Devices}
}

// ListMessages returns the business's notification log, most recent first.
func (s Service) ListMessages(ctx context.Context, scope common.TenantScope) ([]ports.MessageSummary, error) {
	return s.messages.ListMessages(ctx, scope)
}

// UnreadOwnerAlerts is how many new-order alerts this operator has not seen.
// Drives the dashboard badge, which is what turns the message log from an
// archive into something that tells an owner an order just arrived.
func (s Service) UnreadOwnerAlerts(ctx context.Context, scope common.TenantScope, userID common.ID) (int, error) {
	if scope.IsZero() || userID.IsZero() {
		return 0, nil
	}
	return s.messages.CountUnreadOwnerAlerts(ctx, scope, userID)
}

// MarkRead moves this operator's read marker to now.
func (s Service) MarkRead(ctx context.Context, scope common.TenantScope, userID common.ID) error {
	if scope.IsZero() || userID.IsZero() {
		return nil
	}
	return s.messages.MarkNotificationsRead(ctx, scope, userID, time.Now().UTC())
}
