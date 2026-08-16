package affiliateauth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var (
	ErrInvalidCredentials = errors.New("invalid affiliate credentials")
	ErrInvalidInput       = errors.New("invalid affiliate auth input")
	ErrInvalidActivation  = errors.New("invalid or expired affiliate activation token")
	ErrInvalidRecovery    = errors.New("invalid or expired affiliate recovery token")
)

const (
	accessTokenTTL     = 15 * time.Minute
	refreshTokenTTL    = 30 * 24 * time.Hour
	maxLoginAttempts   = 5
	loginLockDuration  = 15 * time.Minute
	minPasswordLength  = 8
	maxPasswordLength  = 128
	recoveryTokenTTL   = 30 * time.Minute
	activationTokenTTL = 48 * time.Hour
)

type Dependencies struct {
	Accounts        ports.AffiliateAuthRepository
	Passwords       ports.PasswordHasher
	AccessTokens    ports.AffiliateTokenIssuer
	RefreshTokens   ports.RefreshTokenIssuer
	Clock           ports.Clock
	IDs             ports.IDGenerator
	Emails          ports.EmailSender
	PortalURL       string
	Portal          ports.AffiliatePortalRepository
	ShareBaseURL    string
	SensitiveCipher interface {
		EncryptSecret(string) ([]byte, error)
	}
}

type Service struct {
	accounts        ports.AffiliateAuthRepository
	passwords       ports.PasswordHasher
	accessTokens    ports.AffiliateTokenIssuer
	refreshTokens   ports.RefreshTokenIssuer
	clock           ports.Clock
	ids             ports.IDGenerator
	emails          ports.EmailSender
	portalURL       string
	portal          ports.AffiliatePortalRepository
	shareBaseURL    string
	sensitiveCipher interface {
		EncryptSecret(string) ([]byte, error)
	}
}

func NewService(deps Dependencies) Service {
	return Service{
		accounts:        deps.Accounts,
		passwords:       deps.Passwords,
		accessTokens:    deps.AccessTokens,
		refreshTokens:   deps.RefreshTokens,
		clock:           deps.Clock,
		ids:             deps.IDs,
		emails:          deps.Emails,
		portalURL:       strings.TrimRight(strings.TrimSpace(deps.PortalURL), "/"),
		portal:          deps.Portal,
		shareBaseURL:    strings.TrimRight(strings.TrimSpace(deps.ShareBaseURL), "/"),
		sensitiveCipher: deps.SensitiveCipher,
	}
}

type ClientContext struct {
	UserAgent string
	IPAddress string
}

type SessionResult struct {
	Account          ports.AffiliateAccountRecord
	AccessToken      string
	RefreshToken     string
	AccessExpiresAt  time.Time
	RefreshExpiresAt time.Time
}

type DashboardResult struct {
	Record                 ports.AffiliateDashboardRecord
	ClickToSignupRateBPS   int64
	ClickToPurchaseRateBPS int64
	From                   time.Time
	To                     time.Time
}

type ConversionPage struct {
	Records    []ports.AffiliateConversionRecord
	NextCursor *common.ID
}

type PayoutPage struct {
	Records    []ports.AffiliatePayoutRecord
	NextCursor *common.ID
}

func (s Service) Activate(
	ctx context.Context,
	token string,
	password string,
	client ClientContext,
) (SessionResult, error) {
	token = strings.TrimSpace(token)
	if token == "" || !validPassword(password) {
		return SessionResult{}, ErrInvalidInput
	}
	passwordHash, err := s.passwords.Hash(password)
	if err != nil {
		return SessionResult{}, err
	}
	account, err := s.accounts.ActivateAffiliateAccount(ctx, ports.ActivateAffiliateAccountInput{
		ActivationTokenHash: s.refreshTokens.HashRefreshToken(token),
		PasswordHash:        passwordHash,
		ActivatedAt:         s.clock.Now(),
	})
	if err != nil {
		return SessionResult{}, ErrInvalidActivation
	}
	return s.issueSession(ctx, account, client)
}

