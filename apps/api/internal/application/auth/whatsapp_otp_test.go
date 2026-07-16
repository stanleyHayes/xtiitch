package authapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeOTPChallenge struct {
	id        common.ID
	number    string
	codeHash  string
	attempts  int
	consumed  bool
	expiresAt time.Time
	createdAt time.Time
	purpose   string
}

type fakeWhatsAppAuth struct {
	credentials ports.BusinessUserCredentials
	findErr     error
	challenges  []*fakeOTPChallenge
	created     []ports.CreateSignInOTPChallengeInput
}

func (f *fakeWhatsAppAuth) FindBusinessUserByHandleAndWhatsApp(
	_ context.Context,
	_ string,
	_ string) (ports.BusinessUserCredentials,
	error,
) {
	if f.findErr != nil {
		return ports.BusinessUserCredentials{}, f.findErr
	}
	return f.credentials, nil
}

func (f *fakeWhatsAppAuth) CreateSignInOTPChallenge(_ context.Context, input ports.CreateSignInOTPChallengeInput) error {
	f.created = append(f.created, input)
	f.challenges = append(f.challenges, &fakeOTPChallenge{
		id:       input.ChallengeID,
		number:   input.WhatsAppNumber,
		codeHash: input.CodeHash,
		// The real table defaults created_at to now() while the service sets
		// expires_at to now()+TTL, so the same relationship holds here.
		createdAt: input.ExpiresAt.Add(-businessOTPTTL),
		expiresAt: input.ExpiresAt,
		purpose:   input.Purpose,
	})
	return nil
}

// Filters on purpose exactly as the real query does: a challenge issued for one
// flow must be invisible to another, so the fake cannot paper over a missing
// purpose filter in the service.
func (f *fakeWhatsAppAuth) LatestActiveSignInOTPChallenge(
	_ context.Context,
	number string,
	purpose string,
	now time.Time) (ports.BusinessOTPChallengeRecord,
	error,
) {
	for i := len(f.challenges) - 1; i >= 0; i-- {
		c := f.challenges[i]
		if c.number == number && c.purpose == purpose && !c.consumed && c.expiresAt.After(now) {
			return ports.BusinessOTPChallengeRecord{
				ChallengeID:    c.id,
				WhatsAppNumber: c.number,
				CodeHash:       c.codeHash,
				Attempts:       c.attempts,
				ExpiresAt:      c.expiresAt,
				CreatedAt:      c.createdAt,
			}, nil
		}
	}
	return ports.BusinessOTPChallengeRecord{}, ports.ErrNotFound
}

func (f *fakeWhatsAppAuth) IncrementSignInOTPAttempts(_ context.Context, id common.ID) error {
	for _, c := range f.challenges {
		if c.id == id {
			c.attempts++
		}
	}
	return nil
}

func (f *fakeWhatsAppAuth) ConsumeSignInOTPChallenge(_ context.Context, id common.ID) error {
	for _, c := range f.challenges {
		if c.id == id {
			c.consumed = true
		}
	}
	return nil
}

type fakeOTPGen struct{ code string }

func (g fakeOTPGen) NewCode() (string, error)    { return g.code, nil }
func (g fakeOTPGen) HashCode(code string) string { return "hash:" + code }

type fakeOTPDelivery struct {
	phone string
	code  string
	calls int
}

func (d *fakeOTPDelivery) SendOTP(_ context.Context, phone string, code string) error {
	d.phone = phone
	d.code = code
	d.calls++
	return nil
}

var fixedOTPClock = fixedClock{now: time.Date(2026, 7, 4, 12, 0, 0, 0, time.UTC)}

func newWhatsAppOTPService(
	wa *fakeWhatsAppAuth,
	delivery *fakeOTPDelivery,
	idList []common.ID,
) (Service, *fakeSessionRepository, *fakeBusinessIdentityRepository) {
	sessions := &fakeSessionRepository{}
	businesses := &fakeBusinessIdentityRepository{}
	svc := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      sessions,
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: idList},
		Clock:         fixedOTPClock,
		WhatsAppAuth:  wa,
		OTPGen:        fakeOTPGen{code: "123456"},
		WhatsAppOTP:   delivery,
	})
	return svc, sessions, businesses
}

func activeOwner() ports.BusinessUserCredentials {
	return ports.BusinessUserCredentials{
		BusinessID: "biz-1",
		UserID:     "user-1",
		Role:       business.UserRoleOwner,
		IsActive:   true,
	}
}

func TestRequestSignInOTPSendsCodeToKnownOwner(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})

	if err := svc.RequestSignInOTP(context.Background(), "ama-stitch", "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	if delivery.calls != 1 || delivery.phone != "233244000111" || delivery.code != "123456" {
		t.Fatalf("unexpected delivery: %+v", delivery)
	}
	if len(wa.created) != 1 || wa.created[0].WhatsAppNumber != "233244000111" || wa.created[0].CodeHash != "hash:123456" {
		t.Fatalf("unexpected challenge stored: %+v", wa.created)
	}
}

