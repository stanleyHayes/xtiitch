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
		id:        input.ChallengeID,
		number:    input.WhatsAppNumber,
		codeHash:  input.CodeHash,
		expiresAt: input.ExpiresAt,
	})
	return nil
}

func (f *fakeWhatsAppAuth) LatestActiveSignInOTPChallenge(
	_ context.Context,
	number string,
	now time.Time) (ports.BusinessOTPChallengeRecord,
	error,
) {
	for i := len(f.challenges) - 1; i >= 0; i-- {
		c := f.challenges[i]
		if c.number == number && !c.consumed && c.expiresAt.After(now) {
			return ports.BusinessOTPChallengeRecord{
				ChallengeID:    c.id,
				WhatsAppNumber: c.number,
				CodeHash:       c.codeHash,
				Attempts:       c.attempts,
				ExpiresAt:      c.expiresAt,
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

func TestRegisterBusinessStoresVerifiedWhatsApp(t *testing.T) {
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
	})

	_, err := svc.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    "strong-password",
		WhatsAppNumber:   "0244000111",
		WhatsAppCode:     "123456",
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if businesses.created.WhatsAppNumber != "233244000111" || !businesses.created.WhatsAppVerified {
		t.Fatalf(
			"expected a verified WhatsApp number persisted, got %q verified=%v",
			businesses.created.WhatsAppNumber, businesses.created.WhatsAppVerified,
		)
	}
	if !wa.challenges[0].consumed {
		t.Fatal("expected the registration challenge to be consumed")
	}
}

func TestRegisterBusinessRejectsBadWhatsAppCode(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, businesses := newWhatsAppOTPService(wa, delivery, []common.ID{"business-1", "user-1", "session-1"})
	wa.challenges = append(wa.challenges, &fakeOTPChallenge{
		id:        "chal-x",
		number:    "233244000111",
		codeHash:  "hash:123456",
		expiresAt: fixedOTPClock.now.Add(5 * time.Minute),
	})

	_, err := svc.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    "strong-password",
		WhatsAppNumber:   "0244000111",
		WhatsAppCode:     "000000",
	})
	if !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expected ErrInvalidCode, got %v", err)
	}
	if businesses.created.BusinessID != "" {
		t.Fatal("expected the business NOT to be created when the WhatsApp code is wrong")
	}
}
