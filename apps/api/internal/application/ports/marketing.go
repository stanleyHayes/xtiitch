package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// MarketingWaitlistRepository persists and lists waitlist leads captured from the
// public marketing site. Leads are platform-level (not tenant-scoped).
type MarketingWaitlistRepository interface {
	CreateWaitlistLead(ctx context.Context, input CreateWaitlistLeadInput) (WaitlistLeadRecord, error)
	ListWaitlistLeads(ctx context.Context, limit int) ([]WaitlistLeadRecord, error)
}

type CreateWaitlistLeadInput struct {
	LeadID    common.ID
	Name      string
	Business  string
	Phone     string
	Email     string
	City      string
	Message   string
	Source    string
	UserAgent string
}

type WaitlistLeadRecord struct {
	LeadID    common.ID
	Name      string
	Business  string
	Phone     string
	Email     string
	City      string
	Message   string
	Source    string
	UserAgent string
	CreatedAt time.Time
}