func TestRequestSignInOTPOpaqueForUnknownOwner(t *testing.T) {
	t.Parallel()
	// No active owner matches: stay opaque (no send, no challenge, no error).
	wa := &fakeWhatsAppAuth{credentials: ports.BusinessUserCredentials{IsActive: false}}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})

	if err := svc.RequestSignInOTP(context.Background(), "ama-stitch", "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	if delivery.calls != 0 || len(wa.created) != 0 {
		t.Fatalf("expected no send for unknown owner, got delivery=%+v challenges=%d", delivery, len(wa.created))
	}
}

// Every send bills a real SMS on a public endpoint, so a second code to the same
// number inside the cooldown must not go out.
func TestRequestOTPThrottlesResendToTheSameNumber(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1", "chal-2"})

	if err := svc.RequestRegistrationOTP(context.Background(), "0244000111"); err != nil {
		t.Fatalf("first request: %v", err)
	}
	err := svc.RequestRegistrationOTP(context.Background(), "0244000111")
	if !errors.Is(err, ErrOTPResendTooSoon) {
		t.Fatalf("expected ErrOTPResendTooSoon on an immediate resend, got %v", err)
	}
	if delivery.calls != 1 {
		t.Fatalf("expected exactly one SMS billed, got %d", delivery.calls)
	}
	if len(wa.created) != 1 {
		t.Fatalf("expected no second challenge stored, got %d", len(wa.created))
	}
}

// The throttle is per NUMBER, so it must not block a different number: one
// person signing up cannot lock out the next.
func TestRequestOTPThrottleIsPerNumber(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1", "chal-2"})

	if err := svc.RequestRegistrationOTP(context.Background(), "0244000111"); err != nil {
		t.Fatalf("first request: %v", err)
	}
	if err := svc.RequestRegistrationOTP(context.Background(), "0209999888"); err != nil {
		t.Fatalf("a different number must not be throttled: %v", err)
	}
	if delivery.calls != 2 {
		t.Fatalf("expected both numbers to receive a code, got %d sends", delivery.calls)
	}
}

// Once the cooldown has passed a resend is allowed again — a stuck user must not
// be locked out of a fresh code.
func TestRequestOTPAllowsResendAfterCooldown(t *testing.T) {
	t.Parallel()
	now := fixedOTPClock.now
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	// A live challenge older than the cooldown but not yet expired.
	wa.challenges = append(wa.challenges, &fakeOTPChallenge{
		id:        "chal-old",
		number:    "233244000111",
		codeHash:  "hash:000000",
		createdAt: now.Add(-businessOTPResendCooldown - time.Second),
		expiresAt: now.Add(time.Minute),
		purpose:   ports.BusinessOTPPurposeRegister,
	})
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-2"})

	if err := svc.RequestRegistrationOTP(context.Background(), "0244000111"); err != nil {
		t.Fatalf("expected a resend after the cooldown to be allowed, got %v", err)
	}
	if delivery.calls != 1 {
		t.Fatalf("expected the resend to be sent, got %d", delivery.calls)
	}
}

// A code is only good for the flow that issued it. The challenge store is keyed
// on a phone number shared across flows, so without this a code the owner
// requested to SIGN IN would equally authorise redirecting their payouts —
// turning "read me the code you just got" into a payout-redirection attack.
func TestOTPCodeCannotBeReplayedAcrossFlows(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})

	// A code issued for sign-in...
	if err := svc.RequestSignInOTP(context.Background(), "ama-stitch", "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	// ...must not prove a payout number.
	err := svc.VerifyBusinessPhoneOTP(context.Background(), "0244000111", "123456")
	if !errors.Is(err, ErrCodeExpired) {
		t.Fatalf("expected a sign-in code to be invisible to the payout flow, got %v", err)
	}
}

// The converse: a payout code must not sign anyone in.
func TestPayoutOTPCodeCannotSignIn(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})

	if err := svc.RequestBusinessPhoneOTP(context.Background(), "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	_, err := svc.VerifySignInOTP(context.Background(), VerifySignInOTPCommand{
		BusinessHandle: "ama-stitch",
		WhatsAppNumber: "0244000111",
		Code:           "123456",
	})
	if !errors.Is(err, ErrCodeExpired) {
		t.Fatalf("expected a payout code to be invisible to sign-in, got %v", err)
	}
}

// The code issued for a flow still works for THAT flow — the discriminator must
// scope codes, not break them.
func TestPayoutOTPCodeVerifiesItsOwnFlow(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})

	if err := svc.RequestBusinessPhoneOTP(context.Background(), "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	if err := svc.VerifyBusinessPhoneOTP(context.Background(), "0244000111", "123456"); err != nil {
		t.Fatalf("expected the payout code to verify its own flow: %v", err)
	}
}