func (s Service) Login(
	ctx context.Context,
	email string,
	password string,
	client ClientContext,
) (SessionResult, error) {
	email, err := normalizeEmail(email)
	if err != nil || password == "" {
		return SessionResult{}, ErrInvalidCredentials
	}
	credentials, err := s.accounts.FindAffiliateAccountByEmail(ctx, email)
	if err != nil {
		return SessionResult{}, ErrInvalidCredentials
	}
	now := s.clock.Now()
	if credentials.Status == "locked" && credentials.LockedUntil != nil &&
		now.Before(*credentials.LockedUntil) {
		return SessionResult{}, ErrInvalidCredentials
	}
	if credentials.Status != "active" && credentials.Status != "locked" {
		return SessionResult{}, ErrInvalidCredentials
	}
	if err := s.passwords.Compare(credentials.PasswordHash, password); err != nil {
		_ = s.accounts.RecordFailedAffiliateLogin(
			ctx,
			credentials.AccountID,
			maxLoginAttempts,
			loginLockDuration,
		)
		return SessionResult{}, ErrInvalidCredentials
	}
	if err := s.accounts.ClearFailedAffiliateLogin(ctx, credentials.AccountID); err != nil {
		return SessionResult{}, err
	}
	if err := s.accounts.RecordAffiliateLogin(ctx, credentials.AccountID); err != nil {
		return SessionResult{}, err
	}
	return s.issueSession(ctx, credentials.AffiliateAccountRecord, client)
}

func (s Service) Refresh(
	ctx context.Context,
	token string,
	client ClientContext,
) (SessionResult, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return SessionResult{}, ErrInvalidCredentials
	}
	session, err := s.accounts.FindAffiliateSession(
		ctx,
		s.refreshTokens.HashRefreshToken(token),
	)
	if err != nil || session.Revoked || session.AccountStatus != "active" ||
		!s.clock.Now().Before(session.ExpiresAt) {
		return SessionResult{}, ErrInvalidCredentials
	}
	if err := s.accounts.RevokeAffiliateSession(ctx, session.SessionID); err != nil {
		return SessionResult{}, err
	}
	account := ports.AffiliateAccountRecord{
		AccountID:   session.AccountID,
		AffiliateID: session.AffiliateID,
		Email:       session.Email,
		DisplayName: session.DisplayName,
		Code:        session.Code,
		Status:      session.AccountStatus,
	}
	return s.issueSession(ctx, account, client)
}

func (s Service) Logout(ctx context.Context, token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil
	}
	session, err := s.accounts.FindAffiliateSession(
		ctx,
		s.refreshTokens.HashRefreshToken(token),
	)
	if err != nil {
		return nil
	}
	return s.accounts.RevokeAffiliateSession(ctx, session.SessionID)
}

func (s Service) RequestRecovery(ctx context.Context, rawEmail string) error {
	if s.emails == nil {
		return nil
	}
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return nil
	}
	token, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return err
	}
	account, err := s.accounts.CreateAffiliateRecoveryToken(
		ctx,
		ports.CreateAffiliateRecoveryTokenInput{
			TokenID:   s.ids.NewID(),
			Email:     email,
			TokenHash: s.refreshTokens.HashRefreshToken(token),
			ExpiresAt: s.clock.Now().Add(recoveryTokenTTL),
		},
	)
	if err != nil {
		return nil
	}
	resetURL := s.portalURL + "/reset-password?token=" + url.QueryEscape(token)
	body := fmt.Sprintf(
		"Hi %s,\n\nReset your Xtiitch affiliate password here:\n\n%s\n\n"+
			"This link expires in 30 minutes. If you did not request it, ignore this email.",
		account.DisplayName,
		resetURL,
	)
	return s.emails.Send(ctx, ports.EmailMessage{
		To:      account.Email,
		Subject: "Reset your Xtiitch affiliate password",
		Body:    body,
	})
}

