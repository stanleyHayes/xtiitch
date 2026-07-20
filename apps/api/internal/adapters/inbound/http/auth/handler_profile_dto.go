package authhttp

type verifyRegistrationOTPRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type requestProfilePhoneOTPRequest struct {
	Phone string `json:"phone"`
}

// updateOwnProfileRequest carries a §9 self-service profile edit. Pointer
// fields distinguish "field omitted" (nil: keep stored value) from an empty
// value supplied on purpose; otp_code gates a phone change.
type updateOwnProfileRequest struct {
	DisplayName    *string `json:"display_name"`
	Email          *string `json:"email"`
	WhatsAppNumber *string `json:"whatsapp_number"`
	Phone          *string `json:"phone"`
	OTPCode        string  `json:"otp_code"`
}

// ownProfileResponse is the signed-in user's own profile (§9), richer than
// businessUserResponse: the profile screen also shows the WhatsApp chat number
// and whether the phone is SMS-proven.
type ownProfileResponse struct {
	UserID         string `json:"business_user_id"`
	BusinessID     string `json:"business_id"`
	Email          string `json:"email"`
	DisplayName    string `json:"display_name"`
	Phone          string `json:"phone"`
	PhoneVerified  bool   `json:"phone_verified"`
	WhatsAppNumber string `json:"whatsapp_number"`
	Role           string `json:"role"`
	IsActive       bool   `json:"is_active"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}
