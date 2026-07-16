package authapp

import (
	"context"
	"errors"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func newRefreshTestService(sessions *fakeSessionRepository, now time.Time) Service {
	return NewService(Dependencies{
		Businesses:    &fakeBusinessIdentityRepository{},
		Sessions:      sessions,
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"session-2"}},
		Clock:         fixedClock{now: now},
	})
}

func activeSession(now time.Time) ports.AuthSessionWithUser {
	return ports.AuthSessionWithUser{
		SessionID:      "session-1",
		BusinessID:     "business-1",
		BusinessUserID: "user-1",
		Role:           business.UserRoleOwner,
		UserIsActive:   true,
		Revoked:        false,
		ExpiresAt:      now.Add(time.Hour),
	}
}

type fakeBusinessIdentityRepository struct {
	created               ports.CreateBusinessWithOwnerInput
	createErr             error
	handleExists          bool
	handleExistsErr       error
	credentials           ports.BusinessUserCredentials
	findErr               error
	credentialsByID       ports.BusinessUserCredentials
	findByIDErr           error
	lookupUserID          common.ID
	lookupHandle          string
	lookupEmail           string
	users                 []ports.BusinessUserRecord
	listScope             common.TenantScope
	listErr               error
	createdUser           ports.CreateBusinessUserInput
	createUserErr         error
	updatedUser           ports.UpdateBusinessUserInput
	updateScope           common.TenantScope
	updateUserErr         error
	updatedPassword       ports.UpdateBusinessUserPasswordInput
	updatePasswordErr     error
	updatedOwnPassword    ports.UpdateBusinessUserPasswordInput
	updateOwnPasswordErr  error
	transferredOwner      ports.TransferBusinessOwnerInput
	transferScope         common.TenantScope
	transferErr           error
	subscription          ports.BusinessSubscriptionRecord
	subscriptionUpgraded  ports.BusinessSubscriptionRecord
	activationPayment     ports.RecordSubscriptionActivationPaymentInput
	recurringActivated    *ports.ActivateRecurringBillingInput
	failedLoginsRecorded  int
	failedLoginsCleared   int
	activationAlreadyPaid bool
	cadenceSet            string
	setCadenceErr         error
	identityDocument      ports.SubmitIdentityDocumentInput
	planByCode            ports.PlanPricingRecord
	planByCodeErr         error
	upgradeApplied        *ports.ApplyImmediatePlanUpgradeInput
	downgradeScheduled    *ports.SchedulePlanDowngradeInput
}

func (repo *fakeBusinessIdentityRepository) CreateBusinessWithOwner(
	_ context.Context,
	input ports.CreateBusinessWithOwnerInput) (ports.BusinessOwnerIdentity,
	error,
) {
	repo.created = input
	if repo.createErr != nil {
		return ports.BusinessOwnerIdentity{}, repo.createErr
	}
	return ports.BusinessOwnerIdentity{
		BusinessID:     input.BusinessID,
		BusinessUserID: input.OwnerUserID,
		Role:           business.UserRoleOwner,
	}, nil
}

func (repo *fakeBusinessIdentityRepository) HandleExists(_ context.Context, _ string) (bool, error) {
	return repo.handleExists, repo.handleExistsErr
}

func (repo *fakeBusinessIdentityRepository) ListActivePlans(_ context.Context) ([]ports.PublicPlanRecord, error) {
	return nil, nil
}

func (repo *fakeBusinessIdentityRepository) GetBusinessSubscription(
	_ context.Context,
	_ common.ID) (ports.BusinessSubscriptionRecord,
	error,
) {
	// After a plan switch, a re-read reflects the upgraded plan (mirrors the real
	// repo, whose figures are joined from the now-current plan).
	if repo.upgradeApplied != nil && repo.subscriptionUpgraded.SubscriptionID != "" {
		return repo.subscriptionUpgraded, nil
	}
	return repo.subscription, nil
}

func (repo *fakeBusinessIdentityRepository) GetPlanByCode(_ context.Context, _ string) (ports.PlanPricingRecord, error) {
	if repo.planByCodeErr != nil {
		return ports.PlanPricingRecord{}, repo.planByCodeErr
	}
	return repo.planByCode, nil
}

func (repo *fakeBusinessIdentityRepository) ApplyImmediatePlanUpgrade(_ context.Context, input ports.ApplyImmediatePlanUpgradeInput) error {
	repo.upgradeApplied = &input
	return nil
}

func (repo *fakeBusinessIdentityRepository) SchedulePlanDowngrade(_ context.Context, input ports.SchedulePlanDowngradeInput) error {
	repo.downgradeScheduled = &input
	return nil
}

