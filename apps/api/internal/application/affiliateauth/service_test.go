package affiliateauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestActivateConsumesInviteAndCreatesDedicatedSession(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateAuthRepository{
		account: testAffiliateAccount(),
	}
	service := testService(repo)
	result, err := service.Activate(
		context.Background(),
		"invite-token",
		"secure-password",
		ClientContext{UserAgent: "Browser", IPAddress: "192.0.2.3"},
	)
	if err != nil {
		t.Fatalf("activate: %v", err)
	}
	if repo.activation.ActivationTokenHash != "hash:invite-token" {
		t.Fatalf("unexpected activation hash %q", repo.activation.ActivationTokenHash)
	}
	if repo.activation.PasswordHash != "password:secure-password" {
		t.Fatalf("unexpected password hash %q", repo.activation.PasswordHash)
	}
	if repo.createdSession.AccountID != repo.account.AccountID {
		t.Fatalf("session account mismatch: %+v", repo.createdSession)
	}
	if repo.createdSession.IPHash == "192.0.2.3" || repo.createdSession.IPHash == "" {
		t.Fatal("expected a non-empty, privacy-safe IP hash")
	}
	if result.AccessToken != "affiliate-access" ||
		result.RefreshToken != "refresh-token" {
		t.Fatalf("unexpected session result: %+v", result)
	}
}

func TestLoginRecordsFailureAndNeverIssuesSession(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateAuthRepository{
		credentials: ports.AffiliateAccountCredentials{
			AffiliateAccountRecord: testAffiliateAccount(),
			PasswordHash:           "password:correct",
		},
	}
	service := testService(repo)
	_, err := service.Login(
		context.Background(),
		"affiliate@example.com",
		"wrong",
		ClientContext{},
	)
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if repo.failedLoginAccount != repo.credentials.AccountID {
		t.Fatal("expected failed login to be recorded")
	}
	if repo.createdSession.AccountID != "" {
		t.Fatal("must not create a session after a failed login")
	}
}

func TestRefreshRevokesPresentedSessionBeforeRotation(t *testing.T) {
	t.Parallel()

	account := testAffiliateAccount()
	repo := &fakeAffiliateAuthRepository{
		session: ports.AffiliateSessionWithAccount{
			SessionID:     common.ID("old-session"),
			AccountID:     account.AccountID,
			AffiliateID:   account.AffiliateID,
			Email:         account.Email,
			DisplayName:   account.DisplayName,
			Code:          account.Code,
			AccountStatus: "active",
			ExpiresAt:     testNow.Add(time.Hour),
		},
	}
	service := testService(repo)
	if _, err := service.Refresh(
		context.Background(),
		"old-refresh",
		ClientContext{},
	); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if repo.revokedSession != common.ID("old-session") {
		t.Fatal("expected old session to be revoked")
	}
	if repo.createdSession.SessionID == "" {
		t.Fatal("expected rotated session")
	}
}

func TestRecoveryRequestDoesNotRevealUnknownEmail(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateAuthRepository{recoveryErr: errors.New("not found")}
	email := &fakeEmailSender{}
	service := testService(repo)
	service.emails = email
	if err := service.RequestRecovery(
		context.Background(),
		"unknown@example.com",
	); err != nil {
		t.Fatalf("request recovery: %v", err)
	}
	if email.sent {
		t.Fatal("must not send recovery email for an unknown account")
	}
}

func TestResendActivationReplacesLinkWithFresh48HourToken(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateAuthRepository{account: testAffiliateAccount()}
	email := &fakeEmailSender{}
	service := testService(repo)
	service.emails = email
	if err := service.ResendActivation(context.Background(), " AFFILIATE@example.com "); err != nil {
		t.Fatalf("resend activation: %v", err)
	}
	if repo.activationToken.Email != "affiliate@example.com" ||
		repo.activationToken.TokenHash != "hash:refresh-token" {
		t.Fatalf("unexpected activation token: %+v", repo.activationToken)
	}
	if !repo.activationToken.ExpiresAt.Equal(testNow.Add(48 * time.Hour)) {
		t.Fatalf("unexpected activation expiry: %v", repo.activationToken.ExpiresAt)
	}
	if !email.sent {
		t.Fatal("expected replacement activation email")
	}
}

