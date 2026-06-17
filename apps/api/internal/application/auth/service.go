package authapp

import (
	"context"
	"errors"
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
	minPasswordLength = 8
	// bcrypt silently truncates input beyond 72 bytes, so reject longer
	// passwords rather than hashing a quietly-truncated value.
	maxPasswordLength = 72
	accessTokenTTL    = 15 * time.Minute
	refreshTokenTTL   = 30 * 24 * time.Hour
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
	ids           ports.IDGenerator
	clock         ports.Clock
}

type Dependencies struct {
	Businesses    ports.BusinessIdentityRepository
	Sessions      ports.AuthSessionRepository
	Passwords     ports.PasswordHasher
	AccessTokens  ports.TokenIssuer
	RefreshTokens ports.RefreshTokenIssuer
	IDs           ports.IDGenerator
	Clock         ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{
		businesses:    deps.Businesses,
		sessions:      deps.Sessions,
		passwords:     deps.Passwords,
		accessTokens:  deps.AccessTokens,
		refreshTokens: deps.RefreshTokens,
		ids:           deps.IDs,
		clock:         deps.Clock,
	}
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

	return s.businesses.CreateBusinessUser(ctx, cmd.Scope, ports.CreateBusinessUserInput{
		UserID:       s.ids.NewID(),
		BusinessID:   cmd.Scope.BusinessID,
		Email:        normalized.Email,
		DisplayName:  normalized.DisplayName,
		PasswordHash: passwordHash,
		Role:         normalized.Role,
	})
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
