package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliateClickRepository interface {
	RecordAffiliateClick(ctx context.Context, input RecordAffiliateClickInput) (AffiliateClickRecord, error)
}

type RecordAffiliateClickInput struct {
	ClickID     common.ID
	Code        string
	VisitorID   string
	LandingURL  string
	ReferrerURL string
	UserAgent   string
	IPHash      string
}

type AffiliateClickRecord struct {
	ClickID     common.ID
	AffiliateID common.ID
	Code        string
	ClickedAt   time.Time
}
