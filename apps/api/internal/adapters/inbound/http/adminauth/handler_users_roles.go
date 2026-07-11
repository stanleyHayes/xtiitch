package adminauthhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

func (handler Handler) profileSettings(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	result, err := handler.service.GetProfileSettings(r.Context(), principal.AdminUserID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, profileSettingsResponse{
		User:        newAdminUserResponse(result.User),
		Preferences: newPreferencesResponse(result.Preferences),
	})
}

func (handler Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateProfileRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.UpdateProfile(r.Context(), adminauthapp.UpdateProfileCommand{
		ActorUserID: principal.AdminUserID,
		DisplayName: request.DisplayName,
		Email:       request.Email,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdminUserResponse(user))
}

func (handler Handler) updatePreferences(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updatePreferencesRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	preferences, err := handler.service.UpdatePreferences(r.Context(), adminauthapp.UpdatePreferencesCommand{
		ActorUserID:        principal.AdminUserID,
		ActorRole:          principal.Role,
		Timezone:           request.Timezone,
		PhoneNumber:        request.PhoneNumber,
		NotifyEmail:        request.NotifyEmail,
		NotifySMS:          request.NotifySMS,
		AlertVerifications: request.AlertVerifications,
		AlertMoneyRails:    request.AlertMoneyRails,
		AlertSubscriptions: request.AlertSubscriptions,
		AlertPromotions:    request.AlertPromotions,
		AlertRisk:          request.AlertRisk,
		AlertSupport:       request.AlertSupport,
		DailyDigestTime:    request.DailyDigestTime,
		UserAgent:          r.UserAgent(),
		IPAddress:          requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPreferencesResponse(preferences))
}

func (handler Handler) roles(w http.ResponseWriter, r *http.Request) {
	records, err := handler.service.ListRolePermissions(r.Context())
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	roles := make([]roleResponse, 0, len(records))
	for _, record := range records {
		roles = append(roles, newRoleResponse(record.Role, record.Permissions))
	}

	permissions := make([]permissionResponse, 0, len(admindomain.PermissionCatalog()))
	for _, permission := range admindomain.PermissionCatalog() {
		permissions = append(permissions, newPermissionResponse(permission))
	}

	writeJSON(w, http.StatusOK, roleCatalogResponse{
		Roles:       roles,
		Permissions: permissions,
	})
}

func (handler Handler) updateRolePermissions(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateRolePermissionsRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	permissions := make([]admindomain.Permission, 0, len(request.Permissions))
	for _, permission := range request.Permissions {
		permissions = append(permissions, admindomain.Permission(permission))
	}

	record, err := handler.service.UpdateRolePermissions(r.Context(), adminauthapp.UpdateRolePermissionsCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Role:        admindomain.Role(chi.URLParam(r, "role")),
		Permissions: permissions,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newRoleResponse(record.Role, record.Permissions))
}

func (handler Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	users, err := handler.service.ListUsers(r.Context(), adminauthapp.ListUsersCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]adminUserResponse, 0, len(users))
	for _, user := range users {
		out = append(out, newAdminUserResponse(user))
	}
	writeJSON(w, http.StatusOK, map[string][]adminUserResponse{"users": out})
}

func (handler Handler) createUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request createUserRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.CreateUser(r.Context(), adminauthapp.CreateUserCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		DisplayName: request.DisplayName,
		Email:       request.Email,
		Password:    request.Password,
		Role:        admindomain.Role(request.Role),
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAdminUserResponse(user))
}

func (handler Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateUserRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.UpdateUser(r.Context(), adminauthapp.UpdateUserCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		UserID:      common.ID(chi.URLParam(r, "id")),
		DisplayName: request.DisplayName,
		Role:        admindomain.Role(request.Role),
		IsActive:    request.IsActive,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdminUserResponse(user))
}

func newPreferencesResponse(preferences ports.AdminPreferencesRecord) adminPreferencesResponse {
	return adminPreferencesResponse{
		Timezone:           preferences.Timezone,
		PhoneNumber:        preferences.PhoneNumber,
		NotifyEmail:        preferences.NotifyEmail,
		NotifySMS:          preferences.NotifySMS,
		AlertVerifications: preferences.AlertVerifications,
		AlertMoneyRails:    preferences.AlertMoneyRails,
		AlertSubscriptions: preferences.AlertSubscriptions,
		AlertPromotions:    preferences.AlertPromotions,
		AlertRisk:          preferences.AlertRisk,
		AlertSupport:       preferences.AlertSupport,
		DailyDigestTime:    preferences.DailyDigestTime,
		UpdatedAt:          preferences.UpdatedAt.Format(time.RFC3339),
	}
}

func newRoleResponse(role admindomain.Role, permissions []admindomain.Permission) roleResponse {
	out := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		out = append(out, string(permission))
	}

	return roleResponse{
		Role:        string(role),
		Label:       roleLabel(role),
		Permissions: out,
	}
}

func newPermissionResponse(permission admindomain.Permission) permissionResponse {
	return permissionResponse{
		Permission: string(permission),
		Label:      permissionLabel(permission),
	}
}

func roleLabel(role admindomain.Role) string {
	switch role {
	case admindomain.RoleOwner:
		return "Owner"
	case admindomain.RoleOperator:
		return "Operator"
	case admindomain.RoleSupport:
		return "Support"
	default:
		return string(role)
	}
}

func permissionLabel(permission admindomain.Permission) string {
	switch permission {
	case admindomain.PermissionManageAdminUsers:
		return "Manage admin users"
	case admindomain.PermissionManageRoles:
		return "Manage roles"
	case admindomain.PermissionManageSettings:
		return "Platform settings"
	case admindomain.PermissionReviewBusinesses:
		return "Business review"
	case admindomain.PermissionManageMoneyRails:
		return "Money rails"
	case admindomain.PermissionManageSubscriptions:
		return "Subscriptions"
	case admindomain.PermissionManagePlans:
		return "Plan packages"
	case admindomain.PermissionManagePromotions:
		return "Promotions"
	case admindomain.PermissionManageAds:
		return "Sponsored placements"
	case admindomain.PermissionManageGrowth:
		return "Growth programmes"
	case admindomain.PermissionManageRisk:
		return "Risk review"
	case admindomain.PermissionManageSupport:
		return "Support queue"
	case admindomain.PermissionViewAudit:
		return "Audit trail"
	default:
		return string(permission)
	}
}
