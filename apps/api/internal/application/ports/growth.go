package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliateClickRepository interface {
	RecordAffiliateClick(ctx context.Context, input RecordAffiliateClickInput) (AffiliateClickRecord, error)
	ReserveAffiliateAttribution(ctx context.Context, scope common.TenantScope, input ReserveAffiliateAttributionInput) (AffiliateAttributionReservation, error)
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

type ReserveAffiliateAttributionInput struct {
	ReservationID common.ID
	BusinessID    common.ID
	OrderID       common.ID
	Code          string
	ClickID       common.ID
	VisitorID     string
	GrossMinor    int64
}

type AffiliateAttributionReservation struct {
	ReservationID    common.ID
	AffiliateID      common.ID
	AffiliateClickID *common.ID
	BusinessID       common.ID
	OrderID          common.ID
	GrossMinor       int64
	CommissionMinor  int64
}
