package authapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ErrPhoneVerificationRequired is returned when a profile update tries to
// change the phone number without proving the NEW number first (§9: verify
// with an SMS code "exactly as at account creation"). It is deliberately
// distinct from the OTP error codes, so the dashboard can open the code-entry
// step rather than report a generic failure.
var ErrPhoneVerificationRequired = errors.New("new phone number must be verified with an SMS code first")

// GetOwnProfile returns the signed-in user's own profile row, backing both the
// §9 profile-settings screen and the extended GET /auth/business/me.
func (s Service) GetOwnProfile(ctx context.Context, scope common.TenantScope, userID common.ID) (ports.BusinessUserProfileRecord, error) {
	if scope.BusinessID.IsZero() || userID.IsZero() {
		return ports.BusinessUserProfileRecord{}, authdomain.ErrInvalidInput
	}
	return s.businesses.FindBusinessUserProfileByID(ctx, scope, userID)
}

// UpdateOwnProfileCommand carries a §9 self-service profile edit. A nil
// pointer means "field not supplied, keep the stored value", so an empty
// PATCH body is a no-op rather than a wipe.
type UpdateOwnProfileCommand struct {
	Scope  common.TenantScope
	UserID common.ID
	// DisplayName, Email and WhatsAppNumber update directly when supplied
	// (validated + normalized exactly like their signup counterparts).
	DisplayName    *string
	Email          *string
	WhatsAppNumber *string
	// Phone requires an OTP proof for the NEW number when it actually changes
	// (request it via RequestProfilePhoneOTP). OTPCode rides on this command
	// because the dashboard collects the code inside the profile form.
	Phone   *string
	OTPCode string
}

// UpdateOwnProfile applies a self-service edit to the caller's OWN business
// user row (§9: "owners can update signup details ... reflected everywhere").
// It is scoped by the authenticated user id, so it can never touch another
// user's row — and, unlike the team-management update, it works for the owner
// row, which is exactly the row §9 is about.
//
//nolint:gocognit,gocyclo // keeps validation, authorization, upload cleanup, and persistence in one atomic profile workflow
func (s Service) UpdateOwnProfile(ctx context.Context, cmd UpdateOwnProfileCommand) (ports.BusinessUserProfileRecord, error) {
	if cmd.Scope.BusinessID.IsZero() || cmd.UserID.IsZero() {
		return ports.BusinessUserProfileRecord{}, authdomain.ErrInvalidInput
	}

	current, err := s.businesses.FindBusinessUserProfileByID(ctx, cmd.Scope, cmd.UserID)
	if err != nil {
		return ports.BusinessUserProfileRecord{}, err
	}

	displayName := current.DisplayName
	if cmd.DisplayName != nil {
		displayName = strings.TrimSpace(*cmd.DisplayName)
		if displayName == "" {
			return ports.BusinessUserProfileRecord{}, authdomain.ErrInvalidInput
		}
	}

	email := current.Email
	if cmd.Email != nil {
		email, err = normalizeEmail(*cmd.Email)
		if err != nil {
			return ports.BusinessUserProfileRecord{}, errors.Join(authdomain.ErrInvalidInput, err)
		}
	}

	// WhatsApp is chat-only and unproven (same stance as registration), so it
	// updates directly; an empty value clears it.
	whatsAppNumber := current.WhatsAppNumber
	if cmd.WhatsAppNumber != nil {
		whatsAppNumber = ""
		if strings.TrimSpace(*cmd.WhatsAppNumber) != "" {
			whatsAppNumber, err = normalizeGhanaPhone(*cmd.WhatsAppNumber)
			if err != nil {
				return ports.BusinessUserProfileRecord{}, err
			}
		}
	}

	phone := current.Phone
	phoneNewlyVerified := false
	if cmd.Phone != nil && strings.TrimSpace(*cmd.Phone) != "" {
		number, normErr := normalizeGhanaPhone(*cmd.Phone)
		if normErr != nil {
			return ports.BusinessUserProfileRecord{}, normErr
		}
		if number != current.Phone {
			// A phone CHANGE must be proven with an SMS code for the new number
			// (§9), exactly as at account creation. An earlier-completed proof
			// (verified challenge) or a code on this request both count.
			if strings.TrimSpace(cmd.OTPCode) == "" {
				return ports.BusinessUserProfileRecord{}, ErrPhoneVerificationRequired
			}
			if !s.whatsAppOTPEnabled() {
				return ports.BusinessUserProfileRecord{}, ErrWhatsAppOTPUnavailable
			}
			if err := s.ensurePhoneProven(ctx, number, cmd.OTPCode, ports.BusinessOTPPurposeProfile); err != nil {
				return ports.BusinessUserProfileRecord{}, err
			}
			phone = number
			phoneNewlyVerified = true
		}
		// The current number re-sent (after normalization) is no change at all,
		// and any otp_code rides along ignored. An empty phone is likewise
		// ignored: clearing a verified number silently would defeat the proof.
	}

	return s.businesses.UpdateOwnBusinessUserProfile(ctx, cmd.Scope, ports.UpdateOwnBusinessUserProfileInput{
		UserID:         cmd.UserID,
		Email:          email,
		DisplayName:    displayName,
		Phone:          phone,
		PhoneVerified:  phoneNewlyVerified,
		WhatsAppNumber: whatsAppNumber,
	})
}
