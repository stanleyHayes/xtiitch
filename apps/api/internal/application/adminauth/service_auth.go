package adminauth

import (
	"context"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
	// Refuse a locked account before the password check — admin compromise is a
	// platform-wide RLS bypass, so throttling brute force per-account matters most.
	if credentials.LoginLockedUntil != nil && credentials.LoginLockedUntil.After(s.clock.Now()) {
		return AuthResult{}, authdomain.ErrAccountLocked
	}
	if err := s.passwords.Compare(credentials.PasswordHash, cmd.Password); err != nil {
		_ = s.users.RecordFailedAdminLogin(ctx, credentials.UserID, adminMaxFailedLoginAttempts, adminLoginLockoutDuration)
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}
	_ = s.users.ClearFailedAdminLogin(ctx, credentials.UserID)
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
