package adminauth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	minPasswordLength = 8
	maxPasswordLength = 72
	accessTokenTTL    = 15 * time.Minute
	refreshTokenTTL   = 30 * 24 * time.Hour

	// Admin password login lockout: stricter than the business one because an
	// admin compromise is a platform-wide RLS bypass.
	adminMaxFailedLoginAttempts = 5
	adminLoginLockoutDuration   = 15 * time.Minute

	// defaultRenewalRepayURL is the existing business billing/onboarding flow the
	// one-tap re-pay call to action links to. It already authorizes and charges,
	// so the reminder never builds a new charge endpoint — it only points here.
	defaultRenewalRepayURL = "https://business.xtiitch.com/onboarding/billing"
)

// SystemActorUserID is the locked, non-login admin identity (migration 000112)
// the /v1/internal/* scheduler endpoints act as. The sweep service methods
// require a real admin_users row — the audit insert joins it for the actor
// email and the billing/event tables reference it by foreign key — so the
// worker's token-authenticated calls are attributed to this system actor
// rather than impersonating a human admin. It can never authenticate:
// is_active = false and its password hash is not a bcrypt hash.
const SystemActorUserID = common.ID("00000000-0000-0000-0000-000000000001")

type Service struct {
	users         ports.AdminUserRepository
	sessions      ports.AdminSessionRepository
	audits        ports.AdminAuditRepository
	businesses    ports.AdminBusinessRepository
	media         ports.MediaStore
	payments      ports.PaymentProvider
	passwords     ports.PasswordHasher
	accessTokens  ports.AdminTokenIssuer
	refreshTokens ports.RefreshTokenIssuer
	ids           ports.IDGenerator
	clock         ports.Clock
	readiness     AdminLaunchReadinessConfig
	// whatsAppEnabled is true only when the WhatsApp Cloud credentials required to
	// actually SEND customer OTPs are configured (mirrors buildCustomerOTPDelivery).
	whatsAppEnabled bool
	// smsEnabled is true when SMS (Arkesel) is configured to send OTPs. Phone-based
	// sign-in works when EITHER SMS or WhatsApp is enabled (see PhoneOTPEnabled),
	// so a storefront gates its phone sign-in on that, not on WhatsApp alone.
	smsEnabled bool
	// renewalRepayURL is the business billing/onboarding flow that the one-tap
	// re-pay reminder links to. It already authorizes and charges, so reminders
	// only point here rather than building a new charge endpoint.
	renewalRepayURL string
	// planChanges applies subscription downgrades that were scheduled for the end
	// of the paid period (see auth.ChangeSubscriptionPlan). The recurring sweep
	// runs it before charging so a downgraded subscription renews at the new plan.
	// Optional; nil disables the step.
	planChanges PlanChangeApplier
	// settlementSyncer refreshes stores' mirrored Paystack settlements for the
	// operator/worker sync endpoint (§3.3). Optional; nil makes the endpoint
	// fail closed, like the other unset dependencies.
	settlementSyncer SettlementSyncer
	// emails delivers the email half of §13.3 renewal reminders (the SMS half
	// goes through the notification outbox). Nil-safe: with no sender configured
	// the reminder sweep still enqueues SMS and counts the skipped emails.
	emails ports.EmailSender
	// vatRates reads the live admin-editable VAT rate (§4.1) at charge time;
	// vatRateBps is the configured seed/fallback used when no reader is wired or
	// the read fails. vatInclusive mirrors the activation path's treatment.
	vatRates     VATRateReader
	vatRateBps   int
	vatInclusive bool
}

// PlanChangeApplier applies subscription plan changes scheduled to take effect at
// the end of the paid period — deferred downgrades recorded by
// auth.ChangeSubscriptionPlan. It is satisfied by the business identity repository
// and invoked from the recurring sweep so downgrades land exactly when the paid
// period ends, right before the renewal charge.
type PlanChangeApplier interface {
	ApplyDuePlanChanges(ctx context.Context) (int, error)
}

