package ports

import (
	"time"

	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
