package adminauth

import (
	"context"
	"errors"
	"net/mail"
	"net/url"
	"strconv"
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
)

type Service struct {
	users         ports.AdminUserRepository
	sessions      ports.AdminSessionRepository
	audits        ports.AdminAuditRepository
	businesses    ports.AdminBusinessRepository
	payments      ports.PaymentProvider
	passwords     ports.PasswordHasher
	accessTokens  ports.AdminTokenIssuer
	refreshTokens ports.RefreshTokenIssuer
	ids           ports.IDGenerator
	clock         ports.Clock
}

type Dependencies struct {
	Users         ports.AdminUserRepository
	Sessions      ports.AdminSessionRepository
	Audits        ports.AdminAuditRepository
	Businesses    ports.AdminBusinessRepository
	Payments      ports.PaymentProvider
	Passwords     ports.PasswordHasher
	AccessTokens  ports.AdminTokenIssuer
	RefreshTokens ports.RefreshTokenIssuer
	IDs           ports.IDGenerator
	Clock         ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{
		users:         deps.Users,
		sessions:      deps.Sessions,
		audits:        deps.Audits,
		businesses:    deps.Businesses,
		payments:      deps.Payments,
		passwords:     deps.Passwords,
		accessTokens:  deps.AccessTokens,
		refreshTokens: deps.RefreshTokens,
		ids:           deps.IDs,
		clock:         deps.Clock,
	}
}

type BootstrapAdminCommand struct {
	Email       string
	DisplayName string
	Password    string
	Role        admindomain.Role
}

type LoginCommand struct {
	Email     string
	Password  string
	UserAgent string
	IPAddress string
}

type RefreshCommand struct {
	RefreshToken string
	UserAgent    string
	IPAddress    string
}

type LogoutCommand struct {
	RefreshToken string
	UserAgent    string
	IPAddress    string
}

type ListUsersCommand struct {
	ActorRole admindomain.Role
}

type ListAuditEventsCommand struct {
	ActorRole admindomain.Role
	Severity  admindomain.AuditSeverity
	Limit     int
}

type BusinessVerificationDecision string

const (
	BusinessVerificationDecisionApproved BusinessVerificationDecision = "approved"
	BusinessVerificationDecisionRejected BusinessVerificationDecision = "rejected"
	BusinessVerificationDecisionHeld     BusinessVerificationDecision = "held"
)

type ListBusinessVerificationsCommand struct {
	ActorRole admindomain.Role
}

type ListBusinessesCommand struct {
	ActorRole admindomain.Role
}

type GetPlatformMetricsCommand struct {
	ActorRole admindomain.Role
}

type GetMoneyRailsCommand struct {
	ActorRole admindomain.Role
}

type ListSubscriptionsCommand struct {
	ActorRole admindomain.Role
}

type UpdateSubscriptionCommand struct {
	ActorUserID             common.ID
	ActorRole               admindomain.Role
	BusinessID              common.ID
	Status                  string
	BillingMode             string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
	Reason                  string
	UserAgent               string
	IPAddress               string
}

type IssueSubscriptionInvoiceCommand struct {
	ActorUserID        common.ID
	ActorRole          admindomain.Role
	BusinessID         common.ID
	ProviderInvoiceRef string
	PaymentURL         string
	DueAt              *time.Time
	Reason             string
	UserAgent          string
	IPAddress          string
}

type MarkSubscriptionInvoicePaidCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	InvoiceID   common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type MarkSubscriptionInvoiceFailedCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	InvoiceID   common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type RunSubscriptionBillingSweepCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Reason      string
	UserAgent   string
	IPAddress   string
}

type ListPlansCommand struct {
	ActorRole admindomain.Role
}

type CreatePlanCommand struct {
	ActorUserID     common.ID
	ActorRole       admindomain.Role
	Code            string
	Name            string
	MonthlyFeeMinor int64
	CommissionBPS   int
	DesignLimit     *int
	UserAgent       string
	IPAddress       string
}

type UpdatePlanCommand struct {
	ActorUserID     common.ID
	ActorRole       admindomain.Role
	PlanID          common.ID
	Name            string
	MonthlyFeeMinor int64
	CommissionBPS   int
	DesignLimit     *int
	IsActive        bool
	UserAgent       string
	IPAddress       string
}

type ArchivePlanCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	PlanID      common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type ListPromotionsCommand struct {
	ActorRole admindomain.Role
}

type CreatePromotionCommand struct {
	ActorUserID           common.ID
	ActorRole             admindomain.Role
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
	UserAgent             string
	IPAddress             string
}

type UpdatePromotionCommand struct {
	ActorUserID           common.ID
	ActorRole             admindomain.Role
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
	UserAgent             string
	IPAddress             string
}

type ArchivePromotionCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	PromotionID common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type ListAdCampaignsCommand struct {
	ActorRole admindomain.Role
}

type CreateAdCampaignCommand struct {
	ActorUserID   common.ID
	ActorRole     admindomain.Role
	BusinessID    common.ID
	PlacementType string
	TargetRefID   string
	Headline      string
	Description   string
	Status        string
	PricingModel  string
	BudgetMinor   int64
	DailyCapMinor *int64
	StartsAt      *time.Time
	EndsAt        *time.Time
	ReviewNote    string
	UserAgent     string
	IPAddress     string
}

type UpdateAdCampaignCommand struct {
	ActorUserID   common.ID
	ActorRole     admindomain.Role
	CampaignID    common.ID
	BusinessID    common.ID
	PlacementType string
	TargetRefID   string
	Headline      string
	Description   string
	Status        string
	PricingModel  string
	BudgetMinor   int64
	DailyCapMinor *int64
	StartsAt      *time.Time
	EndsAt        *time.Time
	ReviewNote    string
	UserAgent     string
	IPAddress     string
}

type ArchiveAdCampaignCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	CampaignID  common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type CollectAdCampaignPaymentCommand struct {
	ActorUserID   common.ID
	ActorRole     admindomain.Role
	CampaignID    common.ID
	CustomerEmail string
	UserAgent     string
	IPAddress     string
}

type AdCampaignPaymentResult struct {
	Payment          ports.AdminAdCampaignPaymentRecord
	Created          bool
	AuthorizationURL string
}

type ListAffiliatesCommand struct {
	ActorRole admindomain.Role
}

type ListAffiliateAttributionCommand struct {
	ActorRole admindomain.Role
}

type UpdateAffiliateConversionStatusCommand struct {
	ActorUserID  common.ID
	ActorRole    admindomain.Role
	ConversionID common.ID
	Status       string
	Reason       string
	UserAgent    string
	IPAddress    string
}

type CreateAffiliatePayoutCommand struct {
	ActorUserID     common.ID
	ActorRole       admindomain.Role
	AffiliateID     common.ID
	PayoutReference string
	Notes           string
	UserAgent       string
	IPAddress       string
}

type CreateAffiliateCommand struct {
	ActorUserID      common.ID
	ActorRole        admindomain.Role
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
	UserAgent        string
	IPAddress        string
}

type UpdateAffiliateCommand struct {
	ActorUserID      common.ID
	ActorRole        admindomain.Role
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
	UserAgent        string
	IPAddress        string
}

type ArchiveAffiliateCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	AffiliateID common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type ListReferralProgrammesCommand struct {
	ActorRole admindomain.Role
}

type CreateReferralProgrammeCommand struct {
	ActorUserID             common.ID
	ActorRole               admindomain.Role
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
	UserAgent               string
	IPAddress               string
}

type UpdateReferralProgrammeCommand struct {
	ActorUserID             common.ID
	ActorRole               admindomain.Role
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
	UserAgent               string
	IPAddress               string
}

type ArchiveReferralProgrammeCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	ProgrammeID common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type IssueReferralRewardsCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Limit       int
	UserAgent   string
	IPAddress   string
}

type QueueMoneyReplayCommand struct {
	ActorUserID       common.ID
	ActorRole         admindomain.Role
	ProviderReference string
	Reason            string
	UserAgent         string
	IPAddress         string
}

type SetSettlementReviewHoldCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	Hold        bool
	Reason      string
	UserAgent   string
	IPAddress   string
}

type ListRiskReviewsCommand struct {
	ActorRole admindomain.Role
}

type SetRiskReviewStatusCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	ReviewKey   string
	Status      string
	Reason      string
	UserAgent   string
	IPAddress   string
}

type ListSupportTicketsCommand struct {
	ActorRole admindomain.Role
}

type UpdateSupportTicketCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	TicketKey   string
	Status      string
	Assignment  string
	Note        string
	UserAgent   string
	IPAddress   string
}

type UpdateBusinessStatusCommand struct {
	ActorUserID       common.ID
	ActorRole         admindomain.Role
	BusinessID        common.ID
	OperationalStatus business.OperationalStatus
	Reason            string
	UserAgent         string
	IPAddress         string
}

type DecideBusinessVerificationCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	Decision    BusinessVerificationDecision
	Note        string
	UserAgent   string
	IPAddress   string
}

type UpdateProfileCommand struct {
	ActorUserID common.ID
	DisplayName string
	Email       string
	UserAgent   string
	IPAddress   string
}

type UpdatePreferencesCommand struct {
	ActorUserID        common.ID
	ActorRole          admindomain.Role
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
	UserAgent          string
	IPAddress          string
}

type UpdatePlatformSettingsCommand struct {
	ActorUserID                  common.ID
	ActorRole                    admindomain.Role
	PlatformName                 string
	SupportEmail                 string
	VerificationSLAHours         int
	PayoutReviewThresholdPesewas int
	MaintenanceMode              bool
	UserAgent                    string
	IPAddress                    string
}

type UpdateRolePermissionsCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Role        admindomain.Role
	Permissions []admindomain.Permission
	UserAgent   string
	IPAddress   string
}

type CreateUserCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	DisplayName string
	Email       string
	Password    string
	Role        admindomain.Role
	UserAgent   string
	IPAddress   string
}

type UpdateUserCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	UserID      common.ID
	DisplayName string
	Role        admindomain.Role
	IsActive    bool
	UserAgent   string
	IPAddress   string
}

type AuthResult struct {
	AdminUserID      common.ID
	Email            string
	DisplayName      string
	Role             admindomain.Role
	AccessToken      string
	RefreshToken     string
	AccessExpiresAt  time.Time
	RefreshExpiresAt time.Time
}

type ProfileSettingsResult struct {
	User        ports.AdminUserRecord
	Preferences ports.AdminPreferencesRecord
}

func (s Service) BootstrapAdmin(ctx context.Context, cmd BootstrapAdminCommand) (ports.AdminUserRecord, error) {
	email, displayName, role, err := normalizeBootstrap(cmd)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	passwordHash, err := s.passwords.Hash(cmd.Password)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	return s.users.EnsureBootstrapUser(ctx, ports.CreateAdminUserInput{
		UserID:       s.ids.NewID(),
		Email:        email,
		DisplayName:  displayName,
		PasswordHash: passwordHash,
		Role:         role,
	})
}

