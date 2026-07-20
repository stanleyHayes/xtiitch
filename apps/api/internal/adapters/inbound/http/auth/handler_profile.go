package authhttp

import (
	"net/http"
	"time"

	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// verifyRegistrationOTP proves a signup phone code WITHOUT registering (§8:
// the form freezes on "Verify phone number" until the 6-digit code checks
// out). On success the challenge is marked verified, so the later
// POST /auth/business/register for the same number is accepted. Error codes
// mirror the other OTP endpoints 1:1 (invalid_code / code_expired /
// too_many_attempts) so the frontend maps them identically.
func (handler Handler) verifyRegistrationOTP(w http.ResponseWriter, r *http.Request) {
	var request verifyRegistrationOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.VerifyRegistrationOTP(r.Context(), request.Phone, request.Code); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// requestProfilePhoneOTP sends an SMS code to the NEW phone number a signed-in
// user wants on their profile (§9). The PATCH only saves a changed phone when
// the code for the new number checks out — exactly as at account creation.
func (handler Handler) requestProfilePhoneOTP(w http.ResponseWriter, r *http.Request) {
	if _, ok := PrincipalFromContext(r.Context()); !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request requestProfilePhoneOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RequestProfilePhoneOTP(r.Context(), request.Phone); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// updateOwnProfile applies a §9 self-service edit to the caller's OWN row: the
// user id comes from the verified token, never from the request, so one user
// can never patch another through this route.
func (handler Handler) updateOwnProfile(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateOwnProfileRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	profile, err := handler.service.UpdateOwnProfile(r.Context(), authapp.UpdateOwnProfileCommand{
		Scope:          principal.TenantScope(),
		UserID:         principal.UserID,
		DisplayName:    request.DisplayName,
		Email:          request.Email,
		WhatsAppNumber: request.WhatsAppNumber,
		Phone:          request.Phone,
		OTPCode:        request.OTPCode,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newOwnProfileResponse(profile))
}

func newOwnProfileResponse(profile ports.BusinessUserProfileRecord) ownProfileResponse {
	return ownProfileResponse{
		UserID:         profile.UserID.String(),
		BusinessID:     profile.BusinessID.String(),
		Email:          profile.Email,
		DisplayName:    profile.DisplayName,
		Phone:          profile.Phone,
		PhoneVerified:  profile.PhoneVerifiedAt != nil,
		WhatsAppNumber: profile.WhatsAppNumber,
		Role:           string(profile.Role),
		IsActive:       profile.IsActive,
		CreatedAt:      profile.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      profile.UpdatedAt.Format(time.RFC3339),
	}
}
