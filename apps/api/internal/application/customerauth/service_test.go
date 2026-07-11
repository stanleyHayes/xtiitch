package customerauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func newTestService(repo *fakeRepo, phone *fakeDelivery, email *fakeEmailDelivery) Service {
	return NewService(Dependencies{
		Repo:          repo,
		Tokens:        fakeTokens{},
		OTP:           fakeOTP{code: "123456"},
		Delivery:      phone,
		EmailDelivery: email,
		IDs:           &sequenceIDs{ids: []common.ID{"challenge-1", "customer-1"}},
		Clock:         fixedClock{now: time.Date(2026, 6, 20, 20, 0, 0, 0, time.UTC)},
	})
}

func TestRequestOTPCreatesWhatsAppChallengeAndDelivers(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{}
	phone := &fakeDelivery{}
	service := newTestService(repo, phone, &fakeEmailDelivery{})

	if err := service.RequestOTP(context.Background(), "024 000 0000"); err != nil {
		t.Fatalf("request otp: %v", err)
	}
	if repo.created.Channel != ports.CustomerOTPChannelWhatsApp {
		t.Fatalf("expected whatsapp channel, got %q", repo.created.Channel)
	}
	if repo.created.Phone != "233240000000" {
		t.Fatalf("expected normalized phone, got %q", repo.created.Phone)
	}
	if repo.created.Email != "" {
		t.Fatalf("whatsapp challenge must carry no email, got %q", repo.created.Email)
	}
	if phone.phone != "233240000000" || phone.code != "123456" {
		t.Fatalf("expected code delivered to phone, got phone=%q code=%q", phone.phone, phone.code)
	}
}

func TestRequestEmailOTPCreatesEmailChallengeAndEmailsCode(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{}
	email := &fakeEmailDelivery{}
	service := newTestService(repo, &fakeDelivery{}, email)

	if err := service.RequestEmailOTP(context.Background(), "  AMA@Example.COM "); err != nil {
		t.Fatalf("request email otp: %v", err)
	}
	if repo.created.Channel != ports.CustomerOTPChannelEmail {
		t.Fatalf("expected email channel, got %q", repo.created.Channel)
	}
	if repo.created.Email != "ama@example.com" {
		t.Fatalf("expected normalized email, got %q", repo.created.Email)
	}
	if repo.created.Phone != "" {
		t.Fatalf("email challenge must carry no phone, got %q", repo.created.Phone)
	}
	if email.email != "ama@example.com" || email.code != "123456" {
		t.Fatalf("expected code emailed, got email=%q code=%q", email.email, email.code)
	}
}

func TestRequestEmailOTPRejectsInvalidEmail(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	for _, bad := range []string{"", "not-an-email", "missing@domain", "a@b"} {
		if err := service.RequestEmailOTP(context.Background(), bad); !errors.Is(err, ErrInvalidEmail) {
			t.Fatalf("email %q: expected ErrInvalidEmail, got %v", bad, err)
		}
	}
	if repo.created.ChallengeID != "" {
		t.Fatal("an invalid email must not create a challenge")
	}
}

func TestVerifyEmailOTPUpsertsCustomerByEmailAndIssuesToken(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{
		active: ports.OTPChallengeRecord{
			ChallengeID: "challenge-1",
			Channel:     ports.CustomerOTPChannelEmail,
			Email:       "ama@example.com",
			CodeHash:    fakeOTP{}.HashCode("123456"),
			ExpiresAt:   time.Date(2026, 6, 20, 20, 5, 0, 0, time.UTC),
		},
	}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	result, err := service.VerifyEmailOTP(context.Background(), "AMA@example.com", "123456")
	if err != nil {
		t.Fatalf("verify email otp: %v", err)
	}
	if repo.lookupChannel != ports.CustomerOTPChannelEmail || repo.lookupIdentifier != "ama@example.com" {
		t.Fatalf("expected lookup by email channel, got channel=%q identifier=%q", repo.lookupChannel, repo.lookupIdentifier)
	}
	if !repo.consumed {
		t.Fatal("expected challenge to be consumed")
	}
	if repo.upsertedEmail != "ama@example.com" {
		t.Fatalf("expected customer upserted by email, got %q", repo.upsertedEmail)
	}
	if repo.upsertedPhone != "" {
		t.Fatal("email verify must not upsert by phone")
	}
	if result.Email != "ama@example.com" || result.Phone != "" {
		t.Fatalf("unexpected result identity: %+v", result)
	}
	if result.AccessToken == "" {
		t.Fatal("expected an access token")
	}
}

func TestVerifyEmailOTPRejectsWrongCodeAndIncrements(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{
		active: ports.OTPChallengeRecord{
			ChallengeID: "challenge-1",
			Channel:     ports.CustomerOTPChannelEmail,
			Email:       "ama@example.com",
			CodeHash:    fakeOTP{}.HashCode("123456"),
			ExpiresAt:   time.Date(2026, 6, 20, 20, 5, 0, 0, time.UTC),
		},
	}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	_, err := service.VerifyEmailOTP(context.Background(), "ama@example.com", "000000")
	if !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expected ErrInvalidCode, got %v", err)
	}
	if !repo.incremented {
		t.Fatal("expected a failed attempt to be recorded")
	}
	if repo.consumed {
		t.Fatal("a wrong code must not consume the challenge")
	}
	if repo.upsertedEmail != "" {
		t.Fatal("a wrong code must not upsert a customer")
	}
}

