package authhttp

type meResponse struct {
	BusinessID string `json:"business_id"`
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
	// §9 profile fields, read live from the caller's business_users row so
	// profile edits are reflected everywhere the dashboard shows them.
	Email          string `json:"email"`
	DisplayName    string `json:"display_name"`
	Phone          string `json:"phone"`
	PhoneVerified  bool   `json:"phone_verified"`
	WhatsAppNumber string `json:"whatsapp_number"`
}

type businessUserResponse struct {
	UserID      string `json:"business_user_id"`
	BusinessID  string `json:"business_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Phone       string `json:"phone"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type transferBusinessOwnerResponse struct {
	PreviousOwner businessUserResponse `json:"previous_owner"`
	NewOwner      businessUserResponse `json:"new_owner"`
}

type createBusinessUserRequest struct {
	DisplayName string `json:"display_name"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

type updateBusinessUserRequest struct {
	DisplayName string `json:"display_name"`
	Phone       string `json:"phone"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
}

type resetBusinessUserPasswordRequest struct {
	Password string `json:"password"`
}

type transferBusinessOwnerRequest struct {
	NewOwnerUserID string `json:"new_owner_user_id"`
	Confirmation   string `json:"confirmation"`
}

type identityVerificationRequest struct {
	// FullLegalName is the owner's official name exactly as printed on the Ghana
	// Card (§2.3); required for new submissions.
	FullLegalName  string `json:"full_legal_name"`
	CardNumber     string `json:"card_number"`
	IDPhotoURL     string `json:"id_photo_url"`
	IDPhotoBackURL string `json:"id_photo_back_url"`
}
