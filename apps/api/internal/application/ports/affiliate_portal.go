package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliatePortalRepository interface {
	GetAffiliateDashboard(
		ctx context.Context,
		input AffiliateDashboardQuery,
	) (AffiliateDashboardRecord, error)
	ListAffiliateConversions(
		ctx context.Context,
		input AffiliateLedgerQuery,
	) ([]AffiliateConversionRecord, error)
	ListAffiliatePayouts(
		ctx context.Context,
		input AffiliateLedgerQuery,
	) ([]AffiliatePayoutRecord, error)
	ListAffiliateCampaignLinks(context.Context, common.ID) ([]AffiliateCampaignLinkRecord, error)
	CreateAffiliateCampaignLink(context.Context, CreateAffiliateCampaignLinkInput) (AffiliateCampaignLinkRecord, error)
	GetAffiliatePayoutProfile(context.Context, common.ID) (AffiliatePayoutProfileRecord, error)
	UpsertAffiliatePayoutProfile(context.Context, UpsertAffiliatePayoutProfileInput) (AffiliatePayoutProfileRecord, error)
	GetAffiliateNotificationPreferences(context.Context, common.ID) (AffiliateNotificationPreferencesRecord, error)
	UpsertAffiliateNotificationPreferences(context.Context, AffiliateNotificationPreferencesRecord) (AffiliateNotificationPreferencesRecord, error)
	ExportAffiliateConversions(context.Context, AffiliateDashboardQuery) ([]AffiliateConversionRecord, error)
	ListPartnerReferrals(context.Context, common.ID) ([]PartnerReferralRecord, error)
}

type AffiliateCampaignLinkRecord struct {
	CampaignLinkID common.ID `json:"campaign_link_id"`
	AffiliateID    common.ID `json:"affiliate_id"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug"`
	DestinationURL string    `json:"destination_url"`
	UTMCampaign    string    `json:"utm_campaign"`
	CreatedAt      time.Time `json:"created_at"`
}

type CreateAffiliateCampaignLinkInput struct {
	CampaignLinkID common.ID
	AffiliateID    common.ID
	Name           string
	Slug           string
	DestinationURL string
	UTMCampaign    string
}

type AffiliatePayoutProfileRecord struct {
	AffiliateID      common.ID `json:"affiliate_id"`
	PayoutMethod     string    `json:"payout_method"`
	AccountName      string    `json:"account_name"`
	ProviderName     string    `json:"provider_name"`
	MaskedIdentifier string    `json:"masked_identifier"`
	Status           string    `json:"status"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type UpsertAffiliatePayoutProfileInput struct {
	AffiliateID         common.ID
	PayoutMethod        string
	AccountName         string
	ProviderName        string
	EncryptedIdentifier string
	IdentifierLast4     string
}

type AffiliateNotificationPreferencesRecord struct {
	AffiliateID      common.ID `json:"affiliate_id"`
	ConversionEmails bool      `json:"conversion_emails"`
	ApprovalEmails   bool      `json:"approval_emails"`
	ReversalEmails   bool      `json:"reversal_emails"`
	PayoutEmails     bool      `json:"payout_emails"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type AffiliateDashboardQuery struct {
	AffiliateID common.ID
	From        time.Time
	To          time.Time
}

type AffiliateLedgerQuery struct {
	AffiliateID common.ID
	Cursor      *common.ID
	Limit       int
	Type        string
	Status      string
}

type AffiliateDashboardRecord struct {
	ClickCount               int64
	CustomerSignupCount      int64
	BusinessSignupCount      int64
	PaidPlanSignupCount      int64
	PurchaseCount            int64
	GrossEligibleMinor       int64
	PendingCommissionMinor   int64
	AvailableCommissionMinor int64
	PaidCommissionMinor      int64
	ReversedCommissionMinor  int64
	LifetimeEarningsMinor    int64
	ActiveReferralCount      int64
	InactiveReferralCount    int64
	NotActivatedCount        int64
	NextMilestoneThreshold   int
	NextMilestoneTitle       string
	PartnersInvitedCount     int64
}

// PartnerReferralRecord is deliberately privacy-minimal. Do not add contact,
// billing or owner fields: the Partner Program contract exposes handle + state.
type PartnerReferralRecord struct {
	Handle string `json:"handle"`
	Status string `json:"status"`
}

type AffiliateConversionRecord struct {
	ConversionID    common.ID
	ConversionType  string
	GrossMinor      int64
	CommissionMinor int64
	Status          string
	OccurredAt      time.Time
}

type AffiliatePayoutRecord struct {
	PayoutID        common.ID
	PayoutMode      string
	PayoutReference string
	ConversionCount int
	GrossMinor      int64
	CommissionMinor int64
	Status          string
	CreatedAt       time.Time
}
