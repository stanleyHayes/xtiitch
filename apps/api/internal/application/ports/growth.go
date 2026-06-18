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

type SponsoredPlacementRepository interface {
	ListActiveSponsoredPlacements(ctx context.Context, input ListActiveSponsoredPlacementsInput) ([]SponsoredPlacementRecord, error)
	RecordSponsoredAdEvent(ctx context.Context, input RecordSponsoredAdEventInput) (SponsoredAdEventRecord, error)
}

type ReferralRepository interface {
	ResolveReferralCode(ctx context.Context, input ResolveReferralCodeInput) (ReferralCodeRecord, error)
	ReserveReferralAttribution(ctx context.Context, scope common.TenantScope, input ReserveReferralAttributionInput) (ReferralAttributionReservation, error)
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

type ListActiveSponsoredPlacementsInput struct {
	Limit int
}

type SponsoredPlacementRecord struct {
	CampaignID     common.ID
	BusinessID     common.ID
	BusinessName   string
	BusinessHandle string
	PlacementType  string
	TargetLabel    string
	Headline       string
	Description    string
	StoreHandle    string
	DesignHandle   string
	ImageURL       string
	StartsAt       time.Time
	EndsAt         time.Time
}

type RecordSponsoredAdEventInput struct {
	EventID     common.ID
	CampaignID  common.ID
	EventType   string
	VisitorID   string
	PageURL     string
	ReferrerURL string
	UserAgent   string
	IPHash      string
}

type SponsoredAdEventRecord struct {
	EventID    common.ID
	CampaignID common.ID
	EventType  string
	OccurredAt time.Time
	Deduped    bool
}

type ResolveReferralCodeInput struct {
	Code string
}

type ReferralCodeRecord struct {
	ReferralCodeID       common.ID
	ReferralProgrammeID  common.ID
	BusinessID           *common.ID
	OwnerType            string
	OwnerCustomerID      *common.ID
	OwnerBusinessID      *common.ID
	Code                 string
	Title                string
	Audience             string
	ReferrerRewardKind   string
	RefereeRewardKind    string
	RewardType           string
	RewardValue          int64
	MaxRewardMinor       *int64
	QualifyingOrderMinor int64
	RewardHoldDays       int
	StartsAt             *time.Time
	EndsAt               *time.Time
	Status               string
}

type ReserveReferralAttributionInput struct {
	ReferralID        common.ID
	BusinessID        common.ID
	OrderID           common.ID
	RefereeCustomerID common.ID
	RefereeEmail      string
	RefereePhone      string
	Code              string
	GrossMinor        int64
}

type ReferralAttributionReservation struct {
	ReferralID          common.ID
	ReferralProgrammeID common.ID
	ReferralCodeID      common.ID
	BusinessID          common.ID
	OrderID             common.ID
	RefereeCustomerID   common.ID
	GrossMinor          int64
	Status              string
}
