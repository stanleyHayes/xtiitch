package adminauth

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type ListUsersCommand struct {
	ActorRole admindomain.Role
}

type ListAuditEventsCommand struct {
	ActorRole admindomain.Role
	Severity  admindomain.AuditSeverity
	Limit     int
}

type UpdateProfileCommand struct {
	ActorUserID common.ID
	DisplayName string
	Email       string
	UserAgent   string
	IPAddress   string
}

type UpdatePreferencesCommand struct {
	ActorUserID        common.ID
	ActorRole          admindomain.Role
	Timezone           string
	PhoneNumber        string
	NotifyEmail        bool
	NotifySMS          bool
	AlertVerifications bool
	AlertMoneyRails    bool
	AlertSubscriptions bool
	AlertPromotions    bool
	AlertRisk          bool
	AlertSupport       bool
	DailyDigestTime    string
	UserAgent          string
	IPAddress          string
}

type SignBrandingUploadCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
}

type UpdateRolePermissionsCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Role        admindomain.Role
	Permissions []admindomain.Permission
	UserAgent   string
	IPAddress   string
}

type CreateUserCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	DisplayName string
	Email       string
	Password    string
	Role        admindomain.Role
	UserAgent   string
	IPAddress   string
}

type UpdateUserCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	UserID      common.ID
	DisplayName string
	Role        admindomain.Role
	IsActive    bool
	UserAgent   string
	IPAddress   string
}

type ProfileSettingsResult struct {
	User        ports.AdminUserRecord
	Preferences ports.AdminPreferencesRecord
}

func (s Service) ListUsers(ctx context.Context, cmd ListUsersCommand) ([]ports.AdminUserRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAdminUsers); err != nil {
		return nil, err
	}

	return s.users.ListAdminUsers(ctx)
}

func (s Service) ListAuditEvents(ctx context.Context, cmd ListAuditEventsCommand) ([]ports.AdminAuditEventRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionViewAudit); err != nil {
		return nil, err
	}
	if cmd.Severity != "" && !cmd.Severity.Valid() {
		return nil, authdomain.ErrInvalidInput
	}

	return s.audits.ListAdminAuditEvents(ctx, ports.ListAdminAuditEventsInput{
		Limit:    cmd.Limit,
		Severity: cmd.Severity,
	})
}

func (s Service) GetProfileSettings(ctx context.Context, adminUserID common.ID) (ProfileSettingsResult, error) {
	user, err := s.Me(ctx, adminUserID)
	if err != nil {
		return ProfileSettingsResult{}, err
	}

	preferences, err := s.users.GetAdminPreferences(ctx, adminUserID)
	if err != nil {
		return ProfileSettingsResult{}, err
	}

	return ProfileSettingsResult{User: user, Preferences: preferences}, nil
}