type Dependencies struct {
	Users         ports.AdminUserRepository
	Sessions      ports.AdminSessionRepository
	Audits        ports.AdminAuditRepository
	Businesses    ports.AdminBusinessRepository
	Media         ports.MediaStore
	Payments      ports.PaymentProvider
	Passwords     ports.PasswordHasher
	AccessTokens  ports.AdminTokenIssuer
	RefreshTokens ports.RefreshTokenIssuer
	IDs           ports.IDGenerator
	Clock         ports.Clock
	Readiness     AdminLaunchReadinessConfig
	// WhatsAppEnabled reflects whether WhatsApp Cloud credentials are configured
	// to actually send customer OTPs (see buildCustomerOTPDelivery).
	WhatsAppEnabled bool
	// SMSEnabled reflects whether SMS (Arkesel) is configured to send OTPs.
	SMSEnabled bool
	// RenewalRepayURL overrides the business billing/onboarding URL the renewal
	// reminder's one-tap re-pay call to action links to. Empty uses the canonical
	// defaultRenewalRepayURL.
	RenewalRepayURL string
	// PlanChanges applies subscription downgrades scheduled for period end. The
	// recurring sweep invokes it before charging renewals so a downgraded
	// subscription bills the new plan. Optional; nil disables the step.
	PlanChanges PlanChangeApplier
	// SettlementSyncer refreshes stores' mirrored Paystack settlements (§3.3)
	// for the operator/worker settlement-sync endpoint. Optional; nil makes that
	// endpoint fail closed.
	SettlementSyncer SettlementSyncer
	// Emails delivers the email half of §13.3 renewal reminders (Resend, same
	// synchronous sender as the auth flows — the notification outbox has no
	// email channel). Nil-safe: nil skips the email half only.
	Emails ports.EmailSender
	// VAT applied to subscription charges, matching the activation path.
	// VATRates reads the live admin-editable rate from the platform settings
	// (§4.1); VATRateBps is only the seed/fallback default, used when no reader
	// is wired or the read fails. VATInclusive=false adds VAT at checkout.
	VATRates     VATRateReader
	VATRateBps   int
	VATInclusive bool
}

func NewService(deps Dependencies) Service {
	renewalRepayURL := strings.TrimSpace(deps.RenewalRepayURL)
	if renewalRepayURL == "" {
		renewalRepayURL = defaultRenewalRepayURL
	}
	return Service{
		users:            deps.Users,
		sessions:         deps.Sessions,
		audits:           deps.Audits,
		businesses:       deps.Businesses,
		media:            deps.Media,
		payments:         deps.Payments,
		passwords:        deps.Passwords,
		accessTokens:     deps.AccessTokens,
		refreshTokens:    deps.RefreshTokens,
		ids:              deps.IDs,
		clock:            deps.Clock,
		readiness:        deps.Readiness,
		whatsAppEnabled:  deps.WhatsAppEnabled,
		smsEnabled:       deps.SMSEnabled,
		renewalRepayURL:  renewalRepayURL,
		planChanges:      deps.PlanChanges,
		settlementSyncer: deps.SettlementSyncer,
		emails:           deps.Emails,
		vatRates:         deps.VATRates,
		vatRateBps:       deps.VATRateBps,
		vatInclusive:     deps.VATInclusive,
	}
}

// WhatsAppEnabled reports whether the WhatsApp Cloud credentials required to send
// customer sign-in OTPs are configured. The public branding endpoint surfaces this
// so storefronts can gate the WhatsApp sign-in tab.
func (s Service) WhatsAppEnabled() bool {
	return s.whatsAppEnabled
}

// SMSEnabled reports whether SMS (Arkesel) is configured to send OTPs.
func (s Service) SMSEnabled() bool {
	return s.smsEnabled
}

// PhoneOTPEnabled reports whether a code can be delivered to a phone at all — over
// SMS OR WhatsApp. A storefront/dashboard gates its phone sign-in on this so the
// option is shown whenever it works, not only when WhatsApp is configured.
func (s Service) PhoneOTPEnabled() bool {
	return s.smsEnabled || s.whatsAppEnabled
}

type issueSessionInput struct {
	AdminUserID common.ID
	Email       string
	DisplayName string
	Role        admindomain.Role
	UserAgent   string
	IPAddress   string
}

type auditInput struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Action      string
	TargetType  string
	TargetID    string
	TargetLabel string
	Summary     string
	Severity    admindomain.AuditSeverity
	Metadata    map[string]string
	IPAddress   string
	UserAgent   string
}

