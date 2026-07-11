package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminPreferencesRecord struct {
	UserID             common.ID
	Timezone           string
	PhoneNumber        string
	NotifyEmail        bool
	NotifySMS          bool
	AlertVerifications bool
	AlertMoneyRails    bool
	AlertSubscriptions bool
	AlertPromotions    bool
	AlertRisk          bool
	AlertSupport       bool
	DailyDigestTime    string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
type UpdateAdminPreferencesInput struct {
	UserID             common.ID
	Timezone           string
	PhoneNumber        string
	NotifyEmail        bool
	NotifySMS          bool
	AlertVerifications bool
	AlertMoneyRails    bool
	AlertSubscriptions bool
	AlertPromotions    bool
	AlertRisk          bool
	AlertSupport       bool
	DailyDigestTime    string
}
type AdminPlatformSettingsRecord struct {
	PlatformName                 string
	SupportEmail                 string
	VerificationSLAHours         int
	PayoutReviewThresholdPesewas int
	MaintenanceMode              bool
	BrandLogoURL                 string
	MarketingFlags               MarketingFlags
	// AIAssistantAddonEnabled is the platform master switch for the paid AI writing
	// add-on: when false it cannot be purchased or renewed anywhere, overriding the
	// per-deployment capability gate.
	AIAssistantAddonEnabled bool
	UpdatedAt               time.Time
}

// MarketingFlags gate whether each not-yet-launched marketing surface is shown.
// All default false during the pre-launch / waitlist period; an owner reveals
// each one from the admin console without a redeploy.
type MarketingFlags struct {
	BrowseStore bool
	Discover    bool
	CreateStore bool
	Pricing     bool
}
type UpdateAdminPlatformSettingsInput struct {
	PlatformName                 string
	SupportEmail                 string
	VerificationSLAHours         int
	PayoutReviewThresholdPesewas int
	MaintenanceMode              bool
	BrandLogoURL                 string
	AIAssistantAddonEnabled      bool
}

// UpdateAdminMarketingFlagsInput is a partial update of the four marketing
// launch flags: only fields whose matching *Set pointer is non-nil are written.
type UpdateAdminMarketingFlagsInput struct {
	BrowseStore *bool
	Discover    *bool
	CreateStore *bool
	Pricing     *bool
}
