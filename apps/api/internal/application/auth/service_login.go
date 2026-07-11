package authapp

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
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
	// accessTokenTTL bounds how long the dashboard can act on one access token
	// before re-auth. The dashboard logs out on a 401, so this is effectively the
	// inactivity timeout. Updates spec §12: keep users signed in ~3× longer — a
	// 3-hour access window so brief inactivity never drops the session.
	accessTokenTTL = 3 * time.Hour
	// refreshTokenTTL is the long-lived login window (Updates §12: 3× longer).
	refreshTokenTTL = 90 * 24 * time.Hour
	// mfaChallengeTTL bounds how long a password-verified caller has to present
	// their second factor before the challenge token expires.
	mfaChallengeTTL = 5 * time.Minute
	// MFA verification lockout: after this many consecutive bad codes the account
	// is locked from MFA verification for the duration, to bound brute force.
	mfaMaxFailedAttempts = 5
	mfaLockoutDuration   = 15 * time.Minute
	// Password login lockout: after this many consecutive bad passwords the account
	// is locked for the duration, throttling brute force per-account (independent of
	// the per-IP limiter). More lenient than MFA since legitimate typos are common.
	maxFailedLoginAttempts = 10
	loginLockoutDuration   = 15 * time.Minute
	// Self-service password reset: a one-time emailed code, short-lived and
	// attempt-capped to bound brute force.
	passwordResetTTL      = 15 * time.Minute
	maxPasswordResetTries = 5
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

// mfaEnabled reports whether the optional MFA dependency set is fully wired.
func (s Service) mfaEnabled() bool {
	return s.mfa != nil && s.mfaSecrets != nil && s.mfaChallenges != nil && s.mfaVerifier != nil
}

// whatsAppOTPEnabled reports whether the optional WhatsApp one-time-code
// dependency set is fully wired.
func (s Service) whatsAppOTPEnabled() bool {
	return s.whatsAppAuth != nil && s.otpGen != nil && s.whatsAppOTP != nil
}

