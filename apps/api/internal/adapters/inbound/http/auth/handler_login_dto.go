package authhttp

type registerBusinessRequest struct {
	BusinessName     string `json:"business_name"`
	BusinessHandle   string `json:"business_handle"`
	OwnerDisplayName string `json:"owner_display_name"`
	OwnerEmail       string `json:"owner_email"`
	OwnerPassword    string `json:"owner_password"`
	PlanCode         string `json:"plan_code"`
	// OwnerPhone is the number Xtiitch SMSes, so it is the one proven at signup:
	// when supplied, owner_phone_code must be a valid one-time code for it.
	OwnerPhone     string `json:"owner_phone"`
	OwnerPhoneCode string `json:"owner_phone_code"`
	// WhatsApp is chat-only and is stored unproven, so it carries no code.
	WhatsAppNumber string `json:"whatsapp_number"`
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

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type requestPasswordResetRequest struct {
	Email string `json:"email"`
}

type confirmPasswordResetRequest struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

type changeOwnPasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
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
