package adminauth

import (
	"context"
	"errors"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func newTestService(users *fakeAdminUsers, sessions *fakeAdminSessions, now time.Time, ids []common.ID) Service {
	service, _ := newTestServiceWithAudits(users, sessions, now, ids)
	return service
}

func newTestServiceWithAudits(
	users *fakeAdminUsers,
	sessions *fakeAdminSessions,
	now time.Time,
	ids []common.ID,
) (Service, *fakeAdminAudits) {
	return newTestServiceWithBusinesses(users, sessions, &fakeAdminBusinesses{}, now, ids)
}

func newTestServiceWithBusinesses(
	users *fakeAdminUsers,
	sessions *fakeAdminSessions,
	businesses *fakeAdminBusinesses,
	now time.Time,
	ids []common.ID,
) (Service, *fakeAdminAudits) {
	audits := &fakeAdminAudits{}
	return NewService(Dependencies{
		Users:         users,
		Sessions:      sessions,
		Audits:        audits,
		Businesses:    businesses,
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeAdminTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: ids},
		Clock:         fixedClock{now: now},
	}), audits
}

type fakeAdminUsers struct {
	bootstrapped            ports.CreateAdminUserInput
	credentials             ports.AdminUserCredentials
	findErr                 error
	lookupEmail             string
	loginUserID             common.ID
	record                  ports.AdminUserRecord
	users                   []ports.AdminUserRecord
	listCalled              bool
	created                 ports.CreateAdminUserInput
	updated                 ports.UpdateAdminUserInput
	updatedProfile          ports.UpdateAdminProfileInput
	preferencesUserID       common.ID
	preferences             ports.AdminPreferencesRecord
	updatedPreferences      ports.UpdateAdminPreferencesInput
	platformSettings        ports.AdminPlatformSettingsRecord
	updatedPlatformSettings ports.UpdateAdminPlatformSettingsInput
	marketingFlags          ports.MarketingFlags
	updatedMarketingFlags   ports.UpdateAdminMarketingFlagsInput
	rolePermissions         []ports.AdminRolePermissionsRecord
	updatedRolePermissions  ports.UpdateAdminRolePermissionsInput
}

func (repo *fakeAdminUsers) EnsureBootstrapUser(_ context.Context, input ports.CreateAdminUserInput) (ports.AdminUserRecord, error) {
	repo.bootstrapped = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    true,
	}, nil
}

func (repo *fakeAdminUsers) RecordFailedAdminLogin(_ context.Context, _ common.ID, _ int, _ time.Duration) error {
	return nil
}

func (repo *fakeAdminUsers) ClearFailedAdminLogin(_ context.Context, _ common.ID) error {
	return nil
}

func (repo *fakeAdminUsers) FindByEmail(_ context.Context, email string) (ports.AdminUserCredentials, error) {
	repo.lookupEmail = email
	if repo.findErr != nil {
		return ports.AdminUserCredentials{}, repo.findErr
	}
	return repo.credentials, nil
}

func (repo *fakeAdminUsers) FindByID(_ context.Context, _ common.ID) (ports.AdminUserRecord, error) {
	return repo.record, nil
}

func (repo *fakeAdminUsers) ListAdminUsers(_ context.Context) ([]ports.AdminUserRecord, error) {
	repo.listCalled = true
	return repo.users, nil
}