func (s Service) ResendActivation(ctx context.Context, rawEmail string) error {
	if s.emails == nil {
		return nil
	}
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return nil
	}
	token, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return err
	}
	account, err := s.accounts.CreateAffiliateActivationToken(
		ctx,
		ports.CreateAffiliateActivationTokenInput{
			TokenID: s.ids.NewID(), Email: email,
			TokenHash: s.refreshTokens.HashRefreshToken(token),
			ExpiresAt: s.clock.Now().Add(activationTokenTTL),
		},
	)
	if err != nil {
		return nil
	}
	activationURL := s.portalURL + "/activate?token=" + url.QueryEscape(token)
	body := fmt.Sprintf(
		"Hi %s,\n\nActivate your Xtiitch affiliate account here:\n\n%s\n\n"+
			"This link expires in 48 hours. If you did not request it, ignore this email.",
		account.DisplayName, activationURL,
	)
	return s.emails.Send(ctx, ports.EmailMessage{
		To: account.Email, Subject: "Activate your Xtiitch affiliate account", Body: body,
	})
}

func (s Service) ResetPassword(
	ctx context.Context,
	token string,
	password string,
) error {
	token = strings.TrimSpace(token)
	if token == "" || !validPassword(password) {
		return ErrInvalidInput
	}
	passwordHash, err := s.passwords.Hash(password)
	if err != nil {
		return err
	}
	err = s.accounts.ResetAffiliatePassword(ctx, ports.ResetAffiliatePasswordInput{
		TokenHash:    s.refreshTokens.HashRefreshToken(token),
		PasswordHash: passwordHash,
		ResetAt:      s.clock.Now(),
	})
	if err != nil {
		return ErrInvalidRecovery
	}
	return nil
}

func (s Service) Me(
	ctx context.Context,
	accountID common.ID,
) (ports.AffiliateAccountRecord, error) {
	account, err := s.accounts.FindAffiliateAccountByID(ctx, accountID)
	if err != nil {
		return ports.AffiliateAccountRecord{}, ErrInvalidCredentials
	}
	return account, nil
}

func (s Service) Dashboard(
	ctx context.Context,
	affiliateID common.ID,
	from *time.Time,
	to *time.Time,
) (DashboardResult, error) {
	if s.portal == nil {
		return DashboardResult{}, ErrInvalidInput
	}
	now := s.clock.Now()
	rangeTo := now
	if to != nil {
		rangeTo = to.UTC()
	}
	rangeFrom := rangeTo.AddDate(0, 0, -30)
	if from != nil {
		rangeFrom = from.UTC()
	}
	if !rangeFrom.Before(rangeTo) || rangeTo.After(now.Add(time.Minute)) ||
		rangeTo.Sub(rangeFrom) > 366*24*time.Hour {
		return DashboardResult{}, ErrInvalidInput
	}
	record, err := s.portal.GetAffiliateDashboard(ctx, ports.AffiliateDashboardQuery{
		AffiliateID: affiliateID,
		From:        rangeFrom,
		To:          rangeTo,
	})
	if err != nil {
		return DashboardResult{}, err
	}
	signups := record.CustomerSignupCount + record.BusinessSignupCount
	return DashboardResult{
		Record:                 record,
		ClickToSignupRateBPS:   conversionRateBPS(signups, record.ClickCount),
		ClickToPurchaseRateBPS: conversionRateBPS(record.PurchaseCount, record.ClickCount),
		From:                   rangeFrom,
		To:                     rangeTo,
	}, nil
}

func (s Service) Conversions(
	ctx context.Context,
	affiliateID common.ID,
	cursor string,
	conversionType string,
	status string,
) (ConversionPage, error) {
	query, err := ledgerQuery(affiliateID, cursor, conversionType, status)
	if err != nil {
		return ConversionPage{}, err
	}
	records, err := s.portal.ListAffiliateConversions(ctx, query)
	if err != nil {
		return ConversionPage{}, err
	}
	page := ConversionPage{Records: records}
	if len(records) > 20 {
		records = records[:20]
		page.Records = records
		next := records[len(records)-1].ConversionID
		page.NextCursor = &next
	}
	return page, nil
}