func (repo *fakeBusinessIdentityRepository) ActivateRecurringBilling(_ context.Context, input ports.ActivateRecurringBillingInput) error {
	repo.recurringActivated = &input
	return nil
}

func (repo *fakeBusinessIdentityRepository) RecordFailedBusinessLogin(_ context.Context, _ common.ID, _ int, _ time.Duration) error {
	repo.failedLoginsRecorded++
	return nil
}

func (repo *fakeBusinessIdentityRepository) ClearFailedBusinessLogin(_ context.Context, _ common.ID) error {
	repo.failedLoginsCleared++
	return nil
}

func (repo *fakeBusinessIdentityRepository) RecordSubscriptionActivationPayment(
	_ context.Context,
	input ports.RecordSubscriptionActivationPaymentInput,
) error {
	repo.activationPayment = input
	return nil
}

func (repo *fakeBusinessIdentityRepository) SetSubscriptionBillingCadence(_ context.Context, _ common.ID, cadence string) error {
	if repo.setCadenceErr != nil {
		return repo.setCadenceErr
	}
	repo.cadenceSet = cadence
	return nil
}

func (repo *fakeBusinessIdentityRepository) PrepareSubscriptionActivationCharge(
	_ context.Context,
	_ common.ID) (ports.SubscriptionActivationCharge,
	error,
) {
	return ports.SubscriptionActivationCharge{Ref: "xtsub_act_test", ShouldCharge: !repo.activationAlreadyPaid}, nil
}

func (repo *fakeBusinessIdentityRepository) SubmitIdentityDocument(_ context.Context, input ports.SubmitIdentityDocumentInput) error {
	repo.identityDocument = input
	return nil
}

// fakeSubscriptionPayments is a minimal PaymentProvider for the subscription
// checkout tests. It records the standard-checkout it was asked to open and
// returns a verified, PAID transaction on verify (the amount echoes what the
// checkout was priced at). The recurring sweep still uses ChargeAuthorization.
type fakeSubscriptionPayments struct {
	initInput ports.InitializeAuthorizationInput
	// verifyNotSucceeded makes VerifyAuthorization report an unpaid/abandoned
	// checkout; verifyNoAuth makes it report a mobile-money payment (no reusable
	// authorization). Both default to the paid-card happy path.
	verifyNotSucceeded bool
	verifyNoAuth       bool
	verifyChannel      string
	chargeStatus       string
	chargeInput        ports.ChargeAuthorizationInput
	chargeErr          error
}

func (f *fakeSubscriptionPayments) CreateBusinessSubaccount(
	_ context.Context,
	_ ports.CreateBusinessSubaccountInput) (ports.CreateBusinessSubaccountResult,
	error,
) {
	return ports.CreateBusinessSubaccountResult{}, nil
}

func (f *fakeSubscriptionPayments) UpdateBusinessSubaccount(_ context.Context, _ ports.UpdateBusinessSubaccountInput) error {
	return nil
}

func (f *fakeSubscriptionPayments) InitializeTransaction(
	_ context.Context,
	_ ports.InitializeTransactionInput) (ports.InitializeTransactionResult,
	error,
) {
	return ports.InitializeTransactionResult{}, nil
}

func (f *fakeSubscriptionPayments) InitializeAuthorization(
	_ context.Context,
	input ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult,
	error,
) {
	f.initInput = input
	return ports.InitializeAuthorizationResult{RedirectURL: "https://pay", Reference: input.Reference}, nil
}

func (f *fakeSubscriptionPayments) VerifyAuthorization(
	_ context.Context,
	_ ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult,
	error,
) {
	if f.verifyNotSucceeded {
		return ports.VerifyAuthorizationResult{Succeeded: false}, nil
	}
	authCode := "AUTH_x"
	customerCode := "CUS_x"
	if f.verifyNoAuth {
		authCode = ""
		customerCode = ""
	}
	return ports.VerifyAuthorizationResult{
		Succeeded:         true,
		AmountMinor:       f.initInput.AmountMinor,
		AuthorizationCode: authCode,
		CustomerCode:      customerCode,
		CustomerEmail:     "owner@example.com",
		Channel:           f.verifyChannel,
		Reusable:          !f.verifyNoAuth,
		Active:            !f.verifyNoAuth,
	}, nil
}

func (f *fakeSubscriptionPayments) ChargeAuthorization(
	_ context.Context,
	input ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult,
	error,
) {
	f.chargeInput = input
	if f.chargeErr != nil {
		return ports.ChargeAuthorizationResult{}, f.chargeErr
	}
	return ports.ChargeAuthorizationResult{Status: f.chargeStatus, AmountMinor: input.AmountMinor}, nil
}

