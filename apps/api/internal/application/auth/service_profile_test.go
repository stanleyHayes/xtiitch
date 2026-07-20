package authapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §8: the signup form's own "Verify phone number" button proves the code up
// front (verify-only) — marked, NOT consumed — and the register call
// afterwards must succeed for the same number WITHOUT carrying the code.
func TestVerifyRegistrationOTPThenRegisterWithoutCode(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, businesses := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1", "business-1", "user-1", "session-1"})

	if err := svc.RequestRegistrationOTP(context.Background(), "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	if err := svc.VerifyRegistrationOTP(context.Background(), "0244000111", "123456"); err != nil {
		t.Fatalf("verify-only: %v", err)
	}
	if !wa.challenges[0].verified {
		t.Fatal("expected the challenge to be marked verified")
	}
	if wa.challenges[0].consumed {
		t.Fatal("verify-only must not consume the challenge; register redeems the proof")
	}

	_, err := svc.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    "strong-password",
		OwnerPhone:       "0244000111",
		// No OwnerPhoneCode: the earlier verify-only proof covers it.
	})
	if err != nil {
		t.Fatalf("register after verify-only: %v", err)
	}
	if businesses.created.Phone != "233244000111" || !businesses.created.PhoneVerified {
		t.Fatalf("expected a verified phone persisted, got %q verified=%v",
			businesses.created.Phone, businesses.created.PhoneVerified)
	}
	if !wa.challenges[0].consumed {
		t.Fatal("register must consume the redeemed proof, so one proof opens exactly one account")
	}
}

// The verify-only endpoint maps wrong/expired codes to the same errors the
// other OTP endpoints return, so the frontend maps them 1:1.
func TestVerifyRegistrationOTPRejectsWrongCode(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})

	if err := svc.RequestRegistrationOTP(context.Background(), "0244000111"); err != nil {
		t.Fatalf("request: %v", err)
	}
	err := svc.VerifyRegistrationOTP(context.Background(), "0244000111", "000000")
	if !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expected ErrInvalidCode, got %v", err)
	}
	if wa.challenges[0].attempts != 1 {
		t.Fatalf("expected attempts incremented to 1, got %d", wa.challenges[0].attempts)
	}
	if wa.challenges[0].verified {
		t.Fatal("a wrong code must not mark the challenge verified")
	}
}

func TestVerifyRegistrationOTPExpiredOrMissing(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, nil)

	err := svc.VerifyRegistrationOTP(context.Background(), "0244000111", "123456")
	if !errors.Is(err, ErrCodeExpired) {
		t.Fatalf("expected ErrCodeExpired, got %v", err)
	}
}

func ownProfileRecord() ports.BusinessUserProfileRecord {
	return ports.BusinessUserProfileRecord{
		UserID:         "user-1",
		BusinessID:     "biz-1",
		Email:          "ama@example.com",
		DisplayName:    "Ama",
		Phone:          "233244000111",
		WhatsAppNumber: "233244000111",
		Role:           business.UserRoleOwner,
		IsActive:       true,
	}
}

