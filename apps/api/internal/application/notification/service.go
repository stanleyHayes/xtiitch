// Package notifyapp exposes a business's notification log — the read side of the
// message outbox. Messages are produced transactionally inside the state changes
// that cause them (in the postgres adapter), so there is no "send" use case here;
// the platform transport drains the outbox out of band.
package notifyapp

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service struct {
	messages ports.NotificationRepository
}

type Dependencies struct {
	Messages ports.NotificationRepository
}

func NewService(deps Dependencies) Service {
	return Service{messages: deps.Messages}
}

// ListMessages returns the business's notification log, most recent first.
func (s Service) ListMessages(ctx context.Context, scope common.TenantScope) ([]ports.MessageSummary, error) {
	return s.messages.ListMessages(ctx, scope)
}
