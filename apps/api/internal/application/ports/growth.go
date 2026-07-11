package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliateClickRepository interface {
	RecordAffiliateClick(ctx context.Context, input RecordAffiliateClickInput) (AffiliateClickRecord, error)
	ReserveAffiliateAttribution(
		ctx context.Context,
		scope common.TenantScope,
		input ReserveAffiliateAttributionInput,
	) (AffiliateAttributionReservation, error)
}

type SponsoredPlacementRepository interface {
	ListActiveSponsoredPlacements(ctx context.Context, input ListActiveSponsoredPlacementsInput) ([]SponsoredPlacementRecord, error)
	RecordSponsoredAdEvent(ctx context.Context, input RecordSponsoredAdEventInput) (SponsoredAdEventRecord, error)
}

type ReferralRepository interface {
	ResolveReferralCode(ctx context.Context, input ResolveReferralCodeInput) (ReferralCodeRecord, error)
	ReserveReferralAttribution(
		ctx context.Context,
		scope common.TenantScope,
		input ReserveReferralAttributionInput,
	) (ReferralAttributionReservation, error)
}