func TestVerifySignInOTPIssuesSession(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, sessions, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1", "session-1", "x1", "x2"})

	if err := svc.RequestSignInOTP(context.Background(), "ama-stitch", "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	result, err := svc.VerifySignInOTP(context.Background(), VerifySignInOTPCommand{
		BusinessHandle: "ama-stitch",
		WhatsAppNumber: "0244000111",
		Code:           "123456",
		UserAgent:      "test-agent",
		IPAddress:      "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if result.MFARequired {
		t.Fatal("did not expect an MFA challenge")
	}
	if result.AccessToken != "access:user-1:biz-1:owner" {
		t.Fatalf("unexpected access token %q", result.AccessToken)
	}
	if sessions.created.RefreshTokenHash != "hash:refresh-token" {
		t.Fatalf("expected a session to be created, got %q", sessions.created.RefreshTokenHash)
	}
	if !wa.challenges[0].consumed {
		t.Fatal("expected the challenge to be consumed")
	}
}

func TestVerifySignInOTPRejectsWrongCode(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1", "session-1"})

	if err := svc.RequestSignInOTP(context.Background(), "ama-stitch", "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	_, err := svc.VerifySignInOTP(context.Background(), VerifySignInOTPCommand{
		BusinessHandle: "ama-stitch",
		WhatsAppNumber: "0244000111",
		Code:           "000000",
	})
	if !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expected ErrInvalidCode, got %v", err)
	}
	if wa.challenges[0].attempts != 1 {
		t.Fatalf("expected attempts incremented to 1, got %d", wa.challenges[0].attempts)
	}
}

func TestVerifySignInOTPExpiredOrMissing(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"session-1"})

	_, err := svc.VerifySignInOTP(context.Background(), VerifySignInOTPCommand{
		BusinessHandle: "ama-stitch",
		WhatsAppNumber: "0244000111",
		Code:           "123456",
	})
	if !errors.Is(err, ErrCodeExpired) {
		t.Fatalf("expected ErrCodeExpired, got %v", err)
	}
}

func TestVerifySignInOTPTooManyAttempts(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{credentials: activeOwner()}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1", "session-1"})

	if err := svc.RequestSignInOTP(context.Background(), "ama-stitch", "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	wa.challenges[0].attempts = maxBusinessOTPAttempts

	_, err := svc.VerifySignInOTP(context.Background(), VerifySignInOTPCommand{
		BusinessHandle: "ama-stitch",
		WhatsAppNumber: "0244000111",
		Code:           "123456",
	})
	if !errors.Is(err, ErrTooManyAttempts) {
		t.Fatalf("expected ErrTooManyAttempts, got %v", err)
	}
}

func TestRegisterBusinessVerifiesOwnerPhone(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, businesses := newWhatsAppOTPService(wa, delivery, []common.ID{"business-1", "user-1", "session-1"})
	// A prior request left an active challenge for the number.
	wa.challenges = append(wa.challenges, &fakeOTPChallenge{
		id:        "chal-x",
		number:    "233244000111",
		codeHash:  "hash:123456",
		expiresAt: fixedOTPClock.now.Add(5 * time.Minute),
		purpose:   ports.BusinessOTPPurposeRegister,
	})

	_, err := svc.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    "strong-password",
		OwnerPhone:       "0244000111",
		OwnerPhoneCode:   "123456",
		WhatsAppNumber:   "0244000111",
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	// The PHONE is what we SMS, so it is the number proven at signup.
	if businesses.created.Phone != "233244000111" || !businesses.created.PhoneVerified {
		t.Fatalf(
			"expected a verified phone persisted, got %q verified=%v",
			businesses.created.Phone, businesses.created.PhoneVerified,
		)
	}
	// WhatsApp is chat-only: stored (normalized) but never marked verified.
	if businesses.created.WhatsAppNumber != "233244000111" {
		t.Fatalf("expected the WhatsApp number stored, got %q", businesses.created.WhatsAppNumber)
	}
	if businesses.created.WhatsAppVerified {
		t.Fatal("WhatsApp is chat-only and must not be marked verified at signup")
	}
	if !wa.challenges[0].consumed {
		t.Fatal("expected the registration challenge to be consumed")
	}
}

func TestRegisterBusinessRejectsBadPhoneCode(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, businesses := newWhatsAppOTPService(wa, delivery, []common.ID{"business-1", "user-1", "session-1"})
	wa.challenges = append(wa.challenges, &fakeOTPChallenge{
		id:        "chal-x",
		number:    "233244000111",
		codeHash:  "hash:123456",
		expiresAt: fixedOTPClock.now.Add(5 * time.Minute),
		purpose:   ports.BusinessOTPPurposeRegister,
	})

	_, err := svc.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    "strong-password",
		OwnerPhone:       "0244000111",
		OwnerPhoneCode:   "000000",
	})
	if !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expected ErrInvalidCode, got %v", err)
	}
	if businesses.created.BusinessID != "" {
		t.Fatal("expected the business NOT to be created when the WhatsApp code is wrong")
	}
}