func (s Service) recordAudit(ctx context.Context, input auditInput) error {
	if s.audits == nil {
		return nil
	}
	if input.ActorUserID.IsZero() || !input.ActorRole.Valid() {
		return authdomain.ErrInvalidInput
	}

	action := strings.TrimSpace(input.Action)
	summary := strings.TrimSpace(input.Summary)
	if action == "" || summary == "" {
		return authdomain.ErrInvalidInput
	}

	severity := input.Severity
	if severity == "" {
		severity = admindomain.AuditSeverityInfo
	}
	if !severity.Valid() {
		return authdomain.ErrInvalidInput
	}

	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]string{}
	}

	_, err := s.audits.CreateAdminAuditEvent(ctx, ports.CreateAdminAuditEventInput{
		AuditEventID: s.ids.NewID(),
		ActorUserID:  input.ActorUserID,
		ActorRole:    input.ActorRole,
		Action:       action,
		TargetType:   strings.TrimSpace(input.TargetType),
		TargetID:     strings.TrimSpace(input.TargetID),
		TargetLabel:  strings.TrimSpace(input.TargetLabel),
		Summary:      summary,
		Severity:     severity,
		Metadata:     metadata,
		IPAddress:    strings.TrimSpace(input.IPAddress),
		UserAgent:    strings.TrimSpace(input.UserAgent),
	})
	return err
}

func (s Service) issueSession(ctx context.Context, input issueSessionInput) (AuthResult, error) {
	now := s.clock.Now()
	accessExpiresAt := now.Add(accessTokenTTL)
	refreshExpiresAt := now.Add(refreshTokenTTL)

	accessToken, err := s.accessTokens.IssueAdminAccessToken(ctx, ports.AdminAccessTokenInput{
		Subject:   input.AdminUserID,
		Role:      input.Role,
		IssuedAt:  now,
		ExpiresAt: accessExpiresAt,
	})
	if err != nil {
		return AuthResult{}, err
	}

	refreshToken, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return AuthResult{}, err
	}

	if err := s.sessions.Create(ctx, ports.CreateAdminSessionInput{
		SessionID:        s.ids.NewID(),
		AdminUserID:      input.AdminUserID,
		RefreshTokenHash: s.refreshTokens.HashRefreshToken(refreshToken),
		UserAgent:        strings.TrimSpace(input.UserAgent),
		IPAddress:        strings.TrimSpace(input.IPAddress),
		ExpiresAt:        refreshExpiresAt,
	}); err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		AdminUserID:      input.AdminUserID,
		Email:            input.Email,
		DisplayName:      input.DisplayName,
		Role:             input.Role,
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  accessExpiresAt,
		RefreshExpiresAt: refreshExpiresAt,
	}, nil
}

func normalizeBootstrap(cmd BootstrapAdminCommand) (string, string, admindomain.Role, error) {
	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return "", "", "", errors.Join(authdomain.ErrInvalidInput, err)
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" {
		displayName = "Xtiitch Owner"
	}

	role := cmd.Role
	if role == "" {
		role = admindomain.RoleOwner
	}
	if !role.Valid() {
		return "", "", "", authdomain.ErrInvalidInput
	}

	if len(cmd.Password) < minPasswordLength || len(cmd.Password) > maxPasswordLength {
		return "", "", "", authdomain.ErrInvalidInput
	}

	return email, displayName, role, nil
}

type normalizedUserCreation struct {
	DisplayName string
	Email       string
	Password    string
	Role        admindomain.Role
}

func normalizeUserCreation(cmd CreateUserCommand) (normalizedUserCreation, error) {
	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return normalizedUserCreation{}, errors.Join(authdomain.ErrInvalidInput, err)
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" || !cmd.Role.Valid() {
		return normalizedUserCreation{}, authdomain.ErrInvalidInput
	}
	if len(cmd.Password) < minPasswordLength || len(cmd.Password) > maxPasswordLength {
		return normalizedUserCreation{}, authdomain.ErrInvalidInput
	}

	return normalizedUserCreation{
		DisplayName: displayName,
		Email:       email,
		Password:    cmd.Password,
		Role:        cmd.Role,
	}, nil
}

func normalizePreferences(cmd UpdatePreferencesCommand) (ports.UpdateAdminPreferencesInput, error) {
	timezone := strings.TrimSpace(cmd.Timezone)
	if timezone == "" {
		timezone = "Africa/Accra"
	}
	if len(timezone) > 80 {
		return ports.UpdateAdminPreferencesInput{}, authdomain.ErrInvalidInput
	}

	phoneNumber := strings.TrimSpace(cmd.PhoneNumber)
	if len(phoneNumber) > 32 {
		return ports.UpdateAdminPreferencesInput{}, authdomain.ErrInvalidInput
	}

	digestTime := strings.TrimSpace(cmd.DailyDigestTime)
	if digestTime == "" {
		digestTime = "08:00"
	}
	if _, err := time.Parse("15:04", digestTime); err != nil {
		return ports.UpdateAdminPreferencesInput{}, authdomain.ErrInvalidInput
	}

	return ports.UpdateAdminPreferencesInput{
		UserID:             cmd.ActorUserID,
		Timezone:           timezone,
		PhoneNumber:        phoneNumber,
		NotifyEmail:        cmd.NotifyEmail,
		NotifySMS:          cmd.NotifySMS,
		AlertVerifications: cmd.AlertVerifications,
		AlertMoneyRails:    cmd.AlertMoneyRails,
		AlertSubscriptions: cmd.AlertSubscriptions,
		AlertPromotions:    cmd.AlertPromotions,
		AlertRisk:          cmd.AlertRisk,
		AlertSupport:       cmd.AlertSupport,
		DailyDigestTime:    digestTime,
	}, nil
}