func TestVerifyEmailOTPExpiredWhenNoActiveChallenge(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{lookupErr: ports.ErrNotFound}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	if _, err := service.VerifyEmailOTP(context.Background(), "ama@example.com", "123456"); !errors.Is(err, ErrCodeExpired) {
		t.Fatalf("expected ErrCodeExpired, got %v", err)
	}
}

func TestVerifyOTPPhonePathStillWorks(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{
		active: ports.OTPChallengeRecord{
			ChallengeID: "challenge-1",
			Channel:     ports.CustomerOTPChannelWhatsApp,
			Phone:       "233240000000",
			CodeHash:    fakeOTP{}.HashCode("123456"),
			ExpiresAt:   time.Date(2026, 6, 20, 20, 5, 0, 0, time.UTC),
		},
	}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	result, err := service.VerifyOTP(context.Background(), "0240000000", "123456")
	if err != nil {
		t.Fatalf("verify otp: %v", err)
	}
	if repo.lookupChannel != ports.CustomerOTPChannelWhatsApp || repo.lookupIdentifier != "233240000000" {
		t.Fatalf("expected lookup by whatsapp channel, got channel=%q identifier=%q", repo.lookupChannel, repo.lookupIdentifier)
	}
	if repo.upsertedPhone != "233240000000" {
		t.Fatalf("expected customer upserted by phone, got %q", repo.upsertedPhone)
	}
	if repo.upsertedEmail != "" {
		t.Fatal("phone verify must not upsert by email")
	}
	if result.Phone != "233240000000" {
		t.Fatalf("unexpected result phone %q", result.Phone)
	}
}

// ── fakes ──────────────────────────────────────────────────────────────────

type fakeRepo struct {
	created          ports.CreateOTPChallengeInput
	active           ports.OTPChallengeRecord
	lookupErr        error
	lookupChannel    ports.CustomerOTPChannel
	lookupIdentifier string
	consumed         bool
	incremented      bool
	upsertedPhone    string
	upsertedEmail    string
}

func (r *fakeRepo) CreateOTPChallenge(_ context.Context, input ports.CreateOTPChallengeInput) error {
	r.created = input
	return nil
}

func (r *fakeRepo) LatestActiveOTPChallenge(
	_ context.Context,
	channel ports.CustomerOTPChannel,
	identifier string,
	_ time.Time) (ports.OTPChallengeRecord,
	error,
) {
	r.lookupChannel = channel
	r.lookupIdentifier = identifier
	if r.lookupErr != nil {
		return ports.OTPChallengeRecord{}, r.lookupErr
	}
	return r.active, nil
}

func (r *fakeRepo) IncrementOTPAttempts(_ context.Context, _ common.ID) error {
	r.incremented = true
	return nil
}

func (r *fakeRepo) ConsumeOTPChallenge(_ context.Context, _ common.ID) error {
	r.consumed = true
	return nil
}

func (r *fakeRepo) UpsertVerifiedCustomerByPhone(_ context.Context, newID common.ID, phone string) (common.ID, error) {
	r.upsertedPhone = phone
	return newID, nil
}

func (r *fakeRepo) UpsertVerifiedCustomerByEmail(_ context.Context, newID common.ID, email string) (common.ID, error) {
	r.upsertedEmail = email
	return newID, nil
}

func (r *fakeRepo) ListCustomerOrders(_ context.Context, _ common.ID) ([]ports.CustomerOrderSummary, error) {
	return nil, nil
}

func (r *fakeRepo) GetCustomerProfile(_ context.Context, _ common.ID) (ports.CustomerProfile, error) {
	return ports.CustomerProfile{}, nil
}

func (r *fakeRepo) UpdateCustomerProfile(_ context.Context, _ common.ID, _, _, _ string) (ports.CustomerProfile, error) {
	return ports.CustomerProfile{}, nil
}

type fakeDelivery struct {
	phone string
	code  string
}

func (d *fakeDelivery) SendOTP(_ context.Context, phone string, code string) error {
	d.phone = phone
	d.code = code
	return nil
}

type fakeEmailDelivery struct {
	email string
	code  string
}

func (d *fakeEmailDelivery) SendEmailOTP(_ context.Context, email string, code string) error {
	d.email = email
	d.code = code
	return nil
}

type fakeTokens struct{}

func (fakeTokens) IssueCustomerAccessToken(_ context.Context, input ports.CustomerAccessTokenInput) (string, error) {
	return "token:" + input.CustomerID.String(), nil
}

// fakeOTP returns a fixed code and a deterministic hash so tests can construct
// matching challenge records.
type fakeOTP struct{ code string }

func (o fakeOTP) NewCode() (string, error) { return o.code, nil }

func (fakeOTP) HashCode(code string) string { return "hash:" + code }

type sequenceIDs struct {
	ids  []common.ID
	next int
}

func (seq *sequenceIDs) NewID() common.ID {
	if seq.next >= len(seq.ids) {
		return common.ID("overflow")
	}
	id := seq.ids[seq.next]
	seq.next++
	return id
}

type fixedClock struct{ now time.Time }

func (c fixedClock) Now() time.Time { return c.now }
