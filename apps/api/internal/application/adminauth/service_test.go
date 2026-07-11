package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

func TestBootstrapAdminNormalizesAndHashesUser(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"admin-1"})

	user, err := service.BootstrapAdmin(context.Background(), BootstrapAdminCommand{
		Email:       "OWNER@xtiitch.com",
		DisplayName: "  Xtiitch Owner  ",
		Password:    "AdminPass123!",
		Role:        admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("bootstrap admin: %v", err)
	}
	if users.bootstrapped.Email != "owner@xtiitch.com" || users.bootstrapped.DisplayName != "Xtiitch Owner" {
		t.Fatalf("expected normalized bootstrap user, got %+v", users.bootstrapped)
	}
	if users.bootstrapped.PasswordHash != "hashed:AdminPass123!" {
		t.Fatalf("expected password hash, got %q", users.bootstrapped.PasswordHash)
	}
	if user.UserID != "admin-1" || user.Role != admindomain.RoleOwner {
		t.Fatalf("unexpected bootstrap user response: %+v", user)
	}
}

func TestLoginIssuesAdminSessionForValidCredentials(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)
	users := &fakeAdminUsers{
		credentials: ports.AdminUserCredentials{
			UserID:       "admin-1",
			Email:        "owner@xtiitch.com",
			DisplayName:  "Owner",
			PasswordHash: "hashed:AdminPass123!",
			Role:         admindomain.RoleOwner,
			IsActive:     true,
		},
	}
	sessions := &fakeAdminSessions{}
	service := newTestService(users, sessions, now, []common.ID{"session-1", "audit-1"})

	result, err := service.Login(context.Background(), LoginCommand{
		Email:     "OWNER@xtiitch.com",
		Password:  "AdminPass123!",
		UserAgent: "test-agent",
		IPAddress: "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("login admin: %v", err)
	}
	if users.lookupEmail != "owner@xtiitch.com" || users.loginUserID != "admin-1" {
		t.Fatalf("expected lookup and login recording, got email=%q login=%q", users.lookupEmail, users.loginUserID)
	}
	if result.AccessToken != "admin-access:admin-1:owner" || result.RefreshToken != "refresh-token" {
		t.Fatalf("unexpected auth tokens: %+v", result)
	}
	if sessions.created.AdminUserID != "admin-1" || sessions.created.RefreshTokenHash != "hash:refresh-token" {
		t.Fatalf("expected persisted admin session, got %+v", sessions.created)
	}
}

func TestLoginEqualizesTimingForUnknownAdmin(t *testing.T) {
	t.Parallel()

	hasher := &countingPasswordHasher{}
	users := &fakeAdminUsers{findErr: errors.New("not found")}
	service := Service{
		users:         users,
		sessions:      &fakeAdminSessions{},
		passwords:     hasher,
		accessTokens:  fakeAdminTokenIssuer{},
		refreshTokens: fakeRefreshTokens{},
		ids:           &sequenceIDs{ids: []common.ID{"session-1"}},
		clock:         fixedClock{now: time.Now()},
	}

	_, err := service.Login(context.Background(), LoginCommand{
		Email:    "missing@xtiitch.com",
		Password: "AdminPass123!",
	})
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if hasher.hashCalls != 1 {
		t.Fatalf("expected one equalising hash call, got %d", hasher.hashCalls)
	}
}

func TestRefreshRotatesAdminSession(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)
	session := ports.AdminSessionWithUser{
		SessionID:    "session-1",
		AdminUserID:  "admin-1",
		Email:        "owner@xtiitch.com",
		DisplayName:  "Owner",
		Role:         admindomain.RoleOwner,
		UserIsActive: true,
		ExpiresAt:    now.Add(time.Hour),
	}
	sessions := &fakeAdminSessions{session: session}
	service := newTestService(&fakeAdminUsers{}, sessions, now, []common.ID{"session-2"})

	result, err := service.Refresh(context.Background(), RefreshCommand{RefreshToken: "old-refresh"})
	if err != nil {
		t.Fatalf("refresh admin session: %v", err)
	}
	if result.AdminUserID != "admin-1" || result.RefreshToken == "" {
		t.Fatalf("unexpected refresh result: %+v", result)
	}
	if len(sessions.revoked) != 1 || sessions.revoked[0] != "session-1" {
		t.Fatalf("expected old session revoked, got %v", sessions.revoked)
	}
	if sessions.created.SessionID != "session-2" {
		t.Fatalf("expected rotated session id, got %+v", sessions.created)
	}
}

func TestMeRejectsInactiveAdmin(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{
		record: ports.AdminUserRecord{UserID: "admin-1", IsActive: false},
	}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	_, err := service.Me(context.Background(), "admin-1")
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected inactive admin to be rejected, got %v", err)
	}
}

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

