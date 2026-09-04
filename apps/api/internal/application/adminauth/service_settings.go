package adminauth

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type UpdatePlatformSettingsCommand struct {
	ActorUserID                  common.ID
	ActorRole                    admindomain.Role
	PlatformName                 string
	SupportEmail                 string
	VerificationSLAHours         int
	PayoutReviewThresholdPesewas int
	MaintenanceMode              bool
	BrandLogoURL                 string
	AIAssistantAddonEnabled      bool
	// VATRateBps is the platform VAT rate in basis points (§4.1), effective
	// immediately across all payments. 0 disables VAT.
	VATRateBps int
	UserAgent  string
	IPAddress  string
}

// UpdateMarketingFlagsCommand is a partial update of the four marketing launch
// flags. Only fields whose pointer is non-nil are written, so the admin can
// toggle a single flag without disturbing the others.
type UpdateMarketingFlagsCommand struct {
	ActorUserID     common.ID
	ActorRole       admindomain.Role
	BrowseStore     *bool
	Discover        *bool
	CreateStore     *bool
	Pricing         *bool
	AffiliateSignup *bool
	UserAgent       string
	IPAddress       string
}

// SignBrandingUploadCommand authorises an owner to obtain a signed Cloudinary
// payload for a direct browser upload of the platform brand logo.
// PublicBranding is the subset of platform settings a signed-out visitor may see:
// what the platform is called, its logo, and which marketing surfaces are live.
type PublicBranding struct {
	PlatformName   string
	BrandLogoURL   string
	MarketingFlags ports.MarketingFlags
}

// GetPublicBranding reads that subset for the unauthenticated branding endpoint.
//
// Deliberately separate from GetPlatformSettings, which is now gated: the
// marketing site and storefronts need the logo, and routing them through the
// admin read is what left the VAT rate and payout threshold reachable by any
// staff token. Naming the public path makes it a decision rather than a
// side effect.
func (s Service) GetPublicBranding(ctx context.Context) (PublicBranding, error) {
	settings, err := s.users.GetAdminPlatformSettings(ctx)
	if err != nil {
		return PublicBranding{}, err
	}
	return PublicBranding{
		PlatformName:   settings.PlatformName,
		BrandLogoURL:   settings.BrandLogoURL,
		MarketingFlags: settings.MarketingFlags,
	}, nil
}

// GetPlatformSettings reads the platform configuration.
//
// Authorised on the same permission as writing it. These values — the VAT rate,
// the payout review threshold — describe how the business runs, and its write
// counterpart has always been gated; only the read was open to any staff token.
func (s Service) GetPlatformSettings(
	ctx context.Context,
	actorRole admindomain.Role,
) (ports.AdminPlatformSettingsRecord, error) {
	if err := s.authorizePermission(ctx, actorRole, admindomain.PermissionManageSettings); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}
	return s.users.GetAdminPlatformSettings(ctx)
}

func (s Service) UpdatePlatformSettings(
	ctx context.Context,
	cmd UpdatePlatformSettingsCommand,
) (ports.AdminPlatformSettingsRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPlatformSettingsRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSettings); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	normalized, err := normalizePlatformSettings(cmd)
	if err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	settings, err := s.users.UpdateAdminPlatformSettings(ctx, normalized)
	if err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated platform settings",
		TargetType:  "admin_platform_settings",
		TargetID:    "platform",
		TargetLabel: settings.PlatformName,
		Summary:     "Operator updated platform-wide admin settings.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"support_email":                   settings.SupportEmail,
			"verification_sla_hours":          intString(settings.VerificationSLAHours),
			"payout_review_threshold_pesewas": intString(settings.PayoutReviewThresholdPesewas),
			"maintenance_mode":                boolString(settings.MaintenanceMode),
			// The VAT rate is money-critical (§4.1), so the change is audited with it.
			"vat_rate_bps": intString(settings.VATRateBps),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

// UpdateMarketingFlags applies a partial update of the marketing launch flags.
// Gated by manage_settings like the rest of the platform-settings mutations.
// Only the flags present in the command are written.
func (s Service) UpdateMarketingFlags(
	ctx context.Context,
	cmd UpdateMarketingFlagsCommand,
) (ports.AdminPlatformSettingsRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPlatformSettingsRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSettings); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}
	if cmd.BrowseStore == nil && cmd.Discover == nil && cmd.CreateStore == nil &&
		cmd.Pricing == nil && cmd.AffiliateSignup == nil {
		return ports.AdminPlatformSettingsRecord{}, authdomain.ErrInvalidInput
	}

	settings, err := s.users.UpdateAdminMarketingFlags(ctx, ports.UpdateAdminMarketingFlagsInput{
		BrowseStore:     cmd.BrowseStore,
		Discover:        cmd.Discover,
		CreateStore:     cmd.CreateStore,
		Pricing:         cmd.Pricing,
		AffiliateSignup: cmd.AffiliateSignup,
	})
	if err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated marketing launch flags",
		TargetType:  "admin_platform_settings",
		TargetID:    "platform",
		TargetLabel: settings.PlatformName,
		Summary:     "Operator changed which marketing surfaces are publicly visible.",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"browse_store": boolString(settings.MarketingFlags.BrowseStore),
			"discover":     boolString(settings.MarketingFlags.Discover),
			"create_store": boolString(settings.MarketingFlags.CreateStore),
			"pricing":      boolString(settings.MarketingFlags.Pricing),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}