func (s Service) UpdateProfile(ctx context.Context, cmd UpdateProfileCommand) (ports.AdminUserRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	email, err := normalizeEmail(cmd.Email)
	if err != nil {
		return ports.AdminUserRecord{}, errors.Join(authdomain.ErrInvalidInput, err)
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	user, err := s.users.UpdateAdminProfile(ctx, ports.UpdateAdminProfileInput{
		UserID:      cmd.ActorUserID,
		Email:       email,
		DisplayName: displayName,
	})
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   user.Role,
		Action:      "Updated profile",
		TargetType:  "admin_user",
		TargetID:    user.UserID.String(),
		TargetLabel: user.Email,
		Summary:     "Operator updated their admin profile.",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"display_name": user.DisplayName,
			"email":        user.Email,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (s Service) UpdatePreferences(
	ctx context.Context,
	cmd UpdatePreferencesCommand,
) (ports.AdminPreferencesRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPreferencesRecord{}, authdomain.ErrInvalidInput
	}
	if !cmd.ActorRole.Valid() {
		return ports.AdminPreferencesRecord{}, authdomain.ErrInvalidInput
	}

	normalized, err := normalizePreferences(cmd)
	if err != nil {
		return ports.AdminPreferencesRecord{}, err
	}

	preferences, err := s.users.UpdateAdminPreferences(ctx, normalized)
	if err != nil {
		return ports.AdminPreferencesRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated notification preferences",
		TargetType:  "admin_preferences",
		TargetID:    cmd.ActorUserID.String(),
		TargetLabel: preferences.Timezone,
		Summary:     "Operator updated their notification preferences.",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"timezone":          preferences.Timezone,
			"daily_digest_time": preferences.DailyDigestTime,
			"notify_email":      boolString(preferences.NotifyEmail),
			"notify_sms":        boolString(preferences.NotifySMS),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPreferencesRecord{}, err
	}

	return preferences, nil
}

const brandingUploadFolder = "xtiitch/branding"

// SignBrandingUpload returns a signed Cloudinary payload for a direct browser
// upload of the platform brand logo. Gated by manage_settings so only owners
// can rebrand the platform.
func (s Service) SignBrandingUpload(
	ctx context.Context,
	cmd SignBrandingUploadCommand,
) (ports.SignedUpload, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.SignedUpload{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSettings); err != nil {
		return ports.SignedUpload{}, err
	}
	if s.media == nil {
		return ports.SignedUpload{}, authdomain.ErrInvalidInput
	}
	return s.media.SignUpload(ctx, common.TenantScope{}, brandingUploadFolder)
}

func (s Service) ListRolePermissions(ctx context.Context) ([]ports.AdminRolePermissionsRecord, error) {
	records, err := s.users.ListAdminRolePermissions(ctx)
	if err != nil {
		return nil, err
	}

	return normalizeRolePermissionRecords(records)
}

func (s Service) UpdateRolePermissions(
	ctx context.Context,
	cmd UpdateRolePermissionsCommand,
) (ports.AdminRolePermissionsRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminRolePermissionsRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRoles); err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}
	if !cmd.Role.Valid() {
		return ports.AdminRolePermissionsRecord{}, authdomain.ErrInvalidInput
	}

	permissions, err := normalizePermissionSet(cmd.Role, cmd.Permissions)
	if err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}

	record, err := s.users.ReplaceAdminRolePermissions(ctx, ports.UpdateAdminRolePermissionsInput{
		Role:        cmd.Role,
		Permissions: permissions,
	})
	if err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated role permissions",
		TargetType:  "admin_role",
		TargetID:    string(record.Role),
		TargetLabel: string(record.Role),
		Summary:     "Operator changed admin role permission grants.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"permissions": permissionsString(record.Permissions),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminRolePermissionsRecord{}, err
	}

	return record, nil
}

func (s Service) CreateUser(ctx context.Context, cmd CreateUserCommand) (ports.AdminUserRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAdminUsers); err != nil {
		return ports.AdminUserRecord{}, err
	}

	normalized, err := normalizeUserCreation(cmd)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	passwordHash, err := s.passwords.Hash(normalized.Password)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	user, err := s.users.CreateAdminUser(ctx, ports.CreateAdminUserInput{
		UserID:       s.ids.NewID(),
		Email:        normalized.Email,
		DisplayName:  normalized.DisplayName,
		PasswordHash: passwordHash,
		Role:         normalized.Role,
	})
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created admin user",
		TargetType:  "admin_user",
		TargetID:    user.UserID.String(),
		TargetLabel: user.Email,
		Summary:     "Operator created a new admin user.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"role":         string(user.Role),
			"display_name": user.DisplayName,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}

func (s Service) UpdateUser(ctx context.Context, cmd UpdateUserCommand) (ports.AdminUserRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAdminUsers); err != nil {
		return ports.AdminUserRecord{}, err
	}
	if cmd.UserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	displayName := strings.TrimSpace(cmd.DisplayName)
	if displayName == "" || !cmd.Role.Valid() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}

	if cmd.UserID == cmd.ActorUserID && (!cmd.IsActive || cmd.Role != admindomain.RoleOwner) {
		return ports.AdminUserRecord{}, authdomain.ErrForbidden
	}

	user, err := s.users.UpdateAdminUser(ctx, ports.UpdateAdminUserInput{
		UserID:      cmd.UserID,
		DisplayName: displayName,
		Role:        cmd.Role,
		IsActive:    cmd.IsActive,
	})
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated admin user",
		TargetType:  "admin_user",
		TargetID:    user.UserID.String(),
		TargetLabel: user.Email,
		Summary:     "Operator updated an admin user account.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"role":         string(user.Role),
			"display_name": user.DisplayName,
			"is_active":    boolString(user.IsActive),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminUserRecord{}, err
	}

	return user, nil
}