func (repo *fakeAdminUsers) CreateAdminUser(_ context.Context, input ports.CreateAdminUserInput) (ports.AdminUserRecord, error) {
	repo.created = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    true,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminUser(_ context.Context, input ports.UpdateAdminUserInput) (ports.AdminUserRecord, error) {
	repo.updated = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    input.IsActive,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminProfile(_ context.Context, input ports.UpdateAdminProfileInput) (ports.AdminUserRecord, error) {
	repo.updatedProfile = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        admindomain.RoleOwner,
		IsActive:    true,
	}, nil
}

func (repo *fakeAdminUsers) ListAdminRolePermissions(_ context.Context) ([]ports.AdminRolePermissionsRecord, error) {
	if repo.rolePermissions != nil {
		return repo.rolePermissions, nil
	}
	return defaultTestRolePermissions(), nil
}

func (repo *fakeAdminUsers) GetAdminPreferences(_ context.Context, userID common.ID) (ports.AdminPreferencesRecord, error) {
	repo.preferencesUserID = userID
	if repo.preferences.UserID != "" {
		return repo.preferences, nil
	}
	return ports.AdminPreferencesRecord{
		UserID:          userID,
		Timezone:        "Africa/Accra",
		NotifyEmail:     true,
		DailyDigestTime: "08:00",
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminPreferences(
	_ context.Context,
	input ports.UpdateAdminPreferencesInput,
) (ports.AdminPreferencesRecord, error) {
	repo.updatedPreferences = input
	return ports.AdminPreferencesRecord{
		UserID:             input.UserID,
		Timezone:           input.Timezone,
		PhoneNumber:        input.PhoneNumber,
		NotifyEmail:        input.NotifyEmail,
		NotifySMS:          input.NotifySMS,
		AlertVerifications: input.AlertVerifications,
		AlertMoneyRails:    input.AlertMoneyRails,
		AlertRisk:          input.AlertRisk,
		AlertSupport:       input.AlertSupport,
		DailyDigestTime:    input.DailyDigestTime,
	}, nil
}

func (repo *fakeAdminUsers) GetAdminPlatformSettings(context.Context) (ports.AdminPlatformSettingsRecord, error) {
	if repo.platformSettings.PlatformName != "" {
		return repo.platformSettings, nil
	}
	return ports.AdminPlatformSettingsRecord{
		PlatformName:                 "Xtiitch",
		SupportEmail:                 "support@xtiitch.com",
		VerificationSLAHours:         24,
		PayoutReviewThresholdPesewas: 500000,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminPlatformSettings(
	_ context.Context,
	input ports.UpdateAdminPlatformSettingsInput,
) (ports.AdminPlatformSettingsRecord, error) {
	repo.updatedPlatformSettings = input
	return ports.AdminPlatformSettingsRecord{
		PlatformName:                 input.PlatformName,
		SupportEmail:                 input.SupportEmail,
		VerificationSLAHours:         input.VerificationSLAHours,
		PayoutReviewThresholdPesewas: input.PayoutReviewThresholdPesewas,
		MaintenanceMode:              input.MaintenanceMode,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminMarketingFlags(
	_ context.Context,
	input ports.UpdateAdminMarketingFlagsInput,
) (ports.AdminPlatformSettingsRecord, error) {
	repo.updatedMarketingFlags = input
	if input.BrowseStore != nil {
		repo.marketingFlags.BrowseStore = *input.BrowseStore
	}
	if input.Discover != nil {
		repo.marketingFlags.Discover = *input.Discover
	}
	if input.CreateStore != nil {
		repo.marketingFlags.CreateStore = *input.CreateStore
	}
	if input.Pricing != nil {
		repo.marketingFlags.Pricing = *input.Pricing
	}
	settings := repo.platformSettings
	settings.MarketingFlags = repo.marketingFlags
	return settings, nil
}

func (repo *fakeAdminUsers) ReplaceAdminRolePermissions(
	_ context.Context,
	input ports.UpdateAdminRolePermissionsInput,
) (ports.AdminRolePermissionsRecord, error) {
	repo.updatedRolePermissions = input
	return ports.AdminRolePermissionsRecord(input), nil
}

func (repo *fakeAdminUsers) RecordLogin(_ context.Context, userID common.ID) error {
	repo.loginUserID = userID
	return nil
}

func defaultTestRolePermissions() []ports.AdminRolePermissionsRecord {
	out := make([]ports.AdminRolePermissionsRecord, 0, len(admindomain.RoleCatalog()))
	for _, role := range admindomain.RoleCatalog() {
		out = append(out, ports.AdminRolePermissionsRecord{
			Role:        role,
			Permissions: role.Permissions(),
		})
	}
	return out
}

type fakeAdminBusinesses struct {
	cases                      []ports.AdminVerificationCaseRecord
	listCalled                 bool
	decided                    ports.AdminBusinessVerificationDecisionInput
	businesses                 []ports.AdminBusinessRecord
	customers                  []ports.AdminCustomerRecord
	customersListed            bool
	statusUpdate               ports.UpdateAdminBusinessStatusInput
	metrics                    ports.AdminPlatformMetricsRecord
	moneyRails                 ports.AdminMoneyRailsRecord
	subscriptions              []ports.AdminSubscriptionRecord
	subscriptionUpdate         ports.UpdateAdminSubscriptionInput
	issuedSubscriptionInvoice  ports.IssueAdminSubscriptionInvoiceInput
	paidSubscriptionInvoice    ports.MarkAdminSubscriptionInvoicePaidInput
	failedSubscriptionInvoice  ports.MarkAdminSubscriptionInvoiceFailedInput
	renewalReminders           []ports.EnqueueSubscriptionRenewalReminderInput
	renewalReminderSeen        map[string]bool
	sweepInput                 ports.RunAdminSubscriptionBillingSweepInput
	sweepResult                ports.AdminSubscriptionBillingSweepRecord
	plans                      []ports.AdminPlanRecord
	createdPlan                ports.CreateAdminPlanInput
	updatedPlan                ports.UpdateAdminPlanInput
	archivedPlan               ports.ArchiveAdminPlanInput
	updatedPlanEntitlements    ports.UpdateAdminPlanEntitlementsInput
	subscriptionDiscountCodes  []ports.AdminSubscriptionDiscountCodeRecord
	createdDiscountCode        ports.CreateAdminSubscriptionDiscountCodeInput
	updatedDiscountCode        ports.UpdateAdminSubscriptionDiscountCodeInput
	archivedDiscountCode       ports.ArchiveAdminSubscriptionDiscountCodeInput
	promotions                 []ports.AdminPromotionRecord
	createdPromotion           ports.CreateAdminPromotionInput
	updatedPromotion           ports.UpdateAdminPromotionInput
	archivedPromotion          ports.ArchiveAdminPromotionInput
	adCampaigns                []ports.AdminAdCampaignRecord
	createdAdCampaign          ports.CreateAdminAdCampaignInput
	updatedAdCampaign          ports.UpdateAdminAdCampaignInput
	archivedAdCampaign         ports.ArchiveAdminAdCampaignInput
	adPaymentIntent            ports.AdminAdCampaignPaymentIntentRecord
	createdAdCampaignPayment   ports.CreateAdminAdCampaignPaymentInput
	affiliates                 []ports.AdminAffiliateRecord
	createdAffiliate           ports.CreateAdminAffiliateInput
	updatedAffiliate           ports.UpdateAdminAffiliateInput
	archivedAffiliate          ports.ArchiveAdminAffiliateInput
	affiliateAttribution       []ports.AdminAffiliateAttributionRecord
	updatedAffiliateConversion ports.UpdateAdminAffiliateConversionStatusInput
	createdAffiliatePayout     ports.CreateAdminAffiliatePayoutInput
	referralProgrammes         []ports.AdminReferralProgrammeRecord
	createdReferralProgramme   ports.CreateAdminReferralProgrammeInput
	updatedReferralProgramme   ports.UpdateAdminReferralProgrammeInput
	archivedReferralProgramme  ports.ArchiveAdminReferralProgrammeInput
	createdReferralCode        ports.CreateAdminReferralCodeInput
	issuedReferralRewards      ports.IssueAdminReferralRewardsInput
	replay                     ports.QueueAdminMoneyReplayInput
	reversal                   ports.ReverseAdminMoneyPaymentInput
	hold                       ports.SetAdminSettlementReviewHoldInput
	riskReviews                []ports.AdminRiskReviewRecord
	riskUpdate                 ports.SetAdminRiskReviewStatusInput
	supportTickets             []ports.AdminSupportTicketRecord
	supportUpdate              ports.UpdateAdminSupportTicketInput
}

func (repo *fakeAdminBusinesses) ArchiveAdminAdCampaign(
	_ context.Context,
	input ports.ArchiveAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	repo.archivedAdCampaign = input
	return fakeAdminAdCampaignRecord(
		input.CampaignID,
		"business-1",
		"featured_business",
		"Featured Atelier",
		"archived",
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminAffiliateConversionStatus(
	_ context.Context,
	input ports.UpdateAdminAffiliateConversionStatusInput,
) (ports.AdminAffiliateConversionRecord, error) {
	repo.updatedAffiliateConversion = input
	record := fakeAdminAffiliateAttributionRecord(
		"affiliate-1",
		"SEWINGPRO",
		"Sewing Pro Partners",
	).RecentConversions[0]
	record.ConversionID = input.ConversionID
	record.Status = input.Status
	return record, nil
}

type fakeAdminSessions struct {
	created ports.CreateAdminSessionInput
	session ports.AdminSessionWithUser
	findErr error
	revoked []common.ID
}

type fakeAdminAudits struct {
	created []ports.CreateAdminAuditEventInput
	events  []ports.AdminAuditEventRecord
}

func (repo *fakeAdminAudits) CreateAdminAuditEvent(
	_ context.Context,
	input ports.CreateAdminAuditEventInput,
) (ports.AdminAuditEventRecord, error) {
	repo.created = append(repo.created, input)
	return ports.AdminAuditEventRecord{
		AuditEventID: input.AuditEventID,
		ActorUserID:  input.ActorUserID,
		ActorRole:    input.ActorRole,
		Action:       input.Action,
		TargetType:   input.TargetType,
		TargetID:     input.TargetID,
		TargetLabel:  input.TargetLabel,
		Summary:      input.Summary,
		Severity:     input.Severity,
		Metadata:     input.Metadata,
		IPAddress:    input.IPAddress,
		UserAgent:    input.UserAgent,
	}, nil
}

func (repo *fakeAdminAudits) ListAdminAuditEvents(
	context.Context,
	ports.ListAdminAuditEventsInput,
) ([]ports.AdminAuditEventRecord, error) {
	return repo.events, nil
}

func (repo *fakeAdminSessions) Create(_ context.Context, input ports.CreateAdminSessionInput) error {
	repo.created = input
	return nil
}

func (repo *fakeAdminSessions) FindByRefreshTokenHash(_ context.Context, _ string) (ports.AdminSessionWithUser, error) {
	if repo.findErr != nil {
		return ports.AdminSessionWithUser{}, repo.findErr
	}
	return repo.session, nil
}

func (repo *fakeAdminSessions) Revoke(_ context.Context, sessionID common.ID) error {
	repo.revoked = append(repo.revoked, sessionID)
	return nil
}

type fakePasswordHasher struct{}

func (fakePasswordHasher) Hash(password string) (string, error) {
	return "hashed:" + password, nil
}

func (fakePasswordHasher) Compare(hash string, password string) error {
	if hash != "hashed:"+password {
		return errors.New("password mismatch")
	}
	return nil
}

type countingPasswordHasher struct {
	hashCalls int
}

func (h *countingPasswordHasher) Hash(password string) (string, error) {
	h.hashCalls++
	return "hashed:" + password, nil
}

func (h *countingPasswordHasher) Compare(hash string, password string) error {
	if hash != "hashed:"+password {
		return errors.New("password mismatch")
	}
	return nil
}

type fakeAdminTokenIssuer struct{}

func (fakeAdminTokenIssuer) IssueAdminAccessToken(_ context.Context, input ports.AdminAccessTokenInput) (string, error) {
	return "admin-access:" + input.Subject.String() + ":" + string(input.Role), nil
}

type fakeRefreshTokens struct{}

func (fakeRefreshTokens) NewRefreshToken() (string, error) {
	return "refresh-token", nil
}

func (fakeRefreshTokens) HashRefreshToken(token string) string {
	return "hash:" + token
}

type sequenceIDs struct {
	ids []common.ID
}

func (seq *sequenceIDs) NewID() common.ID {
	id := seq.ids[0]
	seq.ids = seq.ids[1:]
	return id
}

type fixedClock struct {
	now time.Time
}

func (clock fixedClock) Now() time.Time {
	return clock.now
}
