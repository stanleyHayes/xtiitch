package authhttp

import (
	"net/http"

	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
)

type registerBusinessRequest struct {
	BusinessName     string `json:"business_name"`
	BusinessHandle   string `json:"business_handle"`
	OwnerDisplayName string `json:"owner_display_name"`
	OwnerEmail       string `json:"owner_email"`
	OwnerPassword    string `json:"owner_password"`
	PlanCode         string `json:"plan_code"`
	// OwnerPhone is the store owner's contact phone number for order and account
	// notifications. Optional; not a sign-in identity.
	OwnerPhone string `json:"owner_phone"`
	// Optional WhatsApp identity: when a number is supplied, the code proving it
	// must accompany the request.
	WhatsAppNumber string `json:"whatsapp_number"`
	WhatsAppCode   string `json:"whatsapp_code"`
}

func (handler Handler) registerBusiness(w http.ResponseWriter, r *http.Request) {
	var request registerBusinessRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.RegisterBusiness(r.Context(), authapp.RegisterBusinessCommand{
		BusinessName:     request.BusinessName,
		BusinessHandle:   request.BusinessHandle,
		OwnerDisplayName: request.OwnerDisplayName,
		OwnerEmail:       request.OwnerEmail,
		OwnerPassword:    request.OwnerPassword,
		PlanCode:         request.PlanCode,
		OwnerPhone:       request.OwnerPhone,
		WhatsAppNumber:   request.WhatsAppNumber,
		WhatsAppCode:     request.WhatsAppCode,
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAuthResponse(result))
}

type loginBusinessRequest struct {
	BusinessHandle string `json:"business_handle"`
	OwnerEmail     string `json:"owner_email"`
	OwnerPassword  string `json:"owner_password"`
}

type mfaChallengeResponse struct {
	MFARequired       bool   `json:"mfa_required"`
	MFAChallengeToken string `json:"mfa_challenge_token"`
}

func (handler Handler) loginBusiness(w http.ResponseWriter, r *http.Request) {
	var request loginBusinessRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.LoginBusiness(r.Context(), authapp.LoginBusinessCommand{
		BusinessHandle: request.BusinessHandle,
		OwnerEmail:     request.OwnerEmail,
		OwnerPassword:  request.OwnerPassword,
		UserAgent:      r.UserAgent(),
		IPAddress:      requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	if result.MFARequired {
		writeJSON(w, http.StatusOK, mfaChallengeResponse{
			MFARequired:       true,
			MFAChallengeToken: result.MFAChallengeToken,
		})
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (handler Handler) refreshSession(w http.ResponseWriter, r *http.Request) {
	var request refreshRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.RefreshSession(r.Context(), authapp.RefreshSessionCommand{
		RefreshToken: request.RefreshToken,
		UserAgent:    r.UserAgent(),
		IPAddress:    requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (handler Handler) logout(w http.ResponseWriter, r *http.Request) {
	var request logoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.Logout(r.Context(), authapp.LogoutCommand{RefreshToken: request.RefreshToken}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type requestPasswordResetRequest struct {
	Email string `json:"email"`
}

func (handler Handler) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var request requestPasswordResetRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	// Always 204, whether or not the email maps to an account, so the response
	// never reveals which addresses are registered.
	if err := handler.service.RequestPasswordReset(r.Context(), request.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type confirmPasswordResetRequest struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

func (handler Handler) confirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	var request confirmPasswordResetRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.ConfirmPasswordReset(r.Context(), request.Email, request.Code, request.NewPassword); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type changeOwnPasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (handler Handler) changeOwnPassword(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request changeOwnPasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	err := handler.service.ChangeOwnPassword(r.Context(), authapp.ChangeOwnPasswordCommand{
		Scope:           principal.TenantScope(),
		UserID:          principal.UserID,
		CurrentPassword: request.CurrentPassword,
		NewPassword:     request.NewPassword,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type mfaStatusResponse struct {
	Enabled         bool `json:"enabled"`
	Enrolled        bool `json:"enrolled"`
	BackupCodesLeft int  `json:"backup_codes_left"`
}

type mfaSetupResponse struct {
	Secret          string `json:"secret"`
	ProvisioningURI string `json:"provisioning_uri"`
}

type mfaCodeRequest struct {
	Code string `json:"code"`
}

type mfaActivateResponse struct {
	Enabled     bool     `json:"enabled"`
	BackupCodes []string `json:"backup_codes"`
}

type verifyMFALoginRequest struct {
	MFAChallengeToken string `json:"mfa_challenge_token"`
	Code              string `json:"code"`
}

func (handler Handler) mfaStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	status, err := handler.service.GetMFAStatus(r.Context(), principal.TenantScope(), principal.UserID)
	if err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	writeJSON(w, http.StatusOK, mfaStatusResponse{
		Enabled:         status.Enabled,
		Enrolled:        status.Enrolled,
		BackupCodesLeft: status.BackupCodesLeft,
	})
}

func (handler Handler) startMFAEnrollment(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	setup, err := handler.service.StartMFAEnrollment(r.Context(), principal.TenantScope(), principal.UserID)
	if err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	writeJSON(w, http.StatusOK, mfaSetupResponse{
		Secret:          setup.Secret,
		ProvisioningURI: setup.ProvisioningURI,
	})
}

func (handler Handler) activateMFA(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request mfaCodeRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	backupCodes, err := handler.service.ActivateMFA(r.Context(), principal.TenantScope(), principal.UserID, request.Code)
	if err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	writeJSON(w, http.StatusOK, mfaActivateResponse{Enabled: true, BackupCodes: backupCodes})
}

func (handler Handler) disableMFA(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request mfaCodeRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.DisableMFA(r.Context(), principal.TenantScope(), principal.UserID, request.Code); err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) verifyMFALogin(w http.ResponseWriter, r *http.Request) {
	var request verifyMFALoginRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.VerifyMFALogin(r.Context(), authapp.VerifyMFALoginCommand{
		ChallengeToken: request.MFAChallengeToken,
		Code:           request.Code,
		UserAgent:      r.UserAgent(),
		IPAddress:      requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

type signInOTPRequest struct {
	BusinessHandle string `json:"business_handle"`
	WhatsAppNumber string `json:"whatsapp_number"`
}

type verifySignInOTPRequest struct {
	BusinessHandle string `json:"business_handle"`
	WhatsAppNumber string `json:"whatsapp_number"`
	Code           string `json:"code"`
}

type registrationOTPRequest struct {
	WhatsAppNumber string `json:"whatsapp_number"`
}

// requestSignInOTP sends a WhatsApp sign-in code. Always 202 (opaque about
// whether the handle+number is registered) unless the number is malformed or
// the feature is unavailable.
func (handler Handler) requestSignInOTP(w http.ResponseWriter, r *http.Request) {
	var request signInOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RequestSignInOTP(r.Context(), request.BusinessHandle, request.WhatsAppNumber); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// requestRegistrationOTP sends a verification code to a number a signup form
// collected (before the account exists).
func (handler Handler) requestRegistrationOTP(w http.ResponseWriter, r *http.Request) {
	var request registrationOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RequestRegistrationOTP(r.Context(), request.WhatsAppNumber); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// verifySignInOTP verifies a WhatsApp code and issues a session, or returns an
// MFA challenge when the account has a second factor enabled.
func (handler Handler) verifySignInOTP(w http.ResponseWriter, r *http.Request) {
	var request verifySignInOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.VerifySignInOTP(r.Context(), authapp.VerifySignInOTPCommand{
		BusinessHandle: request.BusinessHandle,
		WhatsAppNumber: request.WhatsAppNumber,
		Code:           request.Code,
		UserAgent:      r.UserAgent(),
		IPAddress:      requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	if result.MFARequired {
		writeJSON(w, http.StatusOK, mfaChallengeResponse{
			MFARequired:       true,
			MFAChallengeToken: result.MFAChallengeToken,
		})
		return
	}
	writeJSON(w, http.StatusOK, newAuthResponse(result))
}