func TestUpdatePlatformSettingsRequiresManageSettings(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	settings, err := service.UpdatePlatformSettings(context.Background(), UpdatePlatformSettingsCommand{
		ActorUserID:                  "owner-1",
		ActorRole:                    admindomain.RoleOwner,
		PlatformName:                 "  Xtiitch Console  ",
		SupportEmail:                 "SUPPORT@xtiitch.com",
		VerificationSLAHours:         36,
		PayoutReviewThresholdPesewas: 750000,
		MaintenanceMode:              true,
	})
	if err != nil {
		t.Fatalf("update platform settings: %v", err)
	}
	if users.updatedPlatformSettings.PlatformName != "Xtiitch Console" ||
		users.updatedPlatformSettings.SupportEmail != "support@xtiitch.com" ||
		users.updatedPlatformSettings.VerificationSLAHours != 36 ||
		users.updatedPlatformSettings.PayoutReviewThresholdPesewas != 750000 ||
		!users.updatedPlatformSettings.MaintenanceMode {
		t.Fatalf("expected normalized platform settings, got %+v", users.updatedPlatformSettings)
	}
	if settings.SupportEmail != "support@xtiitch.com" || !settings.MaintenanceMode {
		t.Fatalf("unexpected platform settings response: %+v", settings)
	}

	_, err = service.UpdatePlatformSettings(context.Background(), UpdatePlatformSettingsCommand{
		ActorUserID:                  "support-1",
		ActorRole:                    admindomain.RoleSupport,
		PlatformName:                 "Xtiitch",
		SupportEmail:                 "support@xtiitch.com",
		VerificationSLAHours:         24,
		PayoutReviewThresholdPesewas: 500000,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateMarketingFlagsPartialUpdateAndPermission(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	enabled := true
	settings, err := service.UpdateMarketingFlags(context.Background(), UpdateMarketingFlagsCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		Pricing:     &enabled,
	})
	if err != nil {
		t.Fatalf("update marketing flags: %v", err)
	}
	// Only Pricing was provided; the other three pointers must stay nil so the repo
	// leaves them unchanged.
	if users.updatedMarketingFlags.Pricing == nil || !*users.updatedMarketingFlags.Pricing {
		t.Fatalf("expected pricing flag set true, got %+v", users.updatedMarketingFlags)
	}
	if users.updatedMarketingFlags.BrowseStore != nil ||
		users.updatedMarketingFlags.Discover != nil ||
		users.updatedMarketingFlags.CreateStore != nil {
		t.Fatalf("expected untouched flags to remain nil, got %+v", users.updatedMarketingFlags)
	}
	if !settings.MarketingFlags.Pricing {
		t.Fatalf("expected response to reflect pricing=true, got %+v", settings.MarketingFlags)
	}

	// Empty body (no flags) is rejected.
	if _, err := service.UpdateMarketingFlags(context.Background(), UpdateMarketingFlagsCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
	}); !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for empty update, got %v", err)
	}

	// Support role lacks manage_settings.
	if _, err := service.UpdateMarketingFlags(context.Background(), UpdateMarketingFlagsCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		Pricing:     &enabled,
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
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

func TestListBusinessVerificationsRequiresReviewPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		cases: []ports.AdminVerificationCaseRecord{
			{BusinessID: "business-1", BusinessName: "Ama Stitches"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	result, err := service.ListBusinessVerifications(
		context.Background(),
		ListBusinessVerificationsCommand{ActorRole: admindomain.RoleOperator},
	)
	if err != nil {
		t.Fatalf("list business verifications: %v", err)
	}
	if len(result) != 1 || !businesses.listCalled {
		t.Fatalf("expected operator to list verification cases, got result=%+v listCalled=%v", result, businesses.listCalled)
	}

	_, err = service.ListBusinessVerifications(
		context.Background(),
		ListBusinessVerificationsCommand{ActorRole: admindomain.RoleSupport},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestListCustomersRequiresReviewPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		customers: []ports.AdminCustomerRecord{
			{CustomerID: "customer-1", DisplayName: "Ama Customer"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	result, err := service.ListCustomers(
		context.Background(),
		ListCustomersCommand{ActorRole: admindomain.RoleOperator},
	)
	if err != nil {
		t.Fatalf("list customers: %v", err)
	}
	if len(result) != 1 || !businesses.customersListed {
		t.Fatalf("expected operator to list customers, got result=%+v listed=%v", result, businesses.customersListed)
	}

	_, err = service.ListCustomers(
		context.Background(),
		ListCustomersCommand{ActorRole: admindomain.RoleSupport},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestDecideBusinessVerificationUpdatesStatusAndWritesAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.DecideBusinessVerification(context.Background(), DecideBusinessVerificationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Decision:    BusinessVerificationDecisionApproved,
		Note:        "  owner and settlement account match  ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("decide business verification: %v", err)
	}
	if businesses.decided.BusinessID != "business-1" ||
		businesses.decided.Status != business.VerificationStatusVerified {
		t.Fatalf("expected approved status update, got %+v", businesses.decided)
	}
	if record.BusinessID != "business-1" || record.VerificationStatus != business.VerificationStatusVerified {
		t.Fatalf("unexpected decision result: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Approved business verification" ||
		event.TargetID != "business-1" ||
		event.Severity != admindomain.AuditSeverityInfo ||
		event.Metadata["operator_note"] != "owner and settlement account match" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.DecideBusinessVerification(context.Background(), DecideBusinessVerificationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Decision:    BusinessVerificationDecision("bad"),
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid decision to be rejected, got %v", err)
	}
}

func TestUpdateBusinessStatusSuspendsAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateBusinessStatus(context.Background(), UpdateBusinessStatusCommand{
		ActorUserID:       "operator-1",
		ActorRole:         admindomain.RoleOperator,
		BusinessID:        "business-1",
		OperationalStatus: business.OperationalStatusSuspended,
		Reason:            " chargeback pattern under review ",
		UserAgent:         "test-agent",
		IPAddress:         "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update business status: %v", err)
	}
	if businesses.statusUpdate.BusinessID != "business-1" ||
		businesses.statusUpdate.OperationalStatus != business.OperationalStatusSuspended ||
		businesses.statusUpdate.SuspensionReason != "chargeback pattern under review" ||
		businesses.statusUpdate.SuspendedByAdminUser != "operator-1" {
		t.Fatalf("expected normalized suspension update, got %+v", businesses.statusUpdate)
	}
	if record.BusinessID != "business-1" || record.OperationalStatus != business.OperationalStatusSuspended {
		t.Fatalf("unexpected status response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Suspended business" ||
		event.TargetID != "business-1" ||
		event.Severity != admindomain.AuditSeverityCritical ||
		event.Metadata["reason"] != "chargeback pattern under review" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.UpdateBusinessStatus(context.Background(), UpdateBusinessStatusCommand{
		ActorUserID:       "support-1",
		ActorRole:         admindomain.RoleSupport,
		BusinessID:        "business-1",
		OperationalStatus: business.OperationalStatusActive,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestGetPlatformMetricsRequiresReviewPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		metrics: ports.AdminPlatformMetricsRecord{
			GMVMonthMinor:        18420000,
			ActiveBusinesses:     12,
			PendingVerifications: 2,
			PaymentHealthBPS:     9910,
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	metrics, err := service.GetPlatformMetrics(context.Background(), GetPlatformMetricsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("get platform metrics: %v", err)
	}
	if metrics.GMVMonthMinor != 18420000 || metrics.PaymentHealthBPS != 9910 {
		t.Fatalf("unexpected platform metrics: %+v", metrics)
	}

	_, err = service.GetPlatformMetrics(context.Background(), GetPlatformMetricsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestGetMoneyRailsRequiresMoneyPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		moneyRails: ports.AdminMoneyRailsRecord{
			WebhookEvents: []ports.AdminMoneyWebhookEventRecord{
				{ID: "payment-1", ProviderReference: "xt_ref_1", Status: "verified"},
			},
			PayoutReviews: []ports.AdminMoneyPayoutReviewRecord{
				{ID: "business-1", BusinessName: "Ama Stitches", Status: "ready"},
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	moneyRails, err := service.GetMoneyRails(context.Background(), GetMoneyRailsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("get money rails: %v", err)
	}
	if len(moneyRails.WebhookEvents) != 1 || len(moneyRails.PayoutReviews) != 1 {
		t.Fatalf("unexpected money rails response: %+v", moneyRails)
	}

	_, err = service.GetMoneyRails(context.Background(), GetMoneyRailsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestListSubscriptionsRequiresSubscriptionPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{SubscriptionID: "subscription-1", BusinessID: "business-1", BusinessName: "Ama Stitches"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	subscriptions, err := service.ListSubscriptions(context.Background(), ListSubscriptionsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list subscriptions: %v", err)
	}
	if len(subscriptions) != 1 || subscriptions[0].BusinessID != "business-1" {
		t.Fatalf("unexpected subscriptions: %+v", subscriptions)
	}

	_, err = service.ListSubscriptions(context.Background(), ListSubscriptionsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateSubscriptionRequiresPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateSubscription(context.Background(), UpdateSubscriptionCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		BusinessID:              "business-1",
		Status:                  " grace_period ",
		BillingMode:             " recurring ",
		ProviderCustomerRef:     " CUS_123 ",
		ProviderSubscriptionRef: " SUB_123 ",
		Reason:                  " card failed twice ",
		UserAgent:               "test-agent",
		IPAddress:               "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update subscription: %v", err)
	}
	if businesses.subscriptionUpdate.Status != "grace_period" ||
		businesses.subscriptionUpdate.BillingMode != "recurring" ||
		businesses.subscriptionUpdate.ProviderCustomerRef != "CUS_123" ||
		businesses.subscriptionUpdate.ProviderSubscriptionRef != "SUB_123" ||
		businesses.subscriptionUpdate.Reason != "card failed twice" {
		t.Fatalf("expected normalized subscription update, got %+v", businesses.subscriptionUpdate)
	}
	if record.BusinessID != "business-1" || record.Status != "grace_period" {
		t.Fatalf("unexpected subscription response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Updated subscription" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["billing_mode"] != "recurring" ||
		audits.created[0].Metadata["provider_subscription_ref"] != "SUB_123" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.UpdateSubscription(context.Background(), UpdateSubscriptionCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Status:      "active",
		BillingMode: "recurring",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected recurring billing to require a subscription ref, got %v", err)
	}

	_, err = service.UpdateSubscription(context.Background(), UpdateSubscriptionCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
		Status:      "active",
		BillingMode: "manual",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestSubscriptionInvoicesRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(48 * time.Hour)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-created", "audit-issue", "audit-paid", "audit-failed"},
	)

	issued, err := service.IssueSubscriptionInvoice(context.Background(), IssueSubscriptionInvoiceCommand{
		ActorUserID:        "operator-1",
		ActorRole:          admindomain.RoleOperator,
		BusinessID:         "business-1",
		ProviderInvoiceRef: " ps-invoice-1 ",
		PaymentURL:         " https://paystack.com/pay/subscription ",
		DueAt:              &dueAt,
		Reason:             " monthly fee ",
		UserAgent:          "test-agent",
		IPAddress:          "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("issue subscription invoice: %v", err)
	}
	if businesses.issuedSubscriptionInvoice.BusinessID != "business-1" ||
		businesses.issuedSubscriptionInvoice.ProviderInvoiceRef != "ps-invoice-1" ||
		businesses.issuedSubscriptionInvoice.PaymentURL != "https://paystack.com/pay/subscription" ||
		!businesses.issuedSubscriptionInvoice.DueAt.Equal(dueAt) ||
		businesses.issuedSubscriptionInvoice.InvoiceRef == "" {
		t.Fatalf("expected normalized issue input, got %+v", businesses.issuedSubscriptionInvoice)
	}
	if issued.LastInvoiceRef != businesses.issuedSubscriptionInvoice.InvoiceRef {
		t.Fatalf("expected issued record to carry invoice ref, got %+v", issued)
	}

	paid, err := service.MarkSubscriptionInvoicePaid(context.Background(), MarkSubscriptionInvoicePaidCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		InvoiceID:   "invoice-created",
		Reason:      " paid via link ",
	})
	if err != nil {
		t.Fatalf("mark subscription invoice paid: %v", err)
	}
	if businesses.paidSubscriptionInvoice.InvoiceID != "invoice-created" ||
		businesses.paidSubscriptionInvoice.Reason != "paid via link" ||
		paid.Status != "active" {
		t.Fatalf("expected paid input and active response, got input=%+v record=%+v", businesses.paidSubscriptionInvoice, paid)
	}

	failed, err := service.MarkSubscriptionInvoiceFailed(context.Background(), MarkSubscriptionInvoiceFailedCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		InvoiceID:   "invoice-created",
		Reason:      " card failed ",
	})
	if err != nil {
		t.Fatalf("mark subscription invoice failed: %v", err)
	}
	if businesses.failedSubscriptionInvoice.InvoiceID != "invoice-created" ||
		businesses.failedSubscriptionInvoice.Reason != "card failed" ||
		failed.Status != "past_due" {
		t.Fatalf("expected failed input and past-due response, got input=%+v record=%+v", businesses.failedSubscriptionInvoice, failed)
	}

	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Issued subscription invoice" ||
		audits.created[1].Action != "Marked subscription invoice paid" ||
		audits.created[2].Action != "Marked subscription invoice failed" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.IssueSubscriptionInvoice(context.Background(), IssueSubscriptionInvoiceCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestRunSubscriptionBillingSweepRequiresPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	businesses := &fakeAdminBusinesses{
		sweepResult: ports.AdminSubscriptionBillingSweepRecord{
			OverdueInvoicesFailed: 2,
			SubscriptionsCanceled: 1,
			BusinessesTouched:     2,
			RanAt:                 now,
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-sweep"},
	)

	record, err := service.RunSubscriptionBillingSweep(context.Background(), RunSubscriptionBillingSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		Reason:      " retry overdue links ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("run billing sweep: %v", err)
	}
	if businesses.sweepInput.ActorAdminUser != "operator-1" ||
		businesses.sweepInput.Reason != "retry overdue links" {
		t.Fatalf("expected normalized sweep input, got %+v", businesses.sweepInput)
	}
	if record.OverdueInvoicesFailed != 2 ||
		record.SubscriptionsCanceled != 1 ||
		record.BusinessesTouched != 2 {
		t.Fatalf("unexpected sweep record: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Ran subscription billing sweep" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["overdue_invoices_failed"] != "2" ||
		audits.created[0].Metadata["subscriptions_canceled"] != "1" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.RunSubscriptionBillingSweep(context.Background(), RunSubscriptionBillingSweepCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestRunSubscriptionRecurringSweepChargesDueSubscriptionsAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	futureBilling := now.Add(time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				OwnerEmail:              "owner@example.com",
				MonthlyFeeMinor:         12000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				NextBillingAt:           &dueAt,
			},
			{
				SubscriptionID:  "subscription-2",
				BusinessID:      "business-2",
				BusinessName:    "Missing Auth",
				OwnerEmail:      "",
				MonthlyFeeMinor: 12000,
				Status:          "active",
				BillingMode:     "recurring",
				NextBillingAt:   &dueAt,
			},
			{
				SubscriptionID:          "subscription-3",
				BusinessID:              "business-3",
				BusinessName:            "Future Charge",
				OwnerEmail:              "future@example.com",
				MonthlyFeeMinor:         12000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_456",
				NextBillingAt:           &futureBilling,
			},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-recurring", "audit-recurring"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		Reason:      " collect recurring package fees ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	if record.DueSubscriptions != 2 ||
		record.ChargesAttempted != 1 ||
		record.ChargesPaid != 1 ||
		record.ChargesSkipped != 1 ||
		record.ChargesFailed != 0 ||
		record.ChargesPending != 0 {
		t.Fatalf("unexpected recurring sweep record: %+v", record)
	}
	if len(provider.charged) != 1 ||
		provider.charged[0].AuthorizationCode != "AUTH_123" ||
		provider.charged[0].CustomerEmail != "owner@example.com" ||
		provider.charged[0].AmountMinor != 12000 ||
		provider.charged[0].Reference != businesses.issuedSubscriptionInvoice.InvoiceRef {
		t.Fatalf("unexpected recurring charge input: %+v", provider.charged)
	}
	// A monthly (default cadence) subscription stays on the monthly fee and a
	// one-month period.
	if businesses.issuedSubscriptionInvoice.BusinessID != "business-1" ||
		!businesses.issuedSubscriptionInvoice.DueAt.Equal(now.Add(72*time.Hour)) ||
		businesses.issuedSubscriptionInvoice.AmountMinor != 12000 ||
		businesses.issuedSubscriptionInvoice.PeriodMonths != 1 ||
		businesses.paidSubscriptionInvoice.InvoiceID != "invoice-recurring" {
		t.Fatalf("expected issued and paid invoice inputs, got issue=%+v paid=%+v",
			businesses.issuedSubscriptionInvoice, businesses.paidSubscriptionInvoice)
	}
	if len(audits.created) != 1 ||
		audits.created[0].Action != "Ran subscription recurring charge sweep" ||
		audits.created[0].Metadata["charges_paid"] != "1" ||
		audits.created[0].Metadata["charges_skipped"] != "1" {
		t.Fatalf("unexpected audit event: %+v", audits.created)
	}

	_, err = service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestRunSubscriptionRecurringSweepMarksProviderFailure(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				OwnerEmail:              "owner@example.com",
				MonthlyFeeMinor:         12000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-recurring", "audit-recurring"},
	)
	service.payments = &fakePaymentProvider{
		chargeResult: ports.ChargeAuthorizationResult{Status: "failed"},
	}

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	if record.ChargesAttempted != 1 || record.ChargesFailed != 1 || record.ChargesPaid != 0 {
		t.Fatalf("unexpected recurring failure record: %+v", record)
	}
	if businesses.failedSubscriptionInvoice.InvoiceID != "invoice-recurring" ||
		businesses.failedSubscriptionInvoice.Reason != "Paystack recurring charge returned failed." {
		t.Fatalf("expected failed invoice input, got %+v", businesses.failedSubscriptionInvoice)
	}
}

func TestRunSubscriptionRecurringSweepBillsCadenceRenewalFigure(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Quarterly Threads",
				OwnerEmail:              "owner@example.com",
				MonthlyFeeMinor:         9900, // display basis only; must not be charged
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   29700,
				YearlyRenewalMinor:      118800,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_Q",
				NextBillingAt:           &dueAt,
			},
			{
				// Quarterly with a zero renewal figure (e.g. a free plan): the
				// cadence renewal guard must skip it entirely, just like the
				// legacy monthly_fee<=0 skip.
				SubscriptionID:          "subscription-2",
				BusinessID:              "business-2",
				BusinessName:            "Free Cadence",
				OwnerEmail:              "free@example.com",
				MonthlyFeeMinor:         9900,
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   0,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_FREE",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-recurring", "audit-recurring"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	// Only the funded quarterly subscription is due; the zero-renewal one is
	// skipped by the guard before it counts as due.
	if record.DueSubscriptions != 1 || record.ChargesAttempted != 1 || record.ChargesPaid != 1 {
		t.Fatalf("unexpected quarterly sweep record: %+v", record)
	}
	// The charge bills the quarterly RENEWAL figure, not the monthly fee.
	if len(provider.charged) != 1 ||
		provider.charged[0].AuthorizationCode != "AUTH_Q" ||
		provider.charged[0].AmountMinor != 29700 {
		t.Fatalf("expected a single 29700 quarterly charge, got %+v", provider.charged)
	}
	// The invoice records the same renewal amount and advances the period by 3
	// months (the cadence length), not 1.
	if businesses.issuedSubscriptionInvoice.BusinessID != "business-1" ||
		businesses.issuedSubscriptionInvoice.AmountMinor != 29700 ||
		businesses.issuedSubscriptionInvoice.PeriodMonths != 3 {
		t.Fatalf("expected quarterly renewal invoice (29700, 3 months), got %+v",
			businesses.issuedSubscriptionInvoice)
	}
}

func TestRunSubscriptionRecurringSweepEnqueuesUpcomingReminderOnce(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	// Renewal is two days out — inside the three-day lead window but not yet due,
	// so the sweep enqueues an "upcoming renewal" reminder and attempts no charge.
	upcoming := now.Add(2 * 24 * time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				PlanName:                "Growth",
				OwnerEmail:              "owner@example.com",
				OwnerWhatsApp:           "233555000111",
				MonthlyFeeMinor:         12000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				ProviderChannel:         "card",
				NextBillingAt:           &upcoming,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1", "audit-2", "audit-3", "audit-4"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	first, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep (first): %v", err)
	}
	// Not due yet: no charge attempted, exactly one reminder enqueued.
	if first.DueSubscriptions != 0 || first.ChargesAttempted != 0 || first.RemindersEnqueued != 1 {
		t.Fatalf("unexpected first sweep record: %+v", first)
	}
	if len(provider.charged) != 0 {
		t.Fatalf("expected no charge for an upcoming (not-yet-due) renewal, got %+v", provider.charged)
	}
	if len(businesses.renewalReminders) != 1 {
		t.Fatalf("expected one reminder enqueue attempt, got %d", len(businesses.renewalReminders))
	}
	reminder := businesses.renewalReminders[0]
	if reminder.Kind != string(notification.KindSubscriptionRenewalUpcoming) ||
		reminder.Channel != string(notification.ChannelWhatsApp) ||
		reminder.Recipient != "233555000111" ||
		reminder.RenewalAmountMinor != 12000 ||
		reminder.RepayURL != defaultRenewalRepayURL ||
		!reminder.RenewalAt.Equal(upcoming) {
		t.Fatalf("unexpected upcoming reminder input: %+v", reminder)
	}

	second, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep (second): %v", err)
	}
	// The same (subscription, period, kind) reminder must not be enqueued twice.
	if second.RemindersEnqueued != 0 {
		t.Fatalf("expected the reminder to be de-duplicated on the second sweep, got %+v", second)
	}
	if len(businesses.renewalReminders) != 2 ||
		businesses.renewalReminders[1].DedupKey != reminder.DedupKey {
		t.Fatalf("expected the second attempt to reuse the same dedup key, got %+v", businesses.renewalReminders)
	}
}

func TestRunSubscriptionRecurringSweepEnqueuesRepayReminderOnCardFailure(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				PlanName:                "Growth",
				OwnerEmail:              "owner@example.com",
				OwnerWhatsApp:           "233555000222",
				MonthlyFeeMinor:         12000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				ProviderChannel:         "card",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-1", "audit-1", "audit-2"},
	)
	provider := &fakePaymentProvider{
		chargeResult: ports.ChargeAuthorizationResult{Status: "failed"},
	}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	// A card is still auto-charged; on failure a re-pay reminder is enqueued.
	if record.ChargesAttempted != 1 || record.ChargesFailed != 1 || record.RemindersEnqueued != 1 {
		t.Fatalf("unexpected card-failure sweep record: %+v", record)
	}
	if len(provider.charged) != 1 {
		t.Fatalf("expected the card to be charged once, got %+v", provider.charged)
	}
	if len(businesses.renewalReminders) != 1 {
		t.Fatalf("expected one re-pay reminder, got %d", len(businesses.renewalReminders))
	}
	reminder := businesses.renewalReminders[0]
	if reminder.Kind != string(notification.KindSubscriptionRenewalPastDue) ||
		reminder.Recipient != "233555000222" ||
		reminder.RenewalAmountMinor != 12000 ||
		reminder.RepayURL != defaultRenewalRepayURL {
		t.Fatalf("unexpected re-pay reminder input: %+v", reminder)
	}
}

func TestRunSubscriptionRecurringSweepMoMoIsReminderDrivenNotCharged(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Kofi Kente",
				PlanName:                "Growth",
				OwnerEmail:              "owner@example.com",
				OwnerWhatsApp:           "233555000333",
				MonthlyFeeMinor:         12000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_MOMO",
				ProviderChannel:         "mobile_money",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1", "audit-2"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	// MoMo cannot be silently auto-debited: it is due and skipped for charging,
	// but a re-pay reminder is enqueued instead — never a failed-charge.
	if record.DueSubscriptions != 1 ||
		record.ChargesAttempted != 0 ||
		record.ChargesFailed != 0 ||
		record.ChargesSkipped != 1 ||
		record.RemindersEnqueued != 1 {
		t.Fatalf("unexpected MoMo sweep record: %+v", record)
	}
	if len(provider.charged) != 0 {
		t.Fatalf("MoMo must not be silently charged, got %+v", provider.charged)
	}
	if businesses.issuedSubscriptionInvoice.BusinessID != "" {
		t.Fatalf("MoMo must not issue a charge invoice, got %+v", businesses.issuedSubscriptionInvoice)
	}
	if len(businesses.renewalReminders) != 1 ||
		businesses.renewalReminders[0].Kind != string(notification.KindSubscriptionRenewalPastDue) ||
		businesses.renewalReminders[0].Recipient != "233555000333" {
		t.Fatalf("unexpected MoMo re-pay reminder: %+v", businesses.renewalReminders)
	}
}

func TestCadenceRenewalMinorAndCadenceMonths(t *testing.T) {
	t.Parallel()

	base := ports.AdminSubscriptionRecord{
		MonthlyFeeMinor:       9900,
		QuarterlyRenewalMinor: 29700,
		YearlyRenewalMinor:    118800,
	}
	cases := []struct {
		cadence    string
		wantAmount int64
		wantMonths int
	}{
		{"monthly", 9900, 1},
		{"", 9900, 1}, // legacy rows default to the monthly fee and one month
		{"quarterly", 29700, 3},
		{"yearly", 118800, 12},
	}
	for _, tc := range cases {
		sub := base
		sub.BillingCadence = tc.cadence
		if got := cadenceRenewalMinor(sub); got != tc.wantAmount {
			t.Errorf("cadenceRenewalMinor(%q) = %d, want %d", tc.cadence, got, tc.wantAmount)
		}
		if got := cadenceMonths(tc.cadence); got != tc.wantMonths {
			t.Errorf("cadenceMonths(%q) = %d, want %d", tc.cadence, got, tc.wantMonths)
		}
	}
}

func TestSubscriptionAuthorizationLifecycleRequiresPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	nextBilling := now.Add(30 * 24 * time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:     "subscription-1",
				BusinessID:         "business-1",
				BusinessName:       "Ama Stitches",
				Handle:             "ama-stitches",
				OwnerEmail:         "Owner <Owner@Example.COM>",
				PlanCode:           "growth",
				PlanName:           "Growth",
				MonthlyFeeMinor:    12000,
				Status:             "active",
				BillingMode:        "payment_link",
				NextBillingAt:      &nextBilling,
				CurrentPeriodStart: now,
				CurrentPeriodEnd:   nextBilling,
				UpdatedAt:          now,
			},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		// Init consumes an ID for the checkout reference then one for its audit;
		// verify consumes one for the paid invoice then one for its audit.
		[]common.ID{"ref-init", "audit-init", "invoice-1", "audit-verify"},
	)
	provider := &fakePaymentProvider{
		authorizationInitResult: ports.InitializeAuthorizationResult{
			RedirectURL: "https://paystack.test/authorize/ref_123",
			AccessCode:  "access_123",
			Reference:   "ref_123",
		},
		authorizationVerifyResult: ports.VerifyAuthorizationResult{
			Succeeded:         true,
			AmountMinor:       12000,
			AuthorizationCode: "AUTH_123",
			CustomerCode:      "CUS_123",
			CustomerEmail:     "owner@example.com",
			Channel:           "card",
			Bank:              "Test Bank",
			Active:            true,
		},
	}
	service.payments = provider

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		CallbackURL: " https://admin.xtiitch.com/admin?section=subscriptions ",
		Reason:      " start recurring collection ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("initialize subscription authorization: %v", err)
	}
	if provider.authorizationInitialized.BusinessID != "business-1" ||
		provider.authorizationInitialized.CustomerEmail != "owner@example.com" ||
		provider.authorizationInitialized.CallbackURL != "https://admin.xtiitch.com/admin?section=subscriptions" {
		t.Fatalf("expected normalized authorization init input, got %+v", provider.authorizationInitialized)
	}
	if link.RedirectURL != "https://paystack.test/authorize/ref_123" ||
		link.Reference != "ref_123" ||
		link.OwnerEmail != "owner@example.com" {
		t.Fatalf("unexpected authorization link result: %+v", link)
	}

	record, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Reference:   " ref_123 ",
		Reason:      " verified direct debit ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("verify subscription authorization: %v", err)
	}
	if provider.authorizationVerified.Reference != "ref_123" {
		t.Fatalf("expected trimmed verify reference, got %+v", provider.authorizationVerified)
	}
	if businesses.subscriptionUpdate.BillingMode != "recurring" ||
		businesses.subscriptionUpdate.ProviderCustomerRef != "CUS_123" ||
		businesses.subscriptionUpdate.ProviderSubscriptionRef != "AUTH_123" ||
		businesses.subscriptionUpdate.Reason != "verified direct debit" {
		t.Fatalf("expected recurring subscription update, got %+v", businesses.subscriptionUpdate)
	}
	if record.BusinessID != "business-1" || record.BillingMode != "recurring" {
		t.Fatalf("unexpected verified subscription record: %+v", record)
	}
	if len(audits.created) != 2 ||
		audits.created[0].Action != "Initialized subscription authorization" ||
		audits.created[0].Metadata["reference"] != "ref_123" ||
		audits.created[1].Action != "Verified subscription authorization" ||
		audits.created[1].Metadata["provider_authorization"] != "AUTH_123" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestPlanPackagesRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-create", "audit-update", "audit-archive"},
	)

	plans, err := service.ListPlans(context.Background(), ListPlansCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list plans: %v", err)
	}
	if len(plans) != 1 || plans[0].Code != "growth" {
		t.Fatalf("unexpected plans: %+v", plans)
	}

	designLimit := 25
	created, err := service.CreatePlan(context.Background(), CreatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		Code:            " Pro-Plus ",
		Name:            "  Pro   Plus  ",
		MonthlyFeeMinor: 15000,
		YearlyFeeMinor:  150000,
		CommissionBPS:   75,
		DesignLimit:     &designLimit,
		UserAgent:       "test-agent",
		IPAddress:       "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create plan: %v", err)
	}
	if businesses.createdPlan.Code != "pro-plus" ||
		businesses.createdPlan.Name != "Pro Plus" ||
		businesses.createdPlan.YearlyFeeMinor != 150000 ||
		*businesses.createdPlan.DesignLimit != 25 {
		t.Fatalf("expected normalized create input, got %+v", businesses.createdPlan)
	}
	if created.Code != "pro-plus" {
		t.Fatalf("unexpected created plan: %+v", created)
	}

	updated, err := service.UpdatePlan(context.Background(), UpdatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		PlanID:          "plan-growth",
		Name:            "Growth Plus",
		MonthlyFeeMinor: 18000,
		YearlyFeeMinor:  180000,
		CommissionBPS:   50,
		IsActive:        true,
		UserAgent:       "test-agent",
		IPAddress:       "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update plan: %v", err)
	}
	if businesses.updatedPlan.Name != "Growth Plus" ||
		businesses.updatedPlan.YearlyFeeMinor != 180000 ||
		businesses.updatedPlan.IsActive != true {
		t.Fatalf("expected normalized update input, got %+v", businesses.updatedPlan)
	}
	if updated.Name != "Growth Plus" {
		t.Fatalf("unexpected updated plan: %+v", updated)
	}

	archived, err := service.ArchivePlan(context.Background(), ArchivePlanCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		PlanID:      "plan-growth",
		Reason:      " replaced by pro ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive plan: %v", err)
	}
	if businesses.archivedPlan.PlanID != "plan-growth" || archived.IsActive {
		t.Fatalf("expected archived plan, got input=%+v record=%+v", businesses.archivedPlan, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created plan package" ||
		audits.created[1].Action != "Updated plan package" ||
		audits.created[2].Action != "Archived plan package" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.CreatePlan(context.Background(), CreatePlanCommand{
		ActorUserID:     "support-1",
		ActorRole:       admindomain.RoleSupport,
		Code:            "support-plan",
		Name:            "Support Plan",
		MonthlyFeeMinor: 1000,
		YearlyFeeMinor:  10000,
		CommissionBPS:   100,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestPlanPackageValidation(t *testing.T) {
	t.Parallel()

	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		&fakeAdminBusinesses{},
		time.Now(),
		[]common.ID{"audit"},
	)

	_, err := service.CreatePlan(context.Background(), CreatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		Code:            "bad code",
		Name:            "Bad",
		MonthlyFeeMinor: 1000,
		YearlyFeeMinor:  10000,
		CommissionBPS:   100,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid code, got %v", err)
	}

	negativeLimit := -1
	_, err = service.UpdatePlan(context.Background(), UpdatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		PlanID:          "plan-growth",
		Name:            "Growth",
		MonthlyFeeMinor: 1000,
		YearlyFeeMinor:  -1000,
		CommissionBPS:   10001,
		DesignLimit:     &negativeLimit,
		IsActive:        true,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid economics, got %v", err)
	}
}

func TestPromotionsRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	businessID := common.ID("business-1")
	maxDiscount := int64(5000)
	globalLimit := 100
	perCustomerLimit := 1
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"promotion-created", "audit-create", "audit-update", "audit-archive"},
	)

	promotions, err := service.ListPromotions(context.Background(), ListPromotionsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list promotions: %v", err)
	}
	if len(promotions) != 1 || promotions[0].Code != "WELCOME10" {
		t.Fatalf("unexpected promotions: %+v", promotions)
	}

	created, err := service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:           "operator-1",
		ActorRole:             admindomain.RoleOperator,
		BusinessID:            &businessID,
		Code:                  " welcome10 ",
		Title:                 "  Welcome   Ten  ",
		Description:           "  first order  ",
		DiscountType:          "percentage",
		DiscountValue:         1000,
		MaxDiscountMinor:      &maxDiscount,
		MinSpendMinor:         10000,
		UsageLimitGlobal:      &globalLimit,
		UsageLimitPerCustomer: &perCustomerLimit,
		FundingSource:         "split",
		Scope:                 "store",
		Status:                "active",
		UserAgent:             "test-agent",
		IPAddress:             "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create promotion: %v", err)
	}
	if created.PromotionID != "promotion-created" ||
		businesses.createdPromotion.Code != "WELCOME10" ||
		businesses.createdPromotion.Title != "Welcome Ten" ||
		businesses.createdPromotion.Description != "first order" ||
		*businesses.createdPromotion.MaxDiscountMinor != 5000 ||
		*businesses.createdPromotion.UsageLimitGlobal != 100 {
		t.Fatalf("expected normalized create input, got input=%+v record=%+v", businesses.createdPromotion, created)
	}

	updated, err := service.UpdatePromotion(context.Background(), UpdatePromotionCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		PromotionID:   "promotion-created",
		Code:          "WELCOME10",
		Title:         "Welcome Ten Paused",
		DiscountType:  "fixed",
		DiscountValue: 1500,
		MinSpendMinor: 5000,
		FundingSource: "business",
		Scope:         "store",
		Status:        "paused",
		UserAgent:     "test-agent",
		IPAddress:     "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update promotion: %v", err)
	}
	if businesses.updatedPromotion.Status != "paused" || updated.Status != "paused" {
		t.Fatalf("expected paused update, got input=%+v record=%+v", businesses.updatedPromotion, updated)
	}

	archived, err := service.ArchivePromotion(context.Background(), ArchivePromotionCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		PromotionID: "promotion-created",
		Reason:      " campaign ended ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive promotion: %v", err)
	}
	if businesses.archivedPromotion.PromotionID != "promotion-created" || archived.Status != "archived" {
		t.Fatalf("expected archived promotion, got input=%+v record=%+v", businesses.archivedPromotion, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created promotion" ||
		audits.created[1].Action != "Updated promotion" ||
		audits.created[2].Action != "Archived promotion" ||
		audits.created[0].Metadata["code"] != "WELCOME10" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:   "support-1",
		ActorRole:     admindomain.RoleSupport,
		Code:          "NOPE",
		Title:         "Nope",
		DiscountType:  "fixed",
		DiscountValue: 100,
		FundingSource: "business",
		Scope:         "store",
		Status:        "active",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestPromotionValidation(t *testing.T) {
	t.Parallel()

	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		&fakeAdminBusinesses{},
		time.Now(),
		[]common.ID{"promotion", "audit"},
	)

	_, err := service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		Code:          "bad code",
		Title:         "Bad",
		DiscountType:  "percentage",
		DiscountValue: 1000,
		FundingSource: "business",
		Scope:         "store",
		Status:        "active",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid promotion code/cap, got %v", err)
	}

	negativeLimit := -1
	_, err = service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		Code:             "FIXED10",
		Title:            "Fixed",
		DiscountType:     "fixed",
		DiscountValue:    1000,
		UsageLimitGlobal: &negativeLimit,
		FundingSource:    "business",
		Scope:            "store",
		Status:           "active",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid promotion limit, got %v", err)
	}
}

func TestAdCampaignsRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	startsAt := now.Add(24 * time.Hour)
	endsAt := startsAt.Add(7 * 24 * time.Hour)
	dailyCap := int64(15000)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"campaign-created", "audit-create", "audit-update", "audit-archive"},
	)

	campaigns, err := service.ListAdCampaigns(context.Background(), ListAdCampaignsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list ad campaigns: %v", err)
	}
	if len(campaigns) != 1 || campaigns[0].Headline != "Featured Atelier" {
		t.Fatalf("unexpected ad campaigns: %+v", campaigns)
	}

	created, err := service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		BusinessID:    "business-1",
		PlacementType: " homepage_hero ",
		Headline:      "  Launch   spotlight  ",
		Description:   "  homepage slot  ",
		Status:        "active",
		PricingModel:  "flat_time",
		BudgetMinor:   50000,
		DailyCapMinor: &dailyCap,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
		ReviewNote:    " verified advertiser ",
		UserAgent:     "test-agent",
		IPAddress:     "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create ad campaign: %v", err)
	}
	if created.CampaignID != "campaign-created" ||
		businesses.createdAdCampaign.Headline != "Launch spotlight" ||
		businesses.createdAdCampaign.Description != "homepage slot" ||
		*businesses.createdAdCampaign.DailyCapMinor != 15000 ||
		businesses.createdAdCampaign.ReviewNote != "verified advertiser" {
		t.Fatalf("expected normalized create input, got input=%+v record=%+v", businesses.createdAdCampaign, created)
	}

	updated, err := service.UpdateAdCampaign(context.Background(), UpdateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		CampaignID:    "campaign-created",
		BusinessID:    "business-1",
		PlacementType: "featured_business",
		Headline:      "Launch spotlight paused",
		Status:        "paused",
		PricingModel:  "flat_time",
		BudgetMinor:   50000,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
		UserAgent:     "test-agent",
		IPAddress:     "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update ad campaign: %v", err)
	}
	if businesses.updatedAdCampaign.Status != "paused" || updated.Status != "paused" {
		t.Fatalf("expected paused update, got input=%+v record=%+v", businesses.updatedAdCampaign, updated)
	}

	archived, err := service.ArchiveAdCampaign(context.Background(), ArchiveAdCampaignCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		CampaignID:  "campaign-created",
		Reason:      " campaign ended ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive ad campaign: %v", err)
	}
	if businesses.archivedAdCampaign.CampaignID != "campaign-created" || archived.Status != "archived" {
		t.Fatalf("expected archived campaign, got input=%+v record=%+v", businesses.archivedAdCampaign, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created sponsored placement" ||
		audits.created[1].Action != "Updated sponsored placement" ||
		audits.created[2].Action != "Archived sponsored placement" ||
		audits.created[0].Metadata["placement_type"] != "homepage_hero" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "support-1",
		ActorRole:     admindomain.RoleSupport,
		BusinessID:    "business-1",
		PlacementType: "featured_business",
		Headline:      "Nope",
		Status:        "active",
		PricingModel:  "flat_time",
		BudgetMinor:   100,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestCollectAdCampaignPaymentCreatesProviderLinkAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		adPaymentIntent: ports.AdminAdCampaignPaymentIntentRecord{
			CampaignID:   "campaign-1",
			BusinessID:   "business-1",
			BusinessName: "Ama Stitches",
			OwnerEmail:   "owner@example.com",
			Headline:     "Featured Atelier",
			BudgetMinor:  50000,
			PaidMinor:    12500,
			DueMinor:     37500,
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"payment-1", "reference-1", "audit-1"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	result, err := service.CollectAdCampaignPayment(context.Background(), CollectAdCampaignPaymentCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		CampaignID:  "campaign-1",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("collect ad campaign payment: %v", err)
	}
	if provider.initialized.CustomerEmail != "owner@example.com" ||
		provider.initialized.AmountMinor != 37500 ||
		provider.initialized.SubaccountRef != "" ||
		provider.initialized.Reference != "xt_ad_reference-1" {
		t.Fatalf("expected platform Paystack transaction, got %+v", provider.initialized)
	}
	if businesses.createdAdCampaignPayment.PaymentID != "payment-1" ||
		businesses.createdAdCampaignPayment.ProviderReference != "PAY_xt_ad_reference-1" ||
		businesses.createdAdCampaignPayment.PaymentURL == "" {
		t.Fatalf("expected stored campaign payment input, got %+v", businesses.createdAdCampaignPayment)
	}
	if !result.Created ||
		result.Payment.AmountMinor != 37500 ||
		result.AuthorizationURL != "https://paystack.test/xt_ad_reference-1" {
		t.Fatalf("unexpected payment result: %+v", result)
	}
	if len(audits.created) != 1 ||
		audits.created[0].Action != "Created sponsored placement payment link" ||
		audits.created[0].Metadata["provider_reference"] != "PAY_xt_ad_reference-1" {
		t.Fatalf("unexpected audit event: %+v", audits.created)
	}

	_, err = service.CollectAdCampaignPayment(context.Background(), CollectAdCampaignPaymentCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		CampaignID:  "campaign-1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestAdCampaignValidation(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	startsAt := now.Add(24 * time.Hour)
	endsAt := startsAt.Add(7 * 24 * time.Hour)
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		&fakeAdminBusinesses{},
		now,
		[]common.ID{"campaign", "audit"},
	)

	_, err := service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		BusinessID:    "business-1",
		PlacementType: "promoted_design",
		Headline:      "Missing target",
		Status:        "active",
		PricingModel:  "flat_time",
		BudgetMinor:   10000,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected missing promoted design target to fail, got %v", err)
	}

	dailyCap := int64(-1)
	_, err = service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		BusinessID:    "business-1",
		PlacementType: "featured_business",
		Headline:      "Bad cap",
		Status:        "active",
		PricingModel:  "cpc",
		BudgetMinor:   0,
		DailyCapMinor: &dailyCap,
		StartsAt:      &endsAt,
		EndsAt:        &startsAt,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid campaign economics/window, got %v", err)
	}
}

func TestAffiliatesRequireGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"affiliate-created", "audit-create", "audit-update", "audit-archive", "affiliate-invalid"},
	)

	affiliates, err := service.ListAffiliates(context.Background(), ListAffiliatesCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list affiliates: %v", err)
	}
	if len(affiliates) != 1 || affiliates[0].Code != "SEWINGPRO" {
		t.Fatalf("unexpected affiliates: %+v", affiliates)
	}

	created, err := service.CreateAffiliate(context.Background(), CreateAffiliateCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		EntityType:       " agency ",
		Code:             " sewing-pro ",
		DisplayName:      "  Sewing   Pro Partners ",
		ContactName:      "  Ama   Partner ",
		Email:            "AMA@EXAMPLE.COM",
		Phone:            " +233 20 000 0000 ",
		WebsiteURL:       "https://partners.example.com/ref",
		CommissionModel:  "percentage",
		CommissionRate:   1250,
		CookieWindowDays: 45,
		PayoutMode:       "paystack_transfer",
		PayoutReference:  " KYC transfer account ",
		Status:           "active",
		Notes:            " reviewed ",
		UserAgent:        "test-agent",
		IPAddress:        "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create affiliate: %v", err)
	}
	if created.AffiliateID != "affiliate-created" ||
		businesses.createdAffiliate.Code != "SEWING-PRO" ||
		businesses.createdAffiliate.Email != "ama@example.com" ||
		businesses.createdAffiliate.DisplayName != "Sewing Pro Partners" ||
		businesses.createdAffiliate.CookieWindowDays != 45 {
		t.Fatalf("expected normalized affiliate create, got input=%+v record=%+v", businesses.createdAffiliate, created)
	}

	updated, err := service.UpdateAffiliate(context.Background(), UpdateAffiliateCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		AffiliateID:      "affiliate-created",
		EntityType:       "agency",
		Code:             "SEWING-PRO",
		DisplayName:      "Sewing Pro Partners",
		CommissionModel:  "flat",
		CommissionRate:   5000,
		CookieWindowDays: 30,
		PayoutMode:       "manual",
		Status:           "paused",
		UserAgent:        "test-agent",
		IPAddress:        "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update affiliate: %v", err)
	}
	if businesses.updatedAffiliate.Status != "paused" || updated.Status != "paused" {
		t.Fatalf("expected paused affiliate update, got input=%+v record=%+v", businesses.updatedAffiliate, updated)
	}

	archived, err := service.ArchiveAffiliate(context.Background(), ArchiveAffiliateCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		AffiliateID: "affiliate-created",
		Reason:      " programme closed ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive affiliate: %v", err)
	}
	if businesses.archivedAffiliate.AffiliateID != "affiliate-created" || archived.Status != "archived" {
		t.Fatalf("expected archived affiliate, got input=%+v record=%+v", businesses.archivedAffiliate, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three affiliate audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created affiliate programme partner" ||
		audits.created[1].Action != "Updated affiliate programme partner" ||
		audits.created[2].Action != "Archived affiliate programme partner" ||
		audits.created[0].Metadata["code"] != "SEWING-PRO" {
		t.Fatalf("unexpected affiliate audit events: %+v", audits.created)
	}

	_, err = service.CreateAffiliate(context.Background(), CreateAffiliateCommand{
		ActorUserID:     "support-1",
		ActorRole:       admindomain.RoleSupport,
		Code:            "NOPE",
		DisplayName:     "Nope",
		CommissionModel: "percentage",
		CommissionRate:  100,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.CreateAffiliate(context.Background(), CreateAffiliateCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		Code:            "BAD",
		DisplayName:     "Bad",
		Email:           "bad-email",
		WebsiteURL:      "ftp://example.com",
		CommissionModel: "percentage",
		CommissionRate:  10001,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid affiliate fields, got %v", err)
	}
}

func TestAffiliateAttributionRequiresGrowthPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		affiliateAttribution: []ports.AdminAffiliateAttributionRecord{
			fakeAdminAffiliateAttributionRecord("affiliate-1", "SEWINGPRO", "Sewing Pro Partners"),
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	records, err := service.ListAffiliateAttribution(context.Background(), ListAffiliateAttributionCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list affiliate attribution: %v", err)
	}
	if len(records) != 1 ||
		records[0].Code != "SEWINGPRO" ||
		records[0].ClickCount != 12 ||
		records[0].ConversionCount != 2 ||
		len(records[0].RecentConversions) != 1 {
		t.Fatalf("unexpected affiliate attribution records: %+v", records)
	}

	_, err = service.ListAffiliateAttribution(context.Background(), ListAffiliateAttributionCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateAffiliateConversionStatusRequiresGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateAffiliateConversionStatus(
		context.Background(),
		UpdateAffiliateConversionStatusCommand{
			ActorUserID:  "operator-1",
			ActorRole:    admindomain.RoleOperator,
			ConversionID: "conversion-1",
			Status:       "approved",
			Reason:       "  order confirmed  ",
			UserAgent:    "test-agent",
			IPAddress:    "127.0.0.1",
		},
	)
	if err != nil {
		t.Fatalf("update affiliate conversion: %v", err)
	}
	if businesses.updatedAffiliateConversion.ConversionID != "conversion-1" ||
		businesses.updatedAffiliateConversion.Status != "approved" ||
		businesses.updatedAffiliateConversion.Reason != "order confirmed" {
		t.Fatalf("expected normalized conversion update, got %+v", businesses.updatedAffiliateConversion)
	}
	if record.Status != "approved" {
		t.Fatalf("unexpected conversion response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Marked affiliate conversion approved" ||
		event.TargetID != "conversion-1" ||
		event.Metadata["reason"] != "order confirmed" ||
		event.Metadata["commission_minor"] != "1500" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.UpdateAffiliateConversionStatus(
		context.Background(),
		UpdateAffiliateConversionStatusCommand{
			ActorUserID:  "support-1",
			ActorRole:    admindomain.RoleSupport,
			ConversionID: "conversion-1",
			Status:       "approved",
		},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.UpdateAffiliateConversionStatus(
		context.Background(),
		UpdateAffiliateConversionStatusCommand{
			ActorUserID:  "operator-1",
			ActorRole:    admindomain.RoleOperator,
			ConversionID: "conversion-1",
			Status:       "pending",
		},
	)
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid manual status, got %v", err)
	}
}

func TestCreateAffiliatePayoutRequiresGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"payout-1", "audit-1"},
	)

	record, err := service.CreateAffiliatePayout(
		context.Background(),
		CreateAffiliatePayoutCommand{
			ActorUserID:     "operator-1",
			ActorRole:       admindomain.RoleOperator,
			AffiliateID:     "affiliate-1",
			PayoutReference: "  TRF_123  ",
			Notes:           "  sent from settled commission  ",
			UserAgent:       "test-agent",
			IPAddress:       "127.0.0.1",
		},
	)
	if err != nil {
		t.Fatalf("create affiliate payout: %v", err)
	}
	if businesses.createdAffiliatePayout.PayoutBatchID != "payout-1" ||
		businesses.createdAffiliatePayout.AffiliateID != "affiliate-1" ||
		businesses.createdAffiliatePayout.PayoutReference != "TRF_123" ||
		businesses.createdAffiliatePayout.Notes != "sent from settled commission" {
		t.Fatalf("expected normalized payout input, got %+v", businesses.createdAffiliatePayout)
	}
	if record.PayoutBatchID != "payout-1" ||
		record.Status != "settled" ||
		record.ConversionCount != 2 ||
		record.CommissionMinor != 2500 {
		t.Fatalf("unexpected payout response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Reconciled affiliate payout" ||
		event.TargetID != "payout-1" ||
		event.Metadata["affiliate_id"] != "affiliate-1" ||
		event.Metadata["conversion_count"] != "2" ||
		event.Metadata["commission_minor"] != "2500" ||
		event.Metadata["payout_reference"] != "TRF_123" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.CreateAffiliatePayout(
		context.Background(),
		CreateAffiliatePayoutCommand{
			ActorUserID: "support-1",
			ActorRole:   admindomain.RoleSupport,
			AffiliateID: "affiliate-1",
		},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestReferralProgrammesRequireGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	startsAt := now.Add(24 * time.Hour)
	endsAt := startsAt.Add(30 * 24 * time.Hour)
	maxRewardMinor := int64(5000)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"referral-created", "audit-create", "audit-update", "audit-archive", "referral-invalid"},
	)

	programmes, err := service.ListReferralProgrammes(context.Background(), ListReferralProgrammesCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list referral programmes: %v", err)
	}
	if len(programmes) != 1 || programmes[0].CodePrefix != "LAUNCH" {
		t.Fatalf("unexpected referral programmes: %+v", programmes)
	}

	created, err := service.CreateReferralProgramme(context.Background(), CreateReferralProgrammeCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		Title:                   "  Local   Launch Referrals ",
		CodePrefix:              " ref-local ",
		Audience:                " mixed ",
		ReferrerRewardKind:      "voucher",
		RefereeRewardKind:       "voucher",
		RewardType:              "percentage",
		RewardValue:             1250,
		MaxRewardMinor:          &maxRewardMinor,
		QualifyingOrderMinMinor: 20000,
		RewardHoldDays:          21,
		Status:                  "active",
		StartsAt:                &startsAt,
		EndsAt:                  &endsAt,
		Notes:                   " launch cohort ",
		UserAgent:               "test-agent",
		IPAddress:               "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create referral programme: %v", err)
	}
	if created.ProgrammeID != "referral-created" ||
		businesses.createdReferralProgramme.Title != "Local Launch Referrals" ||
		businesses.createdReferralProgramme.CodePrefix != "REF-LOCAL" ||
		businesses.createdReferralProgramme.Audience != "mixed" ||
		businesses.createdReferralProgramme.RewardHoldDays != 21 ||
		businesses.createdReferralProgramme.MaxRewardMinor == nil ||
		*businesses.createdReferralProgramme.MaxRewardMinor != maxRewardMinor {
		t.Fatalf("expected normalized referral create, got input=%+v record=%+v", businesses.createdReferralProgramme, created)
	}

	updated, err := service.UpdateReferralProgramme(context.Background(), UpdateReferralProgrammeCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		ProgrammeID:             "referral-created",
		Title:                   "Local Launch Referrals",
		CodePrefix:              "REF-LOCAL",
		Audience:                "customers",
		ReferrerRewardKind:      "commission_rebate",
		RefereeRewardKind:       "none",
		RewardType:              "fixed",
		RewardValue:             2500,
		QualifyingOrderMinMinor: 10000,
		RewardHoldDays:          7,
		Status:                  "paused",
		UserAgent:               "test-agent",
		IPAddress:               "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update referral programme: %v", err)
	}
	if businesses.updatedReferralProgramme.Status != "paused" ||
		businesses.updatedReferralProgramme.RewardType != "fixed" ||
		businesses.updatedReferralProgramme.MaxRewardMinor != nil ||
		updated.Status != "paused" {
		t.Fatalf("expected paused referral update, got input=%+v record=%+v", businesses.updatedReferralProgramme, updated)
	}

	archived, err := service.ArchiveReferralProgramme(context.Background(), ArchiveReferralProgrammeCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ProgrammeID: "referral-created",
		Reason:      " programme ended ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive referral programme: %v", err)
	}
	if businesses.archivedReferralProgramme.ProgrammeID != "referral-created" || archived.Status != "archived" {
		t.Fatalf("expected archived referral programme, got input=%+v record=%+v", businesses.archivedReferralProgramme, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three referral audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created referral programme" ||
		audits.created[1].Action != "Updated referral programme" ||
		audits.created[2].Action != "Archived referral programme" ||
		audits.created[0].Metadata["code_prefix"] != "REF-LOCAL" {
		t.Fatalf("unexpected referral audit events: %+v", audits.created)
	}

	_, err = service.CreateReferralProgramme(context.Background(), CreateReferralProgrammeCommand{
		ActorUserID:             "support-1",
		ActorRole:               admindomain.RoleSupport,
		Title:                   "Nope",
		CodePrefix:              "NOPE",
		ReferrerRewardKind:      "voucher",
		RefereeRewardKind:       "voucher",
		RewardType:              "fixed",
		RewardValue:             1000,
		QualifyingOrderMinMinor: 0,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.CreateReferralProgramme(context.Background(), CreateReferralProgrammeCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		Title:                   "Bad",
		CodePrefix:              "BAD",
		ReferrerRewardKind:      "none",
		RefereeRewardKind:       "none",
		RewardType:              "percentage",
		RewardValue:             10100,
		QualifyingOrderMinMinor: -1,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid referral programme fields, got %v", err)
	}
}

func TestCreateReferralCodeRequiresGrowthPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 13, 0, 0, 0, time.UTC)
	businessID := common.ID("business-1")
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"referral-code-1", "audit-code-1", "referral-code-invalid"},
	)

	record, err := service.CreateReferralCode(context.Background(), CreateReferralCodeCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ProgrammeID: "programme-1",
		BusinessID:  &businessID,
		OwnerType:   " business ",
		Code:        " ama-team ",
		Status:      "paused",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create referral code: %v", err)
	}
	if record.ReferralCodeID != "referral-code-1" ||
		businesses.createdReferralCode.ProgrammeID != "programme-1" ||
		businesses.createdReferralCode.BusinessID == nil ||
		*businesses.createdReferralCode.BusinessID != businessID ||
		businesses.createdReferralCode.OwnerType != "business" ||
		businesses.createdReferralCode.Code != "AMA-TEAM" ||
		businesses.createdReferralCode.Status != "paused" {
		t.Fatalf("expected normalized referral code input, got input=%+v record=%+v", businesses.createdReferralCode, record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Issued referral code" ||
		event.Metadata["referral_programme_id"] != "programme-1" ||
		event.Metadata["business_id"] != businessID.String() ||
		event.Metadata["owner_business_id"] != businessID.String() ||
		event.Metadata["code"] != "AMA-TEAM" ||
		event.Metadata["status"] != "paused" {
		t.Fatalf("unexpected referral code audit event: %+v", event)
	}

	_, err = service.CreateReferralCode(context.Background(), CreateReferralCodeCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		ProgrammeID: "programme-1",
		Code:        "SUPPORT1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.CreateReferralCode(context.Background(), CreateReferralCodeCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ProgrammeID: "programme-1",
		OwnerType:   "business",
		Code:        "NO",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid code input, got %v", err)
	}
}

func TestIssueReferralRewardsRequiresGrowthPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1"},
	)

	record, err := service.IssueReferralRewards(context.Background(), IssueReferralRewardsCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		Limit:       999,
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("issue referral rewards: %v", err)
	}
	if businesses.issuedReferralRewards.ActorAdminUser != "operator-1" ||
		businesses.issuedReferralRewards.Limit != 500 {
		t.Fatalf("expected normalized reward issue input, got %+v", businesses.issuedReferralRewards)
	}
	if record.ReferralCount != 2 ||
		record.RewardCount != 3 ||
		record.VoucherCount != 2 ||
		record.CommissionRebateCount != 1 ||
		record.TotalRewardMinor != 10000 {
		t.Fatalf("unexpected reward issue record: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Issued referral rewards" ||
		event.Metadata["reward_count"] != "3" ||
		event.Metadata["voucher_count"] != "2" ||
		event.Metadata["commission_rebate_count"] != "1" ||
		event.Metadata["limit"] != "500" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.IssueReferralRewards(context.Background(), IssueReferralRewardsCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestQueueMoneyReplayRequiresMoneyPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"replay-1", "audit-1"},
	)

	record, err := service.QueueMoneyReplay(context.Background(), QueueMoneyReplayCommand{
		ActorUserID:       "operator-1",
		ActorRole:         admindomain.RoleOperator,
		ProviderReference: " xt_ref_1 ",
		Reason:            " customer says checkout was charged ",
		UserAgent:         "test-agent",
		IPAddress:         "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("queue money replay: %v", err)
	}
	if businesses.replay.ProviderReference != "xt_ref_1" ||
		businesses.replay.ReplayRequestID != "replay-1" ||
		businesses.replay.Reason != "customer says checkout was charged" {
		t.Fatalf("expected normalized replay request, got %+v", businesses.replay)
	}
	if record.ReplayRequestID != "replay-1" || record.ProviderReference != "xt_ref_1" {
		t.Fatalf("unexpected replay response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Queued money replay" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["reason"] != "customer says checkout was charged" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.QueueMoneyReplay(context.Background(), QueueMoneyReplayCommand{
		ActorUserID:       "support-1",
		ActorRole:         admindomain.RoleSupport,
		ProviderReference: "xt_ref_1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestReverseMoneyPaymentRequiresMoneyPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.ReverseMoneyPayment(context.Background(), ReverseMoneyPaymentCommand{
		ActorUserID:       "operator-1",
		ActorRole:         admindomain.RoleOperator,
		ProviderReference: " xt_ref_refund ",
		Reason:            " provider refund confirmed ",
		UserAgent:         "test-agent",
		IPAddress:         "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("reverse money payment: %v", err)
	}
	if businesses.reversal.ProviderReference != "xt_ref_refund" ||
		businesses.reversal.Reason != "provider refund confirmed" ||
		!record.PaymentReversed ||
		record.PromotionRedemptionCount != 1 ||
		record.ReferralRewardCount != 2 {
		t.Fatalf("expected normalized reversal and counts, input=%+v record=%+v", businesses.reversal, record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Reversed payment impact" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["provider_reference"] != "xt_ref_refund" ||
		audits.created[0].Metadata["promotion_redemptions"] != "1" ||
		audits.created[0].Metadata["referral_rewards"] != "2" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.ReverseMoneyPayment(context.Background(), ReverseMoneyPaymentCommand{
		ActorUserID:       "support-1",
		ActorRole:         admindomain.RoleSupport,
		ProviderReference: "xt_ref_refund",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestSetSettlementReviewHoldRequiresMoneyPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.SetSettlementReviewHold(context.Background(), SetSettlementReviewHoldCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Hold:        true,
		Reason:      " webhook mismatch needs review ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("set settlement hold: %v", err)
	}
	if businesses.hold.BusinessID != "business-1" ||
		!businesses.hold.Hold ||
		businesses.hold.Reason != "webhook mismatch needs review" {
		t.Fatalf("expected normalized hold input, got %+v", businesses.hold)
	}
	if !record.HoldActive || record.Status != "blocked" {
		t.Fatalf("unexpected hold response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Placed settlement review hold" ||
		audits.created[0].Severity != admindomain.AuditSeverityCritical ||
		audits.created[0].Metadata["hold_active"] != "true" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.SetSettlementReviewHold(context.Background(), SetSettlementReviewHoldCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
		Hold:        false,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestListRiskReviewsRequiresRiskPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		riskReviews: []ports.AdminRiskReviewRecord{
			{ReviewKey: "payment_failures:business-1", BusinessName: "Ama Stitches", Level: "high", Status: "open"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	reviews, err := service.ListRiskReviews(context.Background(), ListRiskReviewsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list risk reviews: %v", err)
	}
	if len(reviews) != 1 || reviews[0].ReviewKey != "payment_failures:business-1" {
		t.Fatalf("unexpected risk review response: %+v", reviews)
	}

	_, err = service.ListRiskReviews(context.Background(), ListRiskReviewsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestSetRiskReviewStatusRequiresRiskPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.SetRiskReviewStatus(context.Background(), SetRiskReviewStatusCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ReviewKey:   " payment_failures:business-1 ",
		Status:      "closed",
		Reason:      " issue reconciled with provider ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("set risk review status: %v", err)
	}
	if businesses.riskUpdate.ReviewKey != "payment_failures:business-1" ||
		businesses.riskUpdate.Status != "closed" ||
		businesses.riskUpdate.Reason != "issue reconciled with provider" {
		t.Fatalf("expected normalized risk update, got %+v", businesses.riskUpdate)
	}
	if record.Status != "closed" || record.ReviewKey != "payment_failures:business-1" {
		t.Fatalf("unexpected risk review response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Closed risk review" ||
		audits.created[0].Severity != admindomain.AuditSeverityInfo ||
		audits.created[0].Metadata["status"] != "closed" ||
		audits.created[0].Metadata["reason"] != "issue reconciled with provider" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.SetRiskReviewStatus(context.Background(), SetRiskReviewStatusCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		ReviewKey:   "payment_failures:business-1",
		Status:      "open",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestListSupportTicketsRequiresSupportPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		supportTickets: []ports.AdminSupportTicketRecord{
			{TicketKey: "failed_payment:payment-1", BusinessName: "Ama Stitches", Priority: "urgent", Status: "open"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	tickets, err := service.ListSupportTickets(context.Background(), ListSupportTicketsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("list support tickets: %v", err)
	}
	if len(tickets) != 1 || tickets[0].TicketKey != "failed_payment:payment-1" {
		t.Fatalf("unexpected support ticket response: %+v", tickets)
	}

	_, err = service.ListSupportTickets(context.Background(), ListSupportTicketsCommand{
		ActorRole: "viewer",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected invalid role to be forbidden, got %v", err)
	}
}

func TestUpdateSupportTicketRequiresSupportPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateSupportTicket(context.Background(), UpdateSupportTicketCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		TicketKey:   " failed_payment:payment-1 ",
		Status:      "open",
		Assignment:  "self",
		Note:        " taking this one ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update support ticket: %v", err)
	}
	if businesses.supportUpdate.TicketKey != "failed_payment:payment-1" ||
		businesses.supportUpdate.Assignment != "self" ||
		businesses.supportUpdate.Note != "taking this one" {
		t.Fatalf("expected normalized support update, got %+v", businesses.supportUpdate)
	}
	if record.Status != "open" || record.AssignedAdminUserID != "support-1" {
		t.Fatalf("unexpected support ticket response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Assigned support ticket" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["assignment"] != "self" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.UpdateSupportTicket(context.Background(), UpdateSupportTicketCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		TicketKey:   "failed_payment:payment-1",
		Status:      "invalid",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid status, got %v", err)
	}
}

func TestGetOperationsHealthSummarizesAllowedReadModels(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 10, 0, 0, 0, time.UTC)
	designLimit := 2
	users := &fakeAdminUsers{
		users: []ports.AdminUserRecord{
			{UserID: "owner-1", Email: "owner@example.com", Role: admindomain.RoleOwner, IsActive: true},
			{UserID: "operator-1", Email: "operator@example.com", Role: admindomain.RoleOperator, IsActive: false},
		},
		platformSettings: ports.AdminPlatformSettingsRecord{
			PlatformName:         "Xtiitch",
			SupportEmail:         "support@xtiitch.com",
			VerificationSLAHours: 24,
			MaintenanceMode:      true,
		},
	}
	businesses := &fakeAdminBusinesses{
		cases: []ports.AdminVerificationCaseRecord{
			{BusinessID: "business-1", VerificationStatus: business.VerificationStatusPending},
		},
		businesses: []ports.AdminBusinessRecord{
			{BusinessID: "business-1", Name: "Ama Stitches", OperationalStatus: business.OperationalStatusSuspended},
		},
		metrics: ports.AdminPlatformMetricsRecord{
			PaymentHealthBPS:  9200,
			FailedPayments30d: 1,
			UpdatedAt:         now,
		},
		moneyRails: ports.AdminMoneyRailsRecord{
			WebhookEvents: []ports.AdminMoneyWebhookEventRecord{
				{ID: "event-1", Status: "failed"},
			},
			PayoutReviews: []ports.AdminMoneyPayoutReviewRecord{
				{ID: "business-1", Status: "blocked", HoldActive: true},
			},
			UpdatedAt: now,
		},
		subscriptions: []ports.AdminSubscriptionRecord{
			{BusinessID: "business-1", BusinessName: "Ama Stitches", Status: "past_due", DesignLimit: &designLimit, DesignCount: 3},
		},
		promotions: []ports.AdminPromotionRecord{
			{
				PromotionID: "promotion-1",
				Status:      "active",
				RecentRedemptions: []ports.AdminPromotionRedemptionRecord{
					{PromotionRedemptionID: "redemption-1", Status: "pending"},
				},
			},
		},
		adCampaigns: []ports.AdminAdCampaignRecord{
			{CampaignID: "campaign-1", Status: "pending_review"},
		},
		affiliates: []ports.AdminAffiliateRecord{
			{AffiliateID: "affiliate-1", Status: "pending_review", PayoutMode: "manual"},
		},
		referralProgrammes: []ports.AdminReferralProgrammeRecord{
			{ProgrammeID: "programme-1", Status: "draft"},
		},
		riskReviews: []ports.AdminRiskReviewRecord{
			{ReviewKey: "risk-1", Level: "high", Status: "open"},
		},
		supportTickets: []ports.AdminSupportTicketRecord{
			{TicketKey: "ticket-1", Priority: "urgent", Status: "open"},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		users,
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"unused"},
	)
	audits.events = []ports.AdminAuditEventRecord{
		{AuditEventID: "audit-1", Severity: admindomain.AuditSeverityCritical},
		{AuditEventID: "audit-2", Severity: admindomain.AuditSeverityInfo},
	}

	health, err := service.GetOperationsHealth(context.Background(), GetOperationsHealthCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get operations health: %v", err)
	}
	if health.HealthScore != 0 ||
		health.BlockedCount != 5 ||
		health.WatchCount != 7 ||
		health.FailedWebhooks != 1 ||
		health.PayoutHolds != 1 ||
		health.UrgentSupportTickets != 1 ||
		health.CriticalAuditEvents != 1 {
		t.Fatalf("unexpected owner health summary: %+v", health)
	}
	if healthSignalStatus(health, "payments") != "blocked" ||
		healthSignalStatus(health, "subscriptions") != "blocked" ||
		healthSignalStatus(health, "access") != "watch" ||
		healthSignalStatus(health, "exports") != "ready" {
		t.Fatalf("unexpected owner health signals: %+v", health.Signals)
	}

	supportHealth, err := service.GetOperationsHealth(context.Background(), GetOperationsHealthCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("get support operations health: %v", err)
	}
	if healthSignalStatus(supportHealth, "payments") != "" ||
		healthSignalStatus(supportHealth, "subscriptions") != "" ||
		healthSignalStatus(supportHealth, "trust") != "blocked" ||
		healthSignalStatus(supportHealth, "audit") != "blocked" ||
		healthSignalStatus(supportHealth, "exports") != "ready" {
		t.Fatalf("unexpected support-scoped health signals: %+v", supportHealth.Signals)
	}

	feed, err := service.GetAdminNotifications(context.Background(), GetAdminNotificationsCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get admin notifications: %v", err)
	}
	if len(feed.Notifications) == 0 ||
		feed.Notifications[0].ID != "health-kyc" ||
		feed.Notifications[0].Tone != "critical" ||
		feed.Notifications[0].Category != "verification" {
		t.Fatalf("unexpected owner notification feed: %+v", feed.Notifications)
	}

	supportFeed, err := service.GetAdminNotifications(context.Background(), GetAdminNotificationsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("get support admin notifications: %v", err)
	}
	if len(supportFeed.Notifications) != 2 ||
		supportFeed.Notifications[0].Category != "support" ||
		supportFeed.Notifications[1].Category != "audit" {
		t.Fatalf("unexpected support notification feed: %+v", supportFeed.Notifications)
	}

	reports, err := service.GetAdminReports(context.Background(), GetAdminReportsCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get admin reports: %v", err)
	}
	if len(reports.Items) == 0 ||
		reports.Items[0].ID != "kyc" ||
		reports.Items[0].Status != "blocked" ||
		healthReportStatus(reports, "exports") != "ready" {
		t.Fatalf("unexpected owner report feed: %+v", reports.Items)
	}

	supportReports, err := service.GetAdminReports(context.Background(), GetAdminReportsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("get support admin reports: %v", err)
	}
	if healthReportStatus(supportReports, "payments") != "" ||
		healthReportStatus(supportReports, "trust") != "blocked" ||
		healthReportStatus(supportReports, "audit") != "blocked" {
		t.Fatalf("unexpected support report feed: %+v", supportReports.Items)
	}
}

func TestGetLaunchReadinessRequiresSettingsAndSummarizesConfig(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 11, 0, 0, 0, time.UTC)
	service := newTestService(&fakeAdminUsers{}, &fakeAdminSessions{}, now, []common.ID{"unused"})
	service.readiness = AdminLaunchReadinessConfig{
		Environment:                   "production",
		AdminBootstrapOwnerConfigured: true,
		CloudinaryConfigured:          true,
		ExpoAccessTokenConfigured:     true,
		GrowthPolicyConfirmed:         true,
		JWTSigningKeyDefault:          false,
		LegalReviewConfirmed:          true,
		MarketingWaitlistEmailReady:   true,
		NotificationTransport:         "whatsapp_cloud",
		NotificationWhatsAppReady:     true,
		PaystackSecretConfigured:      true,
		PaystackWebhookConfigured:     true,
		SonarHostConfigured:           true,
		SonarOrganizationConfigured:   true,
		SonarTokenConfigured:          true,
	}

	result, err := service.GetLaunchReadiness(context.Background(), GetLaunchReadinessCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("get launch readiness: %v", err)
	}
	if result.Environment != "production" ||
		result.ReadyCount != 9 ||
		result.WatchCount != 1 ||
		result.BlockedCount != 0 ||
		launchReadinessStatus(result, "paystack-sandbox") != "watch" ||
		launchReadinessStatus(result, "legal-policy") != "ready" ||
		launchReadinessStatus(result, "growth-policy") != "ready" {
		t.Fatalf("unexpected readiness result: %+v", result)
	}
	if !result.UpdatedAt.Equal(now) {
		t.Fatalf("expected fixed updated_at, got %v", result.UpdatedAt)
	}

	_, err = service.GetLaunchReadiness(context.Background(), GetLaunchReadinessCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support to be forbidden, got %v", err)
	}
}

func healthSignalStatus(
	record OperationsHealthResult,
	id string,
) string {
	for _, signal := range record.Signals {
		if signal.ID == id {
			return signal.Status
		}
	}
	return ""
}

func launchReadinessStatus(record LaunchReadinessResult, id string) string {
	for _, check := range record.Checks {
		if check.ID == id {
			return check.Status
		}
	}
	return ""
}

func healthReportStatus(record AdminReportsResult, id string) string {
	for _, item := range record.Items {
		if item.ID == id {
			return item.Status
		}
	}
	return ""
}

func newTestService(users *fakeAdminUsers, sessions *fakeAdminSessions, now time.Time, ids []common.ID) Service {
	service, _ := newTestServiceWithAudits(users, sessions, now, ids)
	return service
}

func newTestServiceWithAudits(
	users *fakeAdminUsers,
	sessions *fakeAdminSessions,
	now time.Time,
	ids []common.ID,
) (Service, *fakeAdminAudits) {
	return newTestServiceWithBusinesses(users, sessions, &fakeAdminBusinesses{}, now, ids)
}

func newTestServiceWithBusinesses(
	users *fakeAdminUsers,
	sessions *fakeAdminSessions,
	businesses *fakeAdminBusinesses,
	now time.Time,
	ids []common.ID,
) (Service, *fakeAdminAudits) {
	audits := &fakeAdminAudits{}
	return NewService(Dependencies{
		Users:         users,
		Sessions:      sessions,
		Audits:        audits,
		Businesses:    businesses,
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeAdminTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: ids},
		Clock:         fixedClock{now: now},
	}), audits
}

type fakeAdminUsers struct {
	bootstrapped            ports.CreateAdminUserInput
	credentials             ports.AdminUserCredentials
	findErr                 error
	lookupEmail             string
	loginUserID             common.ID
	record                  ports.AdminUserRecord
	users                   []ports.AdminUserRecord
	listCalled              bool
	created                 ports.CreateAdminUserInput
	updated                 ports.UpdateAdminUserInput
	updatedProfile          ports.UpdateAdminProfileInput
	preferencesUserID       common.ID
	preferences             ports.AdminPreferencesRecord
	updatedPreferences      ports.UpdateAdminPreferencesInput
	platformSettings        ports.AdminPlatformSettingsRecord
	updatedPlatformSettings ports.UpdateAdminPlatformSettingsInput
	marketingFlags          ports.MarketingFlags
	updatedMarketingFlags   ports.UpdateAdminMarketingFlagsInput
	rolePermissions         []ports.AdminRolePermissionsRecord
	updatedRolePermissions  ports.UpdateAdminRolePermissionsInput
}

func (repo *fakeAdminUsers) EnsureBootstrapUser(_ context.Context, input ports.CreateAdminUserInput) (ports.AdminUserRecord, error) {
	repo.bootstrapped = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    true,
	}, nil
}

func (repo *fakeAdminUsers) RecordFailedAdminLogin(_ context.Context, _ common.ID, _ int, _ time.Duration) error {
	return nil
}

func (repo *fakeAdminUsers) ClearFailedAdminLogin(_ context.Context, _ common.ID) error {
	return nil
}

func (repo *fakeAdminUsers) FindByEmail(_ context.Context, email string) (ports.AdminUserCredentials, error) {
	repo.lookupEmail = email
	if repo.findErr != nil {
		return ports.AdminUserCredentials{}, repo.findErr
	}
	return repo.credentials, nil
}

func (repo *fakeAdminUsers) FindByID(_ context.Context, _ common.ID) (ports.AdminUserRecord, error) {
	return repo.record, nil
}

func (repo *fakeAdminUsers) ListAdminUsers(_ context.Context) ([]ports.AdminUserRecord, error) {
	repo.listCalled = true
	return repo.users, nil
}

func (repo *fakeAdminUsers) CreateAdminUser(_ context.Context, input ports.CreateAdminUserInput) (ports.AdminUserRecord, error) {
	repo.created = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    true,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminUser(_ context.Context, input ports.UpdateAdminUserInput) (ports.AdminUserRecord, error) {
	repo.updated = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    input.IsActive,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminProfile(_ context.Context, input ports.UpdateAdminProfileInput) (ports.AdminUserRecord, error) {
	repo.updatedProfile = input
	return ports.AdminUserRecord{
		UserID:      input.UserID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        admindomain.RoleOwner,
		IsActive:    true,
	}, nil
}

func (repo *fakeAdminUsers) ListAdminRolePermissions(_ context.Context) ([]ports.AdminRolePermissionsRecord, error) {
	if repo.rolePermissions != nil {
		return repo.rolePermissions, nil
	}
	return defaultTestRolePermissions(), nil
}

func (repo *fakeAdminUsers) GetAdminPreferences(_ context.Context, userID common.ID) (ports.AdminPreferencesRecord, error) {
	repo.preferencesUserID = userID
	if repo.preferences.UserID != "" {
		return repo.preferences, nil
	}
	return ports.AdminPreferencesRecord{
		UserID:          userID,
		Timezone:        "Africa/Accra",
		NotifyEmail:     true,
		DailyDigestTime: "08:00",
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminPreferences(
	_ context.Context,
	input ports.UpdateAdminPreferencesInput,
) (ports.AdminPreferencesRecord, error) {
	repo.updatedPreferences = input
	return ports.AdminPreferencesRecord{
		UserID:             input.UserID,
		Timezone:           input.Timezone,
		PhoneNumber:        input.PhoneNumber,
		NotifyEmail:        input.NotifyEmail,
		NotifySMS:          input.NotifySMS,
		AlertVerifications: input.AlertVerifications,
		AlertMoneyRails:    input.AlertMoneyRails,
		AlertRisk:          input.AlertRisk,
		AlertSupport:       input.AlertSupport,
		DailyDigestTime:    input.DailyDigestTime,
	}, nil
}

func (repo *fakeAdminUsers) GetAdminPlatformSettings(context.Context) (ports.AdminPlatformSettingsRecord, error) {
	if repo.platformSettings.PlatformName != "" {
		return repo.platformSettings, nil
	}
	return ports.AdminPlatformSettingsRecord{
		PlatformName:                 "Xtiitch",
		SupportEmail:                 "support@xtiitch.com",
		VerificationSLAHours:         24,
		PayoutReviewThresholdPesewas: 500000,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminPlatformSettings(
	_ context.Context,
	input ports.UpdateAdminPlatformSettingsInput,
) (ports.AdminPlatformSettingsRecord, error) {
	repo.updatedPlatformSettings = input
	return ports.AdminPlatformSettingsRecord{
		PlatformName:                 input.PlatformName,
		SupportEmail:                 input.SupportEmail,
		VerificationSLAHours:         input.VerificationSLAHours,
		PayoutReviewThresholdPesewas: input.PayoutReviewThresholdPesewas,
		MaintenanceMode:              input.MaintenanceMode,
	}, nil
}

func (repo *fakeAdminUsers) UpdateAdminMarketingFlags(
	_ context.Context,
	input ports.UpdateAdminMarketingFlagsInput,
) (ports.AdminPlatformSettingsRecord, error) {
	repo.updatedMarketingFlags = input
	if input.BrowseStore != nil {
		repo.marketingFlags.BrowseStore = *input.BrowseStore
	}
	if input.Discover != nil {
		repo.marketingFlags.Discover = *input.Discover
	}
	if input.CreateStore != nil {
		repo.marketingFlags.CreateStore = *input.CreateStore
	}
	if input.Pricing != nil {
		repo.marketingFlags.Pricing = *input.Pricing
	}
	settings := repo.platformSettings
	settings.MarketingFlags = repo.marketingFlags
	return settings, nil
}

func (repo *fakeAdminUsers) ReplaceAdminRolePermissions(
	_ context.Context,
	input ports.UpdateAdminRolePermissionsInput,
) (ports.AdminRolePermissionsRecord, error) {
	repo.updatedRolePermissions = input
	return ports.AdminRolePermissionsRecord{
		Role:        input.Role,
		Permissions: input.Permissions,
	}, nil
}

func (repo *fakeAdminUsers) RecordLogin(_ context.Context, userID common.ID) error {
	repo.loginUserID = userID
	return nil
}

func defaultTestRolePermissions() []ports.AdminRolePermissionsRecord {
	out := make([]ports.AdminRolePermissionsRecord, 0, len(admindomain.RoleCatalog()))
	for _, role := range admindomain.RoleCatalog() {
		out = append(out, ports.AdminRolePermissionsRecord{
			Role:        role,
			Permissions: role.Permissions(),
		})
	}
	return out
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

type fakeAdminBusinesses struct {
	cases                      []ports.AdminVerificationCaseRecord
	listCalled                 bool
	decided                    ports.AdminBusinessVerificationDecisionInput
	businesses                 []ports.AdminBusinessRecord
	customers                  []ports.AdminCustomerRecord
	customersListed            bool
	statusUpdate               ports.UpdateAdminBusinessStatusInput
	metrics                    ports.AdminPlatformMetricsRecord
	moneyRails                 ports.AdminMoneyRailsRecord
	subscriptions              []ports.AdminSubscriptionRecord
	subscriptionUpdate         ports.UpdateAdminSubscriptionInput
	issuedSubscriptionInvoice  ports.IssueAdminSubscriptionInvoiceInput
	paidSubscriptionInvoice    ports.MarkAdminSubscriptionInvoicePaidInput
	failedSubscriptionInvoice  ports.MarkAdminSubscriptionInvoiceFailedInput
	renewalReminders           []ports.EnqueueSubscriptionRenewalReminderInput
	renewalReminderSeen        map[string]bool
	sweepInput                 ports.RunAdminSubscriptionBillingSweepInput
	sweepResult                ports.AdminSubscriptionBillingSweepRecord
	plans                      []ports.AdminPlanRecord
	createdPlan                ports.CreateAdminPlanInput
	updatedPlan                ports.UpdateAdminPlanInput
	archivedPlan               ports.ArchiveAdminPlanInput
	updatedPlanEntitlements    ports.UpdateAdminPlanEntitlementsInput
	subscriptionDiscountCodes  []ports.AdminSubscriptionDiscountCodeRecord
	createdDiscountCode        ports.CreateAdminSubscriptionDiscountCodeInput
	updatedDiscountCode        ports.UpdateAdminSubscriptionDiscountCodeInput
	archivedDiscountCode       ports.ArchiveAdminSubscriptionDiscountCodeInput
	promotions                 []ports.AdminPromotionRecord
	createdPromotion           ports.CreateAdminPromotionInput
	updatedPromotion           ports.UpdateAdminPromotionInput
	archivedPromotion          ports.ArchiveAdminPromotionInput
	adCampaigns                []ports.AdminAdCampaignRecord
	createdAdCampaign          ports.CreateAdminAdCampaignInput
	updatedAdCampaign          ports.UpdateAdminAdCampaignInput
	archivedAdCampaign         ports.ArchiveAdminAdCampaignInput
	adPaymentIntent            ports.AdminAdCampaignPaymentIntentRecord
	createdAdCampaignPayment   ports.CreateAdminAdCampaignPaymentInput
	affiliates                 []ports.AdminAffiliateRecord
	createdAffiliate           ports.CreateAdminAffiliateInput
	updatedAffiliate           ports.UpdateAdminAffiliateInput
	archivedAffiliate          ports.ArchiveAdminAffiliateInput
	affiliateAttribution       []ports.AdminAffiliateAttributionRecord
	updatedAffiliateConversion ports.UpdateAdminAffiliateConversionStatusInput
	createdAffiliatePayout     ports.CreateAdminAffiliatePayoutInput
	referralProgrammes         []ports.AdminReferralProgrammeRecord
	createdReferralProgramme   ports.CreateAdminReferralProgrammeInput
	updatedReferralProgramme   ports.UpdateAdminReferralProgrammeInput
	archivedReferralProgramme  ports.ArchiveAdminReferralProgrammeInput
	createdReferralCode        ports.CreateAdminReferralCodeInput
	issuedReferralRewards      ports.IssueAdminReferralRewardsInput
	replay                     ports.QueueAdminMoneyReplayInput
	reversal                   ports.ReverseAdminMoneyPaymentInput
	hold                       ports.SetAdminSettlementReviewHoldInput
	riskReviews                []ports.AdminRiskReviewRecord
	riskUpdate                 ports.SetAdminRiskReviewStatusInput
	supportTickets             []ports.AdminSupportTicketRecord
	supportUpdate              ports.UpdateAdminSupportTicketInput
}

func (repo *fakeAdminBusinesses) ListAdminVerificationCases(context.Context) ([]ports.AdminVerificationCaseRecord, error) {
	repo.listCalled = true
	return repo.cases, nil
}

func (repo *fakeAdminBusinesses) DecideAdminBusinessVerification(
	_ context.Context,
	input ports.AdminBusinessVerificationDecisionInput,
) (ports.AdminVerificationCaseRecord, error) {
	repo.decided = input
	return ports.AdminVerificationCaseRecord{
		BusinessID:         input.BusinessID,
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		OwnerName:          "Ama Owner",
		OwnerEmail:         "ama@example.com",
		PlanName:           "Growth",
		PlanCode:           "growth",
		VerificationStatus: input.Status,
		SubmittedAt:        time.Now(),
		UpdatedAt:          time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) ListAdminBusinesses(context.Context) ([]ports.AdminBusinessRecord, error) {
	if repo.businesses != nil {
		return repo.businesses, nil
	}
	return []ports.AdminBusinessRecord{
		{
			BusinessID:         "business-1",
			Name:               "Ama Stitches",
			Handle:             "ama-stitches",
			OwnerName:          "Ama Owner",
			OwnerEmail:         "ama@example.com",
			PlanName:           "Growth",
			PlanCode:           "growth",
			VerificationStatus: business.VerificationStatusVerified,
			OperationalStatus:  business.OperationalStatusActive,
			LastActiveAt:       time.Now(),
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		},
	}, nil
}

func (repo *fakeAdminBusinesses) ListAdminCustomers(context.Context) ([]ports.AdminCustomerRecord, error) {
	repo.customersListed = true
	return repo.customers, nil
}

func (repo *fakeAdminBusinesses) ExportAdminCustomer(_ context.Context, customerID common.ID) (ports.AdminCustomerExportRecord, error) {
	return ports.AdminCustomerExportRecord{CustomerID: customerID}, nil
}

func (repo *fakeAdminBusinesses) EraseAdminCustomer(_ context.Context, customerID common.ID) (ports.AdminCustomerErasureRecord, error) {
	return ports.AdminCustomerErasureRecord{CustomerID: customerID}, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminBusinessStatus(
	_ context.Context,
	input ports.UpdateAdminBusinessStatusInput,
) (ports.AdminBusinessRecord, error) {
	repo.statusUpdate = input
	return ports.AdminBusinessRecord{
		BusinessID:         input.BusinessID,
		Name:               "Ama Stitches",
		Handle:             "ama-stitches",
		OwnerName:          "Ama Owner",
		OwnerEmail:         "ama@example.com",
		PlanName:           "Growth",
		PlanCode:           "growth",
		VerificationStatus: business.VerificationStatusVerified,
		OperationalStatus:  input.OperationalStatus,
		SuspensionReason:   input.SuspensionReason,
		LastActiveAt:       time.Now(),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) GetAdminPlatformMetrics(context.Context) (ports.AdminPlatformMetricsRecord, error) {
	if repo.metrics.UpdatedAt.IsZero() {
		repo.metrics.UpdatedAt = time.Now()
	}
	return repo.metrics, nil
}

func (repo *fakeAdminBusinesses) GetAdminMoneyRails(context.Context) (ports.AdminMoneyRailsRecord, error) {
	if repo.moneyRails.UpdatedAt.IsZero() {
		repo.moneyRails.UpdatedAt = time.Now()
	}
	return repo.moneyRails, nil
}

func (repo *fakeAdminBusinesses) ListAdminSubscriptions(context.Context) ([]ports.AdminSubscriptionRecord, error) {
	if repo.subscriptions != nil {
		return repo.subscriptions, nil
	}
	return []ports.AdminSubscriptionRecord{
		{
			SubscriptionID:     "subscription-1",
			BusinessID:         "business-1",
			BusinessName:       "Ama Stitches",
			Handle:             "ama-stitches",
			PlanCode:           "growth",
			PlanName:           "Growth",
			Status:             "active",
			BillingMode:        "manual",
			CurrentPeriodStart: time.Now(),
			CurrentPeriodEnd:   time.Now().Add(30 * 24 * time.Hour),
			UpdatedAt:          time.Now(),
		},
	}, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminSubscription(
	_ context.Context,
	input ports.UpdateAdminSubscriptionInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.subscriptionUpdate = input
	return ports.AdminSubscriptionRecord{
		SubscriptionID:          "subscription-1",
		BusinessID:              input.BusinessID,
		BusinessName:            "Ama Stitches",
		Handle:                  "ama-stitches",
		PlanCode:                "growth",
		PlanName:                "Growth",
		Status:                  input.Status,
		BillingMode:             input.BillingMode,
		ProviderCustomerRef:     input.ProviderCustomerRef,
		ProviderSubscriptionRef: input.ProviderSubscriptionRef,
		CurrentPeriodStart:      time.Now(),
		CurrentPeriodEnd:        time.Now().Add(30 * 24 * time.Hour),
		UpdatedAt:               time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) IssueAdminSubscriptionInvoice(
	_ context.Context,
	input ports.IssueAdminSubscriptionInvoiceInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.issuedSubscriptionInvoice = input
	return ports.AdminSubscriptionRecord{
		SubscriptionID:     "subscription-1",
		BusinessID:         input.BusinessID,
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		PlanCode:           "growth",
		PlanName:           "Growth",
		MonthlyFeeMinor:    12000,
		Status:             "active",
		BillingMode:        "payment_link",
		LastInvoiceRef:     input.InvoiceRef,
		NextBillingAt:      &input.DueAt,
		CurrentPeriodStart: time.Now(),
		CurrentPeriodEnd:   time.Now().Add(30 * 24 * time.Hour),
		UpdatedAt:          time.Now(),
		Invoices: []ports.AdminSubscriptionInvoiceRecord{
			{
				InvoiceID:      input.InvoiceID,
				SubscriptionID: "subscription-1",
				BusinessID:     input.BusinessID,
				InvoiceRef:     input.InvoiceRef,
				Status:         "issued",
				BillingMode:    "payment_link",
				AmountMinor:    12000,
				Currency:       "GHS",
				DueAt:          input.DueAt,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			},
		},
	}, nil
}

func (repo *fakeAdminBusinesses) MarkAdminSubscriptionInvoicePaid(
	_ context.Context,
	input ports.MarkAdminSubscriptionInvoicePaidInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.paidSubscriptionInvoice = input
	now := time.Now()
	return ports.AdminSubscriptionRecord{
		SubscriptionID:     "subscription-1",
		BusinessID:         "business-1",
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		PlanCode:           "growth",
		PlanName:           "Growth",
		MonthlyFeeMinor:    12000,
		Status:             "active",
		BillingMode:        "payment_link",
		LastInvoiceRef:     "XTSUB-INVOICE",
		LastPaymentAt:      &now,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   now.Add(30 * 24 * time.Hour),
		UpdatedAt:          now,
	}, nil
}

func (repo *fakeAdminBusinesses) MarkAdminSubscriptionInvoiceFailed(
	_ context.Context,
	input ports.MarkAdminSubscriptionInvoiceFailedInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.failedSubscriptionInvoice = input
	now := time.Now()
	next := now.Add(24 * time.Hour)
	return ports.AdminSubscriptionRecord{
		SubscriptionID:     "subscription-1",
		BusinessID:         "business-1",
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		PlanCode:           "growth",
		PlanName:           "Growth",
		MonthlyFeeMinor:    12000,
		Status:             "past_due",
		BillingMode:        "payment_link",
		LastInvoiceRef:     "XTSUB-INVOICE",
		NextBillingAt:      &next,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   now.Add(30 * 24 * time.Hour),
		UpdatedAt:          now,
	}, nil
}

func (repo *fakeAdminBusinesses) RunAdminSubscriptionBillingSweep(
	_ context.Context,
	input ports.RunAdminSubscriptionBillingSweepInput,
) (ports.AdminSubscriptionBillingSweepRecord, error) {
	repo.sweepInput = input
	if !repo.sweepResult.RanAt.IsZero() {
		return repo.sweepResult, nil
	}
	return ports.AdminSubscriptionBillingSweepRecord{
		RanAt: time.Now(),
	}, nil
}

// EnqueueSubscriptionRenewalReminder records the reminder input and dedupes on
// the caller-supplied dedup key, mirroring the outbox unique index so tests can
// assert a reminder is enqueued at most once per (subscription, period, kind).
func (repo *fakeAdminBusinesses) EnqueueSubscriptionRenewalReminder(
	_ context.Context,
	input ports.EnqueueSubscriptionRenewalReminderInput,
) (ports.SubscriptionRenewalReminderResult, error) {
	repo.renewalReminders = append(repo.renewalReminders, input)
	if repo.renewalReminderSeen == nil {
		repo.renewalReminderSeen = map[string]bool{}
	}
	if repo.renewalReminderSeen[input.DedupKey] {
		return ports.SubscriptionRenewalReminderResult{Enqueued: false}, nil
	}
	repo.renewalReminderSeen[input.DedupKey] = true
	return ports.SubscriptionRenewalReminderResult{Enqueued: true}, nil
}

func (repo *fakeAdminBusinesses) ListAdminPlans(context.Context) ([]ports.AdminPlanRecord, error) {
	if repo.plans != nil {
		return repo.plans, nil
	}
	return []ports.AdminPlanRecord{fakeAdminPlanRecord(
		"plan-growth",
		"growth",
		"Growth",
		12000,
		144000,
		50,
		nil,
		true,
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminPlan(
	_ context.Context,
	input ports.CreateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	repo.createdPlan = input
	return fakeAdminPlanRecord(
		"plan-created",
		input.Code,
		input.Name,
		input.MonthlyFeeMinor,
		input.YearlyFeeMinor,
		input.CommissionBPS,
		input.DesignLimit,
		true,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminPlan(
	_ context.Context,
	input ports.UpdateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	repo.updatedPlan = input
	return fakeAdminPlanRecord(
		input.PlanID,
		"growth",
		input.Name,
		input.MonthlyFeeMinor,
		input.YearlyFeeMinor,
		input.CommissionBPS,
		input.DesignLimit,
		input.IsActive,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminPlan(
	_ context.Context,
	input ports.ArchiveAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	repo.archivedPlan = input
	return fakeAdminPlanRecord(
		input.PlanID,
		"growth",
		"Growth",
		12000,
		144000,
		50,
		nil,
		false,
	), nil
}

func (repo *fakeAdminBusinesses) ListAdminPlanEntitlements(context.Context) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	return []ports.AdminPlanEntitlementFeatureRecord{
		{
			FeatureKey:  "online_ordering",
			Label:       "Online ordering",
			Description: "Checkout entitlement",
			Category:    "Storefront",
			ValueType:   "boolean",
			SortOrder:   1,
			IsActive:    true,
			Values: []ports.AdminPlanEntitlementValueRecord{
				{
					PlanID:    "plan-growth",
					PlanCode:  "growth",
					Enabled:   true,
					UpdatedAt: time.Now(),
				},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminPlanEntitlements(
	_ context.Context,
	input ports.UpdateAdminPlanEntitlementsInput,
) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	repo.updatedPlanEntitlements = input
	return repo.ListAdminPlanEntitlements(context.Background())
}

func (repo *fakeAdminBusinesses) ListAdminSubscriptionDiscountCodes(context.Context) ([]ports.AdminSubscriptionDiscountCodeRecord, error) {
	if repo.subscriptionDiscountCodes != nil {
		return repo.subscriptionDiscountCodes, nil
	}
	return []ports.AdminSubscriptionDiscountCodeRecord{
		fakeSubscriptionDiscountCodeRecord("discount-code-1", "WELCOME100", "percentage", 10000, true),
	}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminSubscriptionDiscountCode(
	_ context.Context,
	input ports.CreateAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	repo.createdDiscountCode = input
	return fakeSubscriptionDiscountCodeRecord(
		input.DiscountCodeID,
		input.Code,
		input.DiscountType,
		input.DiscountValue,
		input.Active,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminSubscriptionDiscountCode(
	_ context.Context,
	input ports.UpdateAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	repo.updatedDiscountCode = input
	return fakeSubscriptionDiscountCodeRecord(
		input.DiscountCodeID,
		input.Code,
		input.DiscountType,
		input.DiscountValue,
		input.Active,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminSubscriptionDiscountCode(
	_ context.Context,
	input ports.ArchiveAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	repo.archivedDiscountCode = input
	return fakeSubscriptionDiscountCodeRecord(
		input.DiscountCodeID,
		"WELCOME100",
		"percentage",
		10000,
		false,
	), nil
}

func fakeSubscriptionDiscountCodeRecord(
	discountCodeID common.ID,
	code string,
	discountType string,
	discountValue int,
	active bool,
) ports.AdminSubscriptionDiscountCodeRecord {
	return ports.AdminSubscriptionDiscountCodeRecord{
		DiscountCodeID:    discountCodeID,
		Code:              code,
		DiscountType:      discountType,
		DiscountValue:     discountValue,
		EligiblePlans:     []string{"starter", "growth"},
		EligibleCadences:  []string{"monthly", "yearly"},
		FirstPurchaseOnly: true,
		MaxPerAccount:     1,
		Active:            active,
		OwnerName:         "Test institution",
		BatchLabel:        "Launch",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}

func fakeAdminPlanRecord(
	planID common.ID,
	code string,
	name string,
	monthlyFeeMinor int64,
	yearlyFeeMinor int64,
	commissionBPS int,
	designLimit *int,
	isActive bool,
) ports.AdminPlanRecord {
	return ports.AdminPlanRecord{
		PlanID:                  planID,
		Code:                    code,
		Name:                    name,
		MonthlyFeeMinor:         monthlyFeeMinor,
		YearlyFeeMinor:          yearlyFeeMinor,
		CommissionBPS:           commissionBPS,
		DesignLimit:             designLimit,
		IsActive:                isActive,
		BusinessCount:           2,
		ActiveSubscriptionCount: 1,
		EstimatedMRRMinor:       monthlyFeeMinor,
		CreatedAt:               time.Now(),
		UpdatedAt:               time.Now(),
	}
}

func (repo *fakeAdminBusinesses) ListAdminPromotions(context.Context) ([]ports.AdminPromotionRecord, error) {
	if repo.promotions != nil {
		return repo.promotions, nil
	}
	return []ports.AdminPromotionRecord{fakeAdminPromotionRecord(
		"promotion-1",
		nil,
		"WELCOME10",
		"Welcome Ten",
		"percentage",
		1000,
		int64Ptr(5000),
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminPromotion(
	_ context.Context,
	input ports.CreateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	repo.createdPromotion = input
	return fakeAdminPromotionRecord(
		input.PromotionID,
		input.BusinessID,
		input.Code,
		input.Title,
		input.DiscountType,
		input.DiscountValue,
		input.MaxDiscountMinor,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminPromotion(
	_ context.Context,
	input ports.UpdateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	repo.updatedPromotion = input
	return fakeAdminPromotionRecord(
		input.PromotionID,
		input.BusinessID,
		input.Code,
		input.Title,
		input.DiscountType,
		input.DiscountValue,
		input.MaxDiscountMinor,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminPromotion(
	_ context.Context,
	input ports.ArchiveAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	repo.archivedPromotion = input
	return fakeAdminPromotionRecord(
		input.PromotionID,
		nil,
		"WELCOME10",
		"Welcome Ten",
		"percentage",
		1000,
		int64Ptr(5000),
		"archived",
	), nil
}

func fakeAdminPromotionRecord(
	promotionID common.ID,
	businessID *common.ID,
	code string,
	title string,
	discountType string,
	discountValue int64,
	maxDiscountMinor *int64,
	status string,
) ports.AdminPromotionRecord {
	record := ports.AdminPromotionRecord{
		PromotionID:           promotionID,
		BusinessID:            businessID,
		Code:                  code,
		Title:                 title,
		Description:           "first order",
		DiscountType:          discountType,
		DiscountValue:         discountValue,
		MaxDiscountMinor:      maxDiscountMinor,
		MinSpendMinor:         10000,
		UsageLimitGlobal:      intPtr(100),
		UsageLimitPerCustomer: intPtr(1),
		FundingSource:         "business",
		Scope:                 "store",
		Status:                status,
		RedemptionCount:       2,
		DiscountRedeemedMinor: 2500,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}
	if businessID != nil {
		record.BusinessName = "Ama Stitches"
		record.BusinessHandle = "ama-stitches"
	}
	return record
}

func (repo *fakeAdminBusinesses) ListAdminAdCampaigns(context.Context) ([]ports.AdminAdCampaignRecord, error) {
	if repo.adCampaigns != nil {
		return repo.adCampaigns, nil
	}
	return []ports.AdminAdCampaignRecord{fakeAdminAdCampaignRecord(
		"campaign-1",
		"business-1",
		"featured_business",
		"Featured Atelier",
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAdCampaign(
	_ context.Context,
	input ports.CreateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	repo.createdAdCampaign = input
	return fakeAdminAdCampaignRecord(
		input.CampaignID,
		input.BusinessID,
		input.PlacementType,
		input.Headline,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminAdCampaign(
	_ context.Context,
	input ports.UpdateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	repo.updatedAdCampaign = input
	return fakeAdminAdCampaignRecord(
		input.CampaignID,
		input.BusinessID,
		input.PlacementType,
		input.Headline,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminAdCampaign(
	_ context.Context,
	input ports.ArchiveAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	repo.archivedAdCampaign = input
	return fakeAdminAdCampaignRecord(
		input.CampaignID,
		"business-1",
		"featured_business",
		"Featured Atelier",
		"archived",
	), nil
}

func (repo *fakeAdminBusinesses) GetAdminAdCampaignPaymentIntent(
	context.Context,
	common.ID,
) (ports.AdminAdCampaignPaymentIntentRecord, error) {
	if !repo.adPaymentIntent.CampaignID.IsZero() {
		return repo.adPaymentIntent, nil
	}
	return ports.AdminAdCampaignPaymentIntentRecord{
		CampaignID:   "campaign-1",
		BusinessID:   "business-1",
		BusinessName: "Ama Stitches",
		OwnerEmail:   "owner@example.com",
		Headline:     "Featured Atelier",
		BudgetMinor:  50000,
		PaidMinor:    12500,
		DueMinor:     37500,
	}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAdCampaignPayment(
	_ context.Context,
	input ports.CreateAdminAdCampaignPaymentInput,
) (ports.AdminAdCampaignPaymentRecord, error) {
	repo.createdAdCampaignPayment = input
	now := time.Now()
	return ports.AdminAdCampaignPaymentRecord{
		PaymentID:         input.PaymentID,
		CampaignID:        input.CampaignID,
		BusinessID:        input.BusinessID,
		Provider:          "paystack",
		ProviderReference: input.ProviderReference,
		PaymentURL:        input.PaymentURL,
		AmountMinor:       input.AmountMinor,
		Currency:          input.Currency,
		Status:            "initiated",
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

func fakeAdminAdCampaignRecord(
	campaignID common.ID,
	businessID common.ID,
	placementType string,
	headline string,
	status string,
) ports.AdminAdCampaignRecord {
	now := time.Now()
	return ports.AdminAdCampaignRecord{
		CampaignID:      campaignID,
		BusinessID:      businessID,
		BusinessName:    "Ama Stitches",
		BusinessHandle:  "ama-stitches",
		PlacementType:   placementType,
		TargetLabel:     "Ama Stitches",
		Headline:        headline,
		Description:     "homepage slot",
		Status:          status,
		PricingModel:    "flat_time",
		BudgetMinor:     50000,
		SpendMinor:      12500,
		DailyCapMinor:   int64Ptr(15000),
		StartsAt:        now,
		EndsAt:          now.Add(7 * 24 * time.Hour),
		ImpressionCount: 100,
		ClickCount:      8,
		ClickRateBPS:    800,
		ReviewNote:      "verified advertiser",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}

func (repo *fakeAdminBusinesses) ListAdminAffiliates(context.Context) ([]ports.AdminAffiliateRecord, error) {
	if repo.affiliates != nil {
		return repo.affiliates, nil
	}
	return []ports.AdminAffiliateRecord{fakeAdminAffiliateRecord(
		"affiliate-1",
		"SEWINGPRO",
		"Sewing Pro Partners",
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) ListAdminAffiliateAttribution(context.Context) ([]ports.AdminAffiliateAttributionRecord, error) {
	if repo.affiliateAttribution != nil {
		return repo.affiliateAttribution, nil
	}
	return []ports.AdminAffiliateAttributionRecord{
		fakeAdminAffiliateAttributionRecord("affiliate-1", "SEWINGPRO", "Sewing Pro Partners"),
	}, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminAffiliateConversionStatus(
	_ context.Context,
	input ports.UpdateAdminAffiliateConversionStatusInput,
) (ports.AdminAffiliateConversionRecord, error) {
	repo.updatedAffiliateConversion = input
	record := fakeAdminAffiliateAttributionRecord(
		"affiliate-1",
		"SEWINGPRO",
		"Sewing Pro Partners",
	).RecentConversions[0]
	record.ConversionID = input.ConversionID
	record.Status = input.Status
	return record, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAffiliatePayout(
	_ context.Context,
	input ports.CreateAdminAffiliatePayoutInput,
) (ports.AdminAffiliatePayoutRecord, error) {
	repo.createdAffiliatePayout = input
	now := time.Now()
	return ports.AdminAffiliatePayoutRecord{
		PayoutBatchID:   input.PayoutBatchID,
		AffiliateID:     input.AffiliateID,
		DisplayName:     "Sewing Pro Partners",
		PayoutMode:      "paystack_transfer",
		PayoutReference: input.PayoutReference,
		ConversionCount: 2,
		GrossMinor:      25000,
		CommissionMinor: 2500,
		Status:          "settled",
		Notes:           input.Notes,
		CreatedAt:       now,
		UpdatedAt:       now,
	}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAffiliate(
	_ context.Context,
	input ports.CreateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	repo.createdAffiliate = input
	return fakeAdminAffiliateRecord(
		input.AffiliateID,
		input.Code,
		input.DisplayName,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminAffiliate(
	_ context.Context,
	input ports.UpdateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	repo.updatedAffiliate = input
	return fakeAdminAffiliateRecord(
		input.AffiliateID,
		input.Code,
		input.DisplayName,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminAffiliate(
	_ context.Context,
	input ports.ArchiveAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	repo.archivedAffiliate = input
	return fakeAdminAffiliateRecord(
		input.AffiliateID,
		"SEWINGPRO",
		"Sewing Pro Partners",
		"archived",
	), nil
}

func fakeAdminAffiliateRecord(
	affiliateID common.ID,
	code string,
	displayName string,
	status string,
) ports.AdminAffiliateRecord {
	now := time.Now()
	return ports.AdminAffiliateRecord{
		AffiliateID:      affiliateID,
		EntityType:       "agency",
		Code:             code,
		DisplayName:      displayName,
		ContactName:      "Ama Partner",
		Email:            "ama@example.com",
		Phone:            "+233 20 000 0000",
		WebsiteURL:       "https://partners.example.com/ref",
		CommissionModel:  "percentage",
		CommissionRate:   1250,
		CookieWindowDays: 45,
		PayoutMode:       "paystack_transfer",
		PayoutReference:  "KYC transfer account",
		Status:           status,
		Notes:            "reviewed",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

func fakeAdminAffiliateAttributionRecord(
	affiliateID common.ID,
	code string,
	displayName string,
) ports.AdminAffiliateAttributionRecord {
	now := time.Now()
	return ports.AdminAffiliateAttributionRecord{
		AffiliateID:             affiliateID,
		Code:                    code,
		DisplayName:             displayName,
		ClickCount:              12,
		ConversionCount:         2,
		PendingConversionCount:  1,
		ApprovedConversionCount: 1,
		GrossMinor:              25000,
		CommissionMinor:         2500,
		LastActivityAt:          &now,
		RecentConversions: []ports.AdminAffiliateConversionRecord{
			{
				ConversionID:     "conversion-1",
				AffiliateID:      affiliateID,
				BusinessID:       "business-1",
				BusinessName:     "Ama Stitches",
				OrderID:          "order-1",
				GrossMinor:       15000,
				CommissionMinor:  1500,
				Status:           "pending",
				AttributionModel: "last_click",
				CreatedAt:        now,
				UpdatedAt:        now,
			},
		},
		RecentPayouts: []ports.AdminAffiliatePayoutRecord{
			{
				PayoutBatchID:   "payout-1",
				AffiliateID:     affiliateID,
				DisplayName:     displayName,
				PayoutMode:      "paystack_transfer",
				PayoutReference: "TRF_123",
				ConversionCount: 2,
				GrossMinor:      25000,
				CommissionMinor: 2500,
				Status:          "settled",
				Notes:           "sent from settled commission",
				CreatedAt:       now,
				UpdatedAt:       now,
			},
		},
	}
}

func (repo *fakeAdminBusinesses) ListAdminReferralProgrammes(context.Context) ([]ports.AdminReferralProgrammeRecord, error) {
	if repo.referralProgrammes != nil {
		return repo.referralProgrammes, nil
	}
	return []ports.AdminReferralProgrammeRecord{fakeAdminReferralProgrammeRecord(
		"referral-programme-1",
		"Launch referrals",
		"LAUNCH",
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminReferralProgramme(
	_ context.Context,
	input ports.CreateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	repo.createdReferralProgramme = input
	return fakeAdminReferralProgrammeRecord(
		input.ProgrammeID,
		input.Title,
		input.CodePrefix,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminReferralProgramme(
	_ context.Context,
	input ports.UpdateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	repo.updatedReferralProgramme = input
	return fakeAdminReferralProgrammeRecord(
		input.ProgrammeID,
		input.Title,
		input.CodePrefix,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminReferralProgramme(
	_ context.Context,
	input ports.ArchiveAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	repo.archivedReferralProgramme = input
	return fakeAdminReferralProgrammeRecord(
		input.ProgrammeID,
		"Launch referrals",
		"LAUNCH",
		"archived",
	), nil
}

func (repo *fakeAdminBusinesses) CreateAdminReferralCode(
	_ context.Context,
	input ports.CreateAdminReferralCodeInput,
) (ports.AdminReferralCodeRecord, error) {
	repo.createdReferralCode = input
	record := ports.AdminReferralCodeRecord{
		ReferralCodeID: input.ReferralCodeID,
		ProgrammeID:    input.ProgrammeID,
		BusinessID:     input.BusinessID,
		OwnerType:      input.OwnerType,
		Code:           input.Code,
		Status:         input.Status,
		OwnerLabel:     "Platform",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if input.BusinessID != nil {
		record.OwnerBusinessID = input.BusinessID
		record.BusinessName = "Ama Stitches"
		record.BusinessHandle = "ama-stitches"
		record.OwnerLabel = "Ama Stitches"
	}
	return record, nil
}

func (repo *fakeAdminBusinesses) IssueAdminReferralRewards(
	_ context.Context,
	input ports.IssueAdminReferralRewardsInput,
) (ports.AdminReferralRewardIssueRecord, error) {
	repo.issuedReferralRewards = input
	return ports.AdminReferralRewardIssueRecord{
		ReferralCount:         2,
		RewardCount:           3,
		VoucherCount:          2,
		CommissionRebateCount: 1,
		TotalRewardMinor:      10000,
		IssuedAt:              time.Now(),
	}, nil
}

func fakeAdminReferralProgrammeRecord(
	programmeID common.ID,
	title string,
	codePrefix string,
	status string,
) ports.AdminReferralProgrammeRecord {
	now := time.Now()
	maxReward := int64(10000)
	return ports.AdminReferralProgrammeRecord{
		ProgrammeID:             programmeID,
		Title:                   title,
		CodePrefix:              codePrefix,
		Audience:                "customers",
		ReferrerRewardKind:      "voucher",
		RefereeRewardKind:       "voucher",
		RewardType:              "percentage",
		RewardValue:             1000,
		MaxRewardMinor:          &maxReward,
		QualifyingOrderMinMinor: 50000,
		RewardHoldDays:          14,
		Status:                  status,
		Notes:                   "launch referral programme",
		CreatedAt:               now,
		UpdatedAt:               now,
	}
}

func intPtr(value int) *int {
	return &value
}

func int64Ptr(value int64) *int64 {
	return &value
}

func (repo *fakeAdminBusinesses) QueueAdminMoneyReplay(
	_ context.Context,
	input ports.QueueAdminMoneyReplayInput,
) (ports.AdminMoneyReplayRequestRecord, error) {
	repo.replay = input
	return ports.AdminMoneyReplayRequestRecord{
		ReplayRequestID:   input.ReplayRequestID,
		ProviderReference: input.ProviderReference,
		PaymentID:         "payment-1",
		BusinessName:      "Ama Stitches",
		Reason:            input.Reason,
		Status:            "queued",
		CreatedAt:         time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) ReverseAdminMoneyPayment(
	_ context.Context,
	input ports.ReverseAdminMoneyPaymentInput,
) (ports.AdminMoneyReversalRecord, error) {
	repo.reversal = input
	orderID := common.ID("order-1")
	return ports.AdminMoneyReversalRecord{
		PaymentID:                "payment-1",
		ProviderReference:        input.ProviderReference,
		BusinessID:               "business-1",
		BusinessName:             "Ama Stitches",
		OrderID:                  &orderID,
		PaymentReversed:          true,
		PromotionRedemptionCount: 1,
		AffiliateConversionCount: 1,
		ReferralCount:            1,
		ReferralRewardCount:      2,
		GeneratedPromotionCount:  1,
		Reason:                   input.Reason,
		ReversedAt:               time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) SetAdminSettlementReviewHold(
	_ context.Context,
	input ports.SetAdminSettlementReviewHoldInput,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	repo.hold = input
	return ports.AdminMoneyPayoutReviewRecord{
		ID:              input.BusinessID.String(),
		BusinessName:    "Ama Stitches",
		SubaccountRef:   "DEV_SUB_1",
		Status:          "blocked",
		SettlementMinor: 10000,
		CommissionMinor: 300,
		NextAction:      input.Reason,
		HoldActive:      input.Hold,
		HoldReason:      input.Reason,
	}, nil
}

func (repo *fakeAdminBusinesses) ListAdminRiskReviews(context.Context) ([]ports.AdminRiskReviewRecord, error) {
	return repo.riskReviews, nil
}

func (repo *fakeAdminBusinesses) SetAdminRiskReviewStatus(
	_ context.Context,
	input ports.SetAdminRiskReviewStatusInput,
) (ports.AdminRiskReviewRecord, error) {
	repo.riskUpdate = input
	return ports.AdminRiskReviewRecord{
		ReviewKey:    input.ReviewKey,
		BusinessID:   "business-1",
		Title:        "Payment failure spike",
		BusinessName: "Ama Stitches",
		Level:        "high",
		Reason:       "3 failed payment(s) in the last 30 days.",
		Owner:        "Money rails",
		Status:       input.Status,
		UpdatedAt:    time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) ListAdminSupportTickets(context.Context) ([]ports.AdminSupportTicketRecord, error) {
	return repo.supportTickets, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminSupportTicket(
	_ context.Context,
	input ports.UpdateAdminSupportTicketInput,
) (ports.AdminSupportTicketRecord, error) {
	repo.supportUpdate = input
	assigned := common.ID("")
	if input.Assignment == "self" {
		assigned = input.ActorAdminUser
	}
	return ports.AdminSupportTicketRecord{
		TicketKey:           input.TicketKey,
		BusinessID:          "business-1",
		Subject:             "Customer payment needs follow-up",
		BusinessName:        "Ama Stitches",
		Priority:            "urgent",
		Summary:             "Payment failed.",
		Category:            "Payments",
		Status:              input.Status,
		AssignedAdminUserID: assigned,
		AssignedAdminEmail:  "support@example.com",
		AssignedAdminName:   "Support Agent",
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}, nil
}

type fakeAdminSessions struct {
	created ports.CreateAdminSessionInput
	session ports.AdminSessionWithUser
	findErr error
	revoked []common.ID
}

type fakeAdminAudits struct {
	created []ports.CreateAdminAuditEventInput
	events  []ports.AdminAuditEventRecord
}

func (repo *fakeAdminAudits) CreateAdminAuditEvent(
	_ context.Context,
	input ports.CreateAdminAuditEventInput,
) (ports.AdminAuditEventRecord, error) {
	repo.created = append(repo.created, input)
	return ports.AdminAuditEventRecord{
		AuditEventID: input.AuditEventID,
		ActorUserID:  input.ActorUserID,
		ActorRole:    input.ActorRole,
		Action:       input.Action,
		TargetType:   input.TargetType,
		TargetID:     input.TargetID,
		TargetLabel:  input.TargetLabel,
		Summary:      input.Summary,
		Severity:     input.Severity,
		Metadata:     input.Metadata,
		IPAddress:    input.IPAddress,
		UserAgent:    input.UserAgent,
	}, nil
}

func (repo *fakeAdminAudits) ListAdminAuditEvents(
	context.Context,
	ports.ListAdminAuditEventsInput,
) ([]ports.AdminAuditEventRecord, error) {
	return repo.events, nil
}

func (repo *fakeAdminSessions) Create(_ context.Context, input ports.CreateAdminSessionInput) error {
	repo.created = input
	return nil
}

func (repo *fakeAdminSessions) FindByRefreshTokenHash(_ context.Context, _ string) (ports.AdminSessionWithUser, error) {
	if repo.findErr != nil {
		return ports.AdminSessionWithUser{}, repo.findErr
	}
	return repo.session, nil
}

func (repo *fakeAdminSessions) Revoke(_ context.Context, sessionID common.ID) error {
	repo.revoked = append(repo.revoked, sessionID)
	return nil
}

type fakePasswordHasher struct{}

func (fakePasswordHasher) Hash(password string) (string, error) {
	return "hashed:" + password, nil
}

func (fakePasswordHasher) Compare(hash string, password string) error {
	if hash != "hashed:"+password {
		return errors.New("password mismatch")
	}
	return nil
}

type countingPasswordHasher struct {
	hashCalls int
}

func (h *countingPasswordHasher) Hash(password string) (string, error) {
	h.hashCalls++
	return "hashed:" + password, nil
}

func (h *countingPasswordHasher) Compare(hash string, password string) error {
	if hash != "hashed:"+password {
		return errors.New("password mismatch")
	}
	return nil
}

type fakeAdminTokenIssuer struct{}

func (fakeAdminTokenIssuer) IssueAdminAccessToken(_ context.Context, input ports.AdminAccessTokenInput) (string, error) {
	return "admin-access:" + input.Subject.String() + ":" + string(input.Role), nil
}

type fakePaymentProvider struct {
	initialized               ports.InitializeTransactionInput
	authorizationInitialized  ports.InitializeAuthorizationInput
	authorizationInitResult   ports.InitializeAuthorizationResult
	authorizationInitErr      error
	authorizationVerified     ports.VerifyAuthorizationInput
	authorizationVerifyResult ports.VerifyAuthorizationResult
	authorizationVerifyErr    error
	charged                   []ports.ChargeAuthorizationInput
	chargeResult              ports.ChargeAuthorizationResult
	chargeErr                 error
}

func (fakePaymentProvider) CreateBusinessSubaccount(
	context.Context,
	ports.CreateBusinessSubaccountInput,
) (ports.CreateBusinessSubaccountResult, error) {
	return ports.CreateBusinessSubaccountResult{}, nil
}

func (provider *fakePaymentProvider) InitializeTransaction(
	_ context.Context,
	input ports.InitializeTransactionInput,
) (ports.InitializeTransactionResult, error) {
	provider.initialized = input
	return ports.InitializeTransactionResult{
		AuthorizationURL:  "https://paystack.test/" + input.Reference,
		ProviderReference: "PAY_" + input.Reference,
	}, nil
}

func (provider *fakePaymentProvider) InitializeAuthorization(
	_ context.Context,
	input ports.InitializeAuthorizationInput,
) (ports.InitializeAuthorizationResult, error) {
	provider.authorizationInitialized = input
	if provider.authorizationInitErr != nil {
		return ports.InitializeAuthorizationResult{}, provider.authorizationInitErr
	}
	if provider.authorizationInitResult.RedirectURL != "" ||
		provider.authorizationInitResult.Reference != "" {
		return provider.authorizationInitResult, nil
	}
	return ports.InitializeAuthorizationResult{
		RedirectURL: "https://paystack.test/authorize/" + input.BusinessID.String(),
		AccessCode:  "access_" + input.BusinessID.String(),
		Reference:   "auth_ref_" + input.BusinessID.String(),
	}, nil
}

func (provider *fakePaymentProvider) VerifyAuthorization(
	_ context.Context,
	input ports.VerifyAuthorizationInput,
) (ports.VerifyAuthorizationResult, error) {
	provider.authorizationVerified = input
	if provider.authorizationVerifyErr != nil {
		return ports.VerifyAuthorizationResult{}, provider.authorizationVerifyErr
	}
	if provider.authorizationVerifyResult.AuthorizationCode != "" ||
		provider.authorizationVerifyResult.CustomerCode != "" {
		return provider.authorizationVerifyResult, nil
	}
	return ports.VerifyAuthorizationResult{
		AuthorizationCode: "AUTH_" + input.Reference,
		CustomerCode:      "CUS_" + input.Reference,
		CustomerEmail:     "owner@example.com",
		Channel:           "direct_debit",
		Bank:              "Test Bank",
		Active:            true,
	}, nil
}

func (provider *fakePaymentProvider) ChargeAuthorization(
	_ context.Context,
	input ports.ChargeAuthorizationInput,
) (ports.ChargeAuthorizationResult, error) {
	provider.charged = append(provider.charged, input)
	if provider.chargeErr != nil {
		return ports.ChargeAuthorizationResult{}, provider.chargeErr
	}
	if provider.chargeResult.Status != "" || provider.chargeResult.ProviderReference != "" {
		return provider.chargeResult, nil
	}
	return ports.ChargeAuthorizationResult{
		ProviderReference: input.Reference,
		Status:            "success",
		AmountMinor:       input.AmountMinor,
		Currency:          input.Currency,
	}, nil
}

func (fakePaymentProvider) VerifyWebhookSignature([]byte, string) bool {
	return true
}

func (fakePaymentProvider) ParseChargeEvent([]byte) (ports.ProviderChargeEvent, error) {
	return ports.ProviderChargeEvent{}, nil
}

type fakeRefreshTokens struct{}

func (fakeRefreshTokens) NewRefreshToken() (string, error) {
	return "refresh-token", nil
}

func (fakeRefreshTokens) HashRefreshToken(token string) string {
	return "hash:" + token
}

type sequenceIDs struct {
	ids []common.ID
}

func (seq *sequenceIDs) NewID() common.ID {
	id := seq.ids[0]
	seq.ids = seq.ids[1:]
	return id
}

type fixedClock struct {
	now time.Time
}

func (clock fixedClock) Now() time.Time {
	return clock.now
}
