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
	ListBusinessUsers(ctx context.Context, scope common.TenantScope) ([]BusinessUserRecord, error)
	CreateBusinessUser(ctx context.Context, scope common.TenantScope, input CreateBusinessUserInput) (BusinessUserRecord, error)
	UpdateBusinessUser(ctx context.Context, scope common.TenantScope, input UpdateBusinessUserInput) (BusinessUserRecord, error)
	UpdateBusinessUserPassword(ctx context.Context, scope common.TenantScope, input UpdateBusinessUserPasswordInput) error
	TransferBusinessOwner(ctx context.Context, scope common.TenantScope, input TransferBusinessOwnerInput) (TransferBusinessOwnerResult, error)
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

type BusinessUserRecord struct {
	UserID      common.ID
	BusinessID  common.ID
	Email       string
	DisplayName string
	Role        business.UserRole
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CreateBusinessUserInput struct {
	UserID       common.ID
	BusinessID   common.ID
	Email        string
	DisplayName  string
	PasswordHash string
	Role         business.UserRole
}

type UpdateBusinessUserInput struct {
	UserID      common.ID
	DisplayName string
	Role        business.UserRole
	IsActive    bool
}

type UpdateBusinessUserPasswordInput struct {
	UserID       common.ID
	PasswordHash string
}

type TransferBusinessOwnerInput struct {
	CurrentOwnerUserID common.ID
	NewOwnerUserID     common.ID
}

type TransferBusinessOwnerResult struct {
	PreviousOwner BusinessUserRecord
	NewOwner      BusinessUserRecord
}

type AuthSessionRepository interface {
	Create(ctx context.Context, input CreateAuthSessionInput) error
	// FindByRefreshTokenHash looks a session up by the credential itself (the
	// hash is globally unique), so it carries no tenant scope, like login. The
	// caller validates expiry/revocation/active-user against its own clock.
	FindByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (AuthSessionWithUser, error)
	// Revoke marks a session revoked within its tenant scope.
	Revoke(ctx context.Context, businessID common.ID, sessionID common.ID) error
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

type AuthSessionWithUser struct {
	SessionID      common.ID
	BusinessID     common.ID
	BusinessUserID common.ID
	Role           business.UserRole
	UserIsActive   bool
	Revoked        bool
	ExpiresAt      time.Time
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

type TokenVerifier interface {
	VerifyAccessToken(ctx context.Context, token string) (VerifiedAccessToken, error)
}

type VerifiedAccessToken struct {
	Subject    common.ID
	BusinessID common.ID
	Role       business.UserRole
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
	InitializeTransaction(ctx context.Context, input InitializeTransactionInput) (InitializeTransactionResult, error)
	InitializeAuthorization(ctx context.Context, input InitializeAuthorizationInput) (InitializeAuthorizationResult, error)
	VerifyAuthorization(ctx context.Context, input VerifyAuthorizationInput) (VerifyAuthorizationResult, error)
	ChargeAuthorization(ctx context.Context, input ChargeAuthorizationInput) (ChargeAuthorizationResult, error)
	// VerifyWebhookSignature checks a raw webhook body against its signature
	// header. It operates on bytes, never a decoded value, so the signature is
	// verified over exactly what the provider signed.
	VerifyWebhookSignature(payload []byte, signature string) bool
	ParseChargeEvent(payload []byte) (ProviderChargeEvent, error)
}

type CreateBusinessSubaccountInput struct {
	BusinessID        common.ID
	BusinessName      string
	SettlementAccount string
}

type CreateBusinessSubaccountResult struct {
	ProviderReference string
}

type InitializeTransactionInput struct {
	BusinessID      common.ID
	SubaccountRef   string
	CustomerEmail   string
	AmountMinor     int64
	CommissionMinor int64
	Currency        string
	Reference       string
}

type InitializeTransactionResult struct {
	AuthorizationURL  string
	AccessCode        string
	ProviderReference string
}

type InitializeAuthorizationInput struct {
	BusinessID    common.ID
	CustomerEmail string
	CallbackURL   string
}

type InitializeAuthorizationResult struct {
	RedirectURL string
	AccessCode  string
	Reference   string
}

type VerifyAuthorizationInput struct {
	Reference string
}

type VerifyAuthorizationResult struct {
	AuthorizationCode string
	CustomerCode      string
	CustomerEmail     string
	Channel           string
	Bank              string
	Active            bool
}

type ChargeAuthorizationInput struct {
	BusinessID        common.ID
	AuthorizationCode string
	CustomerEmail     string
	AmountMinor       int64
	Currency          string
	Reference         string
}

type ChargeAuthorizationResult struct {
	ProviderReference string
	Status            string
	AmountMinor       int64
	Currency          string
}

type ProviderChargeEvent struct {
	EventType         string
	ProviderReference string
	Succeeded         bool
	AmountMinor       int64
	// Signature is the idempotency key for this event (provider + reference +
	// type), used to make a re-delivered confirmation a no-op.
	Signature string
}

type PaymentRepository interface {
	Create(ctx context.Context, input CreatePaymentInput) error
	// ConfirmFromProvider records the provider event and advances the matching
	// payment in a single transaction, so a re-delivered event is a no-op.
	ConfirmFromProvider(ctx context.Context, input ConfirmPaymentInput) (ConfirmPaymentResult, error)
	ListByBusiness(ctx context.Context, scope common.TenantScope) ([]PaymentRecord, error)
	// RecordManualTaking logs an off-platform sale (cash/momo/other). It never
	// carries commission — Xtiitch does not touch this money.
	RecordManualTaking(ctx context.Context, scope common.TenantScope, input ManualTakingInput) error
	// ListManualTakings lists a business's off-platform takings, most recent first.
	ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ManualTakingRecord, error)
	// MoneySummary aggregates the business's income: succeeded through-platform
	// payments and their commission, plus off-platform manual takings.
	MoneySummary(ctx context.Context, scope common.TenantScope) (MoneySummary, error)
}

type ManualTakingInput struct {
	TakingID    common.ID
	BusinessID  common.ID
	OrderID     *common.ID
	AmountMinor int64
	Method      string
	WhatFor     string
}

type ManualTakingRecord struct {
	TakingID    common.ID
	AmountMinor int64
	Method      string
	WhatFor     string
	TakenAt     time.Time
}

// MoneySummary is the business's income overview, all in GHS pesewas. Net income
// is what the business keeps: through-platform settlements (gross minus the
// platform commission) plus the off-platform takings it logged.
type MoneySummary struct {
	ThroughPlatformMinor int64
	CommissionMinor      int64
	ManualTakingsMinor   int64
	NetIncomeMinor       int64
}

type CreatePaymentInput struct {
	PaymentID         common.ID
	BusinessID        common.ID
	OrderID           *common.ID
	BookingID         *common.ID
	Purpose           string
	AmountMinor       int64
	Currency          string
	Method            string
	ProviderReference string
	CommissionMinor   int64
}

type ConfirmPaymentInput struct {
	EventSignature    string
	EventType         string
	ProviderReference string
	Succeeded         bool
}

type ConfirmPaymentResult struct {
	AlreadyProcessed         bool
	PaymentFound             bool
	SubscriptionInvoiceFound bool
	AdCampaignPaymentFound   bool
	BusinessID               common.ID
}

type PaymentRecord struct {
	PaymentID         common.ID
	BusinessID        common.ID
	Purpose           string
	AmountMinor       int64
	Currency          string
	Method            string
	ProviderReference string
	Status            string
	CommissionMinor   int64
}

type BusinessChargeRepository interface {
	GetChargeContext(ctx context.Context, scope common.TenantScope) (BusinessChargeContext, error)
	ProvisionSubaccount(ctx context.Context, businessID common.ID, subaccountRef string, settlementAccount string) error
}

type BusinessChargeContext struct {
	BusinessID    common.ID
	Name          string
	Verified      bool
	SubaccountRef string
	CommissionBps int
}

// MediaStore signs a direct, browser-to-provider image upload. The client
// uploads the file straight to the provider with the returned signature, then
// stores only the resulting URL on a design — image bytes never pass through
// Xtiitch.
type MediaStore interface {
	SignUpload(ctx context.Context, scope common.TenantScope, folder string) (SignedUpload, error)
}

type SignedUpload struct {
	Signature string
	Timestamp int64
	CloudName string
	APIKey    string
	Folder    string
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
