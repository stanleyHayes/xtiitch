package authhttp

type meResponse struct {
	BusinessID string `json:"business_id"`
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
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
	CardNumber     string `json:"card_number"`
	IDPhotoURL     string `json:"id_photo_url"`
	IDPhotoBackURL string `json:"id_photo_back_url"`
}
