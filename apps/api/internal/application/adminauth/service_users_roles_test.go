package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestListUsersRequiresOwner(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{
		users: []ports.AdminUserRecord{{UserID: "admin-1", Email: "owner@xtiitch.com", Role: admindomain.RoleOwner, IsActive: true}},
	}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	result, err := service.ListUsers(context.Background(), ListUsersCommand{ActorRole: admindomain.RoleOwner})
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	if len(result) != 1 || !users.listCalled {
		t.Fatalf("expected owner to list users, got result=%+v listCalled=%v", result, users.listCalled)
	}

	_, err = service.ListUsers(context.Background(), ListUsersCommand{ActorRole: admindomain.RoleOperator})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected operator to be forbidden, got %v", err)
	}
}

func TestProfileSettingsLoadsActiveAdminAndPreferences(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)
	users := &fakeAdminUsers{
		record: ports.AdminUserRecord{
			UserID:      "admin-1",
			Email:       "owner@xtiitch.com",
			DisplayName: "Owner",
			Role:        admindomain.RoleOwner,
			IsActive:    true,
		},
		preferences: ports.AdminPreferencesRecord{
			UserID:          "admin-1",
			Timezone:        "Africa/Accra",
			NotifyEmail:     true,
			DailyDigestTime: "08:00",
			UpdatedAt:       now,
		},
	}
	service := newTestService(users, &fakeAdminSessions{}, now, []common.ID{"unused"})

	result, err := service.GetProfileSettings(context.Background(), "admin-1")
	if err != nil {
		t.Fatalf("profile settings: %v", err)
	}
	if result.User.Email != "owner@xtiitch.com" || result.Preferences.UserID != "admin-1" {
		t.Fatalf("unexpected profile settings: %+v", result)
	}
	if users.preferencesUserID != "admin-1" {
		t.Fatalf("expected preferences lookup for admin-1, got %q", users.preferencesUserID)
	}
}