func (s Service) Payouts(
	ctx context.Context,
	affiliateID common.ID,
	cursor string,
) (PayoutPage, error) {
	query, err := ledgerQuery(affiliateID, cursor, "", "")
	if err != nil {
		return PayoutPage{}, err
	}
	records, err := s.portal.ListAffiliatePayouts(ctx, query)
	if err != nil {
		return PayoutPage{}, err
	}
	page := PayoutPage{Records: records}
	if len(records) > 20 {
		records = records[:20]
		page.Records = records
		next := records[len(records)-1].PayoutID
		page.NextCursor = &next
	}
	return page, nil
}

func (s Service) ShareLinks(
	ctx context.Context,
	accountID common.ID,
) (string, string, int, error) {
	account, err := s.Me(ctx, accountID)
	if err != nil {
		return "", "", 0, err
	}
	link := s.shareBaseURL + "/register?affiliate_code=" + url.QueryEscape(account.Code)
	return account.Code, link, account.CookieWindowDays, nil
}

func (s Service) issueSession(
	ctx context.Context,
	account ports.AffiliateAccountRecord,
	client ClientContext,
) (SessionResult, error) {
	now := s.clock.Now()
	accessExpiresAt := now.Add(accessTokenTTL)
	refreshExpiresAt := now.Add(refreshTokenTTL)
	accessToken, err := s.accessTokens.IssueAffiliateAccessToken(
		ctx,
		ports.AffiliateAccessTokenInput{
			AccountID:   account.AccountID,
			AffiliateID: account.AffiliateID,
			IssuedAt:    now,
			ExpiresAt:   accessExpiresAt,
		},
	)
	if err != nil {
		return SessionResult{}, err
	}
	refreshToken, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return SessionResult{}, err
	}
	if err := s.accounts.CreateAffiliateSession(ctx, ports.CreateAffiliateSessionInput{
		SessionID:        s.ids.NewID(),
		AccountID:        account.AccountID,
		RefreshTokenHash: s.refreshTokens.HashRefreshToken(refreshToken),
		UserAgent:        strings.TrimSpace(client.UserAgent),
		IPHash:           hashIPAddress(client.IPAddress),
		ExpiresAt:        refreshExpiresAt,
	}); err != nil {
		return SessionResult{}, err
	}
	return SessionResult{
		Account:          account,
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  accessExpiresAt,
		RefreshExpiresAt: refreshExpiresAt,
	}, nil
}

func normalizeEmail(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(value)
	if err != nil || strings.ToLower(address.Address) != value {
		return "", ErrInvalidInput
	}
	return value, nil
}

func validPassword(password string) bool {
	return len(password) >= minPasswordLength && len(password) <= maxPasswordLength
}

func hashIPAddress(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func conversionRateBPS(numerator int64, denominator int64) int64 {
	if numerator <= 0 || denominator <= 0 {
		return 0
	}
	return numerator * 10_000 / denominator
}

func ledgerQuery(
	affiliateID common.ID,
	cursor string,
	conversionType string,
	status string,
) (ports.AffiliateLedgerQuery, error) {
	conversionType = strings.TrimSpace(conversionType)
	status = strings.TrimSpace(status)
	if conversionType != "" && conversionType != "purchase" &&
		conversionType != "paid_plan_signup" {
		return ports.AffiliateLedgerQuery{}, ErrInvalidInput
	}
	if status != "" && status != "pending" && status != "approved" &&
		status != "settled" && status != "reversed" {
		return ports.AffiliateLedgerQuery{}, ErrInvalidInput
	}
	query := ports.AffiliateLedgerQuery{
		AffiliateID: affiliateID,
		Limit:       21,
		Type:        conversionType,
		Status:      status,
	}
	cursor = strings.TrimSpace(cursor)
	if cursor != "" {
		if _, err := uuid.Parse(cursor); err != nil {
			return ports.AffiliateLedgerQuery{}, ErrInvalidInput
		}
		value := common.ID(cursor)
		query.Cursor = &value
	}
	return query, nil
}
