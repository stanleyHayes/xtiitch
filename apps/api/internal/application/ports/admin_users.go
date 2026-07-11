package ports

import (
	"context"
	"time"

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

type AdminSessionRepository interface {
	Create(ctx context.Context, input CreateAdminSessionInput) error
	FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (AdminSessionWithUser, error)
	Revoke(ctx context.Context, sessionID common.ID) error
}

type AdminTokenIssuer interface {
	IssueAdminAccessToken(ctx context.Context, input AdminAccessTokenInput) (string, error)
}

type AdminTokenVerifier interface {
	VerifyAdminAccessToken(ctx context.Context, token string) (VerifiedAdminAccessToken, error)
}
