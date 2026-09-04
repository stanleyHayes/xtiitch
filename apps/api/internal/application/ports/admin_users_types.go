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

// CreateAdminUserInviteInput creates the operator and their one-time invite
// together. There is no password: the invited person sets it themselves, so a
// working credential never travels through a chat message or a phone call.
type CreateAdminUserInviteInput struct {
	UserID      common.ID
	InviteID    common.ID
	Email       string
	DisplayName string
	Role        admindomain.Role
	// Only the hash is stored, so a database read cannot mint access.
	TokenHash string
	// Where the link was sent, for the audit trail and for re-sending.
	SentToEmail string
	SentToPhone string
	InvitedBy   common.ID
	ExpiresAt   time.Time
	Now         time.Time
}

type AdminUserInviteRecord struct {
	InviteID    common.ID
	UserID      common.ID
	Email       string
	DisplayName string
	Role        admindomain.Role
	ExpiresAt   time.Time
}

// ConsumeAdminUserInviteInput sets the password, activates the operator and
// marks the invite used in one transaction.
type ConsumeAdminUserInviteInput struct {
	TokenHash    string
	PasswordHash string
	Now          time.Time
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

// SweepRunRecord is the freshness of one scheduled worker sweep.
//
// LastSucceededAt is tracked separately from LastRunAt because a sweep that runs
// every hour and fails every time looks alive by run time alone.
type SweepRunRecord struct {
	SweepName       string
	LastRunAt       time.Time
	LastSucceededAt time.Time
	LastSucceeded   bool
	LastError       string
}

type ListAdminAuditEventsInput struct {
	Limit    int
	Offset   int
	Severity admindomain.AuditSeverity
	// ActorEmail narrows the trail to one operator, which is the question asked
	// during an investigation.
	ActorEmail string
	// From and To bound the window. Zero means unbounded on that side.
	From time.Time
	To   time.Time
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
