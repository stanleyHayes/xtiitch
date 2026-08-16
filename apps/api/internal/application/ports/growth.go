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

type AffiliateApplicationRepository interface {
	AffiliateCodeExists(ctx context.Context, code string) (bool, error)
	SubmitAffiliateApplication(
		ctx context.Context,
		input SubmitAffiliateApplicationInput,
	) (AffiliateApplicationRecord, error)
}

type AffiliateSignupRepository interface {
	RecordAffiliateSignup(
		ctx context.Context,
		input RecordAffiliateSignupInput,
	) (AffiliateSignupRecord, error)
}

type SubscriptionAffiliateAttributionRepository interface {
	ReserveFirstPaidPlanAttribution(
		ctx context.Context,
		input ReserveFirstPaidPlanAttributionInput,
	) (AffiliatePlanAttributionReservation, error)
	FinalizeFirstPaidPlanAttribution(
		ctx context.Context,
		input FinalizeFirstPaidPlanAttributionInput,
	) (AffiliatePlanConversionRecord, error)
	VoidFirstPaidPlanAttribution(
		ctx context.Context,
		businessID common.ID,
		paymentReference string,
		reason string,
	) error
	ApplyFirstPaidPlanProviderEvent(
		ctx context.Context,
		input ApplyFirstPaidPlanProviderEventInput,
	) error
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
