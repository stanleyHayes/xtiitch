package adminauthhttp

type createUserRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

type updateUserRequest struct {
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
}

type updateRolePermissionsRequest struct {
	Permissions []string `json:"permissions"`
}

type updateProfileRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

type updatePreferencesRequest struct {
	Timezone           string `json:"timezone"`
	PhoneNumber        string `json:"phone_number"`
	NotifyEmail        bool   `json:"notify_email"`
	NotifySMS          bool   `json:"notify_sms"`
	AlertVerifications bool   `json:"alert_verifications"`
	AlertMoneyRails    bool   `json:"alert_money_rails"`
	AlertSubscriptions bool   `json:"alert_subscriptions"`
	AlertPromotions    bool   `json:"alert_promotions"`
	AlertRisk          bool   `json:"alert_risk"`
	AlertSupport       bool   `json:"alert_support"`
	DailyDigestTime    string `json:"daily_digest_time"`
}

type roleResponse struct {
	Role        string   `json:"role"`
	Label       string   `json:"label"`
	Permissions []string `json:"permissions"`
}

type permissionResponse struct {
	Permission string `json:"permission"`
	Label      string `json:"label"`
}

type adminPreferencesResponse struct {
	Timezone           string `json:"timezone"`
	PhoneNumber        string `json:"phone_number"`
	NotifyEmail        bool   `json:"notify_email"`
	NotifySMS          bool   `json:"notify_sms"`
	AlertVerifications bool   `json:"alert_verifications"`
	AlertMoneyRails    bool   `json:"alert_money_rails"`
	AlertSubscriptions bool   `json:"alert_subscriptions"`
	AlertPromotions    bool   `json:"alert_promotions"`
	AlertRisk          bool   `json:"alert_risk"`
	AlertSupport       bool   `json:"alert_support"`
	DailyDigestTime    string `json:"daily_digest_time"`
	UpdatedAt          string `json:"updated_at,omitempty"`
}

type profileSettingsResponse struct {
	User        adminUserResponse        `json:"user"`
	Preferences adminPreferencesResponse `json:"preferences"`
}

type roleCatalogResponse struct {
	Roles       []roleResponse       `json:"roles"`
	Permissions []permissionResponse `json:"permissions"`
}