// §9: display name, email and WhatsApp number update directly (validated and
// normalized like at signup) with no SMS gate.
func TestUpdateOwnProfileEditsDirectFieldsWithoutOTP(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, businesses := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})
	businesses.profile = ownProfileRecord()

	name := "Ama Serwaa"
	email := "Ama.Serwaa@example.com"
	whatsApp := "0209999888"
	got, err := svc.UpdateOwnProfile(context.Background(), UpdateOwnProfileCommand{
		Scope:          common.TenantScope{BusinessID: "biz-1"},
		UserID:         "user-1",
		DisplayName:    &name,
		Email:          &email,
		WhatsAppNumber: &whatsApp,
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	updated := businesses.updatedProfile
	if updated.DisplayName != "Ama Serwaa" || updated.Email != "ama.serwaa@example.com" || updated.WhatsAppNumber != "233209999888" {
		t.Fatalf("unexpected merged profile write: %+v", updated)
	}
	if updated.Phone != "233244000111" || updated.PhoneVerified {
		t.Fatalf("an untouched phone must pass through unchanged + unproven, got %q verified=%v",
			updated.Phone, updated.PhoneVerified)
	}
	if got.Email != "ama.serwaa@example.com" || got.WhatsAppNumber != "233209999888" {
		t.Fatalf("expected the returned profile to reflect the edit, got %+v", got)
	}
	if delivery.calls != 0 {
		t.Fatal("no SMS should be billed for a non-phone edit")
	}
}

func TestUpdateOwnProfileRejectsInvalidEmail(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	svc, _, businesses := newWhatsAppOTPService(wa, &fakeOTPDelivery{}, nil)
	businesses.profile = ownProfileRecord()

	email := "not-an-email"
	_, err := svc.UpdateOwnProfile(context.Background(), UpdateOwnProfileCommand{
		Scope:  common.TenantScope{BusinessID: "biz-1"},
		UserID: "user-1",
		Email:  &email,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	if businesses.updatedProfile.UserID != "" {
		t.Fatal("no write should reach the repo when validation fails")
	}
}

// §9: changing the phone demands an SMS proof for the NEW number, exactly as
// at account creation. Without a code the update fails with a stable sentinel.
func TestUpdateOwnProfilePhoneChangeRequiresOTP(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	svc, _, businesses := newWhatsAppOTPService(wa, &fakeOTPDelivery{}, nil)
	businesses.profile = ownProfileRecord()

	newPhone := "0209999888"
	_, err := svc.UpdateOwnProfile(context.Background(), UpdateOwnProfileCommand{
		Scope:  common.TenantScope{BusinessID: "biz-1"},
		UserID: "user-1",
		Phone:  &newPhone,
	})
	if !errors.Is(err, ErrPhoneVerificationRequired) {
		t.Fatalf("expected ErrPhoneVerificationRequired, got %v", err)
	}
	if businesses.updatedProfile.UserID != "" {
		t.Fatal("no write should reach the repo when the new phone is unproven")
	}
}

// With a valid code for the new number the change saves and phone_verified_at
// is stamped anew.
func TestUpdateOwnProfilePhoneChangeWithOTP(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, businesses := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1"})
	businesses.profile = ownProfileRecord()

	if err := svc.RequestProfilePhoneOTP(context.Background(), "0209999888"); err != nil {
		t.Fatalf("request phone otp: %v", err)
	}
	if delivery.calls != 1 || delivery.phone != "233209999888" {
		t.Fatalf("expected the code sent to the NEW number, got %+v", delivery)
	}
	if wa.created[0].Purpose != ports.BusinessOTPPurposeProfile {
		t.Fatalf("expected the profile purpose, got %q", wa.created[0].Purpose)
	}

	newPhone := "0209999888"
	got, err := svc.UpdateOwnProfile(context.Background(), UpdateOwnProfileCommand{
		Scope:   common.TenantScope{BusinessID: "biz-1"},
		UserID:  "user-1",
		Phone:   &newPhone,
		OTPCode: "123456",
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if businesses.updatedProfile.Phone != "233209999888" || !businesses.updatedProfile.PhoneVerified {
		t.Fatalf("expected the new phone saved + marked proven, got %+v", businesses.updatedProfile)
	}
	if got.PhoneVerifiedAt == nil {
		t.Fatal("expected phone_verified_at stamped anew on the returned profile")
	}
	if !wa.challenges[0].consumed {
		t.Fatal("the proof must be consumed so it cannot be replayed into another change")
	}
}

// A wrong code for the new number maps to the shared OTP error set.
func TestUpdateOwnProfilePhoneChangeRejectsWrongCode(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	svc, _, businesses := newWhatsAppOTPService(wa, &fakeOTPDelivery{}, []common.ID{"chal-1"})
	businesses.profile = ownProfileRecord()

	if err := svc.RequestProfilePhoneOTP(context.Background(), "0209999888"); err != nil {
		t.Fatalf("request phone otp: %v", err)
	}
	newPhone := "0209999888"
	_, err := svc.UpdateOwnProfile(context.Background(), UpdateOwnProfileCommand{
		Scope:   common.TenantScope{BusinessID: "biz-1"},
		UserID:  "user-1",
		Phone:   &newPhone,
		OTPCode: "000000",
	})
	if !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expected ErrInvalidCode, got %v", err)
	}
	if businesses.updatedProfile.UserID != "" {
		t.Fatal("no write should reach the repo when the code is wrong")
	}
}

// Re-sending the CURRENT phone (in any accepted format) is no change, so no
// code is demanded and any otp_code rides along ignored.
func TestUpdateOwnProfileUnchangedPhoneIgnoresOTPCode(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	svc, _, businesses := newWhatsAppOTPService(wa, &fakeOTPDelivery{}, nil)
	businesses.profile = ownProfileRecord()

	samePhone := "0244 000 111" // normalizes to the stored 233244000111
	got, err := svc.UpdateOwnProfile(context.Background(), UpdateOwnProfileCommand{
		Scope:  common.TenantScope{BusinessID: "biz-1"},
		UserID: "user-1",
		Phone:  &samePhone,
	})
	if err != nil {
		t.Fatalf("an unchanged phone must not demand a code: %v", err)
	}
	if businesses.updatedProfile.Phone != "233244000111" || businesses.updatedProfile.PhoneVerified {
		t.Fatalf("expected the phone untouched + unproven, got %+v", businesses.updatedProfile)
	}
	if got.Phone != "233244000111" {
		t.Fatalf("expected the stored phone returned, got %q", got.Phone)
	}
}

// The service only ever acts on the caller's own id (from their token), so one
// user can never patch another through /me: the lookup and the write are both
// keyed on that id inside the caller's tenant.
func TestUpdateOwnProfileScopesEveryAccessToTheCaller(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	svc, _, businesses := newWhatsAppOTPService(wa, &fakeOTPDelivery{}, nil)
	businesses.profile = ownProfileRecord()

	name := "Ama Serwaa"
	if _, err := svc.UpdateOwnProfile(context.Background(), UpdateOwnProfileCommand{
		Scope:       common.TenantScope{BusinessID: "biz-1"},
		UserID:      "user-1",
		DisplayName: &name,
	}); err != nil {
		t.Fatalf("update: %v", err)
	}
	if businesses.lookupProfileUserID != "user-1" || businesses.updatedProfile.UserID != "user-1" {
		t.Fatalf("expected lookup + write keyed on the caller, got lookup=%q write=%q",
			businesses.lookupProfileUserID, businesses.updatedProfile.UserID)
	}
	if businesses.listScope.BusinessID != "biz-1" {
		t.Fatalf("expected the caller's tenant scope, got %q", businesses.listScope.BusinessID)
	}
}

// The profile OTP send reuses the per-number resend cooldown: a second code
// inside 60s must not bill another SMS.
func TestRequestProfilePhoneOTPThrottlesResend(t *testing.T) {
	t.Parallel()
	wa := &fakeWhatsAppAuth{}
	delivery := &fakeOTPDelivery{}
	svc, _, _ := newWhatsAppOTPService(wa, delivery, []common.ID{"chal-1", "chal-2"})

	if err := svc.RequestProfilePhoneOTP(context.Background(), "0209999888"); err != nil {
		t.Fatalf("first request: %v", err)
	}
	err := svc.RequestProfilePhoneOTP(context.Background(), "0209999888")
	if !errors.Is(err, ErrOTPResendTooSoon) {
		t.Fatalf("expected ErrOTPResendTooSoon on an immediate resend, got %v", err)
	}
	if delivery.calls != 1 {
		t.Fatalf("expected exactly one SMS billed, got %d", delivery.calls)
	}
}