func TestDashboardAlwaysScopesReadToAuthenticatedAffiliate(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateAuthRepository{
		dashboard: ports.AffiliateDashboardRecord{
			ClickCount:          10,
			CustomerSignupCount: 2,
			BusinessSignupCount: 1,
			PurchaseCount:       2,
		},
	}
	service := testService(repo)
	result, err := service.Dashboard(
		context.Background(),
		common.ID("affiliate-from-token"),
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("dashboard: %v", err)
	}
	if repo.dashboardQuery.AffiliateID != common.ID("affiliate-from-token") {
		t.Fatalf("dashboard was not principal-scoped: %+v", repo.dashboardQuery)
	}
	if result.ClickToSignupRateBPS != 3000 ||
		result.ClickToPurchaseRateBPS != 2000 {
		t.Fatalf("unexpected conversion rates: %+v", result)
	}
}

func TestConversionsRejectsInvalidCursorBeforeRepositoryRead(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateAuthRepository{}
	service := testService(repo)
	_, err := service.Conversions(
		context.Background(),
		common.ID("affiliate-1"),
		"not-a-uuid",
		"",
		"",
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	if repo.conversionRead {
		t.Fatal("repository must not receive an invalid cursor")
	}
}

var testNow = time.Date(2026, 7, 30, 17, 0, 0, 0, time.UTC)

func testAffiliateAccount() ports.AffiliateAccountRecord {
	return ports.AffiliateAccountRecord{
		AccountID:   common.ID("account-1"),
		AffiliateID: common.ID("affiliate-1"),
		Email:       "affiliate@example.com",
		DisplayName: "Affiliate",
		Code:        "AFFILIATE",
		Status:      "active",
	}
}

func testService(repo ports.AffiliateAuthRepository) Service {
	deps := Dependencies{
		Accounts:      repo,
		Passwords:     fakePasswords{},
		AccessTokens:  fakeAccessTokens{},
		RefreshTokens: fakeRefreshTokens{},
		Clock:         fakeClock{},
		IDs:           fakeIDs{},
		PortalURL:     "https://affiliate.example.com",
		ShareBaseURL:  "https://store.example.com",
	}
	if portal, ok := repo.(ports.AffiliatePortalRepository); ok {
		deps.Portal = portal
	}
	return NewService(deps)
}

type fakeAffiliateAuthRepository struct {
	account            ports.AffiliateAccountRecord
	credentials        ports.AffiliateAccountCredentials
	session            ports.AffiliateSessionWithAccount
	activation         ports.ActivateAffiliateAccountInput
	createdSession     ports.CreateAffiliateSessionInput
	failedLoginAccount common.ID
	revokedSession     common.ID
	recoveryErr        error
	activationToken    ports.CreateAffiliateActivationTokenInput
	dashboard          ports.AffiliateDashboardRecord
	dashboardQuery     ports.AffiliateDashboardQuery
	conversionRead     bool
	campaignInput      ports.CreateAffiliateCampaignLinkInput
	payoutInput        ports.UpsertAffiliatePayoutProfileInput
}

func (repo *fakeAffiliateAuthRepository) ListAffiliateCampaignLinks(context.Context, common.ID) ([]ports.AffiliateCampaignLinkRecord, error) {
	return nil, nil
}
func (repo *fakeAffiliateAuthRepository) CreateAffiliateCampaignLink(
	_ context.Context,
	input ports.CreateAffiliateCampaignLinkInput) (ports.AffiliateCampaignLinkRecord,
	error,
) {
	repo.campaignInput = input
	return ports.AffiliateCampaignLinkRecord{CampaignLinkID: input.CampaignLinkID}, nil
}
func (repo *fakeAffiliateAuthRepository) GetAffiliatePayoutProfile(_ context.Context, affiliateID common.ID) (ports.AffiliatePayoutProfileRecord, error) {
	return ports.AffiliatePayoutProfileRecord{AffiliateID: affiliateID}, nil
}
func (repo *fakeAffiliateAuthRepository) UpsertAffiliatePayoutProfile(
	_ context.Context,
	input ports.UpsertAffiliatePayoutProfileInput) (ports.AffiliatePayoutProfileRecord,
	error,
) {
	repo.payoutInput = input
	return ports.AffiliatePayoutProfileRecord{AffiliateID: input.AffiliateID}, nil
}
func (repo *fakeAffiliateAuthRepository) GetAffiliateNotificationPreferences(
	_ context.Context,
	affiliateID common.ID) (ports.AffiliateNotificationPreferencesRecord,
	error,
) {
	return ports.AffiliateNotificationPreferencesRecord{AffiliateID: affiliateID}, nil
}
func (repo *fakeAffiliateAuthRepository) UpsertAffiliateNotificationPreferences(
	_ context.Context,
	input ports.AffiliateNotificationPreferencesRecord) (ports.AffiliateNotificationPreferencesRecord,
	error,
) {
	return input, nil
}
func (repo *fakeAffiliateAuthRepository) ExportAffiliateConversions(context.Context, ports.AffiliateDashboardQuery) ([]ports.AffiliateConversionRecord, error) {
	return nil, nil
}

func (repo *fakeAffiliateAuthRepository) ActivateAffiliateAccount(
	_ context.Context,
	input ports.ActivateAffiliateAccountInput,
) (ports.AffiliateAccountRecord, error) {
	repo.activation = input
	return repo.account, nil
}

func (repo *fakeAffiliateAuthRepository) FindAffiliateAccountByEmail(
	context.Context,
	string,
) (ports.AffiliateAccountCredentials, error) {
	return repo.credentials, nil
}

func (repo *fakeAffiliateAuthRepository) FindAffiliateAccountByID(
	context.Context,
	common.ID,
) (ports.AffiliateAccountRecord, error) {
	return repo.account, nil
}

func (repo *fakeAffiliateAuthRepository) CreateAffiliateRecoveryToken(
	context.Context,
	ports.CreateAffiliateRecoveryTokenInput,
) (ports.AffiliateAccountRecord, error) {
	return repo.account, repo.recoveryErr
}

func (repo *fakeAffiliateAuthRepository) CreateAffiliateActivationToken(
	_ context.Context,
	input ports.CreateAffiliateActivationTokenInput,
) (ports.AffiliateAccountRecord, error) {
	repo.activationToken = input
	return repo.account, repo.recoveryErr
}

func (repo *fakeAffiliateAuthRepository) ResetAffiliatePassword(
	context.Context,
	ports.ResetAffiliatePasswordInput,
) error {
	return nil
}

func (repo *fakeAffiliateAuthRepository) RecordFailedAffiliateLogin(
	_ context.Context,
	accountID common.ID,
	_ int,
	_ time.Duration,
) error {
	repo.failedLoginAccount = accountID
	return nil
}

func (*fakeAffiliateAuthRepository) ClearFailedAffiliateLogin(
	context.Context,
	common.ID,
) error {
	return nil
}

func (*fakeAffiliateAuthRepository) RecordAffiliateLogin(
	context.Context,
	common.ID,
) error {
	return nil
}

func (repo *fakeAffiliateAuthRepository) CreateAffiliateSession(
	_ context.Context,
	input ports.CreateAffiliateSessionInput,
) error {
	repo.createdSession = input
	return nil
}

func (repo *fakeAffiliateAuthRepository) FindAffiliateSession(
	context.Context,
	string,
) (ports.AffiliateSessionWithAccount, error) {
	return repo.session, nil
}

func (repo *fakeAffiliateAuthRepository) RevokeAffiliateSession(
	_ context.Context,
	sessionID common.ID,
) error {
	repo.revokedSession = sessionID
	return nil
}

func (repo *fakeAffiliateAuthRepository) GetAffiliateDashboard(
	_ context.Context,
	input ports.AffiliateDashboardQuery,
) (ports.AffiliateDashboardRecord, error) {
	repo.dashboardQuery = input
	return repo.dashboard, nil
}

func (repo *fakeAffiliateAuthRepository) ListAffiliateConversions(
	context.Context,
	ports.AffiliateLedgerQuery,
) ([]ports.AffiliateConversionRecord, error) {
	repo.conversionRead = true
	return nil, nil
}

func (*fakeAffiliateAuthRepository) ListAffiliatePayouts(
	context.Context,
	ports.AffiliateLedgerQuery,
) ([]ports.AffiliatePayoutRecord, error) {
	return nil, nil
}

type fakePasswords struct{}

func (fakePasswords) Hash(password string) (string, error) {
	return "password:" + password, nil
}

func (fakePasswords) Compare(hash string, password string) error {
	if hash != "password:"+password {
		return errors.New("mismatch")
	}
	return nil
}

type fakeAccessTokens struct{}

func (fakeAccessTokens) IssueAffiliateAccessToken(
	context.Context,
	ports.AffiliateAccessTokenInput,
) (string, error) {
	return "affiliate-access", nil
}

type fakeRefreshTokens struct{}

func (fakeRefreshTokens) NewRefreshToken() (string, error) {
	return "refresh-token", nil
}

func (fakeRefreshTokens) HashRefreshToken(token string) string {
	return "hash:" + token
}

type fakeClock struct{}

func (fakeClock) Now() time.Time {
	return testNow
}

type fakeIDs struct{}

func (fakeIDs) NewID() common.ID {
	return common.ID("new-session")
}

type fakeEmailSender struct {
	sent bool
}

func (sender *fakeEmailSender) Send(context.Context, ports.EmailMessage) error {
	sender.sent = true
	return nil
}
