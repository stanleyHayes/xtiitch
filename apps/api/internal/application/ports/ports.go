package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BusinessRepository interface {
	GetByID(ctx context.Context, scope common.TenantScope, id common.ID) (business.Business, error)
}

type BusinessIdentityRepository interface {
	CreateBusinessWithOwner(ctx context.Context, input CreateBusinessWithOwnerInput) (BusinessOwnerIdentity, error)
	FindBusinessUserByHandleAndEmail(ctx context.Context, handle string, email string) (BusinessUserCredentials, error)
}

type CreateBusinessWithOwnerInput struct {
	BusinessID       common.ID
	BusinessName     string
	BusinessHandle   string
	OwnerUserID      common.ID
	OwnerDisplayName string
	OwnerEmail       string
	OwnerPassword    string
}

type BusinessOwnerIdentity struct {
	BusinessID     common.ID
	BusinessUserID common.ID
	Role           business.UserRole
}

type BusinessUserCredentials struct {
	BusinessID   common.ID
	UserID       common.ID
	PasswordHash string
	Role         business.UserRole
	IsActive     bool
}

type AuthSessionRepository interface {
	Create(ctx context.Context, input CreateAuthSessionInput) error
}

type CreateAuthSessionInput struct {
	SessionID        common.ID
	BusinessID       common.ID
	BusinessUserID   common.ID
	RefreshTokenHash string
	UserAgent        string
	IPAddress        string
	ExpiresAt        time.Time
}

type TransactionManager interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type Clock interface {
	Now() time.Time
}

type IDGenerator interface {
	NewID() common.ID
}

type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash string, password string) error
}

type TokenIssuer interface {
	IssueAccessToken(ctx context.Context, input AccessTokenInput) (string, error)
}

type AccessTokenInput struct {
	Subject    common.ID
	BusinessID common.ID
	Role       business.UserRole
	IssuedAt   time.Time
	ExpiresAt  time.Time
}

type RefreshTokenIssuer interface {
	NewRefreshToken() (string, error)
	HashRefreshToken(token string) string
}

type PaymentProvider interface {
	CreateBusinessSubaccount(ctx context.Context, input CreateBusinessSubaccountInput) (CreateBusinessSubaccountResult, error)
}

type CreateBusinessSubaccountInput struct {
	BusinessID        common.ID
	SettlementAccount string
}

type CreateBusinessSubaccountResult struct {
	ProviderReference string
}

type MediaStore interface {
	SignUpload(ctx context.Context, scope common.TenantScope, folder string) (SignedUpload, error)
}

type SignedUpload struct {
	Signature string
	Timestamp int64
}

type EmailSender interface {
	Send(ctx context.Context, message EmailMessage) error
}

type EmailMessage struct {
	To      string
	Subject string
	Body    string
}

type PushSender interface {
	Send(ctx context.Context, message PushMessage) error
}

type PushMessage struct {
	To    string
	Title string
	Body  string
}

type JobQueue interface {
	Enqueue(ctx context.Context, job Job) error
}

type Job struct {
	Name       string
	TenantID   common.ID
	Payload    map[string]string
	IdempotKey string
}
