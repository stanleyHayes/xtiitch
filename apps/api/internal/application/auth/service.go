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
	accessTokenTTL    = 15 * time.Minute
	refreshTokenTTL   = 30 * 24 * time.Hour
)

var handlePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$`)

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
	if err != nil {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	if !credentials.IsActive {
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
	if len(cmd.OwnerPassword) < minPasswordLength {
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