func TestUpdateProfileNormalizesSelfProfile(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	user, err := service.UpdateProfile(context.Background(), UpdateProfileCommand{
		ActorUserID: "admin-1",
		DisplayName: "  Operations Owner  ",
		Email:       "OWNER@xtiitch.com",
	})
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if users.updatedProfile.UserID != "admin-1" ||
		users.updatedProfile.DisplayName != "Operations Owner" ||
		users.updatedProfile.Email != "owner@xtiitch.com" {
		t.Fatalf("expected normalized profile update, got %+v", users.updatedProfile)
	}
	if user.Email != "owner@xtiitch.com" || user.DisplayName != "Operations Owner" {
		t.Fatalf("unexpected updated profile response: %+v", user)
	}

	_, err = service.UpdateProfile(context.Background(), UpdateProfileCommand{
		ActorUserID: "admin-1",
		DisplayName: "",
		Email:       "owner@xtiitch.com",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid display name, got %v", err)
	}
}

func TestUpdatePreferencesNormalizesAndValidatesInput(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	preferences, err := service.UpdatePreferences(context.Background(), UpdatePreferencesCommand{
		ActorUserID:        "admin-1",
		ActorRole:          admindomain.RoleOwner,
		Timezone:           "  Africa/Accra  ",
		PhoneNumber:        "  +233501234567  ",
		NotifyEmail:        true,
		NotifySMS:          true,
		AlertVerifications: true,
		AlertMoneyRails:    true,
		AlertRisk:          true,
		AlertSupport:       false,
		DailyDigestTime:    "",
	})
	if err != nil {
		t.Fatalf("update preferences: %v", err)
	}
	if users.updatedPreferences.UserID != "admin-1" ||
		users.updatedPreferences.Timezone != "Africa/Accra" ||
		users.updatedPreferences.PhoneNumber != "+233501234567" ||
		users.updatedPreferences.DailyDigestTime != "08:00" {
		t.Fatalf("expected normalized preferences, got %+v", users.updatedPreferences)
	}
	if !preferences.NotifySMS || preferences.AlertSupport {
		t.Fatalf("unexpected preferences response: %+v", preferences)
	}

	_, err = service.UpdatePreferences(context.Background(), UpdatePreferencesCommand{
		ActorUserID:     "admin-1",
		ActorRole:       admindomain.RoleOwner,
		DailyDigestTime: "25:30",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid digest time, got %v", err)
	}
}

func TestUpdateRolePermissionsRequiresManageRolesAndNormalizes(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	record, err := service.UpdateRolePermissions(context.Background(), UpdateRolePermissionsCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		Role:        admindomain.RoleOperator,
		Permissions: []admindomain.Permission{
			admindomain.PermissionViewAudit,
			admindomain.PermissionManageSupport,
			admindomain.PermissionViewAudit,
		},
	})
	if err != nil {
		t.Fatalf("update role permissions: %v", err)
	}
	expected := []admindomain.Permission{
		admindomain.PermissionManageSupport,
		admindomain.PermissionViewAudit,
	}
	if users.updatedRolePermissions.Role != admindomain.RoleOperator {
		t.Fatalf("expected operator update, got %+v", users.updatedRolePermissions)
	}
	if !samePermissions(users.updatedRolePermissions.Permissions, expected) {
		t.Fatalf("expected normalized permissions %v, got %v", expected, users.updatedRolePermissions.Permissions)
	}
	if !samePermissions(record.Permissions, expected) {
		t.Fatalf("unexpected role response: %+v", record)
	}

	_, err = service.UpdateRolePermissions(context.Background(), UpdateRolePermissionsCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		Role:        admindomain.RoleOperator,
		Permissions: expected,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateRolePermissionsProtectsOwnerRecoveryGrants(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	_, err := service.UpdateRolePermissions(context.Background(), UpdateRolePermissionsCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		Role:        admindomain.RoleOwner,
		Permissions: []admindomain.Permission{
			admindomain.PermissionManageRoles,
			admindomain.PermissionViewAudit,
		},
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected missing owner recovery grant to be invalid, got %v", err)
	}
	if users.updatedRolePermissions.Role != "" {
		t.Fatalf("expected no role update, got %+v", users.updatedRolePermissions)
	}
}

func TestCreateUserNormalizesAndHashesInput(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"admin-2", "audit-1"})

	user, err := service.CreateUser(context.Background(), CreateUserCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		DisplayName: "  Support Lead  ",
		Email:       "SUPPORT@xtiitch.com",
		Password:    "AdminPass123!",
		Role:        admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	if users.created.UserID != "admin-2" || users.created.Email != "support@xtiitch.com" {
		t.Fatalf("expected generated normalized user, got %+v", users.created)
	}
	if users.created.DisplayName != "Support Lead" || users.created.PasswordHash != "hashed:AdminPass123!" {
		t.Fatalf("expected normalized display and hash, got %+v", users.created)
	}
	if user.UserID != "admin-2" || user.Role != admindomain.RoleSupport {
		t.Fatalf("unexpected created user response: %+v", user)
	}
}

func TestCreateUserRejectsInvalidRoleAndWeakPassword(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"admin-2"})

	_, err := service.CreateUser(context.Background(), CreateUserCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		DisplayName: "Bad Role",
		Email:       "bad@xtiitch.com",
		Password:    "short",
		Role:        admindomain.Role("bad"),
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	if users.created.UserID != "" {
		t.Fatalf("expected no user to be created, got %+v", users.created)
	}
}

func TestUpdateUserProtectsOwnerFromSelfDemotion(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	_, err := service.UpdateUser(context.Background(), UpdateUserCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		UserID:      "owner-1",
		DisplayName: "Owner",
		Role:        admindomain.RoleOperator,
		IsActive:    true,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected self-demotion to be forbidden, got %v", err)
	}

	user, err := service.UpdateUser(context.Background(), UpdateUserCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		UserID:      "admin-2",
		DisplayName: "  Ops Lead  ",
		Role:        admindomain.RoleOperator,
		IsActive:    false,
	})
	if err != nil {
		t.Fatalf("update user: %v", err)
	}
	if users.updated.UserID != "admin-2" || users.updated.DisplayName != "Ops Lead" || users.updated.IsActive {
		t.Fatalf("expected normalized inactive update, got %+v", users.updated)
	}
	if user.UserID != "admin-2" || user.Role != admindomain.RoleOperator || user.IsActive {
		t.Fatalf("unexpected updated user response: %+v", user)
	}
}

func TestCreateUserWritesAuditEvent(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service, audits := newTestServiceWithAudits(users, &fakeAdminSessions{}, time.Now(), []common.ID{"admin-2", "audit-1"})

	_, err := service.CreateUser(context.Background(), CreateUserCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		DisplayName: "Support Lead",
		Email:       "support@xtiitch.com",
		Password:    "AdminPass123!",
		Role:        admindomain.RoleSupport,
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.AuditEventID != "audit-1" ||
		event.ActorUserID != "owner-1" ||
		event.Action != "Created admin user" ||
		event.TargetID != "admin-2" ||
		event.Severity != admindomain.AuditSeverityWarning {
		t.Fatalf("unexpected audit event: %+v", event)
	}
	if event.Metadata["role"] != string(admindomain.RoleSupport) {
		t.Fatalf("expected role metadata, got %+v", event.Metadata)
	}
}

func TestListAuditEventsRequiresViewAudit(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{
		rolePermissions: []ports.AdminRolePermissionsRecord{
			{
				Role:        admindomain.RoleOwner,
				Permissions: admindomain.RoleOwner.Permissions(),
			},
			{
				Role:        admindomain.RoleOperator,
				Permissions: admindomain.RoleOperator.Permissions(),
			},
			{
				Role:        admindomain.RoleSupport,
				Permissions: []admindomain.Permission{admindomain.PermissionManageSupport},
			},
		},
	}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	_, err := service.ListAuditEvents(context.Background(), ListAuditEventsCommand{ActorRole: admindomain.RoleSupport})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support without view audit to be forbidden, got %v", err)
	}
}

func samePermissions(left []admindomain.Permission, right []admindomain.Permission) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