func (s Service) Login(ctx context.Context, cmd LoginCommand) (AuthResult, error) {
	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	credentials, err := s.users.FindByEmail(ctx, email)
	if err != nil || !credentials.IsActive {
		_, _ = s.passwords.Hash(cmd.Password)
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if err := s.passwords.Compare(credentials.PasswordHash, cmd.Password); err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if err := s.users.RecordLogin(ctx, credentials.UserID); err != nil {
		return AuthResult{}, err
	}

	result, err := s.issueSession(ctx, issueSessionInput{
		AdminUserID: credentials.UserID,
		Email:       credentials.Email,
		DisplayName: credentials.DisplayName,
		Role:        credentials.Role,
		UserAgent:   cmd.UserAgent,
		IPAddress:   cmd.IPAddress,
	})
	if err != nil {
		return AuthResult{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: credentials.UserID,
		ActorRole:   credentials.Role,
		Action:      "Signed in",
		TargetType:  "admin_user",
		TargetID:    credentials.UserID.String(),
		TargetLabel: credentials.Email,
		Summary:     "Operator signed into the admin console.",
		Severity:    admindomain.AuditSeverityInfo,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return AuthResult{}, err
	}

	return result, nil
}

func (s Service) Refresh(ctx context.Context, cmd RefreshCommand) (AuthResult, error) {
	token := strings.TrimSpace(cmd.RefreshToken)
	if token == "" {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	session, err := s.sessions.FindByRefreshTokenHash(ctx, s.refreshTokens.HashRefreshToken(token))
	if err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if session.Revoked || !session.UserIsActive || !s.clock.Now().Before(session.ExpiresAt) {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if err := s.sessions.Revoke(ctx, session.SessionID); err != nil {
		return AuthResult{}, err
	}

	return s.issueSession(ctx, issueSessionInput{
		AdminUserID: session.AdminUserID,
		Email:       session.Email,
		DisplayName: session.DisplayName,
		Role:        session.Role,
		UserAgent:   cmd.UserAgent,
		IPAddress:   cmd.IPAddress,
	})
}

func (s Service) Logout(ctx context.Context, cmd LogoutCommand) error {
	token := strings.TrimSpace(cmd.RefreshToken)
	if token == "" {
		return nil
	}

	session, err := s.sessions.FindByRefreshTokenHash(ctx, s.refreshTokens.HashRefreshToken(token))
	if err != nil {
		return nil
	}

	if err := s.sessions.Revoke(ctx, session.SessionID); err != nil {
		return err
	}

	return s.recordAudit(ctx, auditInput{
		ActorUserID: session.AdminUserID,
		ActorRole:   session.Role,
		Action:      "Signed out",
		TargetType:  "admin_session",
		TargetID:    session.SessionID.String(),
		TargetLabel: session.Email,
		Summary:     "Operator signed out of the admin console.",
		Severity:    admindomain.AuditSeverityInfo,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	})
}

func (s Service) Me(ctx context.Context, adminUserID common.ID) (ports.AdminUserRecord, error) {
	if adminUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidCredentials
	}

	user, err := s.users.FindByID(ctx, adminUserID)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	if !user.IsActive {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidCredentials
	}

	return user, nil
}

func (s Service) ListUsers(ctx context.Context, cmd ListUsersCommand) ([]ports.AdminUserRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAdminUsers); err != nil {
		return nil, err
	}

	return s.users.ListAdminUsers(ctx)
}

func (s Service) ListAuditEvents(ctx context.Context, cmd ListAuditEventsCommand) ([]ports.AdminAuditEventRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionViewAudit); err != nil {
		return nil, err
	}
	if cmd.Severity != "" && !cmd.Severity.Valid() {
		return nil, authdomain.ErrInvalidInput
	}

	return s.audits.ListAdminAuditEvents(ctx, ports.ListAdminAuditEventsInput{
		Limit:    cmd.Limit,
		Severity: cmd.Severity,
	})
}

func (s Service) ListBusinessVerifications(
	ctx context.Context,
	cmd ListBusinessVerificationsCommand,
) ([]ports.AdminVerificationCaseRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminVerificationCases(ctx)
}

func (s Service) DecideBusinessVerification(
	ctx context.Context,
	cmd DecideBusinessVerificationCommand,
) (ports.AdminVerificationCaseRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminVerificationCaseRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminVerificationCaseRecord{}, authdomain.ErrForbidden
	}

	status, err := statusForBusinessVerificationDecision(cmd.Decision)
	if err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	record, err := s.businesses.DecideAdminBusinessVerification(
		ctx,
		ports.AdminBusinessVerificationDecisionInput{
			BusinessID: cmd.BusinessID,
			Status:     status,
		},
	)
	if err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	note := normalizeOperatorNote(cmd.Note)
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      verificationDecisionAction(cmd.Decision),
		TargetType:  "business",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     verificationDecisionSummary(cmd.Decision, note),
		Severity:    verificationDecisionSeverity(cmd.Decision),
		Metadata: map[string]string{
			"decision":            string(cmd.Decision),
			"verification_status": string(record.VerificationStatus),
			"handle":              record.Handle,
			"operator_note":       note,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	return record, nil
}

func (s Service) ListBusinesses(ctx context.Context, cmd ListBusinessesCommand) ([]ports.AdminBusinessRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminBusinesses(ctx)
}

func (s Service) GetPlatformMetrics(ctx context.Context, cmd GetPlatformMetricsCommand) (ports.AdminPlatformMetricsRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminPlatformMetricsRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlatformMetricsRecord{}, authdomain.ErrForbidden
	}

	return s.businesses.GetAdminPlatformMetrics(ctx)
}

func (s Service) GetMoneyRails(ctx context.Context, cmd GetMoneyRailsCommand) (ports.AdminMoneyRailsRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminMoneyRailsRecord{}, authdomain.ErrForbidden
	}

	return s.businesses.GetAdminMoneyRails(ctx)
}

func (s Service) ListSubscriptions(
	ctx context.Context,
	cmd ListSubscriptionsCommand,
) ([]ports.AdminSubscriptionRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminSubscriptions(ctx)
}