func (f *fakeSubscriptionPayments) VerifyWebhookSignature(_ []byte, _ string) bool { return true }

func (f *fakeSubscriptionPayments) ParseChargeEvent(_ []byte) (ports.ProviderChargeEvent, error) {
	return ports.ProviderChargeEvent{}, nil
}

func newSubscriptionTestService(businesses *fakeBusinessIdentityRepository, payments ports.PaymentProvider) Service {
	return NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		Payments:      payments,
		IDs:           &sequenceIDs{ids: []common.ID{"charge-1"}},
		Clock:         fixedClock{now: time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)},
	})
}

func (repo *fakeBusinessIdentityRepository) FindBusinessUserByHandleAndEmail(
	_ context.Context,
	handle string,
	email string) (ports.BusinessUserCredentials,
	error,
) {
	repo.lookupHandle = handle
	repo.lookupEmail = email
	if repo.findErr != nil {
		return ports.BusinessUserCredentials{}, repo.findErr
	}
	return repo.credentials, nil
}

func (repo *fakeBusinessIdentityRepository) FindBusinessUserCredentialsByID(
	_ context.Context,
	scope common.TenantScope,
	userID common.ID) (ports.BusinessUserCredentials,
	error,
) {
	repo.listScope = scope
	repo.lookupUserID = userID
	if repo.findByIDErr != nil {
		return ports.BusinessUserCredentials{}, repo.findByIDErr
	}
	return repo.credentialsByID, nil
}

func (repo *fakeBusinessIdentityRepository) ListBusinessUsers(
	_ context.Context,
	scope common.TenantScope) ([]ports.BusinessUserRecord,
	error,
) {
	repo.listScope = scope
	if repo.listErr != nil {
		return nil, repo.listErr
	}
	return repo.users, nil
}

func (repo *fakeBusinessIdentityRepository) CreateBusinessUser(
	_ context.Context,
	scope common.TenantScope,
	input ports.CreateBusinessUserInput) (ports.BusinessUserRecord,
	error,
) {
	repo.listScope = scope
	repo.createdUser = input
	if repo.createUserErr != nil {
		return ports.BusinessUserRecord{}, repo.createUserErr
	}
	return ports.BusinessUserRecord{
		UserID:      input.UserID,
		BusinessID:  input.BusinessID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    true,
	}, nil
}

func (repo *fakeBusinessIdentityRepository) UpdateBusinessUser(
	_ context.Context,
	scope common.TenantScope,
	input ports.UpdateBusinessUserInput) (ports.BusinessUserRecord,
	error,
) {
	repo.updateScope = scope
	repo.updatedUser = input
	if repo.updateUserErr != nil {
		return ports.BusinessUserRecord{}, repo.updateUserErr
	}
	return ports.BusinessUserRecord{
		UserID:      input.UserID,
		BusinessID:  scope.BusinessID,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    input.IsActive,
	}, nil
}

func (repo *fakeBusinessIdentityRepository) UpdateBusinessUserPassword(
	_ context.Context,
	scope common.TenantScope,
	input ports.UpdateBusinessUserPasswordInput,
) error {
	repo.updateScope = scope
	repo.updatedPassword = input
	return repo.updatePasswordErr
}

func (repo *fakeBusinessIdentityRepository) UpdateOwnPassword(
	_ context.Context,
	scope common.TenantScope,
	input ports.UpdateBusinessUserPasswordInput,
) error {
	repo.updateScope = scope
	repo.updatedOwnPassword = input
	return repo.updateOwnPasswordErr
}

func (repo *fakeBusinessIdentityRepository) TransferBusinessOwner(
	_ context.Context,
	scope common.TenantScope,
	input ports.TransferBusinessOwnerInput) (ports.TransferBusinessOwnerResult,
	error,
) {
	repo.transferScope = scope
	repo.transferredOwner = input
	if repo.transferErr != nil {
		return ports.TransferBusinessOwnerResult{}, repo.transferErr
	}
	return ports.TransferBusinessOwnerResult{
		PreviousOwner: ports.BusinessUserRecord{
			UserID:     input.CurrentOwnerUserID,
			BusinessID: scope.BusinessID,
			Role:       business.UserRoleAdmin,
			IsActive:   true,
		},
		NewOwner: ports.BusinessUserRecord{
			UserID:     input.NewOwnerUserID,
			BusinessID: scope.BusinessID,
			Role:       business.UserRoleOwner,
			IsActive:   true,
		},
	}, nil
}

