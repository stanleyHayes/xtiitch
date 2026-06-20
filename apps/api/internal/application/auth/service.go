package authapp

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	minPasswordLength         = 8
	ownerTransferConfirmation = "TRANSFER OWNER"
	// bcrypt silently truncates input beyond 72 bytes, so reject longer
	// passwords rather than hashing a quietly-truncated value.
	maxPasswordLength = 72
	accessTokenTTL    = 15 * time.Minute
	refreshTokenTTL   = 30 * 24 * time.Hour
	// mfaChallengeTTL bounds how long a password-verified caller has to present
	// their second factor before the challenge token expires.
	mfaChallengeTTL = 5 * time.Minute
	// MFA verification lockout: after this many consecutive bad codes the account
	// is locked from MFA verification for the duration, to bound brute force.
	mfaMaxFailedAttempts = 5
	mfaLockoutDuration   = 15 * time.Minute
)

var handlePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$`)

// reservedHandles are platform subdomains and system words that must never be a
// business store handle, since each business is reached at <handle>.xtiitch.com
// and these labels route to their own surfaces. Kept in sync with the
// storefront's RESERVED_SUBDOMAINS.
var reservedHandles = map[string]bool{
	"www": true, "app": true, "admin": true, "api": true,
	"store": true, "stores": true, "dashboard": true,
	"mail": true, "static": true, "assets": true, "cdn": true,
	"help": true, "support": true, "status": true, "blog": true,
	"xtiitch": true,
}

type Service struct {
	businesses    ports.BusinessIdentityRepository
	sessions      ports.AuthSessionRepository
	passwords     ports.PasswordHasher
	accessTokens  ports.TokenIssuer
	refreshTokens ports.RefreshTokenIssuer
	emails        ports.EmailSender
	dashboardURL  string
	ids           ports.IDGenerator
	clock         ports.Clock
	mfa           ports.MFARepository
	mfaSecrets    ports.MFASecrets
	mfaChallenges ports.MFAChallengeIssuer
	mfaVerifier   ports.MFAChallengeVerifier
}

type Dependencies struct {
	Businesses    ports.BusinessIdentityRepository
	Sessions      ports.AuthSessionRepository
	Passwords     ports.PasswordHasher
	AccessTokens  ports.TokenIssuer
	RefreshTokens ports.RefreshTokenIssuer
	Emails        ports.EmailSender
	DashboardURL  string
	IDs           ports.IDGenerator
	Clock         ports.Clock
	// MFA dependencies are optional: when any is nil, MFA enrolment/verification
	// is disabled and login always issues a session directly.
	MFA           ports.MFARepository
	MFASecrets    ports.MFASecrets
	MFAChallenges ports.MFAChallengeIssuer
	MFAVerifier   ports.MFAChallengeVerifier
}

func NewService(deps Dependencies) Service {
	return Service{
		businesses:    deps.Businesses,
		sessions:      deps.Sessions,
		passwords:     deps.Passwords,
		accessTokens:  deps.AccessTokens,
		refreshTokens: deps.RefreshTokens,
		emails:        deps.Emails,
		dashboardURL:  strings.TrimRight(strings.TrimSpace(deps.DashboardURL), "/"),
		ids:           deps.IDs,
		clock:         deps.Clock,
		mfa:           deps.MFA,
		mfaSecrets:    deps.MFASecrets,
		mfaChallenges: deps.MFAChallenges,
		mfaVerifier:   deps.MFAVerifier,
	}
}

// mfaEnabled reports whether the optional MFA dependency set is fully wired.
func (s Service) mfaEnabled() bool {
	return s.mfa != nil && s.mfaSecrets != nil && s.mfaChallenges != nil && s.mfaVerifier != nil
}

type RegisterBusinessCommand struct {
	BusinessName     string
	BusinessHandle   string
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
	UserAgent        string
	IPAddress        string
}

type LoginBusinessCommand struct {
	BusinessHandle string
	OwnerEmail     string
	OwnerPassword  string
	UserAgent      string
	IPAddress      string
}

type AuthResult struct {
	BusinessID       common.ID
	BusinessUserID   common.ID
	AccessToken      string
	RefreshToken     string
	AccessExpiresAt  time.Time
	RefreshExpiresAt time.Time
	// MFARequired is set when the password was correct but the account has MFA
	// enabled; the caller must complete VerifyMFALogin with MFAChallengeToken to
	// obtain a session. When true, the token fields above are empty.
	MFARequired       bool
	MFAChallengeToken string
}

func (s Service) RegisterBusiness(ctx context.Context, cmd RegisterBusinessCommand) (AuthResult, error) {
	normalized, err := normalizeRegistration(cmd)
	if err != nil {
		return AuthResult{}, err
	}

	passwordHash, err := s.passwords.Hash(normalized.OwnerPassword)
	if err != nil {
		return AuthResult{}, err
	}

	identity, err := s.businesses.CreateBusinessWithOwner(ctx, ports.CreateBusinessWithOwnerInput{
		BusinessID:       s.ids.NewID(),
		BusinessName:     normalized.BusinessName,
		BusinessHandle:   normalized.BusinessHandle,
		OwnerUserID:      s.ids.NewID(),
		OwnerDisplayName: normalized.OwnerDisplayName,
		OwnerEmail:       normalized.OwnerEmail,
		OwnerPassword:    passwordHash,
	})
	if err != nil {
		return AuthResult{}, err
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     identity.BusinessID,
		BusinessUserID: identity.BusinessUserID,
		Role:           identity.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

func (s Service) LoginBusiness(ctx context.Context, cmd LoginBusinessCommand) (AuthResult, error) {
	handle := normalizeHandle(cmd.BusinessHandle)
	email, err := normalizeEmail(cmd.OwnerEmail)
	if err != nil || handle == "" {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	credentials, err := s.businesses.FindBusinessUserByHandleAndEmail(ctx, handle, email)
	if err != nil || !credentials.IsActive {
		// Equalise timing against account enumeration: do equivalent password
		// work even when no active user matches, then fail identically.
		_, _ = s.passwords.Hash(cmd.OwnerPassword)
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if err := s.passwords.Compare(credentials.PasswordHash, cmd.OwnerPassword); err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	// If the account has a second factor enabled, do not issue a session yet:
	// return a short-lived challenge the caller redeems via VerifyMFALogin.
	if s.mfaEnabled() {
		scope := common.TenantScope{BusinessID: credentials.BusinessID}
		enrollment, err := s.mfa.Get(ctx, scope, credentials.UserID)
		if err == nil && enrollment.Enabled {
			now := s.clock.Now()
			challenge, err := s.mfaChallenges.IssueMFAChallengeToken(ctx, ports.MFAChallengeInput{
				Subject:    credentials.UserID,
				BusinessID: credentials.BusinessID,
				Role:       credentials.Role,
				IssuedAt:   now,
				ExpiresAt:  now.Add(mfaChallengeTTL),
			})
			if err != nil {
				return AuthResult{}, err
			}
			return AuthResult{
				BusinessID:        credentials.BusinessID,
				BusinessUserID:    credentials.UserID,
				MFARequired:       true,
				MFAChallengeToken: challenge,
			}, nil
		}
		if err != nil && !errors.Is(err, ports.ErrNotFound) {
			return AuthResult{}, err
		}
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     credentials.BusinessID,
		BusinessUserID: credentials.UserID,
		Role:           credentials.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

type RefreshSessionCommand struct {
	RefreshToken string
	UserAgent    string
	IPAddress    string
}

// RefreshSession validates a refresh token and rotates it: the presented
// session is revoked and a fresh access/refresh pair is issued. Rotation means
// a stolen-then-used refresh token is single-use and the theft is contained.
func (s Service) RefreshSession(ctx context.Context, cmd RefreshSessionCommand) (AuthResult, error) {
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

	if err := s.sessions.Revoke(ctx, session.BusinessID, session.SessionID); err != nil {
		return AuthResult{}, err
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     session.BusinessID,
		BusinessUserID: session.BusinessUserID,
		Role:           session.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

type LogoutCommand struct {
	RefreshToken string
}

// Logout revokes the session behind a refresh token. It is idempotent and never
// reveals whether the token existed.
func (s Service) Logout(ctx context.Context, cmd LogoutCommand) error {
	token := strings.TrimSpace(cmd.RefreshToken)
	if token == "" {
		return nil
	}

	session, err := s.sessions.FindByRefreshTokenHash(ctx, s.refreshTokens.HashRefreshToken(token))
	if err != nil {
		return nil
	}

	return s.sessions.Revoke(ctx, session.BusinessID, session.SessionID)
}

type ListBusinessUsersCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
}

func (s Service) ListBusinessUsers(ctx context.Context, cmd ListBusinessUsersCommand) ([]ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return nil, err
	}

	return s.businesses.ListBusinessUsers(ctx, cmd.Scope)
}

type CreateBusinessUserCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	DisplayName string
	Email       string
	Password    string
	Role        business.UserRole
}

func (s Service) CreateBusinessUser(ctx context.Context, cmd CreateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessUserRecord{}, err
	}

	normalized, err := normalizeBusinessUserCreation(cmd)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}

	passwordHash, err := s.passwords.Hash(normalized.Password)
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}

	user, err := s.businesses.CreateBusinessUser(ctx, cmd.Scope, ports.CreateBusinessUserInput{
		UserID:       s.ids.NewID(),
		BusinessID:   cmd.Scope.BusinessID,
		Email:        normalized.Email,
		DisplayName:  normalized.DisplayName,
		PasswordHash: passwordHash,
		Role:         normalized.Role,
	})
	if err != nil {
		return ports.BusinessUserRecord{}, err
	}
	_ = s.sendBusinessUserInvite(ctx, user)
	return user, nil
}

type UpdateBusinessUserCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	UserID      common.ID
	DisplayName string
	Role        business.UserRole
	IsActive    bool
}

func (s Service) UpdateBusinessUser(ctx context.Context, cmd UpdateBusinessUserCommand) (ports.BusinessUserRecord, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessUserRecord{}, err
	}
	if cmd.UserID.IsZero() {
		return ports.BusinessUserRecord{}, authdomain.ErrInvalidInput
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" || !isManageableBusinessUserRole(cmd.Role) {
		return ports.BusinessUserRecord{}, authdomain.ErrInvalidInput
	}

	return s.businesses.UpdateBusinessUser(ctx, cmd.Scope, ports.UpdateBusinessUserInput{
		UserID:      cmd.UserID,
		DisplayName: displayName,
		Role:        cmd.Role,
		IsActive:    cmd.IsActive,
	})
}

type ResetBusinessUserPasswordCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	UserID      common.ID
	NewPassword string
}

func (s Service) ResetBusinessUserPassword(ctx context.Context, cmd ResetBusinessUserPasswordCommand) error {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.UserID.IsZero() || len(cmd.NewPassword) < minPasswordLength || len(cmd.NewPassword) > maxPasswordLength {
		return authdomain.ErrInvalidInput
	}

	passwordHash, err := s.passwords.Hash(cmd.NewPassword)
	if err != nil {
		return err
	}

	return s.businesses.UpdateBusinessUserPassword(ctx, cmd.Scope, ports.UpdateBusinessUserPasswordInput{
		UserID:       cmd.UserID,
		PasswordHash: passwordHash,
	})
}

type TransferBusinessOwnerCommand struct {
	Scope          common.TenantScope
	ActorUserID    common.ID
	ActorRole      business.UserRole
	NewOwnerUserID common.ID
	Confirmation   string
}

func (s Service) TransferBusinessOwner(ctx context.Context, cmd TransferBusinessOwnerCommand) (ports.TransferBusinessOwnerResult, error) {
	if cmd.Scope.BusinessID.IsZero() || cmd.ActorUserID.IsZero() || cmd.NewOwnerUserID.IsZero() {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}
	if cmd.ActorRole != business.UserRoleOwner {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrForbidden
	}
	if cmd.ActorUserID == cmd.NewOwnerUserID {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}
	if strings.TrimSpace(cmd.Confirmation) != ownerTransferConfirmation {
		return ports.TransferBusinessOwnerResult{}, authdomain.ErrInvalidInput
	}

	return s.businesses.TransferBusinessOwner(ctx, cmd.Scope, ports.TransferBusinessOwnerInput{
		CurrentOwnerUserID: cmd.ActorUserID,
		NewOwnerUserID:     cmd.NewOwnerUserID,
	})
}

type normalizedRegistration struct {
	BusinessName     string
	BusinessHandle   string
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
}

func normalizeRegistration(cmd RegisterBusinessCommand) (normalizedRegistration, error) {
	businessName := strings.TrimSpace(cmd.BusinessName)
	ownerName := strings.TrimSpace(cmd.OwnerDisplayName)
	handle := normalizeHandle(cmd.BusinessHandle)
	email, err := normalizeEmail(cmd.OwnerEmail)
	if err != nil {
		return normalizedRegistration{}, errors.Join(authdomain.ErrInvalidInput, err)
	}
	if businessName == "" || ownerName == "" || handle == "" || !handlePattern.MatchString(handle) {
		return normalizedRegistration{}, authdomain.ErrInvalidInput
	}
	if reservedHandles[handle] {
		return normalizedRegistration{}, authdomain.ErrInvalidInput
	}
	if len(cmd.OwnerPassword) < minPasswordLength || len(cmd.OwnerPassword) > maxPasswordLength {
		return normalizedRegistration{}, authdomain.ErrInvalidInput
	}

	return normalizedRegistration{
		BusinessName:     businessName,
		BusinessHandle:   handle,
		OwnerDisplayName: ownerName,
		OwnerEmail:       email,
		OwnerPassword:    cmd.OwnerPassword,
	}, nil
}

type normalizedBusinessUserCreation struct {
	DisplayName string
	Email       string
	Password    string
	Role        business.UserRole
}

func normalizeBusinessUserCreation(cmd CreateBusinessUserCommand) (normalizedBusinessUserCreation, error) {
	displayName := strings.TrimSpace(cmd.DisplayName)
	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return normalizedBusinessUserCreation{}, errors.Join(authdomain.ErrInvalidInput, err)
	}
	if displayName == "" || !isManageableBusinessUserRole(cmd.Role) {
		return normalizedBusinessUserCreation{}, authdomain.ErrInvalidInput
	}
	if len(cmd.Password) < minPasswordLength || len(cmd.Password) > maxPasswordLength {
		return normalizedBusinessUserCreation{}, authdomain.ErrInvalidInput
	}

	return normalizedBusinessUserCreation{
		DisplayName: displayName,
		Email:       email,
		Password:    cmd.Password,
		Role:        cmd.Role,
	}, nil
}

func authorizeBusinessUserManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	switch role {
	case business.UserRoleOwner, business.UserRoleAdmin:
		return nil
	default:
		return authdomain.ErrForbidden
	}
}

func isManageableBusinessUserRole(role business.UserRole) bool {
	return role == business.UserRoleAdmin || role == business.UserRoleStaff
}

func (s Service) sendBusinessUserInvite(ctx context.Context, user ports.BusinessUserRecord) error {
	if s.emails == nil || strings.TrimSpace(user.Email) == "" {
		return nil
	}
	loginURL := s.dashboardURL
	if loginURL == "" {
		loginURL = "https://app.xtiitch.com"
	}
	loginURL = strings.TrimRight(loginURL, "/") + "/login"
	displayName := strings.TrimSpace(user.DisplayName)
	if displayName == "" {
		displayName = user.Email
	}
	subject := "You have been invited to Xtiitch"
	body := fmt.Sprintf(
		"Hi %s,\n\nYou have been added to the Xtiitch business dashboard as %s.\nOpen %s and sign in with this email address. For security, Xtiitch does not email temporary passwords, so ask your owner or admin for the temporary password they set for you.\n\nThanks,\nXtiitch",
		displayName,
		user.Role,
		loginURL,
	)
	return s.emails.Send(ctx, ports.EmailMessage{
		To:      user.Email,
		Subject: subject,
		Body:    body,
	})
}

func normalizeEmail(value string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}

	return strings.ToLower(parsed.Address), nil
}

func normalizeHandle(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

type issueSessionInput struct {
	BusinessID     common.ID
	BusinessUserID common.ID
	Role           business.UserRole
	UserAgent      string
	IPAddress      string
}

func (s Service) issueSession(ctx context.Context, input issueSessionInput) (AuthResult, error) {
	now := s.clock.Now()
	accessExpiresAt := now.Add(accessTokenTTL)
	refreshExpiresAt := now.Add(refreshTokenTTL)

	accessToken, err := s.accessTokens.IssueAccessToken(ctx, ports.AccessTokenInput{
		Subject:    input.BusinessUserID,
		BusinessID: input.BusinessID,
		Role:       input.Role,
		IssuedAt:   now,
		ExpiresAt:  accessExpiresAt,
	})
	if err != nil {
		return AuthResult{}, err
	}

	refreshToken, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return AuthResult{}, err
	}

	if err := s.sessions.Create(ctx, ports.CreateAuthSessionInput{
		SessionID:        s.ids.NewID(),
		BusinessID:       input.BusinessID,
		BusinessUserID:   input.BusinessUserID,
		RefreshTokenHash: s.refreshTokens.HashRefreshToken(refreshToken),
		UserAgent:        strings.TrimSpace(input.UserAgent),
		IPAddress:        strings.TrimSpace(input.IPAddress),
		ExpiresAt:        refreshExpiresAt,
	}); err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		BusinessID:       input.BusinessID,
		BusinessUserID:   input.BusinessUserID,
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  accessExpiresAt,
		RefreshExpiresAt: refreshExpiresAt,
	}, nil
}

// ---------------------------------------------------------------------------
// Opt-in TOTP MFA
// ---------------------------------------------------------------------------

// MFAStatus is the enrolment state for the current user.
type MFAStatus struct {
	Enabled         bool
	Enrolled        bool
	BackupCodesLeft int
}

// MFAEnrollmentSetup is returned when a user begins enrolment. The client renders
// ProvisioningURI as a QR code and offers Secret for manual entry.
type MFAEnrollmentSetup struct {
	Secret          string
	ProvisioningURI string
}

// GetMFAStatus reports whether the user has MFA enrolled/enabled.
func (s Service) GetMFAStatus(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAStatus, error) {
	if !s.mfaEnabled() {
		return MFAStatus{}, nil
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return MFAStatus{}, nil
		}
		return MFAStatus{}, err
	}
	return MFAStatus{
		Enabled:         enrollment.Enabled,
		Enrolled:        true,
		BackupCodesLeft: enrollment.BackupCodesLeft,
	}, nil
}

// StartMFAEnrollment generates a fresh secret for the user and returns the
// provisioning material. It does not enable MFA — ActivateMFA does, once a code
// is verified. Re-running it before activation simply rotates the pending secret.
func (s Service) StartMFAEnrollment(ctx context.Context, scope common.TenantScope, userID common.ID) (MFAEnrollmentSetup, error) {
	if !s.mfaEnabled() {
		return MFAEnrollmentSetup{}, authdomain.ErrForbidden
	}
	if scope.BusinessID.IsZero() || userID.IsZero() {
		return MFAEnrollmentSetup{}, authdomain.ErrInvalidInput
	}

	if existing, err := s.mfa.Get(ctx, scope, userID); err == nil && existing.Enabled {
		return MFAEnrollmentSetup{}, authdomain.ErrMFAAlreadyEnabled
	} else if err != nil && !errors.Is(err, ports.ErrNotFound) {
		return MFAEnrollmentSetup{}, err
	}

	secret, err := s.mfaSecrets.GenerateSecret()
	if err != nil {
		return MFAEnrollmentSetup{}, err
	}
	encrypted, err := s.mfaSecrets.EncryptSecret(secret)
	if err != nil {
		return MFAEnrollmentSetup{}, err
	}
	if err := s.mfa.Upsert(ctx, scope, ports.UpsertMFAInput{
		UserID:          userID,
		BusinessID:      scope.BusinessID,
		SecretEncrypted: encrypted,
	}); err != nil {
		return MFAEnrollmentSetup{}, err
	}

	return MFAEnrollmentSetup{
		Secret:          secret,
		ProvisioningURI: s.mfaSecrets.ProvisioningURI(secret, s.mfaAccountName(ctx, scope, userID)),
	}, nil
}

// ActivateMFA verifies the first code against the pending secret, enables MFA,
// and returns one-time backup codes (shown to the user once).
func (s Service) ActivateMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) ([]string, error) {
	if !s.mfaEnabled() {
		return nil, authdomain.ErrForbidden
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil, authdomain.ErrMFANotEnrolled
		}
		return nil, err
	}
	if enrollment.Enabled {
		return nil, authdomain.ErrMFAAlreadyEnabled
	}

	secret, err := s.mfaSecrets.DecryptSecret(enrollment.SecretEncrypted)
	if err != nil {
		return nil, err
	}
	step, ok := s.mfaSecrets.VerifyCode(secret, code, s.clock.Now(), enrollment.LastUsedStep)
	if !ok {
		return nil, authdomain.ErrInvalidMFACode
	}

	backupCodes, err := s.mfaSecrets.GenerateBackupCodes()
	if err != nil {
		return nil, err
	}
	hashes := make([]string, 0, len(backupCodes))
	for _, c := range backupCodes {
		hashes = append(hashes, s.mfaSecrets.HashBackupCode(c))
	}
	if err := s.mfa.Enable(ctx, scope, ports.EnableMFAInput{
		UserID:           userID,
		BackupCodeHashes: hashes,
		LastUsedStep:     step,
	}); err != nil {
		return nil, err
	}

	return backupCodes, nil
}

// DisableMFA turns MFA off after verifying a current code or a backup code.
func (s Service) DisableMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) error {
	if !s.mfaEnabled() {
		return authdomain.ErrForbidden
	}
	enrollment, err := s.mfa.Get(ctx, scope, userID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return authdomain.ErrMFANotEnabled
		}
		return err
	}
	if !enrollment.Enabled {
		return authdomain.ErrMFANotEnabled
	}

	ok, err := s.verifyMFAFactor(ctx, scope, enrollment, code)
	if err != nil {
		return err
	}
	if !ok {
		return authdomain.ErrInvalidMFACode
	}

	return s.mfa.Delete(ctx, scope, userID)
}

// VerifyMFALoginCommand completes a login challenge with a second factor.
type VerifyMFALoginCommand struct {
	ChallengeToken string
	Code           string
	UserAgent      string
	IPAddress      string
}

// VerifyMFALogin redeems a password-stage challenge token plus a TOTP/backup code
// for a full session.
func (s Service) VerifyMFALogin(ctx context.Context, cmd VerifyMFALoginCommand) (AuthResult, error) {
	if !s.mfaEnabled() {
		return AuthResult{}, authdomain.ErrForbidden
	}
	verified, err := s.mfaVerifier.VerifyMFAChallengeToken(ctx, strings.TrimSpace(cmd.ChallengeToken))
	if err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	scope := common.TenantScope{BusinessID: verified.BusinessID}
	enrollment, err := s.mfa.Get(ctx, scope, verified.Subject)
	if err != nil || !enrollment.Enabled {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	// Re-confirm the user is still active: they may have been deactivated during
	// the (up to 5-minute) challenge window.
	if !s.businessUserActive(ctx, scope, verified.Subject) {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	ok, err := s.verifyMFAFactor(ctx, scope, enrollment, cmd.Code)
	if err != nil {
		return AuthResult{}, err
	}
	if !ok {
		return AuthResult{}, authdomain.ErrInvalidMFACode
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     verified.BusinessID,
		BusinessUserID: verified.Subject,
		Role:           verified.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

// verifyMFAFactor accepts either a valid current TOTP code (not previously used,
// per the last-used-step replay guard) or an unused backup code (which it
// consumes). It enforces a per-account lockout after repeated failures, and on
// success advances the replay guard / clears the lockout counter.
func (s Service) verifyMFAFactor(ctx context.Context, scope common.TenantScope, enrollment ports.MFAEnrollment, code string) (bool, error) {
	now := s.clock.Now()
	if !enrollment.LockedUntil.IsZero() && now.Before(enrollment.LockedUntil) {
		// Locked out: refuse without consuming the code, surfaced as invalid.
		return false, nil
	}

	secret, err := s.mfaSecrets.DecryptSecret(enrollment.SecretEncrypted)
	if err != nil {
		return false, err
	}

	if step, ok := s.mfaSecrets.VerifyCode(secret, code, now, enrollment.LastUsedStep); ok {
		if err := s.mfa.MarkVerified(ctx, scope, enrollment.UserID, step); err != nil {
			return false, err
		}
		return true, nil
	}

	consumed, err := s.mfa.ConsumeBackupCode(ctx, scope, enrollment.UserID, s.mfaSecrets.HashBackupCode(code))
	if err != nil {
		return false, err
	}
	if consumed {
		// Reset the lockout counter (step is unchanged for backup codes).
		if err := s.mfa.MarkVerified(ctx, scope, enrollment.UserID, enrollment.LastUsedStep); err != nil {
			return false, err
		}
		return true, nil
	}

	if _, err := s.mfa.RegisterFailedAttempt(ctx, scope, enrollment.UserID, mfaMaxFailedAttempts, mfaLockoutDuration); err != nil {
		return false, err
	}
	return false, nil
}

// businessUserActive reports whether the user still exists and is active in the
// tenant. Used to re-confirm at MFA-login time.
func (s Service) businessUserActive(ctx context.Context, scope common.TenantScope, userID common.ID) bool {
	users, err := s.businesses.ListBusinessUsers(ctx, scope)
	if err != nil {
		return false
	}
	for _, u := range users {
		if u.UserID == userID {
			return u.IsActive
		}
	}
	return false
}

// mfaAccountName resolves a human label for the authenticator entry (the user's
// email when available, otherwise the user id).
func (s Service) mfaAccountName(ctx context.Context, scope common.TenantScope, userID common.ID) string {
	users, err := s.businesses.ListBusinessUsers(ctx, scope)
	if err == nil {
		for _, u := range users {
			if u.UserID == userID && strings.TrimSpace(u.Email) != "" {
				return u.Email
			}
		}
	}
	return userID.String()
}
