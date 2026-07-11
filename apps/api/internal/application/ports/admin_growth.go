package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminPromotionRecord struct {
	PromotionID           common.ID
	BusinessID            *common.ID
	BusinessName          string
	BusinessHandle        string
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	RedemptionCount       int
	DiscountRedeemedMinor int64
	RecentRedemptions     []AdminPromotionRedemptionRecord
	CreatedAt             time.Time
	UpdatedAt             time.Time
}
type AdminPromotionRedemptionRecord struct {
	PromotionRedemptionID common.ID
	PromotionID           common.ID
	BusinessID            common.ID
	OrderID               *common.ID
	CustomerID            *common.ID
	CustomerName          string
	DiscountMinor         int64
	Status                string
	RedeemedAt            *time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
}
type CreateAdminPromotionInput struct {
	PromotionID           common.ID
	BusinessID            *common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	ActorAdminUser        common.ID
}
type UpdateAdminPromotionInput struct {
	PromotionID           common.ID
	BusinessID            *common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	ActorAdminUser        common.ID
}
type ArchiveAdminPromotionInput struct {
	PromotionID    common.ID
	ActorAdminUser common.ID
}
type AdminAdCampaignRecord struct {
	CampaignID      common.ID
	BusinessID      common.ID
	BusinessName    string
	BusinessHandle  string
	PlacementType   string
	TargetRefID     string
	TargetLabel     string
	Headline        string
	Description     string
	Status          string
	PricingModel    string
	BudgetMinor     int64
	SpendMinor      int64
	DailyCapMinor   *int64
	StartsAt        time.Time
	EndsAt          time.Time
	ImpressionCount int
	ClickCount      int
	ClickRateBPS    int
	ReviewNote      string
	RecentPayments  []AdminAdCampaignPaymentRecord
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
type AdminAdCampaignPaymentRecord struct {
	PaymentID         common.ID
	CampaignID        common.ID
	BusinessID        common.ID
	Provider          string
	ProviderReference string
	PaymentURL        string
	AmountMinor       int64
	Currency          string
	Status            string
	PaidAt            *time.Time
	FailedAt          *time.Time
	FailureReason     string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}
type AdminAdCampaignPaymentIntentRecord struct {
	CampaignID   common.ID
	BusinessID   common.ID
	BusinessName string
	OwnerEmail   string
	Headline     string
	BudgetMinor  int64
	PaidMinor    int64
	DueMinor     int64
	OpenPayment  *AdminAdCampaignPaymentRecord
}
type CreateAdminAdCampaignInput struct {
	CampaignID     common.ID
	BusinessID     common.ID
	PlacementType  string
	TargetRefID    string
	Headline       string
	Description    string
	Status         string
	PricingModel   string
	BudgetMinor    int64
	DailyCapMinor  *int64
	StartsAt       time.Time
	EndsAt         time.Time
	ReviewNote     string
	ActorAdminUser common.ID
}
type UpdateAdminAdCampaignInput struct {
	CampaignID     common.ID
	BusinessID     common.ID
	PlacementType  string
	TargetRefID    string
	Headline       string
	Description    string
	Status         string
	PricingModel   string
	BudgetMinor    int64
	DailyCapMinor  *int64
	StartsAt       time.Time
	EndsAt         time.Time
	ReviewNote     string
	ActorAdminUser common.ID
}
type ArchiveAdminAdCampaignInput struct {
	CampaignID     common.ID
	ActorAdminUser common.ID
}
type CreateAdminAdCampaignPaymentInput struct {
	PaymentID         common.ID
	CampaignID        common.ID
	BusinessID        common.ID
	ProviderReference string
	PaymentURL        string
	AmountMinor       int64
	Currency          string
	ActorAdminUser    common.ID
}
type AdminAffiliateRecord struct {
	AffiliateID      common.ID
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
type CreateAdminAffiliateInput struct {
	AffiliateID      common.ID
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	ActorAdminUser   common.ID
}
type UpdateAdminAffiliateInput struct {
	AffiliateID      common.ID
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	ActorAdminUser   common.ID
}
type ArchiveAdminAffiliateInput struct {
	AffiliateID    common.ID
	ActorAdminUser common.ID
}
type AdminAffiliateAttributionRecord struct {
	AffiliateID             common.ID
	Code                    string
	DisplayName             string
	ClickCount              int64
	ConversionCount         int64
	PendingConversionCount  int64
	ApprovedConversionCount int64
	SettledConversionCount  int64
	ReversedConversionCount int64
	GrossMinor              int64
	CommissionMinor         int64
	RecentConversions       []AdminAffiliateConversionRecord
	RecentPayouts           []AdminAffiliatePayoutRecord
	LastActivityAt          *time.Time
}
type AdminAffiliateConversionRecord struct {
	ConversionID     common.ID
	AffiliateID      common.ID
	BusinessID       common.ID
	BusinessName     string
	OrderID          common.ID
	GrossMinor       int64
	CommissionMinor  int64
	Status           string
	AttributionModel string
	HoldUntil        *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
type UpdateAdminAffiliateConversionStatusInput struct {
	ConversionID   common.ID
	Status         string
	Reason         string
	ActorAdminUser common.ID
}
type AdminAffiliatePayoutRecord struct {
	PayoutBatchID   common.ID
	AffiliateID     common.ID
	DisplayName     string
	PayoutMode      string
	PayoutReference string
	ConversionCount int
	GrossMinor      int64
	CommissionMinor int64
	Status          string
	Notes           string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
type CreateAdminAffiliatePayoutInput struct {
	PayoutBatchID   common.ID
	AffiliateID     common.ID
	PayoutReference string
	Notes           string
	ActorAdminUser  common.ID
}
type AdminReferralProgrammeRecord struct {
	ProgrammeID             common.ID
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	RecentCodes             []AdminReferralCodeRecord
	CreatedAt               time.Time
	UpdatedAt               time.Time
}
type AdminReferralCodeRecord struct {
	ReferralCodeID  common.ID
	ProgrammeID     common.ID
	BusinessID      *common.ID
	BusinessName    string
	BusinessHandle  string
	OwnerType       string
	OwnerBusinessID *common.ID
	OwnerCustomerID *common.ID
	OwnerLabel      string
	Code            string
	Status          string
	ReferralCount   int
	QualifiedCount  int
	RewardedCount   int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
type CreateAdminReferralProgrammeInput struct {
	ProgrammeID             common.ID
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	ActorAdminUser          common.ID
}
type UpdateAdminReferralProgrammeInput struct {
	ProgrammeID             common.ID
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	ActorAdminUser          common.ID
}
type ArchiveAdminReferralProgrammeInput struct {
	ProgrammeID    common.ID
	ActorAdminUser common.ID
}
type CreateAdminReferralCodeInput struct {
	ReferralCodeID common.ID
	ProgrammeID    common.ID
	BusinessID     *common.ID
	OwnerType      string
	Code           string
	Status         string
	ActorAdminUser common.ID
}
type IssueAdminReferralRewardsInput struct {
	ActorAdminUser common.ID
	Limit          int
}
type AdminReferralRewardIssueRecord struct {
	ReferralCount         int
	RewardCount           int
	VoucherCount          int
	CommissionRebateCount int
	TotalRewardMinor      int64
	IssuedAt              time.Time
}