func normalizePlatformSettings(
	cmd UpdatePlatformSettingsCommand,
) (ports.UpdateAdminPlatformSettingsInput, error) {
	platformName := strings.TrimSpace(cmd.PlatformName)
	if platformName == "" || len(platformName) > 80 {
		return ports.UpdateAdminPlatformSettingsInput{}, authdomain.ErrInvalidInput
	}

	supportEmail, err := normalizeEmail(cmd.SupportEmail)
	if err != nil {
		return ports.UpdateAdminPlatformSettingsInput{}, errors.Join(authdomain.ErrInvalidInput, err)
	}

	if cmd.VerificationSLAHours < 1 || cmd.VerificationSLAHours > 168 {
		return ports.UpdateAdminPlatformSettingsInput{}, authdomain.ErrInvalidInput
	}
	if cmd.PayoutReviewThresholdPesewas < 0 {
		return ports.UpdateAdminPlatformSettingsInput{}, authdomain.ErrInvalidInput
	}
	// §4.1: the VAT rate is a basis-points percentage — 0 (disabled) to 10000.
	if cmd.VATRateBps < 0 || cmd.VATRateBps > 10000 {
		return ports.UpdateAdminPlatformSettingsInput{}, authdomain.ErrInvalidInput
	}

	brandLogoURL, err := normalizeBrandLogoURL(cmd.BrandLogoURL)
	if err != nil {
		return ports.UpdateAdminPlatformSettingsInput{}, err
	}

	return ports.UpdateAdminPlatformSettingsInput{
		PlatformName:                 platformName,
		SupportEmail:                 supportEmail,
		VerificationSLAHours:         cmd.VerificationSLAHours,
		PayoutReviewThresholdPesewas: cmd.PayoutReviewThresholdPesewas,
		MaintenanceMode:              cmd.MaintenanceMode,
		BrandLogoURL:                 brandLogoURL,
		AIAssistantAddonEnabled:      cmd.AIAssistantAddonEnabled,
		VATRateBps:                   cmd.VATRateBps,
	}, nil
}

// normalizeBrandLogoURL allows clearing the logo (empty) or an https URL only.
// Uploads return a Cloudinary https secure_url, so we reject other schemes to
// avoid mixed-content and javascript: style values reaching every storefront.
func normalizeBrandLogoURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	if len(trimmed) > 512 || !strings.HasPrefix(trimmed, "https://") {
		return "", authdomain.ErrInvalidInput
	}
	return trimmed, nil
}

func statusForBusinessVerificationDecision(decision BusinessVerificationDecision) (business.VerificationStatus, error) {
	switch decision {
	case BusinessVerificationDecisionApproved:
		return business.VerificationStatusVerified, nil
	case BusinessVerificationDecisionRejected:
		return business.VerificationStatusRejected, nil
	case BusinessVerificationDecisionHeld:
		return business.VerificationStatusPending, nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

func verificationDecisionAction(decision BusinessVerificationDecision) string {
	switch decision {
	case BusinessVerificationDecisionApproved:
		return "Approved business verification"
	case BusinessVerificationDecisionRejected:
		return "Rejected business verification"
	default:
		return "Held business verification"
	}
}

func verificationDecisionSummary(decision BusinessVerificationDecision, note string) string {
	base := "Operator held the business verification for follow-up."
	switch decision {
	case BusinessVerificationDecisionApproved:
		base = "Operator approved the business verification."
	case BusinessVerificationDecisionRejected:
		base = "Operator rejected the business verification."
	}
	if note == "" {
		return base
	}
	return base + " Note: " + note
}

func verificationDecisionSeverity(decision BusinessVerificationDecision) admindomain.AuditSeverity {
	switch decision {
	case BusinessVerificationDecisionApproved:
		return admindomain.AuditSeverityInfo
	case BusinessVerificationDecisionRejected:
		return admindomain.AuditSeverityCritical
	default:
		return admindomain.AuditSeverityWarning
	}
}