// fakeDiscountRepository is a configurable SubscriptionDiscountRepository for the
// discount-code checkout tests. FindPendingRedemption returns ErrNotFound unless a
// pending redemption is explicitly configured, so the plain (non-discount) flow is
// the default.
type fakeDiscountRepository struct {
	code              ports.SubscriptionDiscountCode
	findErr           error
	lookupCode        string
	appliedTotal      int
	appliedForAccount int
	hasPending        bool
	pending           ports.PendingDiscountRedemption
	created           []ports.CreateDiscountRedemptionInput
	marked            []ports.MarkDiscountRedemptionAppliedInput
	freePeriods       []ports.ActivateFreePeriodInput
}

func (r *fakeDiscountRepository) FindActiveDiscountCodeByCode(_ context.Context, code string) (ports.SubscriptionDiscountCode, error) {
	r.lookupCode = code
	if r.findErr != nil {
		return ports.SubscriptionDiscountCode{}, r.findErr
	}
	return r.code, nil
}

func (r *fakeDiscountRepository) CountAppliedRedemptions(_ context.Context, _ common.ID) (int, error) {
	return r.appliedTotal, nil
}

func (r *fakeDiscountRepository) CountAppliedRedemptionsForAccount(_ context.Context, _ common.ID, _ common.ID) (int, error) {
	return r.appliedForAccount, nil
}

func (r *fakeDiscountRepository) CreateRedemption(
	_ context.Context,
	_ common.TenantScope,
	input ports.CreateDiscountRedemptionInput) (common.ID,
	error,
) {
	r.created = append(r.created, input)
	return "redemption-1", nil
}

func (r *fakeDiscountRepository) CreateRedemptionWithinCaps(
	ctx context.Context,
	scope common.TenantScope,
	input ports.CreateDiscountRedemptionInput,
	maxPerAccount int,
	maxTotal *int) (common.ID,
	error,
) {
	if r.appliedForAccount >= maxPerAccount {
		return "", ports.ErrDiscountRedemptionCapReached
	}
	if maxTotal != nil && r.appliedTotal >= *maxTotal {
		return "", ports.ErrDiscountRedemptionCapReached
	}
	return r.CreateRedemption(ctx, scope, input)
}

func (r *fakeDiscountRepository) FindPendingRedemption(
	_ context.Context,
	_ common.TenantScope,
	_ common.ID) (ports.PendingDiscountRedemption,
	error,
) {
	if !r.hasPending {
		return ports.PendingDiscountRedemption{}, ports.ErrNotFound
	}
	return r.pending, nil
}

func (r *fakeDiscountRepository) MarkRedemptionApplied(
	_ context.Context,
	_ common.TenantScope,
	input ports.MarkDiscountRedemptionAppliedInput,
) error {
	r.marked = append(r.marked, input)
	return nil
}

func (r *fakeDiscountRepository) ActivateFreePeriodBilling(
	_ context.Context,
	_ common.TenantScope,
	input ports.ActivateFreePeriodInput,
) error {
	r.freePeriods = append(r.freePeriods, input)
	return nil
}

func newDiscountTestService(
	businesses *fakeBusinessIdentityRepository,
	payments ports.PaymentProvider,
	discounts ports.SubscriptionDiscountRepository,
) Service {
	return NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		Payments:      payments,
		Discounts:     discounts,
		IDs:           &sequenceIDs{ids: []common.ID{"charge-1"}},
		Clock:         fixedClock{now: time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)},
	})
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

func newPlanChangeTestService(businesses *fakeBusinessIdentityRepository, payments ports.PaymentProvider, now time.Time) Service {
	return NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		Payments:      payments,
		IDs:           &sequenceIDs{ids: []common.ID{"charge-1"}},
		Clock:         fixedClock{now: now},
	})
}

type fakeSessionRepository struct {
	created ports.CreateAuthSessionInput
	session ports.AuthSessionWithUser
	findErr error
	revoked []common.ID
}

func (repo *fakeSessionRepository) Create(_ context.Context, input ports.CreateAuthSessionInput) error {
	repo.created = input
	return nil
}

func (repo *fakeSessionRepository) FindByRefreshTokenHash(_ context.Context, _ string) (ports.AuthSessionWithUser, error) {
	if repo.findErr != nil {
		return ports.AuthSessionWithUser{}, repo.findErr
	}
	return repo.session, nil
}

func (repo *fakeSessionRepository) Revoke(_ context.Context, _ common.ID, sessionID common.ID) error {
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

type fakeEmailSender struct {
	message ports.EmailMessage
}

func (sender *fakeEmailSender) Send(_ context.Context, message ports.EmailMessage) error {
	sender.message = message
	return nil
}

type fakeTokenIssuer struct{}

func (fakeTokenIssuer) IssueAccessToken(_ context.Context, input ports.AccessTokenInput) (string, error) {
	return "access:" + input.Subject.String() + ":" + input.BusinessID.String() + ":" + string(input.Role), nil
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