type RegisterBusinessCommand struct {
	BusinessName     string
	BusinessHandle   string
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
	PlanCode         string
	UserAgent        string
	IPAddress        string
	// OwnerPhone is the store owner's contact phone number captured at signup.
	// Unlike WhatsAppNumber it is not a sign-in identity and needs no verification;
	// it is stored for order and account notifications. Optional.
	OwnerPhone string
	// Optional WhatsApp identity captured at signup. When WhatsAppNumber is set,
	// WhatsAppCode must be a valid one-time code (proving control of the number);
	// the number is then stored as a verified alternative sign-in identity.
	WhatsAppNumber string
	WhatsAppCode   string
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

	// Optional WhatsApp identity: when the signup supplied a number, it must be
	// proven with a valid one-time code before the account is created, and it is
	// then stored as verified. No number → register with email + password only
	// (fully backward compatible).
	var whatsAppNumber string
	var whatsAppVerified bool
	if strings.TrimSpace(cmd.WhatsAppNumber) != "" {
		if !s.whatsAppOTPEnabled() {
			return AuthResult{}, ErrWhatsAppOTPUnavailable
		}
		number, err := normalizeGhanaPhone(cmd.WhatsAppNumber)
		if err != nil {
			return AuthResult{}, err
		}
		if err := s.verifyBusinessOTP(ctx, number, cmd.WhatsAppCode); err != nil {
			return AuthResult{}, err
		}
		whatsAppNumber = number
		whatsAppVerified = true
	}

	identity, err := s.businesses.CreateBusinessWithOwner(ctx, ports.CreateBusinessWithOwnerInput{
		BusinessID:       s.ids.NewID(),
		BusinessName:     normalized.BusinessName,
		BusinessHandle:   normalized.BusinessHandle,
		OwnerUserID:      s.ids.NewID(),
		OwnerDisplayName: normalized.OwnerDisplayName,
		OwnerEmail:       normalized.OwnerEmail,
		OwnerPassword:    passwordHash,
		PlanCode:         normalized.PlanCode,
		Phone:            strings.TrimSpace(cmd.OwnerPhone),
		WhatsAppNumber:   whatsAppNumber,
		WhatsAppVerified: whatsAppVerified,
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

// HandleAvailability is the result of a store-handle availability check, used by
// the signup form to validate the handle in real time.
type HandleAvailability struct {
	Handle    string
	Available bool
	// Reason explains an unavailable handle: "invalid", "reserved", or "taken".
	// Empty when Available is true.
	Reason string
}

// CheckHandleAvailability validates a candidate store handle and reports whether
// it can be claimed, applying exactly the same normalization, format,
// reserved-word and uniqueness rules as RegisterBusiness. It performs no
// mutation and is safe to call unauthenticated.
func (s Service) CheckHandleAvailability(ctx context.Context, raw string) (HandleAvailability, error) {
	handle := normalizeHandle(raw)
	if handle == "" || !handlePattern.MatchString(handle) {
		return HandleAvailability{Handle: handle, Available: false, Reason: "invalid"}, nil
	}
	if reservedHandles[handle] {
		return HandleAvailability{Handle: handle, Available: false, Reason: "reserved"}, nil
	}
	exists, err := s.businesses.HandleExists(ctx, handle)
	if err != nil {
		return HandleAvailability{}, err
	}
	if exists {
		return HandleAvailability{Handle: handle, Available: false, Reason: "taken"}, nil
	}
	return HandleAvailability{Handle: handle, Available: true}, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
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
	// Refuse a locked account before checking the password, so a brute-force attack
	// is throttled per-account regardless of source IP.
	if credentials.LoginLockedUntil != nil && credentials.LoginLockedUntil.After(s.clock.Now()) {
		return AuthResult{}, authdomain.ErrAccountLocked
	}
	if err := s.passwords.Compare(credentials.PasswordHash, cmd.OwnerPassword); err != nil {
		// Count the failure and lock the account once the threshold is reached.
		_ = s.businesses.RecordFailedBusinessLogin(ctx, credentials.UserID, maxFailedLoginAttempts, loginLockoutDuration)
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	// Successful password: clear any accumulated failures/lockout.
	_ = s.businesses.ClearFailedBusinessLogin(ctx, credentials.UserID)

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

// RequestPasswordReset emails a one-time code to a business login so a
// locked-out owner or staff member can set a new password. It always returns
// nil — whether or not the email maps to an account — so the endpoint never
// reveals which addresses are registered.
func (s Service) RequestPasswordReset(ctx context.Context, rawEmail string) error {
	if s.resets == nil {
		return nil
	}
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return nil
	}
	target, err := s.resets.FindBusinessUserByEmail(ctx, email)
	if err != nil {
		return nil
	}

	code, err := generateResetCode()
	if err != nil {
		return err
	}
	now := s.clock.Now()
	if err := s.resets.CreatePasswordResetChallenge(ctx, ports.CreatePasswordResetChallengeInput{
		ChallengeID: s.ids.NewID(),
		UserID:      target.UserID,
		Email:       email,
		CodeHash:    hashResetCode(code),
		ExpiresAt:   now.Add(passwordResetTTL),
	}); err != nil {
		return err
	}

	displayName := strings.TrimSpace(target.DisplayName)
	if displayName == "" {
		displayName = target.Email
	}
	body := fmt.Sprintf(
		"Hi %s,\n\n"+
			"Use this code to reset your Xtiitch dashboard password:\n\n    %s\n\n"+
			"It expires in 15 minutes. If you didn't request this, ignore this email "+
			"— your password stays unchanged.\n\n"+
			"Thanks,\nXtiitch",
		displayName,
		code,
	)
	return s.emails.Send(ctx, ports.EmailMessage{
		To:      target.Email,
		Subject: "Reset your Xtiitch password",
		Body:    body,
	})
}

// ConfirmPasswordReset validates the emailed code and sets the new password.
// ConfirmPasswordReset validates the emailed code and sets the new password.
func (s Service) ConfirmPasswordReset(ctx context.Context, rawEmail string, code string, newPassword string) error {
	if s.resets == nil {
		return authdomain.ErrResetCodeInvalid
	}
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return authdomain.ErrResetCodeInvalid
	}
	if len(newPassword) < minPasswordLength || len(newPassword) > maxPasswordLength {
		return authdomain.ErrInvalidInput
	}

	now := s.clock.Now()
	challenge, err := s.resets.LatestActivePasswordResetChallenge(ctx, email, now)
	if err != nil {
		return authdomain.ErrResetCodeInvalid
	}
	if challenge.Attempts >= maxPasswordResetTries {
		return authdomain.ErrResetCodeInvalid
	}
	if hashResetCode(code) != challenge.CodeHash {
		if incErr := s.resets.IncrementPasswordResetAttempts(ctx, challenge.ChallengeID); incErr != nil {
			s.logger.Error("failed to increment password reset attempts", slog.String("error", incErr.Error()))
		}
		return authdomain.ErrResetCodeInvalid
	}

	passwordHash, err := s.passwords.Hash(newPassword)
	if err != nil {
		return err
	}
	if err := s.resets.SetBusinessUserPasswordByID(ctx, challenge.UserID, passwordHash); err != nil {
		return err
	}
	return s.resets.ConsumePasswordResetChallenge(ctx, challenge.ChallengeID)
}

func generateResetCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashResetCode(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

type normalizedRegistration struct {
	BusinessName     string
	BusinessHandle   string
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
	PlanCode         string
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
		PlanCode:         strings.ToLower(strings.TrimSpace(cmd.PlanCode)),
	}, nil
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