func (s Service) UpdateSubscription(
	ctx context.Context,
	cmd UpdateSubscriptionCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	status, err := normalizeSubscriptionStatus(cmd.Status)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	billingMode, err := normalizeSubscriptionBillingMode(cmd.BillingMode)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	providerCustomerRef, providerSubscriptionRef, err := normalizeSubscriptionProviderRefs(
		billingMode,
		cmd.ProviderCustomerRef,
		cmd.ProviderSubscriptionRef,
	)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = subscriptionUpdateSummary(status, billingMode)
	}

	record, err := s.businesses.UpdateAdminSubscription(ctx, ports.UpdateAdminSubscriptionInput{
		BusinessID:              cmd.BusinessID,
		Status:                  status,
		BillingMode:             billingMode,
		ProviderCustomerRef:     providerCustomerRef,
		ProviderSubscriptionRef: providerSubscriptionRef,
		Reason:                  reason,
		ActorAdminUser:          cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated subscription",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     subscriptionUpdateSummary(status, billingMode),
		Severity:    subscriptionUpdateSeverity(status),
		Metadata: map[string]string{
			"status":                    status,
			"billing_mode":              billingMode,
			"plan":                      record.PlanCode,
			"provider_customer_ref":     providerCustomerRef,
			"provider_subscription_ref": providerSubscriptionRef,
			"reason":                    reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (s Service) IssueSubscriptionInvoice(
	ctx context.Context,
	cmd IssueSubscriptionInvoiceCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	paymentURL, err := normalizePaymentURL(cmd.PaymentURL)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	invoiceID := s.ids.NewID()
	dueAt := subscriptionInvoiceDueAt(s.clock.Now(), cmd.DueAt)
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Subscription invoice issued."
	}

	record, err := s.businesses.IssueAdminSubscriptionInvoice(ctx, ports.IssueAdminSubscriptionInvoiceInput{
		InvoiceID:          invoiceID,
		BusinessID:         cmd.BusinessID,
		InvoiceRef:         subscriptionInvoiceRef(invoiceID),
		ProviderInvoiceRef: normalizeOperatorNote(cmd.ProviderInvoiceRef),
		PaymentURL:         paymentURL,
		DueAt:              dueAt,
		ActorAdminUser:     cmd.ActorUserID,
		Reason:             reason,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Issued subscription invoice",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     "Issued a subscription invoice for " + record.BusinessName + ".",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"business_id":          record.BusinessID.String(),
			"invoice_ref":          record.LastInvoiceRef,
			"provider_invoice_ref": normalizeOperatorNote(cmd.ProviderInvoiceRef),
			"payment_url":          paymentURL,
			"reason":               reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (s Service) MarkSubscriptionInvoicePaid(
	ctx context.Context,
	cmd MarkSubscriptionInvoicePaidCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.InvoiceID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Subscription invoice marked paid."
	}
	record, err := s.businesses.MarkAdminSubscriptionInvoicePaid(ctx, ports.MarkAdminSubscriptionInvoicePaidInput{
		InvoiceID:      cmd.InvoiceID,
		ActorAdminUser: cmd.ActorUserID,
		Reason:         reason,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Marked subscription invoice paid",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     "Marked subscription invoice paid for " + record.BusinessName + ".",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"business_id":  record.BusinessID.String(),
			"invoice_id":   cmd.InvoiceID.String(),
			"invoice_ref":  record.LastInvoiceRef,
			"billing_mode": record.BillingMode,
			"reason":       reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (s Service) MarkSubscriptionInvoiceFailed(
	ctx context.Context,
	cmd MarkSubscriptionInvoiceFailedCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.InvoiceID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Subscription invoice failed."
	}
	record, err := s.businesses.MarkAdminSubscriptionInvoiceFailed(ctx, ports.MarkAdminSubscriptionInvoiceFailedInput{
		InvoiceID:      cmd.InvoiceID,
		ActorAdminUser: cmd.ActorUserID,
		Reason:         reason,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Marked subscription invoice failed",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     "Marked subscription invoice failed for " + record.BusinessName + ".",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"business_id":  record.BusinessID.String(),
			"invoice_id":   cmd.InvoiceID.String(),
			"invoice_ref":  record.LastInvoiceRef,
			"billing_mode": record.BillingMode,
			"reason":       reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (s Service) RunSubscriptionBillingSweep(
	ctx context.Context,
	cmd RunSubscriptionBillingSweepCommand,
) (ports.AdminSubscriptionBillingSweepRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSubscriptionBillingSweepRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator billing sweep."
	}

	record, err := s.businesses.RunAdminSubscriptionBillingSweep(ctx, ports.RunAdminSubscriptionBillingSweepInput{
		ActorAdminUser: cmd.ActorUserID,
		Reason:         reason,
	})
	if err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	severity := admindomain.AuditSeverityInfo
	if record.OverdueInvoicesFailed > 0 || record.SubscriptionsCanceled > 0 {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Ran subscription billing sweep",
		TargetType:  "business_subscription",
		TargetID:    "billing_sweep",
		TargetLabel: "Subscription billing sweep",
		Summary: "Billing sweep failed " + strconv.Itoa(record.OverdueInvoicesFailed) +
			" overdue invoices and canceled " + strconv.Itoa(record.SubscriptionsCanceled) +
			" expired grace subscriptions.",
		Severity: severity,
		Metadata: map[string]string{
			"overdue_invoices_failed": strconv.Itoa(record.OverdueInvoicesFailed),
			"subscriptions_canceled":  strconv.Itoa(record.SubscriptionsCanceled),
			"businesses_touched":      strconv.Itoa(record.BusinessesTouched),
			"reason":                  reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	return record, nil
}

func (s Service) ListPlans(
	ctx context.Context,
	cmd ListPlansCommand,
) ([]ports.AdminPlanRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminPlans(ctx)
}

func (s Service) CreatePlan(
	ctx context.Context,
	cmd CreatePlanCommand,
) (ports.AdminPlanRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlanRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreatePlanInput(cmd)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := s.businesses.CreateAdminPlan(ctx, input)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created plan package",
		TargetType:  "plan",
		TargetID:    record.PlanID.String(),
		TargetLabel: record.Name,
		Summary:     planAuditSummary(record),
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"code":              record.Code,
			"monthly_fee_minor": strconv.FormatInt(record.MonthlyFeeMinor, 10),
			"commission_bps":    strconv.Itoa(record.CommissionBPS),
			"is_active":         boolString(record.IsActive),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (s Service) UpdatePlan(
	ctx context.Context,
	cmd UpdatePlanCommand,
) (ports.AdminPlanRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PlanID.IsZero() {
		return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlanRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdatePlanInput(cmd)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := s.businesses.UpdateAdminPlan(ctx, input)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated plan package",
		TargetType:  "plan",
		TargetID:    record.PlanID.String(),
		TargetLabel: record.Name,
		Summary:     planAuditSummary(record),
		Severity:    planAuditSeverity(record.IsActive),
		Metadata: map[string]string{
			"code":              record.Code,
			"monthly_fee_minor": strconv.FormatInt(record.MonthlyFeeMinor, 10),
			"commission_bps":    strconv.Itoa(record.CommissionBPS),
			"is_active":         boolString(record.IsActive),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (s Service) ArchivePlan(
	ctx context.Context,
	cmd ArchivePlanCommand,
) (ports.AdminPlanRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PlanID.IsZero() {
		return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlanRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminPlan(ctx, ports.ArchiveAdminPlanInput{
		PlanID: cmd.PlanID,
	})
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Plan package archived."
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived plan package",
		TargetType:  "plan",
		TargetID:    record.PlanID.String(),
		TargetLabel: record.Name,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"code":      record.Code,
			"is_active": boolString(record.IsActive),
			"reason":    reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (s Service) ListPromotions(
	ctx context.Context,
	cmd ListPromotionsCommand,
) ([]ports.AdminPromotionRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminPromotions(ctx)
}

func (s Service) CreatePromotion(
	ctx context.Context,
	cmd CreatePromotionCommand,
) (ports.AdminPromotionRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPromotionRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreatePromotionInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := s.businesses.CreateAdminPromotion(ctx, input)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created promotion",
		TargetType:  "promotion",
		TargetID:    record.PromotionID.String(),
		TargetLabel: record.Title,
		Summary:     promotionAuditSummary(record),
		Severity:    promotionAuditSeverity(record.Status),
		Metadata:    promotionAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (s Service) UpdatePromotion(
	ctx context.Context,
	cmd UpdatePromotionCommand,
) (ports.AdminPromotionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PromotionID.IsZero() {
		return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPromotionRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdatePromotionInput(cmd)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := s.businesses.UpdateAdminPromotion(ctx, input)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated promotion",
		TargetType:  "promotion",
		TargetID:    record.PromotionID.String(),
		TargetLabel: record.Title,
		Summary:     promotionAuditSummary(record),
		Severity:    promotionAuditSeverity(record.Status),
		Metadata:    promotionAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (s Service) ArchivePromotion(
	ctx context.Context,
	cmd ArchivePromotionCommand,
) (ports.AdminPromotionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PromotionID.IsZero() {
		return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPromotionRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminPromotion(ctx, ports.ArchiveAdminPromotionInput{
		PromotionID:    cmd.PromotionID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Promotion archived."
	}

	metadata := promotionAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived promotion",
		TargetType:  "promotion",
		TargetID:    record.PromotionID.String(),
		TargetLabel: record.Title,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (s Service) ListAdCampaigns(
	ctx context.Context,
	cmd ListAdCampaignsCommand,
) ([]ports.AdminAdCampaignRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminAdCampaigns(ctx)
}

func (s Service) CreateAdCampaign(
	ctx context.Context,
	cmd CreateAdCampaignCommand,
) (ports.AdminAdCampaignRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreateAdCampaignInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := s.businesses.CreateAdminAdCampaign(ctx, input)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created sponsored placement",
		TargetType:  "ad_campaign",
		TargetID:    record.CampaignID.String(),
		TargetLabel: record.Headline,
		Summary:     adCampaignAuditSummary(record),
		Severity:    adCampaignAuditSeverity(record.Status),
		Metadata:    adCampaignAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateAdCampaign(
	ctx context.Context,
	cmd UpdateAdCampaignCommand,
) (ports.AdminAdCampaignRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.CampaignID.IsZero() {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdateAdCampaignInput(cmd)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := s.businesses.UpdateAdminAdCampaign(ctx, input)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated sponsored placement",
		TargetType:  "ad_campaign",
		TargetID:    record.CampaignID.String(),
		TargetLabel: record.Headline,
		Summary:     adCampaignAuditSummary(record),
		Severity:    adCampaignAuditSeverity(record.Status),
		Metadata:    adCampaignAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (s Service) ArchiveAdCampaign(
	ctx context.Context,
	cmd ArchiveAdCampaignCommand,
) (ports.AdminAdCampaignRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.CampaignID.IsZero() {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminAdCampaign(ctx, ports.ArchiveAdminAdCampaignInput{
		CampaignID:     cmd.CampaignID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Sponsored placement archived."
	}

	metadata := adCampaignAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived sponsored placement",
		TargetType:  "ad_campaign",
		TargetID:    record.CampaignID.String(),
		TargetLabel: record.Headline,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (s Service) CollectAdCampaignPayment(
	ctx context.Context,
	cmd CollectAdCampaignPaymentCommand,
) (AdCampaignPaymentResult, error) {
	if cmd.ActorUserID.IsZero() || cmd.CampaignID.IsZero() {
		return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return AdCampaignPaymentResult{}, err
	}
	if s.businesses == nil || s.payments == nil {
		return AdCampaignPaymentResult{}, authdomain.ErrForbidden
	}

	intent, err := s.businesses.GetAdminAdCampaignPaymentIntent(ctx, cmd.CampaignID)
	if err != nil {
		return AdCampaignPaymentResult{}, err
	}
	if intent.OpenPayment != nil {
		return AdCampaignPaymentResult{
			Payment:          *intent.OpenPayment,
			Created:          false,
			AuthorizationURL: intent.OpenPayment.PaymentURL,
		}, nil
	}
	if intent.DueMinor <= 0 {
		return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
	}

	customerEmail := ""
	if strings.TrimSpace(cmd.CustomerEmail) != "" {
		customerEmail, err = normalizeEmail(cmd.CustomerEmail)
		if err != nil {
			return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
		}
	}
	if customerEmail == "" {
		customerEmail, err = normalizeEmail(intent.OwnerEmail)
		if err != nil {
			return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
		}
	}

	paymentID := s.ids.NewID()
	reference := "xt_ad_" + s.ids.NewID().String()
	providerResult, err := s.payments.InitializeTransaction(ctx, ports.InitializeTransactionInput{
		BusinessID:      intent.BusinessID,
		CustomerEmail:   customerEmail,
		AmountMinor:     intent.DueMinor,
		CommissionMinor: 0,
		Currency:        common.CurrencyGHS,
		Reference:       reference,
	})
	if err != nil {
		return AdCampaignPaymentResult{}, err
	}
	providerReference := providerResult.ProviderReference
	if providerReference == "" {
		providerReference = reference
	}

	payment, err := s.businesses.CreateAdminAdCampaignPayment(ctx, ports.CreateAdminAdCampaignPaymentInput{
		PaymentID:         paymentID,
		CampaignID:        intent.CampaignID,
		BusinessID:        intent.BusinessID,
		ProviderReference: providerReference,
		PaymentURL:        providerResult.AuthorizationURL,
		AmountMinor:       intent.DueMinor,
		Currency:          common.CurrencyGHS,
		ActorAdminUser:    cmd.ActorUserID,
	})
	if err != nil {
		return AdCampaignPaymentResult{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created sponsored placement payment link",
		TargetType:  "ad_campaign_payment",
		TargetID:    payment.PaymentID.String(),
		TargetLabel: intent.Headline,
		Summary: "Created Paystack collection link for " +
			moneySummary(payment.AmountMinor) + " sponsored-placement budget.",
		Severity: admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"campaign_id":        intent.CampaignID.String(),
			"business_id":        intent.BusinessID.String(),
			"provider":           payment.Provider,
			"provider_reference": payment.ProviderReference,
			"amount_minor":       strconv.FormatInt(payment.AmountMinor, 10),
			"currency":           payment.Currency,
			"customer_email":     customerEmail,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return AdCampaignPaymentResult{}, err
	}

	return AdCampaignPaymentResult{
		Payment:          payment,
		Created:          true,
		AuthorizationURL: payment.PaymentURL,
	}, nil
}

func (s Service) ListAffiliates(
	ctx context.Context,
	cmd ListAffiliatesCommand,
) ([]ports.AdminAffiliateRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminAffiliates(ctx)
}

func (s Service) ListAffiliateAttribution(
	ctx context.Context,
	cmd ListAffiliateAttributionCommand,
) ([]ports.AdminAffiliateAttributionRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminAffiliateAttribution(ctx)
}

func (s Service) UpdateAffiliateConversionStatus(
	ctx context.Context,
	cmd UpdateAffiliateConversionStatusCommand,
) (ports.AdminAffiliateConversionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ConversionID.IsZero() {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrForbidden
	}

	status := strings.TrimSpace(cmd.Status)
	if status != "approved" && status != "settled" && status != "reversed" {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator marked affiliate conversion " + status + "."
	}

	record, err := s.businesses.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   cmd.ConversionID,
		Status:         status,
		Reason:         reason,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	action := "Marked affiliate conversion " + status
	severity := admindomain.AuditSeverityInfo
	if status == "reversed" {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "affiliate_conversion",
		TargetID:    record.ConversionID.String(),
		TargetLabel: fallbackString(record.BusinessName, record.OrderID.String()),
		Summary:     action + ". Reason: " + reason,
		Severity:    severity,
		Metadata: map[string]string{
			"affiliate_id":     record.AffiliateID.String(),
			"business_id":      record.BusinessID.String(),
			"order_id":         record.OrderID.String(),
			"status":           record.Status,
			"commission_minor": intString64(record.CommissionMinor),
			"reason":           reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	return record, nil
}

func (s Service) CreateAffiliatePayout(
	ctx context.Context,
	cmd CreateAffiliatePayoutCommand,
) (ports.AdminAffiliatePayoutRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.AffiliateID.IsZero() {
		return ports.AdminAffiliatePayoutRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliatePayoutRecord{}, authdomain.ErrForbidden
	}

	notes := normalizeOperatorNote(cmd.Notes)
	if notes == "" {
		notes = "Operator reconciled approved affiliate payout."
	}
	reference := normalizeOperatorNote(cmd.PayoutReference)

	record, err := s.businesses.CreateAdminAffiliatePayout(ctx, ports.CreateAdminAffiliatePayoutInput{
		PayoutBatchID:   s.ids.NewID(),
		AffiliateID:     cmd.AffiliateID,
		PayoutReference: reference,
		Notes:           notes,
		ActorAdminUser:  cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Reconciled affiliate payout",
		TargetType:  "affiliate_payout",
		TargetID:    record.PayoutBatchID.String(),
		TargetLabel: fallbackString(record.DisplayName, record.AffiliateID.String()),
		Summary: "Settled " + intString(record.ConversionCount) +
			" approved affiliate conversions for " + moneySummary(record.CommissionMinor) + ".",
		Severity: admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"affiliate_id":     record.AffiliateID.String(),
			"conversion_count": intString(record.ConversionCount),
			"commission_minor": intString64(record.CommissionMinor),
			"payout_reference": record.PayoutReference,
			"payout_mode":      record.PayoutMode,
			"status":           record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	return record, nil
}

func (s Service) CreateAffiliate(
	ctx context.Context,
	cmd CreateAffiliateCommand,
) (ports.AdminAffiliateRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreateAffiliateInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := s.businesses.CreateAdminAffiliate(ctx, input)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created affiliate programme partner",
		TargetType:  "affiliate",
		TargetID:    record.AffiliateID.String(),
		TargetLabel: record.DisplayName,
		Summary:     affiliateAuditSummary(record),
		Severity:    affiliateAuditSeverity(record.Status),
		Metadata:    affiliateAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateAffiliate(
	ctx context.Context,
	cmd UpdateAffiliateCommand,
) (ports.AdminAffiliateRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.AffiliateID.IsZero() {
		return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdateAffiliateInput(cmd)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := s.businesses.UpdateAdminAffiliate(ctx, input)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated affiliate programme partner",
		TargetType:  "affiliate",
		TargetID:    record.AffiliateID.String(),
		TargetLabel: record.DisplayName,
		Summary:     affiliateAuditSummary(record),
		Severity:    affiliateAuditSeverity(record.Status),
		Metadata:    affiliateAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (s Service) ArchiveAffiliate(
	ctx context.Context,
	cmd ArchiveAffiliateCommand,
) (ports.AdminAffiliateRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.AffiliateID.IsZero() {
		return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminAffiliate(ctx, ports.ArchiveAdminAffiliateInput{
		AffiliateID:    cmd.AffiliateID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Affiliate programme partner archived."
	}

	metadata := affiliateAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived affiliate programme partner",
		TargetType:  "affiliate",
		TargetID:    record.AffiliateID.String(),
		TargetLabel: record.DisplayName,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (s Service) ListReferralProgrammes(
	ctx context.Context,
	cmd ListReferralProgrammesCommand,
) ([]ports.AdminReferralProgrammeRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminReferralProgrammes(ctx)
}

func (s Service) CreateReferralProgramme(
	ctx context.Context,
	cmd CreateReferralProgrammeCommand,
) (ports.AdminReferralProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreateReferralProgrammeInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := s.businesses.CreateAdminReferralProgramme(ctx, input)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created referral programme",
		TargetType:  "referral_programme",
		TargetID:    record.ProgrammeID.String(),
		TargetLabel: record.Title,
		Summary:     referralProgrammeAuditSummary(record),
		Severity:    referralProgrammeAuditSeverity(record.Status),
		Metadata:    referralProgrammeAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateReferralProgramme(
	ctx context.Context,
	cmd UpdateReferralProgrammeCommand,
) (ports.AdminReferralProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ProgrammeID.IsZero() {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdateReferralProgrammeInput(cmd)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := s.businesses.UpdateAdminReferralProgramme(ctx, input)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated referral programme",
		TargetType:  "referral_programme",
		TargetID:    record.ProgrammeID.String(),
		TargetLabel: record.Title,
		Summary:     referralProgrammeAuditSummary(record),
		Severity:    referralProgrammeAuditSeverity(record.Status),
		Metadata:    referralProgrammeAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (s Service) ArchiveReferralProgramme(
	ctx context.Context,
	cmd ArchiveReferralProgrammeCommand,
) (ports.AdminReferralProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ProgrammeID.IsZero() {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminReferralProgramme(ctx, ports.ArchiveAdminReferralProgrammeInput{
		ProgrammeID:    cmd.ProgrammeID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Referral programme archived."
	}

	metadata := referralProgrammeAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived referral programme",
		TargetType:  "referral_programme",
		TargetID:    record.ProgrammeID.String(),
		TargetLabel: record.Title,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (s Service) IssueReferralRewards(
	ctx context.Context,
	cmd IssueReferralRewardsCommand,
) (ports.AdminReferralRewardIssueRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminReferralRewardIssueRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralRewardIssueRecord{}, authdomain.ErrForbidden
	}

	limit := cmd.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	record, err := s.businesses.IssueAdminReferralRewards(ctx, ports.IssueAdminReferralRewardsInput{
		ActorAdminUser: cmd.ActorUserID,
		Limit:          limit,
	})
	if err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Issued referral rewards",
		TargetType:  "referral_rewards",
		TargetID:    "batch",
		TargetLabel: "Referral rewards",
		Summary: "Issued " + intString(record.RewardCount) +
			" referral rewards across " + intString(record.ReferralCount) + " referrals.",
		Severity: admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"referral_count":          intString(record.ReferralCount),
			"reward_count":            intString(record.RewardCount),
			"voucher_count":           intString(record.VoucherCount),
			"commission_rebate_count": intString(record.CommissionRebateCount),
			"total_reward_minor":      intString64(record.TotalRewardMinor),
			"limit":                   intString(limit),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	return record, nil
}

func (s Service) QueueMoneyReplay(
	ctx context.Context,
	cmd QueueMoneyReplayCommand,
) (ports.AdminMoneyReplayRequestRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminMoneyReplayRequestRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminMoneyReplayRequestRecord{}, authdomain.ErrForbidden
	}

	providerReference := strings.TrimSpace(cmd.ProviderReference)
	if providerReference == "" {
		return ports.AdminMoneyReplayRequestRecord{}, authdomain.ErrInvalidInput
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator queued provider event for money-rails review."
	}

	record, err := s.businesses.QueueAdminMoneyReplay(ctx, ports.QueueAdminMoneyReplayInput{
		ReplayRequestID:   s.ids.NewID(),
		ProviderReference: providerReference,
		RequestedByUserID: cmd.ActorUserID,
		Reason:            reason,
	})
	if err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Queued money replay",
		TargetType:  "payment_provider_reference",
		TargetID:    record.ProviderReference,
		TargetLabel: fallbackString(record.BusinessName, record.ProviderReference),
		Summary:     "Operator queued a payment provider reference for money-rails replay review.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"provider_reference": record.ProviderReference,
			"payment_id":         record.PaymentID.String(),
			"reason":             reason,
			"status":             record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	return record, nil
}

func (s Service) SetSettlementReviewHold(
	ctx context.Context,
	cmd SetSettlementReviewHoldCommand,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminMoneyPayoutReviewRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminMoneyPayoutReviewRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		if cmd.Hold {
			reason = "Operator placed settlement review hold."
		} else {
			reason = "Operator released settlement review hold."
		}
	}

	record, err := s.businesses.SetAdminSettlementReviewHold(ctx, ports.SetAdminSettlementReviewHoldInput{
		BusinessID:     cmd.BusinessID,
		Hold:           cmd.Hold,
		Reason:         reason,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	action := "Released settlement review hold"
	severity := admindomain.AuditSeverityInfo
	if cmd.Hold {
		action = "Placed settlement review hold"
		severity = admindomain.AuditSeverityCritical
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "business",
		TargetID:    record.ID,
		TargetLabel: record.BusinessName,
		Summary:     action + ". Reason: " + reason,
		Severity:    severity,
		Metadata: map[string]string{
			"hold_active":      boolString(record.HoldActive),
			"settlement_minor": intString64(record.SettlementMinor),
			"commission_minor": intString64(record.CommissionMinor),
			"reason":           reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	return record, nil
}

func (s Service) ListRiskReviews(ctx context.Context, cmd ListRiskReviewsCommand) ([]ports.AdminRiskReviewRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRisk); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminRiskReviews(ctx)
}

func (s Service) SetRiskReviewStatus(
	ctx context.Context,
	cmd SetRiskReviewStatusCommand,
) (ports.AdminRiskReviewRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRisk); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrForbidden
	}

	reviewKey := strings.TrimSpace(cmd.ReviewKey)
	if reviewKey == "" {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrInvalidInput
	}

	status := strings.TrimSpace(cmd.Status)
	if status != "open" && status != "closed" {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrInvalidInput
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		if status == "closed" {
			reason = "Operator closed risk review."
		} else {
			reason = "Operator reopened risk review."
		}
	}

	record, err := s.businesses.SetAdminRiskReviewStatus(ctx, ports.SetAdminRiskReviewStatusInput{
		ReviewKey:      reviewKey,
		Status:         status,
		Reason:         reason,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	action := "Reopened risk review"
	severity := admindomain.AuditSeverityWarning
	if status == "closed" {
		action = "Closed risk review"
		severity = admindomain.AuditSeverityInfo
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "risk_review",
		TargetID:    record.ReviewKey,
		TargetLabel: fallbackString(record.BusinessName, record.Title),
		Summary:     action + ". Reason: " + reason,
		Severity:    severity,
		Metadata: map[string]string{
			"business_id": record.BusinessID.String(),
			"level":       record.Level,
			"reason":      reason,
			"status":      record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	return record, nil
}

func (s Service) ListSupportTickets(
	ctx context.Context,
	cmd ListSupportTicketsCommand,
) ([]ports.AdminSupportTicketRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSupport); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminSupportTickets(ctx)
}

func (s Service) UpdateSupportTicket(
	ctx context.Context,
	cmd UpdateSupportTicketCommand,
) (ports.AdminSupportTicketRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSupport); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrForbidden
	}

	ticketKey := strings.TrimSpace(cmd.TicketKey)
	if ticketKey == "" {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}

	status := strings.TrimSpace(cmd.Status)
	if status == "" {
		status = "open"
	}
	if status != "open" && status != "resolved" {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}

	assignment := strings.TrimSpace(cmd.Assignment)
	if assignment == "" {
		assignment = "unchanged"
	}
	if assignment != "self" && assignment != "unassigned" && assignment != "unchanged" {
		return ports.AdminSupportTicketRecord{}, authdomain.ErrInvalidInput
	}

	note := normalizeOperatorNote(cmd.Note)
	if note == "" {
		switch {
		case status == "resolved":
			note = "Operator resolved support ticket."
		case assignment == "self":
			note = "Operator assigned support ticket to self."
		case assignment == "unassigned":
			note = "Operator removed support assignment."
		default:
			note = "Operator reopened support ticket."
		}
	}

	record, err := s.businesses.UpdateAdminSupportTicket(ctx, ports.UpdateAdminSupportTicketInput{
		TicketKey:      ticketKey,
		Status:         status,
		Assignment:     assignment,
		Note:           note,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	action := supportTicketAction(status, assignment)
	severity := admindomain.AuditSeverityInfo
	if record.Priority == "urgent" && status == "open" {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "support_ticket",
		TargetID:    record.TicketKey,
		TargetLabel: fallbackString(record.BusinessName, record.Subject),
		Summary:     action + ". Note: " + note,
		Severity:    severity,
		Metadata: map[string]string{
			"assignment":  assignment,
			"business_id": record.BusinessID.String(),
			"category":    record.Category,
			"priority":    record.Priority,
			"status":      record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSupportTicketRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateBusinessStatus(
	ctx context.Context,
	cmd UpdateBusinessStatusCommand,
) (ports.AdminBusinessRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminBusinessRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminBusinessRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminBusinessRecord{}, authdomain.ErrForbidden
	}
	if !cmd.OperationalStatus.Valid() {
		return ports.AdminBusinessRecord{}, authdomain.ErrInvalidInput
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if cmd.OperationalStatus == business.OperationalStatusSuspended && reason == "" {
		reason = "Operator suspended tenant activity pending review."
	}
	if cmd.OperationalStatus == business.OperationalStatusActive && reason == "" {
		reason = "Operator reactivated tenant activity after review."
	}

	record, err := s.businesses.UpdateAdminBusinessStatus(ctx, ports.UpdateAdminBusinessStatusInput{
		BusinessID:           cmd.BusinessID,
		OperationalStatus:    cmd.OperationalStatus,
		SuspensionReason:     reason,
		SuspendedByAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminBusinessRecord{}, err
	}

	action := "Reactivated business"
	summary := "Operator reactivated tenant activity."
	severity := admindomain.AuditSeverityInfo
	if cmd.OperationalStatus == business.OperationalStatusSuspended {
		action = "Suspended business"
		summary = "Operator suspended tenant activity."
		severity = admindomain.AuditSeverityCritical
	}
	if reason != "" {
		summary += " Reason: " + reason
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "business",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.Name,
		Summary:     summary,
		Severity:    severity,
		Metadata: map[string]string{
			"operational_status":  string(record.OperationalStatus),
			"verification_status": string(record.VerificationStatus),
			"handle":              record.Handle,
			"reason":              reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminBusinessRecord{}, err
	}

	return record, nil
}

func (s Service) GetProfileSettings(ctx context.Context, adminUserID common.ID) (ProfileSettingsResult, error) {
	user, err := s.Me(ctx, adminUserID)
	if err != nil {
		return ProfileSettingsResult{}, err
	}

	preferences, err := s.users.GetAdminPreferences(ctx, adminUserID)
	if err != nil {
		return ProfileSettingsResult{}, err
	}

	return ProfileSettingsResult{User: user, Preferences: preferences}, nil
}

func (s Service) UpdateProfile(ctx context.Context, cmd UpdateProfileCommand) (ports.AdminUserRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return ports.AdminUserRecord{}, errors.Join(authdomain.ErrInvalidInput, err)
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	user, err := s.users.UpdateAdminProfile(ctx, ports.UpdateAdminProfileInput{
		UserID:      cmd.ActorUserID,
		Email:       email,
		DisplayName: displayName,
	})
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   user.Role,
		Action:      "Updated profile",
		TargetType:  "admin_user",
		TargetID:    user.UserID.String(),
		TargetLabel: user.Email,
		Summary:     "Operator updated their admin profile.",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"display_name": user.DisplayName,
			"email":        user.Email,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (s Service) UpdatePreferences(
	ctx context.Context,
	cmd UpdatePreferencesCommand,
) (ports.AdminPreferencesRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPreferencesRecord{}, authdomain.ErrInvalidInput
	}
	if !cmd.ActorRole.Valid() {
		return ports.AdminPreferencesRecord{}, authdomain.ErrInvalidInput
	}

	normalized, err := normalizePreferences(cmd)
	if err != nil {
		return ports.AdminPreferencesRecord{}, err
	}

	preferences, err := s.users.UpdateAdminPreferences(ctx, normalized)
	if err != nil {
		return ports.AdminPreferencesRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated notification preferences",
		TargetType:  "admin_preferences",
		TargetID:    cmd.ActorUserID.String(),
		TargetLabel: preferences.Timezone,
		Summary:     "Operator updated their notification preferences.",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"timezone":          preferences.Timezone,
			"daily_digest_time": preferences.DailyDigestTime,
			"notify_email":      boolString(preferences.NotifyEmail),
			"notify_sms":        boolString(preferences.NotifySMS),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPreferencesRecord{}, err
	}

	return preferences, nil
}

func (s Service) GetPlatformSettings(ctx context.Context) (ports.AdminPlatformSettingsRecord, error) {
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
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

func (s Service) ListRolePermissions(ctx context.Context) ([]ports.AdminRolePermissionsRecord, error) {
	records, err := s.users.ListAdminRolePermissions(ctx)
	if err != nil {
		return nil, err
	}

	return normalizeRolePermissionRecords(records)
}

func (s Service) UpdateRolePermissions(
	ctx context.Context,
	cmd UpdateRolePermissionsCommand,
) (ports.AdminRolePermissionsRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminRolePermissionsRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRoles); err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}
	if !cmd.Role.Valid() {
		return ports.AdminRolePermissionsRecord{}, authdomain.ErrInvalidInput
	}

	permissions, err := normalizePermissionSet(cmd.Role, cmd.Permissions)
	if err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}

	record, err := s.users.ReplaceAdminRolePermissions(ctx, ports.UpdateAdminRolePermissionsInput{
		Role:        cmd.Role,
		Permissions: permissions,
	})
	if err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated role permissions",
		TargetType:  "admin_role",
		TargetID:    string(record.Role),
		TargetLabel: string(record.Role),
		Summary:     "Operator changed admin role permission grants.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"permissions": permissionsString(record.Permissions),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}

	return record, nil
}

func (s Service) CreateUser(ctx context.Context, cmd CreateUserCommand) (ports.AdminUserRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAdminUsers); err != nil {
		return ports.AdminUserRecord{}, err
	}

	normalized, err := normalizeUserCreation(cmd)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	passwordHash, err := s.passwords.Hash(normalized.Password)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	user, err := s.users.CreateAdminUser(ctx, ports.CreateAdminUserInput{
		UserID:       s.ids.NewID(),
		Email:        normalized.Email,
		DisplayName:  normalized.DisplayName,
		PasswordHash: passwordHash,
		Role:         normalized.Role,
	})
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created admin user",
		TargetType:  "admin_user",
		TargetID:    user.UserID.String(),
		TargetLabel: user.Email,
		Summary:     "Operator created a new admin user.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"role":         string(user.Role),
			"display_name": user.DisplayName,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (s Service) UpdateUser(ctx context.Context, cmd UpdateUserCommand) (ports.AdminUserRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAdminUsers); err != nil {
		return ports.AdminUserRecord{}, err
	}
	if cmd.UserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" || !cmd.Role.Valid() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	if cmd.UserID == cmd.ActorUserID && (!cmd.IsActive || cmd.Role != admindomain.RoleOwner) {
		return ports.AdminUserRecord{}, authdomain.ErrForbidden
	}

	user, err := s.users.UpdateAdminUser(ctx, ports.UpdateAdminUserInput{
		UserID:      cmd.UserID,
		DisplayName: displayName,
		Role:        cmd.Role,
		IsActive:    cmd.IsActive,
	})
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated admin user",
		TargetType:  "admin_user",
		TargetID:    user.UserID.String(),
		TargetLabel: user.Email,
		Summary:     "Operator updated an admin user account.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"role":         string(user.Role),
			"display_name": user.DisplayName,
			"is_active":    boolString(user.IsActive),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminUserRecord{}, err
	}

	return user, nil
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

	return ports.UpdateAdminPlatformSettingsInput{
		PlatformName:                 platformName,
		SupportEmail:                 supportEmail,
		VerificationSLAHours:         cmd.VerificationSLAHours,
		PayoutReviewThresholdPesewas: cmd.PayoutReviewThresholdPesewas,
		MaintenanceMode:              cmd.MaintenanceMode,
	}, nil
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

func normalizeOperatorNote(value string) string {
	note := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(note)
	if len(runes) > 600 {
		return string(runes[:600])
	}
	return note
}

func normalizeEmail(value string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}

	return strings.ToLower(parsed.Address), nil
}

func (s Service) authorizePermission(
	ctx context.Context,
	role admindomain.Role,
	permission admindomain.Permission,
) error {
	permissions, err := s.permissionsForRole(ctx, role)
	if err != nil {
		return err
	}
	for _, candidate := range permissions {
		if candidate == permission {
			return nil
		}
	}
	return authdomain.ErrForbidden
}

func (s Service) permissionsForRole(ctx context.Context, role admindomain.Role) ([]admindomain.Permission, error) {
	records, err := s.ListRolePermissions(ctx)
	if err != nil {
		return nil, err
	}
	for _, record := range records {
		if record.Role == role {
			return record.Permissions, nil
		}
	}
	return nil, authdomain.ErrForbidden
}

func normalizeRolePermissionRecords(records []ports.AdminRolePermissionsRecord) ([]ports.AdminRolePermissionsRecord, error) {
	byRole := make(map[admindomain.Role][]admindomain.Permission, len(admindomain.RoleCatalog()))
	for _, record := range records {
		if !record.Role.Valid() {
			return nil, authdomain.ErrInvalidInput
		}
		byRole[record.Role] = append(byRole[record.Role], record.Permissions...)
	}

	out := make([]ports.AdminRolePermissionsRecord, 0, len(admindomain.RoleCatalog()))
	for _, role := range admindomain.RoleCatalog() {
		permissions, err := normalizePermissionSet(role, byRole[role])
		if err != nil {
			return nil, err
		}
		out = append(out, ports.AdminRolePermissionsRecord{
			Role:        role,
			Permissions: permissions,
		})
	}

	return out, nil
}

func normalizePermissionSet(
	role admindomain.Role,
	permissions []admindomain.Permission,
) ([]admindomain.Permission, error) {
	if !role.Valid() {
		return nil, authdomain.ErrInvalidInput
	}

	selected := make(map[admindomain.Permission]bool, len(permissions))
	for _, permission := range permissions {
		if !permission.Valid() {
			return nil, authdomain.ErrInvalidInput
		}
		selected[permission] = true
	}

	if role == admindomain.RoleOwner {
		for _, permission := range requiredOwnerPermissions() {
			if !selected[permission] {
				return nil, authdomain.ErrInvalidInput
			}
		}
	}

	out := make([]admindomain.Permission, 0, len(selected))
	for _, permission := range admindomain.PermissionCatalog() {
		if selected[permission] {
			out = append(out, permission)
		}
	}
	return out, nil
}

func requiredOwnerPermissions() []admindomain.Permission {
	return []admindomain.Permission{
		admindomain.PermissionManageAdminUsers,
		admindomain.PermissionManageRoles,
	}
}

func normalizeSubscriptionStatus(value string) (string, error) {
	switch strings.TrimSpace(value) {
	case "active", "trialing", "past_due", "grace_period", "cancel_at_period_end", "canceled":
		return strings.TrimSpace(value), nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

func normalizeSubscriptionBillingMode(value string) (string, error) {
	switch strings.TrimSpace(value) {
	case "manual", "payment_link", "recurring":
		return strings.TrimSpace(value), nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

func normalizeSubscriptionProviderRefs(
	billingMode string,
	customerRef string,
	subscriptionRef string,
) (string, string, error) {
	if billingMode == "manual" {
		return "", "", nil
	}

	normalizedCustomerRef, err := normalizeProviderReference(customerRef)
	if err != nil {
		return "", "", err
	}
	normalizedSubscriptionRef, err := normalizeProviderReference(subscriptionRef)
	if err != nil {
		return "", "", err
	}
	if billingMode == "recurring" && normalizedSubscriptionRef == "" {
		return "", "", authdomain.ErrInvalidInput
	}
	return normalizedCustomerRef, normalizedSubscriptionRef, nil
}

func normalizeProviderReference(value string) (string, error) {
	ref := strings.TrimSpace(value)
	if ref == "" {
		return "", nil
	}
	if len([]rune(ref)) > 160 || strings.ContainsAny(ref, " \t\r\n") {
		return "", authdomain.ErrInvalidInput
	}
	return ref, nil
}

func subscriptionUpdateSummary(status string, billingMode string) string {
	return "Subscription moved to " + strings.ReplaceAll(status, "_", " ") +
		" using " + strings.ReplaceAll(billingMode, "_", " ") + " billing."
}

func subscriptionUpdateSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "past_due", "grace_period", "cancel_at_period_end":
		return admindomain.AuditSeverityWarning
	case "canceled":
		return admindomain.AuditSeverityCritical
	default:
		return admindomain.AuditSeverityInfo
	}
}

func subscriptionInvoiceDueAt(now time.Time, value *time.Time) time.Time {
	if value == nil || value.IsZero() {
		return now.Add(7 * 24 * time.Hour)
	}
	return *value
}

func subscriptionInvoiceRef(invoiceID common.ID) string {
	compact := strings.ReplaceAll(invoiceID.String(), "-", "")
	if len(compact) > 12 {
		compact = compact[:12]
	}
	if compact == "" {
		compact = "manual"
	}
	return "XTSUB-" + strings.ToUpper(compact)
}

func normalizePaymentURL(value string) (string, error) {
	trimmed := normalizeOperatorNote(value)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return "", authdomain.ErrInvalidInput
	}
	return trimmed, nil
}

func normalizeCreatePlanInput(cmd CreatePlanCommand) (ports.CreateAdminPlanInput, error) {
	code := normalizePlanCode(cmd.Code)
	if !validPlanCode(code) {
		return ports.CreateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	name := normalizePlanName(cmd.Name)
	if name == "" {
		return ports.CreateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	if !validPlanEconomics(cmd.MonthlyFeeMinor, cmd.CommissionBPS, cmd.DesignLimit) {
		return ports.CreateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	return ports.CreateAdminPlanInput{
		Code:            code,
		Name:            name,
		MonthlyFeeMinor: cmd.MonthlyFeeMinor,
		CommissionBPS:   cmd.CommissionBPS,
		DesignLimit:     copyOptionalInt(cmd.DesignLimit),
	}, nil
}

func normalizeUpdatePlanInput(cmd UpdatePlanCommand) (ports.UpdateAdminPlanInput, error) {
	name := normalizePlanName(cmd.Name)
	if name == "" {
		return ports.UpdateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	if !validPlanEconomics(cmd.MonthlyFeeMinor, cmd.CommissionBPS, cmd.DesignLimit) {
		return ports.UpdateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	return ports.UpdateAdminPlanInput{
		PlanID:          cmd.PlanID,
		Name:            name,
		MonthlyFeeMinor: cmd.MonthlyFeeMinor,
		CommissionBPS:   cmd.CommissionBPS,
		DesignLimit:     copyOptionalInt(cmd.DesignLimit),
		IsActive:        cmd.IsActive,
	}, nil
}

func normalizePlanCode(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizePlanName(value string) string {
	name := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(name)
	if len(runes) > 80 {
		return string(runes[:80])
	}
	return name
}

func validPlanCode(value string) bool {
	if len(value) < 2 || len(value) > 32 {
		return false
	}
	for index, char := range value {
		valid := (char >= 'a' && char <= 'z') ||
			(char >= '0' && char <= '9') ||
			char == '-' ||
			char == '_'
		if !valid {
			return false
		}
		if index == 0 && !((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
			return false
		}
	}
	last := value[len(value)-1]
	return (last >= 'a' && last <= 'z') || (last >= '0' && last <= '9')
}

func validPlanEconomics(monthlyFeeMinor int64, commissionBPS int, designLimit *int) bool {
	if monthlyFeeMinor < 0 || commissionBPS < 0 || commissionBPS > 10000 {
		return false
	}
	if designLimit != nil && *designLimit < 0 {
		return false
	}
	return true
}

func copyOptionalInt(value *int) *int {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func planAuditSummary(record ports.AdminPlanRecord) string {
	fee := "free"
	if record.MonthlyFeeMinor > 0 {
		fee = "GHS " + strconv.FormatFloat(float64(record.MonthlyFeeMinor)/100, 'f', 2, 64)
	}
	return record.Code + " package set to " + fee +
		" and " + strconv.FormatFloat(float64(record.CommissionBPS)/100, 'f', 2, 64) +
		"% commission."
}

func planAuditSeverity(active bool) admindomain.AuditSeverity {
	if active {
		return admindomain.AuditSeverityInfo
	}
	return admindomain.AuditSeverityWarning
}

func normalizeCreatePromotionInput(cmd CreatePromotionCommand, promotionID common.ID) (ports.CreateAdminPromotionInput, error) {
	normalized, err := normalizePromotionFields(promotionFields{
		BusinessID:            cmd.BusinessID,
		Code:                  cmd.Code,
		Title:                 cmd.Title,
		Description:           cmd.Description,
		DiscountType:          cmd.DiscountType,
		DiscountValue:         cmd.DiscountValue,
		MaxDiscountMinor:      cmd.MaxDiscountMinor,
		MinSpendMinor:         cmd.MinSpendMinor,
		UsageLimitGlobal:      cmd.UsageLimitGlobal,
		UsageLimitPerCustomer: cmd.UsageLimitPerCustomer,
		FundingSource:         cmd.FundingSource,
		Scope:                 cmd.Scope,
		TargetCollectionID:    cmd.TargetCollectionID,
		TargetDesignID:        cmd.TargetDesignID,
		Status:                cmd.Status,
		StartsAt:              cmd.StartsAt,
		EndsAt:                cmd.EndsAt,
	})
	if err != nil {
		return ports.CreateAdminPromotionInput{}, err
	}
	return ports.CreateAdminPromotionInput{
		PromotionID:           promotionID,
		BusinessID:            normalized.BusinessID,
		Code:                  normalized.Code,
		Title:                 normalized.Title,
		Description:           normalized.Description,
		DiscountType:          normalized.DiscountType,
		DiscountValue:         normalized.DiscountValue,
		MaxDiscountMinor:      normalized.MaxDiscountMinor,
		MinSpendMinor:         normalized.MinSpendMinor,
		UsageLimitGlobal:      normalized.UsageLimitGlobal,
		UsageLimitPerCustomer: normalized.UsageLimitPerCustomer,
		FundingSource:         normalized.FundingSource,
		Scope:                 normalized.Scope,
		TargetCollectionID:    normalized.TargetCollectionID,
		TargetDesignID:        normalized.TargetDesignID,
		Status:                normalized.Status,
		StartsAt:              normalized.StartsAt,
		EndsAt:                normalized.EndsAt,
		ActorAdminUser:        cmd.ActorUserID,
	}, nil
}

func normalizeUpdatePromotionInput(cmd UpdatePromotionCommand) (ports.UpdateAdminPromotionInput, error) {
	normalized, err := normalizePromotionFields(promotionFields{
		BusinessID:            cmd.BusinessID,
		Code:                  cmd.Code,
		Title:                 cmd.Title,
		Description:           cmd.Description,
		DiscountType:          cmd.DiscountType,
		DiscountValue:         cmd.DiscountValue,
		MaxDiscountMinor:      cmd.MaxDiscountMinor,
		MinSpendMinor:         cmd.MinSpendMinor,
		UsageLimitGlobal:      cmd.UsageLimitGlobal,
		UsageLimitPerCustomer: cmd.UsageLimitPerCustomer,
		FundingSource:         cmd.FundingSource,
		Scope:                 cmd.Scope,
		TargetCollectionID:    cmd.TargetCollectionID,
		TargetDesignID:        cmd.TargetDesignID,
		Status:                cmd.Status,
		StartsAt:              cmd.StartsAt,
		EndsAt:                cmd.EndsAt,
	})
	if err != nil {
		return ports.UpdateAdminPromotionInput{}, err
	}
	return ports.UpdateAdminPromotionInput{
		PromotionID:           cmd.PromotionID,
		BusinessID:            normalized.BusinessID,
		Code:                  normalized.Code,
		Title:                 normalized.Title,
		Description:           normalized.Description,
		DiscountType:          normalized.DiscountType,
		DiscountValue:         normalized.DiscountValue,
		MaxDiscountMinor:      normalized.MaxDiscountMinor,
		MinSpendMinor:         normalized.MinSpendMinor,
		UsageLimitGlobal:      normalized.UsageLimitGlobal,
		UsageLimitPerCustomer: normalized.UsageLimitPerCustomer,
		FundingSource:         normalized.FundingSource,
		Scope:                 normalized.Scope,
		TargetCollectionID:    normalized.TargetCollectionID,
		TargetDesignID:        normalized.TargetDesignID,
		Status:                normalized.Status,
		StartsAt:              normalized.StartsAt,
		EndsAt:                normalized.EndsAt,
		ActorAdminUser:        cmd.ActorUserID,
	}, nil
}

type promotionFields struct {
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
}

func normalizePromotionFields(input promotionFields) (promotionFields, error) {
	businessID := copyOptionalID(input.BusinessID)
	if businessID != nil && businessID.IsZero() {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	code := normalizePromotionCode(input.Code)
	if code != "" && !validPromotionCode(code) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	title := normalizePromotionTitle(input.Title)
	if title == "" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	description := normalizeOperatorNote(input.Description)
	discountType := normalizePromotionOption(input.DiscountType, "percentage")
	if discountType != "percentage" && discountType != "fixed" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	if !validPromotionDiscount(discountType, input.DiscountValue, input.MaxDiscountMinor) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	if input.MinSpendMinor < 0 ||
		(input.UsageLimitGlobal != nil && *input.UsageLimitGlobal <= 0) ||
		(input.UsageLimitPerCustomer != nil && *input.UsageLimitPerCustomer <= 0) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	fundingSource := normalizePromotionOption(input.FundingSource, "business")
	if fundingSource != "business" && fundingSource != "platform" && fundingSource != "split" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	scope := normalizePromotionOption(input.Scope, "store")
	if scope != "store" && scope != "collection" && scope != "design" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	targetCollectionID := copyOptionalID(input.TargetCollectionID)
	targetDesignID := copyOptionalID(input.TargetDesignID)
	if (targetCollectionID != nil && targetCollectionID.IsZero()) ||
		(targetDesignID != nil && targetDesignID.IsZero()) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	switch scope {
	case "store":
		if targetCollectionID != nil || targetDesignID != nil {
			return promotionFields{}, authdomain.ErrInvalidInput
		}
	case "collection":
		if targetCollectionID == nil || targetDesignID != nil {
			return promotionFields{}, authdomain.ErrInvalidInput
		}
	case "design":
		if targetDesignID == nil || targetCollectionID != nil {
			return promotionFields{}, authdomain.ErrInvalidInput
		}
	}
	status := normalizePromotionOption(input.Status, "active")
	if status != "active" && status != "paused" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	if input.StartsAt != nil && input.EndsAt != nil && !input.EndsAt.After(*input.StartsAt) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	return promotionFields{
		BusinessID:            businessID,
		Code:                  code,
		Title:                 title,
		Description:           description,
		DiscountType:          discountType,
		DiscountValue:         input.DiscountValue,
		MaxDiscountMinor:      copyOptionalInt64(input.MaxDiscountMinor),
		MinSpendMinor:         input.MinSpendMinor,
		UsageLimitGlobal:      copyOptionalInt(input.UsageLimitGlobal),
		UsageLimitPerCustomer: copyOptionalInt(input.UsageLimitPerCustomer),
		FundingSource:         fundingSource,
		Scope:                 scope,
		TargetCollectionID:    targetCollectionID,
		TargetDesignID:        targetDesignID,
		Status:                status,
		StartsAt:              copyOptionalTime(input.StartsAt),
		EndsAt:                copyOptionalTime(input.EndsAt),
	}, nil
}

func normalizePromotionCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizePromotionTitle(value string) string {
	title := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(title)
	if len(runes) > 96 {
		return string(runes[:96])
	}
	return title
}

func normalizePromotionOption(value string, fallback string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return fallback
	}
	return normalized
}

func validPromotionCode(value string) bool {
	if len(value) < 3 || len(value) > 32 {
		return false
	}
	for index, char := range value {
		valid := (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char == '-' ||
			char == '_'
		if !valid {
			return false
		}
		if index == 0 && !((char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
			return false
		}
	}
	last := value[len(value)-1]
	return (last >= 'A' && last <= 'Z') || (last >= '0' && last <= '9')
}

func validPromotionDiscount(discountType string, value int64, maxDiscountMinor *int64) bool {
	if discountType == "percentage" {
		return value > 0 && value <= 10000 && maxDiscountMinor != nil && *maxDiscountMinor > 0
	}
	return value > 0 && (maxDiscountMinor == nil || *maxDiscountMinor >= 0)
}

func copyOptionalID(value *common.ID) *common.ID {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func copyOptionalInt64(value *int64) *int64 {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func copyOptionalTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func promotionAuditSummary(record ports.AdminPromotionRecord) string {
	discount := formatPromotionDiscount(record)
	scope := "platform-wide"
	if record.BusinessName != "" {
		scope = record.BusinessName
	}
	return record.Title + " gives " + discount + " for " + scope + "."
}

func promotionAuditMetadata(record ports.AdminPromotionRecord) map[string]string {
	metadata := map[string]string{
		"code":             record.Code,
		"discount_type":    record.DiscountType,
		"discount_value":   strconv.FormatInt(record.DiscountValue, 10),
		"funding_source":   record.FundingSource,
		"scope":            record.Scope,
		"status":           record.Status,
		"min_spend_minor":  strconv.FormatInt(record.MinSpendMinor, 10),
		"redemption_count": strconv.Itoa(record.RedemptionCount),
	}
	if record.BusinessID != nil {
		metadata["business_id"] = record.BusinessID.String()
	}
	if record.MaxDiscountMinor != nil {
		metadata["max_discount_minor"] = strconv.FormatInt(*record.MaxDiscountMinor, 10)
	}
	return metadata
}

func promotionAuditSeverity(status string) admindomain.AuditSeverity {
	if status == "active" {
		return admindomain.AuditSeverityInfo
	}
	return admindomain.AuditSeverityWarning
}

func formatPromotionDiscount(record ports.AdminPromotionRecord) string {
	if record.DiscountType == "percentage" {
		return strconv.FormatFloat(float64(record.DiscountValue)/100, 'f', 2, 64) + "%"
	}
	return "GHS " + strconv.FormatFloat(float64(record.DiscountValue)/100, 'f', 2, 64)
}

func normalizeCreateAdCampaignInput(
	cmd CreateAdCampaignCommand,
	campaignID common.ID,
) (ports.CreateAdminAdCampaignInput, error) {
	normalized, err := normalizeAdCampaignFields(adCampaignFields{
		BusinessID:    cmd.BusinessID,
		PlacementType: cmd.PlacementType,
		TargetRefID:   cmd.TargetRefID,
		Headline:      cmd.Headline,
		Description:   cmd.Description,
		Status:        cmd.Status,
		PricingModel:  cmd.PricingModel,
		BudgetMinor:   cmd.BudgetMinor,
		DailyCapMinor: cmd.DailyCapMinor,
		StartsAt:      cmd.StartsAt,
		EndsAt:        cmd.EndsAt,
		ReviewNote:    cmd.ReviewNote,
	})
	if err != nil {
		return ports.CreateAdminAdCampaignInput{}, err
	}
	return ports.CreateAdminAdCampaignInput{
		CampaignID:     campaignID,
		BusinessID:     normalized.BusinessID,
		PlacementType:  normalized.PlacementType,
		TargetRefID:    normalized.TargetRefID,
		Headline:       normalized.Headline,
		Description:    normalized.Description,
		Status:         normalized.Status,
		PricingModel:   normalized.PricingModel,
		BudgetMinor:    normalized.BudgetMinor,
		DailyCapMinor:  normalized.DailyCapMinor,
		StartsAt:       *normalized.StartsAt,
		EndsAt:         *normalized.EndsAt,
		ReviewNote:     normalized.ReviewNote,
		ActorAdminUser: cmd.ActorUserID,
	}, nil
}

func normalizeUpdateAdCampaignInput(cmd UpdateAdCampaignCommand) (ports.UpdateAdminAdCampaignInput, error) {
	normalized, err := normalizeAdCampaignFields(adCampaignFields{
		BusinessID:    cmd.BusinessID,
		PlacementType: cmd.PlacementType,
		TargetRefID:   cmd.TargetRefID,
		Headline:      cmd.Headline,
		Description:   cmd.Description,
		Status:        cmd.Status,
		PricingModel:  cmd.PricingModel,
		BudgetMinor:   cmd.BudgetMinor,
		DailyCapMinor: cmd.DailyCapMinor,
		StartsAt:      cmd.StartsAt,
		EndsAt:        cmd.EndsAt,
		ReviewNote:    cmd.ReviewNote,
	})
	if err != nil {
		return ports.UpdateAdminAdCampaignInput{}, err
	}
	return ports.UpdateAdminAdCampaignInput{
		CampaignID:     cmd.CampaignID,
		BusinessID:     normalized.BusinessID,
		PlacementType:  normalized.PlacementType,
		TargetRefID:    normalized.TargetRefID,
		Headline:       normalized.Headline,
		Description:    normalized.Description,
		Status:         normalized.Status,
		PricingModel:   normalized.PricingModel,
		BudgetMinor:    normalized.BudgetMinor,
		DailyCapMinor:  normalized.DailyCapMinor,
		StartsAt:       *normalized.StartsAt,
		EndsAt:         *normalized.EndsAt,
		ReviewNote:     normalized.ReviewNote,
		ActorAdminUser: cmd.ActorUserID,
	}, nil
}

type adCampaignFields struct {
	BusinessID    common.ID
	PlacementType string
	TargetRefID   string
	Headline      string
	Description   string
	Status        string
	PricingModel  string
	BudgetMinor   int64
	DailyCapMinor *int64
	StartsAt      *time.Time
	EndsAt        *time.Time
	ReviewNote    string
}

func normalizeAdCampaignFields(input adCampaignFields) (adCampaignFields, error) {
	if input.BusinessID.IsZero() || input.StartsAt == nil || input.EndsAt == nil {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	if !input.EndsAt.After(*input.StartsAt) {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	placementType := normalizePromotionOption(input.PlacementType, "featured_business")
	if placementType != "featured_business" &&
		placementType != "promoted_design" &&
		placementType != "homepage_hero" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	targetRefID := strings.TrimSpace(input.TargetRefID)
	if placementType == "promoted_design" && targetRefID == "" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	headline := normalizeAdHeadline(input.Headline)
	if headline == "" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	status := normalizePromotionOption(input.Status, "pending_review")
	if status != "pending_review" && status != "active" && status != "paused" && status != "completed" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	pricingModel := normalizePromotionOption(input.PricingModel, "flat_time")
	if pricingModel != "flat_time" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	if input.BudgetMinor <= 0 || (input.DailyCapMinor != nil && *input.DailyCapMinor <= 0) {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	return adCampaignFields{
		BusinessID:    input.BusinessID,
		PlacementType: placementType,
		TargetRefID:   targetRefID,
		Headline:      headline,
		Description:   normalizeOperatorNote(input.Description),
		Status:        status,
		PricingModel:  pricingModel,
		BudgetMinor:   input.BudgetMinor,
		DailyCapMinor: copyOptionalInt64(input.DailyCapMinor),
		StartsAt:      copyOptionalTime(input.StartsAt),
		EndsAt:        copyOptionalTime(input.EndsAt),
		ReviewNote:    normalizeOperatorNote(input.ReviewNote),
	}, nil
}

func normalizeAdHeadline(value string) string {
	headline := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(headline)
	if len(runes) > 96 {
		return string(runes[:96])
	}
	return headline
}

func adCampaignAuditSummary(record ports.AdminAdCampaignRecord) string {
	return record.Headline + " runs as " + adPlacementLabel(record.PlacementType) +
		" for " + record.BusinessName + "."
}

func adCampaignAuditMetadata(record ports.AdminAdCampaignRecord) map[string]string {
	metadata := map[string]string{
		"business_id":      record.BusinessID.String(),
		"placement_type":   record.PlacementType,
		"target_ref_id":    record.TargetRefID,
		"status":           record.Status,
		"pricing_model":    record.PricingModel,
		"budget_minor":     strconv.FormatInt(record.BudgetMinor, 10),
		"spend_minor":      strconv.FormatInt(record.SpendMinor, 10),
		"impression_count": strconv.Itoa(record.ImpressionCount),
		"click_count":      strconv.Itoa(record.ClickCount),
	}
	if record.DailyCapMinor != nil {
		metadata["daily_cap_minor"] = strconv.FormatInt(*record.DailyCapMinor, 10)
	}
	return metadata
}

func adCampaignAuditSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "active":
		return admindomain.AuditSeverityInfo
	case "pending_review":
		return admindomain.AuditSeverityInfo
	default:
		return admindomain.AuditSeverityWarning
	}
}

func adPlacementLabel(value string) string {
	switch value {
	case "homepage_hero":
		return "homepage hero"
	case "promoted_design":
		return "promoted design"
	default:
		return "featured business"
	}
}

func normalizeCreateAffiliateInput(
	cmd CreateAffiliateCommand,
	affiliateID common.ID,
) (ports.CreateAdminAffiliateInput, error) {
	normalized, err := normalizeAffiliateFields(affiliateFields{
		EntityType:       cmd.EntityType,
		Code:             cmd.Code,
		DisplayName:      cmd.DisplayName,
		ContactName:      cmd.ContactName,
		Email:            cmd.Email,
		Phone:            cmd.Phone,
		WebsiteURL:       cmd.WebsiteURL,
		CommissionModel:  cmd.CommissionModel,
		CommissionRate:   cmd.CommissionRate,
		CookieWindowDays: cmd.CookieWindowDays,
		PayoutMode:       cmd.PayoutMode,
		PayoutReference:  cmd.PayoutReference,
		Status:           cmd.Status,
		Notes:            cmd.Notes,
	})
	if err != nil {
		return ports.CreateAdminAffiliateInput{}, err
	}
	return ports.CreateAdminAffiliateInput{
		AffiliateID:      affiliateID,
		EntityType:       normalized.EntityType,
		Code:             normalized.Code,
		DisplayName:      normalized.DisplayName,
		ContactName:      normalized.ContactName,
		Email:            normalized.Email,
		Phone:            normalized.Phone,
		WebsiteURL:       normalized.WebsiteURL,
		CommissionModel:  normalized.CommissionModel,
		CommissionRate:   normalized.CommissionRate,
		CookieWindowDays: normalized.CookieWindowDays,
		PayoutMode:       normalized.PayoutMode,
		PayoutReference:  normalized.PayoutReference,
		Status:           normalized.Status,
		Notes:            normalized.Notes,
		ActorAdminUser:   cmd.ActorUserID,
	}, nil
}

func normalizeUpdateAffiliateInput(cmd UpdateAffiliateCommand) (ports.UpdateAdminAffiliateInput, error) {
	normalized, err := normalizeAffiliateFields(affiliateFields{
		EntityType:       cmd.EntityType,
		Code:             cmd.Code,
		DisplayName:      cmd.DisplayName,
		ContactName:      cmd.ContactName,
		Email:            cmd.Email,
		Phone:            cmd.Phone,
		WebsiteURL:       cmd.WebsiteURL,
		CommissionModel:  cmd.CommissionModel,
		CommissionRate:   cmd.CommissionRate,
		CookieWindowDays: cmd.CookieWindowDays,
		PayoutMode:       cmd.PayoutMode,
		PayoutReference:  cmd.PayoutReference,
		Status:           cmd.Status,
		Notes:            cmd.Notes,
	})
	if err != nil {
		return ports.UpdateAdminAffiliateInput{}, err
	}
	return ports.UpdateAdminAffiliateInput{
		AffiliateID:      cmd.AffiliateID,
		EntityType:       normalized.EntityType,
		Code:             normalized.Code,
		DisplayName:      normalized.DisplayName,
		ContactName:      normalized.ContactName,
		Email:            normalized.Email,
		Phone:            normalized.Phone,
		WebsiteURL:       normalized.WebsiteURL,
		CommissionModel:  normalized.CommissionModel,
		CommissionRate:   normalized.CommissionRate,
		CookieWindowDays: normalized.CookieWindowDays,
		PayoutMode:       normalized.PayoutMode,
		PayoutReference:  normalized.PayoutReference,
		Status:           normalized.Status,
		Notes:            normalized.Notes,
		ActorAdminUser:   cmd.ActorUserID,
	}, nil
}

type affiliateFields struct {
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
}

func normalizeAffiliateFields(input affiliateFields) (affiliateFields, error) {
	entityType := normalizePromotionOption(input.EntityType, "person")
	if entityType != "person" && entityType != "business" && entityType != "agency" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	code := normalizePromotionCode(input.Code)
	if !validPromotionCode(code) {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	displayName := normalizePromotionTitle(input.DisplayName)
	if displayName == "" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	email := strings.TrimSpace(input.Email)
	if email != "" {
		normalized, err := normalizeEmail(email)
		if err != nil {
			return affiliateFields{}, authdomain.ErrInvalidInput
		}
		email = normalized
	}
	websiteURL, err := normalizeAffiliateURL(input.WebsiteURL)
	if err != nil {
		return affiliateFields{}, err
	}
	commissionModel := normalizePromotionOption(input.CommissionModel, "percentage")
	if commissionModel != "percentage" && commissionModel != "flat" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	if input.CommissionRate <= 0 ||
		(commissionModel == "percentage" && input.CommissionRate > 10000) {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	cookieWindowDays := input.CookieWindowDays
	if cookieWindowDays == 0 {
		cookieWindowDays = 30
	}
	if cookieWindowDays < 1 || cookieWindowDays > 365 {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	payoutMode := normalizePromotionOption(input.PayoutMode, "voucher")
	if payoutMode != "paystack_split" &&
		payoutMode != "paystack_transfer" &&
		payoutMode != "voucher" &&
		payoutMode != "manual" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	status := normalizePromotionOption(input.Status, "pending_review")
	if status != "pending_review" && status != "active" && status != "paused" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	return affiliateFields{
		EntityType:       entityType,
		Code:             code,
		DisplayName:      displayName,
		ContactName:      normalizePromotionTitle(input.ContactName),
		Email:            email,
		Phone:            strings.Join(strings.Fields(strings.TrimSpace(input.Phone)), " "),
		WebsiteURL:       websiteURL,
		CommissionModel:  commissionModel,
		CommissionRate:   input.CommissionRate,
		CookieWindowDays: cookieWindowDays,
		PayoutMode:       payoutMode,
		PayoutReference:  normalizeOperatorNote(input.PayoutReference),
		Status:           status,
		Notes:            normalizeOperatorNote(input.Notes),
	}, nil
}

func normalizeAffiliateURL(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", authdomain.ErrInvalidInput
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", authdomain.ErrInvalidInput
	}
	return parsed.String(), nil
}

func affiliateAuditSummary(record ports.AdminAffiliateRecord) string {
	return record.DisplayName + " uses code " + record.Code +
		" with " + affiliateCommissionLabel(record) + "."
}

func affiliateAuditMetadata(record ports.AdminAffiliateRecord) map[string]string {
	return map[string]string{
		"affiliate_id":       record.AffiliateID.String(),
		"entity_type":        record.EntityType,
		"code":               record.Code,
		"commission_model":   record.CommissionModel,
		"commission_rate":    strconv.FormatInt(record.CommissionRate, 10),
		"cookie_window_days": strconv.Itoa(record.CookieWindowDays),
		"payout_mode":        record.PayoutMode,
		"status":             record.Status,
	}
}

func affiliateAuditSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "active":
		return admindomain.AuditSeverityInfo
	default:
		return admindomain.AuditSeverityWarning
	}
}

func affiliateCommissionLabel(record ports.AdminAffiliateRecord) string {
	if record.CommissionModel == "percentage" {
		return strconv.FormatFloat(float64(record.CommissionRate)/100, 'f', 2, 64) + "% commission"
	}
	return "GHS " + strconv.FormatFloat(float64(record.CommissionRate)/100, 'f', 2, 64) + " flat commission"
}

func normalizeCreateReferralProgrammeInput(
	cmd CreateReferralProgrammeCommand,
	programmeID common.ID,
) (ports.CreateAdminReferralProgrammeInput, error) {
	normalized, err := normalizeReferralProgrammeFields(referralProgrammeFields{
		Title:                   cmd.Title,
		CodePrefix:              cmd.CodePrefix,
		Audience:                cmd.Audience,
		ReferrerRewardKind:      cmd.ReferrerRewardKind,
		RefereeRewardKind:       cmd.RefereeRewardKind,
		RewardType:              cmd.RewardType,
		RewardValue:             cmd.RewardValue,
		MaxRewardMinor:          cmd.MaxRewardMinor,
		QualifyingOrderMinMinor: cmd.QualifyingOrderMinMinor,
		RewardHoldDays:          cmd.RewardHoldDays,
		Status:                  cmd.Status,
		StartsAt:                cmd.StartsAt,
		EndsAt:                  cmd.EndsAt,
		Notes:                   cmd.Notes,
	})
	if err != nil {
		return ports.CreateAdminReferralProgrammeInput{}, err
	}
	return ports.CreateAdminReferralProgrammeInput{
		ProgrammeID:             programmeID,
		Title:                   normalized.Title,
		CodePrefix:              normalized.CodePrefix,
		Audience:                normalized.Audience,
		ReferrerRewardKind:      normalized.ReferrerRewardKind,
		RefereeRewardKind:       normalized.RefereeRewardKind,
		RewardType:              normalized.RewardType,
		RewardValue:             normalized.RewardValue,
		MaxRewardMinor:          normalized.MaxRewardMinor,
		QualifyingOrderMinMinor: normalized.QualifyingOrderMinMinor,
		RewardHoldDays:          normalized.RewardHoldDays,
		Status:                  normalized.Status,
		StartsAt:                normalized.StartsAt,
		EndsAt:                  normalized.EndsAt,
		Notes:                   normalized.Notes,
		ActorAdminUser:          cmd.ActorUserID,
	}, nil
}

func normalizeUpdateReferralProgrammeInput(cmd UpdateReferralProgrammeCommand) (ports.UpdateAdminReferralProgrammeInput, error) {
	normalized, err := normalizeReferralProgrammeFields(referralProgrammeFields{
		Title:                   cmd.Title,
		CodePrefix:              cmd.CodePrefix,
		Audience:                cmd.Audience,
		ReferrerRewardKind:      cmd.ReferrerRewardKind,
		RefereeRewardKind:       cmd.RefereeRewardKind,
		RewardType:              cmd.RewardType,
		RewardValue:             cmd.RewardValue,
		MaxRewardMinor:          cmd.MaxRewardMinor,
		QualifyingOrderMinMinor: cmd.QualifyingOrderMinMinor,
		RewardHoldDays:          cmd.RewardHoldDays,
		Status:                  cmd.Status,
		StartsAt:                cmd.StartsAt,
		EndsAt:                  cmd.EndsAt,
		Notes:                   cmd.Notes,
	})
	if err != nil {
		return ports.UpdateAdminReferralProgrammeInput{}, err
	}
	return ports.UpdateAdminReferralProgrammeInput{
		ProgrammeID:             cmd.ProgrammeID,
		Title:                   normalized.Title,
		CodePrefix:              normalized.CodePrefix,
		Audience:                normalized.Audience,
		ReferrerRewardKind:      normalized.ReferrerRewardKind,
		RefereeRewardKind:       normalized.RefereeRewardKind,
		RewardType:              normalized.RewardType,
		RewardValue:             normalized.RewardValue,
		MaxRewardMinor:          normalized.MaxRewardMinor,
		QualifyingOrderMinMinor: normalized.QualifyingOrderMinMinor,
		RewardHoldDays:          normalized.RewardHoldDays,
		Status:                  normalized.Status,
		StartsAt:                normalized.StartsAt,
		EndsAt:                  normalized.EndsAt,
		Notes:                   normalized.Notes,
		ActorAdminUser:          cmd.ActorUserID,
	}, nil
}

type referralProgrammeFields struct {
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
}

func normalizeReferralProgrammeFields(input referralProgrammeFields) (referralProgrammeFields, error) {
	title := normalizePromotionTitle(input.Title)
	if title == "" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	codePrefix := normalizePromotionCode(input.CodePrefix)
	if !validReferralCodePrefix(codePrefix) {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	audience := normalizePromotionOption(input.Audience, "customers")
	if audience != "customers" && audience != "businesses" && audience != "mixed" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	referrerRewardKind := normalizePromotionOption(input.ReferrerRewardKind, "voucher")
	if referrerRewardKind != "voucher" &&
		referrerRewardKind != "commission_rebate" &&
		referrerRewardKind != "none" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	refereeRewardKind := normalizePromotionOption(input.RefereeRewardKind, "voucher")
	if refereeRewardKind != "voucher" && refereeRewardKind != "none" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if referrerRewardKind == "none" && refereeRewardKind == "none" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	rewardType := normalizePromotionOption(input.RewardType, "fixed")
	if rewardType != "percentage" && rewardType != "fixed" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if rewardType == "percentage" {
		if input.RewardValue <= 0 || input.RewardValue > 10000 || input.MaxRewardMinor == nil || *input.MaxRewardMinor <= 0 {
			return referralProgrammeFields{}, authdomain.ErrInvalidInput
		}
	} else if input.RewardValue <= 0 || (input.MaxRewardMinor != nil && *input.MaxRewardMinor <= 0) {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	rewardHoldDays := input.RewardHoldDays
	if rewardHoldDays == 0 {
		rewardHoldDays = 14
	}
	status := normalizePromotionOption(input.Status, "draft")
	if status != "draft" && status != "active" && status != "paused" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if input.QualifyingOrderMinMinor < 0 || rewardHoldDays < 0 || rewardHoldDays > 180 {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if input.StartsAt != nil && input.EndsAt != nil && !input.EndsAt.After(*input.StartsAt) {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	return referralProgrammeFields{
		Title:                   title,
		CodePrefix:              codePrefix,
		Audience:                audience,
		ReferrerRewardKind:      referrerRewardKind,
		RefereeRewardKind:       refereeRewardKind,
		RewardType:              rewardType,
		RewardValue:             input.RewardValue,
		MaxRewardMinor:          copyOptionalInt64(input.MaxRewardMinor),
		QualifyingOrderMinMinor: input.QualifyingOrderMinMinor,
		RewardHoldDays:          rewardHoldDays,
		Status:                  status,
		StartsAt:                copyOptionalTime(input.StartsAt),
		EndsAt:                  copyOptionalTime(input.EndsAt),
		Notes:                   normalizeOperatorNote(input.Notes),
	}, nil
}

func validReferralCodePrefix(value string) bool {
	return validPromotionCode(value) && len(value) <= 24
}

func referralProgrammeAuditSummary(record ports.AdminReferralProgrammeRecord) string {
	return record.Title + " uses prefix " + record.CodePrefix +
		" for " + record.Audience + "."
}

func referralProgrammeAuditMetadata(record ports.AdminReferralProgrammeRecord) map[string]string {
	metadata := map[string]string{
		"programme_id":               record.ProgrammeID.String(),
		"code_prefix":                record.CodePrefix,
		"audience":                   record.Audience,
		"referrer_reward_kind":       record.ReferrerRewardKind,
		"referee_reward_kind":        record.RefereeRewardKind,
		"reward_type":                record.RewardType,
		"reward_value":               strconv.FormatInt(record.RewardValue, 10),
		"qualifying_order_min_minor": strconv.FormatInt(record.QualifyingOrderMinMinor, 10),
		"reward_hold_days":           strconv.Itoa(record.RewardHoldDays),
		"status":                     record.Status,
	}
	if record.MaxRewardMinor != nil {
		metadata["max_reward_minor"] = strconv.FormatInt(*record.MaxRewardMinor, 10)
	}
	return metadata
}

func referralProgrammeAuditSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "active":
		return admindomain.AuditSeverityInfo
	default:
		return admindomain.AuditSeverityWarning
	}
}

func boolString(value bool) string {
	return strconv.FormatBool(value)
}

func supportTicketAction(status string, assignment string) string {
	if status == "resolved" {
		return "Resolved support ticket"
	}
	if assignment == "self" {
		return "Assigned support ticket"
	}
	if assignment == "unassigned" {
		return "Unassigned support ticket"
	}
	return "Reopened support ticket"
}

func intString(value int) string {
	return strconv.Itoa(value)
}

func intString64(value int64) string {
	return strconv.FormatInt(value, 10)
}

func moneySummary(value int64) string {
	return "GHS " + strconv.FormatFloat(float64(value)/100, 'f', 2, 64)
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func permissionsString(permissions []admindomain.Permission) string {
	out := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		out = append(out, string(permission))
	}
	return strings.Join(out, ",")
}
