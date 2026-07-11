package ports

import (
	"context"
	"time"

	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminUserRepository interface {
	EnsureBootstrapUser(ctx context.Context, input CreateAdminUserInput) (AdminUserRecord, error)
	FindByEmail(ctx context.Context, email string) (AdminUserCredentials, error)
	// RecordFailedAdminLogin increments the account's failed-attempt counter and, on
	// reaching maxAttempts, sets a lockout of lockFor and resets the counter.
	RecordFailedAdminLogin(ctx context.Context, userID common.ID, maxAttempts int, lockFor time.Duration) error
	// ClearFailedAdminLogin resets the failed-attempt counter and lockout after a
	// successful password login.
	ClearFailedAdminLogin(ctx context.Context, userID common.ID) error
	FindByID(ctx context.Context, userID common.ID) (AdminUserRecord, error)
	ListAdminUsers(ctx context.Context) ([]AdminUserRecord, error)
	CreateAdminUser(ctx context.Context, input CreateAdminUserInput) (AdminUserRecord, error)
	UpdateAdminUser(ctx context.Context, input UpdateAdminUserInput) (AdminUserRecord, error)
	UpdateAdminProfile(ctx context.Context, input UpdateAdminProfileInput) (AdminUserRecord, error)
	ListAdminRolePermissions(ctx context.Context) ([]AdminRolePermissionsRecord, error)
	ReplaceAdminRolePermissions(ctx context.Context, input UpdateAdminRolePermissionsInput) (AdminRolePermissionsRecord, error)
	GetAdminPreferences(ctx context.Context, userID common.ID) (AdminPreferencesRecord, error)
	UpdateAdminPreferences(ctx context.Context, input UpdateAdminPreferencesInput) (AdminPreferencesRecord, error)
	GetAdminPlatformSettings(ctx context.Context) (AdminPlatformSettingsRecord, error)
	UpdateAdminPlatformSettings(ctx context.Context, input UpdateAdminPlatformSettingsInput) (AdminPlatformSettingsRecord, error)
	UpdateAdminMarketingFlags(ctx context.Context, input UpdateAdminMarketingFlagsInput) (AdminPlatformSettingsRecord, error)
	RecordLogin(ctx context.Context, userID common.ID) error
}
type AdminAuditRepository interface {
	CreateAdminAuditEvent(ctx context.Context, input CreateAdminAuditEventInput) (AdminAuditEventRecord, error)
	ListAdminAuditEvents(ctx context.Context, input ListAdminAuditEventsInput) ([]AdminAuditEventRecord, error)
}
type CreateAdminUserInput struct {
	UserID       common.ID
	Email        string
	DisplayName  string
	PasswordHash string
	Role         admindomain.Role
}
type AdminUserRecord struct {
	UserID      common.ID
	Email       string
	DisplayName string
	Role        admindomain.Role
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
type UpdateAdminUserInput struct {
	UserID      common.ID
	DisplayName string
	Role        admindomain.Role
	IsActive    bool
}
type UpdateAdminProfileInput struct {
	UserID      common.ID
	Email       string
	DisplayName string
}
type AdminRolePermissionsRecord struct {
	Role        admindomain.Role
	Permissions []admindomain.Permission
}
type UpdateAdminRolePermissionsInput struct {
	Role        admindomain.Role
	Permissions []admindomain.Permission
}
type AdminUserCredentials struct {
	UserID      common.ID
	Email       string
	DisplayName string
	// LoginLockedUntil is non-nil and in the future when the account is temporarily
	// locked after too many failed password attempts.
	LoginLockedUntil *time.Time
	PasswordHash     string
	Role             admindomain.Role
	IsActive         bool
}
type AdminAuditEventRecord struct {
	AuditEventID common.ID
	ActorUserID  common.ID
	ActorEmail   string
	ActorRole    admindomain.Role
	Action       string
	TargetType   string
	TargetID     string
	TargetLabel  string
	Summary      string
	Severity     admindomain.AuditSeverity
	Metadata     map[string]string
	IPAddress    string
	UserAgent    string
	CreatedAt    time.Time
}
type CreateAdminAuditEventInput struct {
	AuditEventID common.ID
	ActorUserID  common.ID
	ActorRole    admindomain.Role
	Action       string
	TargetType   string
	TargetID     string
	TargetLabel  string
	Summary      string
	Severity     admindomain.AuditSeverity
	Metadata     map[string]string
	IPAddress    string
	UserAgent    string
}
type ListAdminAuditEventsInput struct {
	Limit    int
	Severity admindomain.AuditSeverity
}
type AdminSessionRepository interface {
	Create(ctx context.Context, input CreateAdminSessionInput) error
	FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (AdminSessionWithUser, error)
	Revoke(ctx context.Context, sessionID common.ID) error
}
type CreateAdminSessionInput struct {
	SessionID        common.ID
	AdminUserID      common.ID
	RefreshTokenHash string
	UserAgent        string
	IPAddress        string
	ExpiresAt        time.Time
}
type AdminSessionWithUser struct {
	SessionID    common.ID
	AdminUserID  common.ID
	Email        string
	DisplayName  string
	Role         admindomain.Role
	UserIsActive bool
	Revoked      bool
	ExpiresAt    time.Time
}
type AdminTokenIssuer interface {
	IssueAdminAccessToken(ctx context.Context, input AdminAccessTokenInput) (string, error)
}
type AdminTokenVerifier interface {
	VerifyAdminAccessToken(ctx context.Context, token string) (VerifiedAdminAccessToken, error)
}
type AdminAccessTokenInput struct {
	Subject   common.ID
	Role      admindomain.Role
	IssuedAt  time.Time
	ExpiresAt time.Time
}
type VerifiedAdminAccessToken struct {
	Subject common.ID
	Role    admindomain.Role
}
