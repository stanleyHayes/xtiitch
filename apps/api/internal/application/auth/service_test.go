package authapp

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestRegisterBusinessCreatesOwnerSession(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	sessions := &fakeSessionRepository{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      sessions,
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"business-1", "user-1", "session-1"}},
		Clock:         fixedClock{now: time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)},
	})

	result, err := service.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "Ama-Stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "AMA@example.com",
		OwnerPassword:    "strong-password",
		UserAgent:        "test-agent",
		IPAddress:        "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("register business: %v", err)
	}

	if businesses.created.BusinessHandle != "ama-stitch" {
		t.Fatalf("expected normalized handle, got %q", businesses.created.BusinessHandle)
	}
	if businesses.created.OwnerEmail != "ama@example.com" {
		t.Fatalf("expected normalized email, got %q", businesses.created.OwnerEmail)
	}
	if businesses.created.OwnerPassword != "hashed:strong-password" {
		t.Fatalf("expected password hash to be persisted, got %q", businesses.created.OwnerPassword)
	}
	if result.AccessToken != "access:user-1:business-1:owner" {
		t.Fatalf("unexpected access token %q", result.AccessToken)
	}
	if result.RefreshToken != "refresh-token" {
		t.Fatalf("unexpected refresh token %q", result.RefreshToken)
	}
	if sessions.created.RefreshTokenHash != "hash:refresh-token" {
		t.Fatalf("expected refresh token hash, got %q", sessions.created.RefreshTokenHash)
	}
}

func TestRegisterBusinessRejectsWeakPassword(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Businesses:    &fakeBusinessIdentityRepository{},
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"business-1", "user-1", "session-1"}},
		Clock:         fixedClock{now: time.Now()},
	})

	_, err := service.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    "short",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestRegisterBusinessRejectsReservedHandle(t *testing.T) {
	t.Parallel()

	for _, handle := range []string{"app", "admin", "api", "www", "App", " ADMIN "} {
		businesses := &fakeBusinessIdentityRepository{}
		service := NewService(Dependencies{
			Businesses:    businesses,
			Sessions:      &fakeSessionRepository{},
			Passwords:     fakePasswordHasher{},
			AccessTokens:  fakeTokenIssuer{},
			RefreshTokens: fakeRefreshTokens{},
			IDs:           &sequenceIDs{ids: []common.ID{"business-1", "user-1", "session-1"}},
			Clock:         fixedClock{now: time.Now()},
		})

		_, err := service.RegisterBusiness(context.Background(), RegisterBusinessCommand{
			BusinessName:     "Reserved Co",
			BusinessHandle:   handle,
			OwnerDisplayName: "Ama",
			OwnerEmail:       "ama@example.com",
			OwnerPassword:    "DemoPass12345",
		})
		if !errors.Is(err, authdomain.ErrInvalidInput) {
			t.Fatalf("handle %q: expected reserved handle rejected, got %v", handle, err)
		}
		if businesses.created.BusinessHandle != "" {
			t.Fatalf("handle %q: a reserved handle must create nothing", handle)
		}
	}
}

func TestCheckHandleAvailability(t *testing.T) {
	t.Parallel()

	newService := func(exists bool) Service {
		return NewService(Dependencies{
			Businesses:    &fakeBusinessIdentityRepository{handleExists: exists},
			Sessions:      &fakeSessionRepository{},
			Passwords:     fakePasswordHasher{},
			AccessTokens:  fakeTokenIssuer{},
			RefreshTokens: fakeRefreshTokens{},
			IDs:           &sequenceIDs{},
			Clock:         fixedClock{now: time.Now()},
		})
	}

	cases := []struct {
		name      string
		raw       string
		exists    bool
		available bool
		reason    string
	}{
		{"free handle", "ama-designs", false, true, ""},
		{"normalizes case", "  Ama-Designs ", false, true, ""},
		{"taken", "ama-designs", true, false, "taken"},
		{"reserved", "admin", false, false, "reserved"},
		{"invalid chars", "-bad-", false, false, "invalid"},
		{"too short", "a", false, false, "invalid"},
	}
	for _, tc := range cases {
		result, err := newService(tc.exists).CheckHandleAvailability(context.Background(), tc.raw)
		if err != nil {
			t.Fatalf("%s: unexpected error: %v", tc.name, err)
		}
		if result.Available != tc.available || result.Reason != tc.reason {
			t.Fatalf("%s: expected available=%v reason=%q, got available=%v reason=%q",
				tc.name, tc.available, tc.reason, result.Available, result.Reason)
		}
	}
}

func TestLoginBusinessIssuesSessionForValidCredentials(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		credentials: ports.BusinessUserCredentials{
			BusinessID:   "business-1",
			UserID:       "user-1",
			PasswordHash: "hashed:strong-password",
			Role:         business.UserRoleOwner,
			IsActive:     true,
		},
	}
	sessions := &fakeSessionRepository{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      sessions,
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"session-1"}},
		Clock:         fixedClock{now: time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)},
	})

	result, err := service.LoginBusiness(context.Background(), LoginBusinessCommand{
		BusinessHandle: "Ama-Stitch",
		OwnerEmail:     "AMA@example.com",
		OwnerPassword:  "strong-password",
	})
	if err != nil {
		t.Fatalf("login business: %v", err)
	}

	if businesses.lookupHandle != "ama-stitch" {
		t.Fatalf("expected normalized handle, got %q", businesses.lookupHandle)
	}
	if businesses.lookupEmail != "ama@example.com" {
		t.Fatalf("expected normalized email, got %q", businesses.lookupEmail)
	}
	if result.AccessToken == "" || sessions.created.SessionID == "" {
		t.Fatal("expected access token and persisted session")
	}
}

func TestLoginBusinessRejectsInvalidPassword(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Businesses: &fakeBusinessIdentityRepository{
			credentials: ports.BusinessUserCredentials{
				BusinessID:   "business-1",
				UserID:       "user-1",
				PasswordHash: "hashed:strong-password",
				Role:         business.UserRoleOwner,
				IsActive:     true,
			},
		},
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"session-1"}},
		Clock:         fixedClock{now: time.Now()},
	})

	_, err := service.LoginBusiness(context.Background(), LoginBusinessCommand{
		BusinessHandle: "ama-stitch",
		OwnerEmail:     "ama@example.com",
		OwnerPassword:  "wrong-password",
	})
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
}

func TestRegisterBusinessPropagatesHandleConflict(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{createErr: business.ErrHandleTaken}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"business-1", "user-1", "session-1"}},
		Clock:         fixedClock{now: time.Now()},
	})

	_, err := service.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    "strong-password",
	})
	if !errors.Is(err, business.ErrHandleTaken) {
		t.Fatalf("expected handle conflict to propagate, got %v", err)
	}
}

func TestRegisterBusinessRejectsOverlongPassword(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Businesses:    &fakeBusinessIdentityRepository{},
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"business-1", "user-1", "session-1"}},
		Clock:         fixedClock{now: time.Now()},
	})

	_, err := service.RegisterBusiness(context.Background(), RegisterBusinessCommand{
		BusinessName:     "Ama Stitch House",
		BusinessHandle:   "ama-stitch",
		OwnerDisplayName: "Ama",
		OwnerEmail:       "ama@example.com",
		OwnerPassword:    strings.Repeat("a", 73),
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid input for overlong password, got %v", err)
	}
}

func TestLoginBusinessEqualisesTimingForUnknownUser(t *testing.T) {
	t.Parallel()

	hasher := &countingPasswordHasher{}
	businesses := &fakeBusinessIdentityRepository{findErr: errors.New("not found")}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     hasher,
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"session-1"}},
		Clock:         fixedClock{now: time.Now()},
	})

	_, err := service.LoginBusiness(context.Background(), LoginBusinessCommand{
		BusinessHandle: "ama-stitch",
		OwnerEmail:     "ama@example.com",
		OwnerPassword:  "strong-password",
	})
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if hasher.hashCalls != 1 {
		t.Fatalf("expected one equalising hash call, got %d", hasher.hashCalls)
	}
}

func newRefreshTestService(sessions *fakeSessionRepository, now time.Time) Service {
	return NewService(Dependencies{
		Businesses:    &fakeBusinessIdentityRepository{},
		Sessions:      sessions,
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"session-2"}},
		Clock:         fixedClock{now: now},
	})
}

func activeSession(now time.Time) ports.AuthSessionWithUser {
	return ports.AuthSessionWithUser{
		SessionID:      "session-1",
		BusinessID:     "business-1",
		BusinessUserID: "user-1",
		Role:           business.UserRoleOwner,
		UserIsActive:   true,
		Revoked:        false,
		ExpiresAt:      now.Add(time.Hour),
	}
}

func TestRefreshSessionRotatesValidToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)
	sessions := &fakeSessionRepository{session: activeSession(now)}
	service := newRefreshTestService(sessions, now)

	result, err := service.RefreshSession(context.Background(), RefreshSessionCommand{RefreshToken: "old-refresh"})
	if err != nil {
		t.Fatalf("refresh session: %v", err)
	}
	if result.AccessToken == "" || result.RefreshToken == "" {
		t.Fatal("expected new access and refresh tokens")
	}
	if len(sessions.revoked) != 1 || sessions.revoked[0] != common.ID("session-1") {
		t.Fatalf("expected presented session to be revoked, got %v", sessions.revoked)
	}
	if sessions.created.SessionID != common.ID("session-2") {
		t.Fatalf("expected a rotated session to be created, got %q", sessions.created.SessionID)
	}
}

func TestRefreshSessionRejectsRevokedToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)
	session := activeSession(now)
	session.Revoked = true
	sessions := &fakeSessionRepository{session: session}
	service := newRefreshTestService(sessions, now)

	_, err := service.RefreshSession(context.Background(), RefreshSessionCommand{RefreshToken: "x"})
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if len(sessions.revoked) != 0 {
		t.Fatal("expected no rotation when refresh is rejected")
	}
}

func TestRefreshSessionRejectsExpiredToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)
	session := activeSession(now)
	session.ExpiresAt = now.Add(-time.Minute)
	sessions := &fakeSessionRepository{session: session}
	service := newRefreshTestService(sessions, now)

	_, err := service.RefreshSession(context.Background(), RefreshSessionCommand{RefreshToken: "x"})
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
}

func TestRefreshSessionRejectsInactiveUser(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)
	session := activeSession(now)
	session.UserIsActive = false
	sessions := &fakeSessionRepository{session: session}
	service := newRefreshTestService(sessions, now)

	_, err := service.RefreshSession(context.Background(), RefreshSessionCommand{RefreshToken: "x"})
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
}

func TestLogoutRevokesSession(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)
	sessions := &fakeSessionRepository{session: activeSession(now)}
	service := newRefreshTestService(sessions, now)

	if err := service.Logout(context.Background(), LogoutCommand{RefreshToken: "x"}); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if len(sessions.revoked) != 1 || sessions.revoked[0] != common.ID("session-1") {
		t.Fatalf("expected session to be revoked, got %v", sessions.revoked)
	}
}

func TestLogoutIsIdempotentForUnknownToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)
	sessions := &fakeSessionRepository{findErr: errors.New("not found")}
	service := newRefreshTestService(sessions, now)

	if err := service.Logout(context.Background(), LogoutCommand{RefreshToken: "x"}); err != nil {
		t.Fatalf("expected logout to be idempotent, got %v", err)
	}
	if len(sessions.revoked) != 0 {
		t.Fatal("expected nothing to be revoked for an unknown token")
	}
}

func TestListBusinessUsersRequiresOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		users: []ports.BusinessUserRecord{{UserID: "owner-1", BusinessID: "business-1", Role: business.UserRoleOwner}},
	}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"unused"}},
		Clock:         fixedClock{now: time.Now()},
	})

	users, err := service.ListBusinessUsers(context.Background(), ListBusinessUsersCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
	})
	if err != nil {
		t.Fatalf("list business users: %v", err)
	}
	if len(users) != 1 || businesses.listScope.BusinessID != "business-1" {
		t.Fatalf("expected scoped user list, got users=%v scope=%q", users, businesses.listScope.BusinessID)
	}

	_, err = service.ListBusinessUsers(context.Background(), ListBusinessUsersCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleStaff,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff users to be forbidden, got %v", err)
	}
}

func TestCreateBusinessUserNormalizesAndHashesInput(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"user-2"}},
		Clock:         fixedClock{now: time.Now()},
	})

	user, err := service.CreateBusinessUser(context.Background(), CreateBusinessUserCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleAdmin,
		DisplayName: "  Kofi Admin  ",
		Email:       "KOFI@example.com",
		Password:    "strong-password",
		Role:        business.UserRoleAdmin,
	})
	if err != nil {
		t.Fatalf("create business user: %v", err)
	}
	if businesses.createdUser.UserID != "user-2" || businesses.createdUser.BusinessID != "business-1" {
		t.Fatalf("expected generated scoped user id, got %+v", businesses.createdUser)
	}
	if businesses.createdUser.Email != "kofi@example.com" || businesses.createdUser.DisplayName != "Kofi Admin" {
		t.Fatalf("expected normalized identity, got %+v", businesses.createdUser)
	}
	if businesses.createdUser.PasswordHash != "hashed:strong-password" {
		t.Fatalf("expected password hash, got %q", businesses.createdUser.PasswordHash)
	}
	if user.UserID != "user-2" || user.Role != business.UserRoleAdmin {
		t.Fatalf("unexpected created user response: %+v", user)
	}
}

func TestCreateBusinessUserRejectsOwnerRole(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"user-2"}},
		Clock:         fixedClock{now: time.Now()},
	})

	_, err := service.CreateBusinessUser(context.Background(), CreateBusinessUserCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		DisplayName: "Second Owner",
		Email:       "owner2@example.com",
		Password:    "strong-password",
		Role:        business.UserRoleOwner,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected owner role to be rejected, got %v", err)
	}
	if businesses.createdUser.UserID != "" {
		t.Fatalf("expected no user to be created, got %+v", businesses.createdUser)
	}
}

func TestCreateBusinessUserSendsInviteEmailWithoutPassword(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	emails := &fakeEmailSender{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		Emails:        emails,
		DashboardURL:  "https://app.xtiitch.com",
		IDs:           &sequenceIDs{ids: []common.ID{"user-2"}},
		Clock:         fixedClock{now: time.Now()},
	})

	_, err := service.CreateBusinessUser(context.Background(), CreateBusinessUserCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		DisplayName: "Kofi Staff",
		Email:       "kofi@example.com",
		Password:    "strong-password",
		Role:        business.UserRoleStaff,
	})
	if err != nil {
		t.Fatalf("create business user: %v", err)
	}
	if emails.message.To != "kofi@example.com" || emails.message.Subject == "" {
		t.Fatalf("expected invite email, got %+v", emails.message)
	}
	if !strings.Contains(emails.message.Body, "https://app.xtiitch.com/login") ||
		!strings.Contains(emails.message.Body, "staff") {
		t.Fatalf("expected dashboard invite body, got %q", emails.message.Body)
	}
	if strings.Contains(emails.message.Body, "strong-password") {
		t.Fatal("invite email must not include the temporary password")
	}
}

func TestUpdateBusinessUserPassesManageableRoleAndActiveState(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"unused"}},
		Clock:         fixedClock{now: time.Now()},
	})

	user, err := service.UpdateBusinessUser(context.Background(), UpdateBusinessUserCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		UserID:      "user-2",
		DisplayName: "  Kofi Staff  ",
		Role:        business.UserRoleStaff,
		IsActive:    false,
	})
	if err != nil {
		t.Fatalf("update business user: %v", err)
	}
	if businesses.updatedUser.UserID != "user-2" || businesses.updatedUser.DisplayName != "Kofi Staff" || businesses.updatedUser.IsActive {
		t.Fatalf("expected normalized inactive update, got %+v", businesses.updatedUser)
	}
	if user.UserID != "user-2" || user.IsActive {
		t.Fatalf("unexpected updated user response: %+v", user)
	}

	_, err = service.UpdateBusinessUser(context.Background(), UpdateBusinessUserCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleStaff,
		UserID:      "user-2",
		DisplayName: "Kofi",
		Role:        business.UserRoleStaff,
		IsActive:    true,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff update to be forbidden, got %v", err)
	}
}

func TestResetBusinessUserPasswordRequiresOwnerOrAdminAndHashesPassword(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"unused"}},
		Clock:         fixedClock{now: time.Now()},
	})

	err := service.ResetBusinessUserPassword(context.Background(), ResetBusinessUserPasswordCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleAdmin,
		UserID:      "user-2",
		NewPassword: "new-strong-password",
	})
	if err != nil {
		t.Fatalf("reset business user password: %v", err)
	}
	if businesses.updatedPassword.UserID != "user-2" || businesses.updatedPassword.PasswordHash != "hashed:new-strong-password" {
		t.Fatalf("expected hashed password update, got %+v", businesses.updatedPassword)
	}

	err = service.ResetBusinessUserPassword(context.Background(), ResetBusinessUserPasswordCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleStaff,
		UserID:      "user-2",
		NewPassword: "new-strong-password",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff reset to be forbidden, got %v", err)
	}

	err = service.ResetBusinessUserPassword(context.Background(), ResetBusinessUserPasswordCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		UserID:      "user-2",
		NewPassword: "short",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected weak password to be rejected, got %v", err)
	}
}

func TestChangeOwnPasswordVerifiesCurrentAndHashesNew(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		credentialsByID: ports.BusinessUserCredentials{
			BusinessID:   "business-1",
			UserID:       "owner-1",
			PasswordHash: "hashed:current-password",
			Role:         business.UserRoleOwner,
			IsActive:     true,
		},
	}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"unused"}},
		Clock:         fixedClock{now: time.Now()},
	})

	scope := common.TenantScope{BusinessID: "business-1"}

	// Owner can rotate their own password via the no-role-guard update path.
	err := service.ChangeOwnPassword(context.Background(), ChangeOwnPasswordCommand{
		Scope:           scope,
		UserID:          "owner-1",
		CurrentPassword: "current-password",
		NewPassword:     "fresh-strong-password",
	})
	if err != nil {
		t.Fatalf("change own password: %v", err)
	}
	if businesses.lookupUserID != "owner-1" {
		t.Fatalf("expected lookup by own user id, got %q", businesses.lookupUserID)
	}
	if businesses.updatedOwnPassword.UserID != "owner-1" || businesses.updatedOwnPassword.PasswordHash != "hashed:fresh-strong-password" {
		t.Fatalf("expected hashed own-password update, got %+v", businesses.updatedOwnPassword)
	}

	// A wrong current password is rejected as invalid credentials, and no update
	// is attempted.
	businesses.updatedOwnPassword = ports.UpdateBusinessUserPasswordInput{}
	err = service.ChangeOwnPassword(context.Background(), ChangeOwnPasswordCommand{
		Scope:           scope,
		UserID:          "owner-1",
		CurrentPassword: "wrong-password",
		NewPassword:     "fresh-strong-password",
	})
	if !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials for wrong current password, got %v", err)
	}
	if businesses.updatedOwnPassword.PasswordHash != "" {
		t.Fatal("expected no password update when current password is wrong")
	}

	// A weak new password is rejected before any lookup.
	err = service.ChangeOwnPassword(context.Background(), ChangeOwnPasswordCommand{
		Scope:           scope,
		UserID:          "owner-1",
		CurrentPassword: "current-password",
		NewPassword:     "short",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected weak new password to be rejected, got %v", err)
	}
}

func TestTransferBusinessOwnerRequiresCurrentOwnerAndConfirmation(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	service := NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		IDs:           &sequenceIDs{ids: []common.ID{"unused"}},
		Clock:         fixedClock{now: time.Now()},
	})

	result, err := service.TransferBusinessOwner(context.Background(), TransferBusinessOwnerCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		ActorUserID:    "owner-1",
		ActorRole:      business.UserRoleOwner,
		NewOwnerUserID: "admin-1",
		Confirmation:   "TRANSFER OWNER",
	})
	if err != nil {
		t.Fatalf("transfer business owner: %v", err)
	}
	if businesses.transferredOwner.CurrentOwnerUserID != "owner-1" || businesses.transferredOwner.NewOwnerUserID != "admin-1" {
		t.Fatalf("expected scoped owner transfer, got %+v", businesses.transferredOwner)
	}
	if result.NewOwner.UserID != "admin-1" || result.NewOwner.Role != business.UserRoleOwner {
		t.Fatalf("unexpected transfer response: %+v", result)
	}

	_, err = service.TransferBusinessOwner(context.Background(), TransferBusinessOwnerCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		ActorUserID:    "admin-2",
		ActorRole:      business.UserRoleAdmin,
		NewOwnerUserID: "admin-1",
		Confirmation:   "TRANSFER OWNER",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected admin transfer to be forbidden, got %v", err)
	}

	_, err = service.TransferBusinessOwner(context.Background(), TransferBusinessOwnerCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		ActorUserID:    "owner-1",
		ActorRole:      business.UserRoleOwner,
		NewOwnerUserID: "admin-1",
		Confirmation:   "transfer owner",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected confirmation mismatch to be invalid, got %v", err)
	}

	_, err = service.TransferBusinessOwner(context.Background(), TransferBusinessOwnerCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		ActorUserID:    "owner-1",
		ActorRole:      business.UserRoleOwner,
		NewOwnerUserID: "owner-1",
		Confirmation:   "TRANSFER OWNER",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected self-transfer to be invalid, got %v", err)
	}
}

type fakeBusinessIdentityRepository struct {
	created               ports.CreateBusinessWithOwnerInput
	createErr             error
	handleExists          bool
	handleExistsErr       error
	credentials           ports.BusinessUserCredentials
	findErr               error
	credentialsByID       ports.BusinessUserCredentials
	findByIDErr           error
	lookupUserID          common.ID
	lookupHandle          string
	lookupEmail           string
	users                 []ports.BusinessUserRecord
	listScope             common.TenantScope
	listErr               error
	createdUser           ports.CreateBusinessUserInput
	createUserErr         error
	updatedUser           ports.UpdateBusinessUserInput
	updateScope           common.TenantScope
	updateUserErr         error
	updatedPassword       ports.UpdateBusinessUserPasswordInput
	updatePasswordErr     error
	updatedOwnPassword    ports.UpdateBusinessUserPasswordInput
	updateOwnPasswordErr  error
	transferredOwner      ports.TransferBusinessOwnerInput
	transferScope         common.TenantScope
	transferErr           error
	subscription          ports.BusinessSubscriptionRecord
	subscriptionUpgraded  ports.BusinessSubscriptionRecord
	activationPayment     ports.RecordSubscriptionActivationPaymentInput
	activationAlreadyPaid bool
	cadenceSet            string
	setCadenceErr         error
	identityDocument      ports.SubmitIdentityDocumentInput
	planByCode            ports.PlanPricingRecord
	planByCodeErr         error
	upgradeApplied        *ports.ApplyImmediatePlanUpgradeInput
	downgradeScheduled    *ports.SchedulePlanDowngradeInput
}

func (repo *fakeBusinessIdentityRepository) CreateBusinessWithOwner(_ context.Context, input ports.CreateBusinessWithOwnerInput) (ports.BusinessOwnerIdentity, error) {
	repo.created = input
	if repo.createErr != nil {
		return ports.BusinessOwnerIdentity{}, repo.createErr
	}
	return ports.BusinessOwnerIdentity{
		BusinessID:     input.BusinessID,
		BusinessUserID: input.OwnerUserID,
		Role:           business.UserRoleOwner,
	}, nil
}

func (repo *fakeBusinessIdentityRepository) HandleExists(_ context.Context, handle string) (bool, error) {
	return repo.handleExists, repo.handleExistsErr
}

func (repo *fakeBusinessIdentityRepository) ListActivePlans(_ context.Context) ([]ports.PublicPlanRecord, error) {
	return nil, nil
}

func (repo *fakeBusinessIdentityRepository) GetBusinessSubscription(_ context.Context, _ common.ID) (ports.BusinessSubscriptionRecord, error) {
	// After a plan switch, a re-read reflects the upgraded plan (mirrors the real
	// repo, whose figures are joined from the now-current plan).
	if repo.upgradeApplied != nil && repo.subscriptionUpgraded.SubscriptionID != "" {
		return repo.subscriptionUpgraded, nil
	}
	return repo.subscription, nil
}

func (repo *fakeBusinessIdentityRepository) GetPlanByCode(_ context.Context, _ string) (ports.PlanPricingRecord, error) {
	if repo.planByCodeErr != nil {
		return ports.PlanPricingRecord{}, repo.planByCodeErr
	}
	return repo.planByCode, nil
}

func (repo *fakeBusinessIdentityRepository) ApplyImmediatePlanUpgrade(_ context.Context, input ports.ApplyImmediatePlanUpgradeInput) error {
	repo.upgradeApplied = &input
	return nil
}

func (repo *fakeBusinessIdentityRepository) SchedulePlanDowngrade(_ context.Context, input ports.SchedulePlanDowngradeInput) error {
	repo.downgradeScheduled = &input
	return nil
}

func (repo *fakeBusinessIdentityRepository) ActivateRecurringBilling(_ context.Context, _ ports.ActivateRecurringBillingInput) error {
	return nil
}

func (repo *fakeBusinessIdentityRepository) RecordSubscriptionActivationPayment(_ context.Context, input ports.RecordSubscriptionActivationPaymentInput) error {
	repo.activationPayment = input
	return nil
}

func (repo *fakeBusinessIdentityRepository) SetSubscriptionBillingCadence(_ context.Context, _ common.ID, cadence string) error {
	if repo.setCadenceErr != nil {
		return repo.setCadenceErr
	}
	repo.cadenceSet = cadence
	return nil
}

func (repo *fakeBusinessIdentityRepository) PrepareSubscriptionActivationCharge(_ context.Context, _ common.ID) (ports.SubscriptionActivationCharge, error) {
	return ports.SubscriptionActivationCharge{Ref: "xtsub_act_test", ShouldCharge: !repo.activationAlreadyPaid}, nil
}

func (repo *fakeBusinessIdentityRepository) SubmitIdentityDocument(_ context.Context, input ports.SubmitIdentityDocumentInput) error {
	repo.identityDocument = input
	return nil
}

// fakeSubscriptionPayments is a minimal PaymentProvider for the subscription
// first-charge tests: a verified authorization plus a configurable charge status.
type fakeSubscriptionPayments struct {
	chargeStatus string
	chargeInput  ports.ChargeAuthorizationInput
	chargeErr    error
}

func (f *fakeSubscriptionPayments) CreateBusinessSubaccount(_ context.Context, _ ports.CreateBusinessSubaccountInput) (ports.CreateBusinessSubaccountResult, error) {
	return ports.CreateBusinessSubaccountResult{}, nil
}

func (f *fakeSubscriptionPayments) InitializeTransaction(_ context.Context, _ ports.InitializeTransactionInput) (ports.InitializeTransactionResult, error) {
	return ports.InitializeTransactionResult{}, nil
}

func (f *fakeSubscriptionPayments) InitializeAuthorization(_ context.Context, _ ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult, error) {
	return ports.InitializeAuthorizationResult{RedirectURL: "https://pay", Reference: "ref"}, nil
}

func (f *fakeSubscriptionPayments) VerifyAuthorization(_ context.Context, _ ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error) {
	return ports.VerifyAuthorizationResult{
		Active:            true,
		AuthorizationCode: "AUTH_x",
		CustomerCode:      "CUS_x",
		CustomerEmail:     "owner@example.com",
	}, nil
}

func (f *fakeSubscriptionPayments) ChargeAuthorization(_ context.Context, input ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error) {
	f.chargeInput = input
	if f.chargeErr != nil {
		return ports.ChargeAuthorizationResult{}, f.chargeErr
	}
	return ports.ChargeAuthorizationResult{Status: f.chargeStatus, AmountMinor: input.AmountMinor}, nil
}

func (f *fakeSubscriptionPayments) VerifyWebhookSignature(_ []byte, _ string) bool { return true }

func (f *fakeSubscriptionPayments) ParseChargeEvent(_ []byte) (ports.ProviderChargeEvent, error) {
	return ports.ProviderChargeEvent{}, nil
}

func newSubscriptionTestService(businesses *fakeBusinessIdentityRepository, payments ports.PaymentProvider) Service {
	return NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		Payments:      payments,
		IDs:           &sequenceIDs{ids: []common.ID{"charge-1"}},
		Clock:         fixedClock{now: time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)},
	})
}

// A paid plan's authorization-verify charges the first period immediately and,
// on success, books the activation payment and reports the subscription active.
func TestInitializeSubscriptionAuthorizationUpgradesFreePlanToTarget(t *testing.T) {
	t.Parallel()

	// A store on the FREE plan (fee 0) activating a paid plan. Without the plan
	// switch this fails the fee gate outright — the reported "couldn't start billing"
	// bug for free→paid upgrades.
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "free", MonthlyFeeMinor: 0, Status: "active",
		},
		planByCode: ports.PlanPricingRecord{PlanID: "plan-growth", Code: "growth", MonthlyFeeMinor: 9900},
		subscriptionUpgraded: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 9900, Status: "active", BillingCadence: "yearly", YearlyFirstMinor: 89100,
		},
	}
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{chargeStatus: "success"})

	result, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb",
		BillingCadence: "yearly", PlanCode: "growth",
	})
	if err != nil {
		t.Fatalf("free→paid activation should succeed, got %v", err)
	}
	if businesses.upgradeApplied == nil || businesses.upgradeApplied.NewPlanID != "plan-growth" {
		t.Fatalf("expected the subscription switched to the target plan, got %+v", businesses.upgradeApplied)
	}
	if businesses.upgradeApplied.AmountMinor != 0 {
		t.Fatalf("activation switch must not book a proration invoice (first charge is on the callback), got %d", businesses.upgradeApplied.AmountMinor)
	}
	if result.RedirectURL == "" {
		t.Fatal("expected a Paystack authorization link")
	}
}

func TestInitializeSubscriptionAuthorizationRejectsFreeWithoutTarget(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "free", MonthlyFeeMinor: 0, Status: "active",
		},
	}
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
	_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("a free plan with no target must be rejected, got %v", err)
	}
	if businesses.upgradeApplied != nil {
		t.Fatal("no plan switch should occur without a target")
	}
}

func TestInitializeSubscriptionAuthorizationRejectsDowngradeTarget(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 9900, Status: "active",
		},
		planByCode: ports.PlanPricingRecord{PlanID: "plan-starter", Code: "starter", MonthlyFeeMinor: 4900},
	}
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
	_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly", PlanCode: "starter",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("a downgrade via activation must be rejected, got %v", err)
	}
	if businesses.upgradeApplied != nil {
		t.Fatal("no immediate switch on a downgrade target")
	}
}

func TestVerifySubscriptionAuthorizationChargesFirstPeriod(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:   "sub-1",
			BusinessID:       "business-1",
			OwnerEmail:       "owner@adwoa.test",
			MonthlyFeeMinor:  9900,
			Status:           "trialing",
			BillingCadence:   "yearly",
			YearlyFirstMinor: 89100,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newSubscriptionTestService(businesses, payments)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "active" || result.BillingMode != "recurring" {
		t.Fatalf("expected active recurring subscription, got %+v", result)
	}
	// First purchase on a yearly cadence bills the INTRO figure, not the monthly fee.
	if payments.chargeInput.AmountMinor != 89100 || payments.chargeInput.AuthorizationCode != "AUTH_x" {
		t.Fatalf("expected first charge of the yearly intro figure on the stored authorization, got %+v", payments.chargeInput)
	}
	if businesses.activationPayment.AmountMinor != 89100 || businesses.activationPayment.ChargeRef == "" {
		t.Fatalf("expected the activation payment to be booked, got %+v", businesses.activationPayment)
	}
	if businesses.activationPayment.BillingCadence != "yearly" {
		t.Fatalf("expected the activation payment to carry the yearly cadence, got %q", businesses.activationPayment.BillingCadence)
	}
	if businesses.activationPayment.ChargeRef != payments.chargeInput.Reference {
		t.Fatalf("invoice ref must equal the charge reference for webhook idempotency: %q vs %q",
			businesses.activationPayment.ChargeRef, payments.chargeInput.Reference)
	}
}

// When the first charge does not succeed, the authorization is still stored
// (recurring) but the subscription is not reported active and no payment booked.
func TestVerifySubscriptionAuthorizationLeavesAuthorizedWhenChargeNotSuccessful(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:   "sub-1",
			BusinessID:       "business-1",
			OwnerEmail:       "owner@adwoa.test",
			MonthlyFeeMinor:  9900,
			Status:           "trialing",
			BillingCadence:   "yearly",
			YearlyFirstMinor: 89100,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "failed"}
	service := newSubscriptionTestService(businesses, payments)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status == "active" {
		t.Fatal("a non-success charge must not report the subscription active")
	}
	if businesses.activationPayment.ChargeRef != "" {
		t.Fatal("no activation payment should be booked when the charge did not succeed")
	}
}

// Re-verifying after the first period is already paid must NOT charge the card
// again (idempotency guard against double-submit / callback replay).
func TestVerifySubscriptionAuthorizationDoesNotRechargeWhenAlreadyPaid(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		activationAlreadyPaid: true,
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			MonthlyFeeMinor:       9900,
			Status:                "active",
			BillingCadence:        "yearly",
			FirstPurchaseConsumed: true,
			YearlyRenewalMinor:    118800,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newSubscriptionTestService(businesses, payments)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payments.chargeInput.AuthorizationCode != "" {
		t.Fatalf("must not charge again when the period is already paid, but charged %+v", payments.chargeInput)
	}
	if businesses.activationPayment.ChargeRef != "" {
		t.Fatal("must not re-book an activation payment when already paid")
	}
	if result.Status != "active" {
		t.Fatalf("an already-paid subscription should still report active, got %q", result.Status)
	}
}

// A first purchase (intro not yet consumed) on a QUARTERLY cadence bills the
// quarterly INTRO figure and books the activation payment with that cadence, so
// the repository can mark the first purchase consumed and set a 3-month period.
func TestVerifySubscriptionAuthorizationFirstPurchaseChargesQuarterlyIntro(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "quarterly",
			FirstPurchaseConsumed: false,
			QuarterlyFirstMinor:   11800,
			QuarterlyRenewalMinor: 14700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newSubscriptionTestService(businesses, payments)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "active" {
		t.Fatalf("expected active subscription after successful first charge, got %q", result.Status)
	}
	if payments.chargeInput.AmountMinor != 11800 {
		t.Fatalf("first purchase must charge the quarterly INTRO figure (11800), got %d", payments.chargeInput.AmountMinor)
	}
	if businesses.activationPayment.AmountMinor != 11800 || businesses.activationPayment.BillingCadence != "quarterly" {
		t.Fatalf("expected the intro payment booked with the quarterly cadence, got %+v", businesses.activationPayment)
	}
}

// An account that has already consumed its first purchase bills the FULL renewal
// figure for its cadence, never the intro again (cancel+resubscribe safety).
func TestVerifySubscriptionAuthorizationConsumedAccountChargesRenewal(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "quarterly",
			FirstPurchaseConsumed: true,
			QuarterlyFirstMinor:   11800,
			QuarterlyRenewalMinor: 14700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newSubscriptionTestService(businesses, payments)

	if _, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payments.chargeInput.AmountMinor != 14700 {
		t.Fatalf("a consumed account must charge the quarterly RENEWAL figure (14700), got %d", payments.chargeInput.AmountMinor)
	}
	if businesses.activationPayment.AmountMinor != 14700 {
		t.Fatalf("expected the renewal figure booked, got %d", businesses.activationPayment.AmountMinor)
	}
}

// A paid plan cannot be activated with a non-billable cadence: monthly/empty are
// rejected and no charge is attempted.
func TestVerifySubscriptionAuthorizationRejectsNonBillableCadence(t *testing.T) {
	t.Parallel()

	for _, cadence := range []string{"monthly", ""} {
		businesses := &fakeBusinessIdentityRepository{
			subscription: ports.BusinessSubscriptionRecord{
				SubscriptionID:      "sub-1",
				BusinessID:          "business-1",
				OwnerEmail:          "owner@adwoa.test",
				MonthlyFeeMinor:     4900,
				Status:              "trialing",
				BillingCadence:      cadence,
				QuarterlyFirstMinor: 11800,
			},
		}
		payments := &fakeSubscriptionPayments{chargeStatus: "success"}
		service := newSubscriptionTestService(businesses, payments)

		_, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
			Scope:     common.TenantScope{BusinessID: "business-1"},
			Reference: "paystack-ref",
		})
		if !errors.Is(err, authdomain.ErrInvalidInput) {
			t.Fatalf("cadence %q: expected ErrInvalidInput, got %v", cadence, err)
		}
		if payments.chargeInput.AuthorizationCode != "" {
			t.Fatalf("cadence %q: must not charge when the cadence is not billable", cadence)
		}
	}
}

// The authorization-link step rejects a monthly/empty cadence for a paid plan and
// persists a valid quarterly/yearly cadence before redirecting to Paystack.
func TestInitializeSubscriptionAuthorizationValidatesAndPersistsCadence(t *testing.T) {
	t.Parallel()

	newRepo := func() *fakeBusinessIdentityRepository {
		return &fakeBusinessIdentityRepository{
			subscription: ports.BusinessSubscriptionRecord{
				SubscriptionID:  "sub-1",
				BusinessID:      "business-1",
				OwnerEmail:      "owner@adwoa.test",
				MonthlyFeeMinor: 4900,
				Status:          "trialing",
			},
		}
	}

	for _, cadence := range []string{"monthly", ""} {
		businesses := newRepo()
		service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
		_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
			Scope:          common.TenantScope{BusinessID: "business-1"},
			BillingCadence: cadence,
		})
		if !errors.Is(err, authdomain.ErrInvalidInput) {
			t.Fatalf("cadence %q: expected ErrInvalidInput, got %v", cadence, err)
		}
		if businesses.cadenceSet != "" {
			t.Fatalf("cadence %q: must not persist an invalid cadence, got %q", cadence, businesses.cadenceSet)
		}
	}

	businesses := newRepo()
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		BillingCadence: "quarterly",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if businesses.cadenceSet != "quarterly" {
		t.Fatalf("expected the quarterly cadence to be persisted, got %q", businesses.cadenceSet)
	}
	if link.RedirectURL == "" {
		t.Fatalf("expected a redirect link, got %+v", link)
	}
}

func TestSubmitIdentityVerificationRequiresManagerRole(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	service := NewService(Dependencies{
		Businesses: businesses,
		Sessions:   &fakeSessionRepository{},
		Passwords:  fakePasswordHasher{},
		IDs:        &sequenceIDs{},
		Clock:      fixedClock{now: time.Now()},
	})

	err := service.SubmitIdentityVerification(context.Background(), SubmitIdentityVerificationCommand{
		Scope:      common.TenantScope{BusinessID: "business-1"},
		ActorRole:  business.UserRoleStaff,
		CardNumber: "GHA-123456789-0",
		IDPhotoURL: "https://cdn.example.com/card.jpg",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff identity submission to be forbidden, got %v", err)
	}
	if businesses.identityDocument.BusinessID != "" {
		t.Fatal("forbidden identity submission must not write a document")
	}

	err = service.SubmitIdentityVerification(context.Background(), SubmitIdentityVerificationCommand{
		Scope:      common.TenantScope{BusinessID: "business-1"},
		ActorRole:  business.UserRoleAdmin,
		CardNumber: " GHA-123456789-0 ",
		IDPhotoURL: "https://cdn.example.com/card.jpg",
	})
	if err != nil {
		t.Fatalf("expected admin identity submission to pass, got %v", err)
	}
	if businesses.identityDocument.BusinessID != "business-1" ||
		businesses.identityDocument.CardNumber != "GHA-123456789-0" ||
		businesses.identityDocument.IDPhotoURL != "https://cdn.example.com/card.jpg" {
		t.Fatalf("unexpected identity document: %+v", businesses.identityDocument)
	}
}

func (repo *fakeBusinessIdentityRepository) FindBusinessUserByHandleAndEmail(_ context.Context, handle string, email string) (ports.BusinessUserCredentials, error) {
	repo.lookupHandle = handle
	repo.lookupEmail = email
	if repo.findErr != nil {
		return ports.BusinessUserCredentials{}, repo.findErr
	}
	return repo.credentials, nil
}

func (repo *fakeBusinessIdentityRepository) FindBusinessUserCredentialsByID(_ context.Context, scope common.TenantScope, userID common.ID) (ports.BusinessUserCredentials, error) {
	repo.listScope = scope
	repo.lookupUserID = userID
	if repo.findByIDErr != nil {
		return ports.BusinessUserCredentials{}, repo.findByIDErr
	}
	return repo.credentialsByID, nil
}

func (repo *fakeBusinessIdentityRepository) ListBusinessUsers(_ context.Context, scope common.TenantScope) ([]ports.BusinessUserRecord, error) {
	repo.listScope = scope
	if repo.listErr != nil {
		return nil, repo.listErr
	}
	return repo.users, nil
}

func (repo *fakeBusinessIdentityRepository) CreateBusinessUser(_ context.Context, scope common.TenantScope, input ports.CreateBusinessUserInput) (ports.BusinessUserRecord, error) {
	repo.listScope = scope
	repo.createdUser = input
	if repo.createUserErr != nil {
		return ports.BusinessUserRecord{}, repo.createUserErr
	}
	return ports.BusinessUserRecord{
		UserID:      input.UserID,
		BusinessID:  input.BusinessID,
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    true,
	}, nil
}

func (repo *fakeBusinessIdentityRepository) UpdateBusinessUser(_ context.Context, scope common.TenantScope, input ports.UpdateBusinessUserInput) (ports.BusinessUserRecord, error) {
	repo.updateScope = scope
	repo.updatedUser = input
	if repo.updateUserErr != nil {
		return ports.BusinessUserRecord{}, repo.updateUserErr
	}
	return ports.BusinessUserRecord{
		UserID:      input.UserID,
		BusinessID:  scope.BusinessID,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		IsActive:    input.IsActive,
	}, nil
}

func (repo *fakeBusinessIdentityRepository) UpdateBusinessUserPassword(_ context.Context, scope common.TenantScope, input ports.UpdateBusinessUserPasswordInput) error {
	repo.updateScope = scope
	repo.updatedPassword = input
	return repo.updatePasswordErr
}

func (repo *fakeBusinessIdentityRepository) UpdateOwnPassword(_ context.Context, scope common.TenantScope, input ports.UpdateBusinessUserPasswordInput) error {
	repo.updateScope = scope
	repo.updatedOwnPassword = input
	return repo.updateOwnPasswordErr
}

func (repo *fakeBusinessIdentityRepository) TransferBusinessOwner(_ context.Context, scope common.TenantScope, input ports.TransferBusinessOwnerInput) (ports.TransferBusinessOwnerResult, error) {
	repo.transferScope = scope
	repo.transferredOwner = input
	if repo.transferErr != nil {
		return ports.TransferBusinessOwnerResult{}, repo.transferErr
	}
	return ports.TransferBusinessOwnerResult{
		PreviousOwner: ports.BusinessUserRecord{
			UserID:     input.CurrentOwnerUserID,
			BusinessID: scope.BusinessID,
			Role:       business.UserRoleAdmin,
			IsActive:   true,
		},
		NewOwner: ports.BusinessUserRecord{
			UserID:     input.NewOwnerUserID,
			BusinessID: scope.BusinessID,
			Role:       business.UserRoleOwner,
			IsActive:   true,
		},
	}, nil
}

// fakeDiscountRepository is a configurable SubscriptionDiscountRepository for the
// discount-code checkout tests. FindPendingRedemption returns ErrNotFound unless a
// pending redemption is explicitly configured, so the plain (non-discount) flow is
// the default.
type fakeDiscountRepository struct {
	code              ports.SubscriptionDiscountCode
	findErr           error
	lookupCode        string
	appliedTotal      int
	appliedForAccount int
	hasPending        bool
	pending           ports.PendingDiscountRedemption
	created           []ports.CreateDiscountRedemptionInput
	marked            []ports.MarkDiscountRedemptionAppliedInput
	freePeriods       []ports.ActivateFreePeriodInput
}

func (r *fakeDiscountRepository) FindActiveDiscountCodeByCode(_ context.Context, code string) (ports.SubscriptionDiscountCode, error) {
	r.lookupCode = code
	if r.findErr != nil {
		return ports.SubscriptionDiscountCode{}, r.findErr
	}
	return r.code, nil
}

func (r *fakeDiscountRepository) CountAppliedRedemptions(_ context.Context, _ common.ID) (int, error) {
	return r.appliedTotal, nil
}

func (r *fakeDiscountRepository) CountAppliedRedemptionsForAccount(_ context.Context, _ common.ID, _ common.ID) (int, error) {
	return r.appliedForAccount, nil
}

func (r *fakeDiscountRepository) CreateRedemption(_ context.Context, _ common.TenantScope, input ports.CreateDiscountRedemptionInput) (common.ID, error) {
	r.created = append(r.created, input)
	return "redemption-1", nil
}

func (r *fakeDiscountRepository) FindPendingRedemption(_ context.Context, _ common.TenantScope, _ common.ID) (ports.PendingDiscountRedemption, error) {
	if !r.hasPending {
		return ports.PendingDiscountRedemption{}, ports.ErrNotFound
	}
	return r.pending, nil
}

func (r *fakeDiscountRepository) MarkRedemptionApplied(_ context.Context, _ common.TenantScope, input ports.MarkDiscountRedemptionAppliedInput) error {
	r.marked = append(r.marked, input)
	return nil
}

func (r *fakeDiscountRepository) ActivateFreePeriodBilling(_ context.Context, _ common.TenantScope, input ports.ActivateFreePeriodInput) error {
	r.freePeriods = append(r.freePeriods, input)
	return nil
}

func newDiscountTestService(businesses *fakeBusinessIdentityRepository, payments ports.PaymentProvider, discounts ports.SubscriptionDiscountRepository) Service {
	return NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		Payments:      payments,
		Discounts:     discounts,
		IDs:           &sequenceIDs{ids: []common.ID{"charge-1"}},
		Clock:         fixedClock{now: time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)},
	})
}

// A percentage code applies against the plan's FULL renewal figure (NOT the intro)
// and reduces the activation charge accordingly, then flips the captured
// redemption to applied with the money-given-away amount.
func TestVerifySubscriptionAuthorizationAppliesPercentageDiscountOffRenewal(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "quarterly",
			FirstPurchaseConsumed: false,
			QuarterlyFirstMinor:   11800, // intro (must NOT be charged)
			QuarterlyRenewalMinor: 14700, // renewal (discount base)
		},
	}
	discounts := &fakeDiscountRepository{
		hasPending: true,
		pending: ports.PendingDiscountRedemption{
			RedemptionID:  "redemption-1",
			DiscountType:  "percentage",
			DiscountValue: 20,
			PlanCode:      "growth",
			Cadence:       "quarterly",
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newDiscountTestService(businesses, payments, discounts)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "active" {
		t.Fatalf("expected active subscription, got %q", result.Status)
	}
	// 20% off the 14700 renewal = 2940 discount → charge 11760 (NOT the 11800 intro).
	if payments.chargeInput.AmountMinor != 11760 {
		t.Fatalf("expected discounted charge 11760 off the renewal figure, got %d", payments.chargeInput.AmountMinor)
	}
	if businesses.activationPayment.AmountMinor != 11760 {
		t.Fatalf("expected the activation payment booked at the discounted amount, got %d", businesses.activationPayment.AmountMinor)
	}
	if len(discounts.marked) != 1 || discounts.marked[0].DiscountMinor != 2940 {
		t.Fatalf("expected the redemption marked applied with a 2940 discount, got %+v", discounts.marked)
	}
	if discounts.marked[0].RedemptionID != "redemption-1" {
		t.Fatalf("expected the captured redemption flipped to applied, got %q", discounts.marked[0].RedemptionID)
	}
}

// A free-period code charges nothing at activation and starts a free window
// (next billing = now + value months), recording the full renewal as the discount.
func TestVerifySubscriptionAuthorizationAppliesFreePeriodDiscount(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "yearly",
			FirstPurchaseConsumed: false,
			YearlyFirstMinor:      89100,
			YearlyRenewalMinor:    118800,
		},
	}
	discounts := &fakeDiscountRepository{
		hasPending: true,
		pending: ports.PendingDiscountRedemption{
			RedemptionID:  "redemption-1",
			DiscountType:  "free_period",
			DiscountValue: 3,
			PlanCode:      "growth",
			Cadence:       "yearly",
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newDiscountTestService(businesses, payments, discounts)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "active" {
		t.Fatalf("expected active subscription, got %q", result.Status)
	}
	if payments.chargeInput.AuthorizationCode != "" {
		t.Fatalf("a free-period code must not charge the card, but charged %+v", payments.chargeInput)
	}
	if len(discounts.freePeriods) != 1 || discounts.freePeriods[0].FreeMonths != 3 {
		t.Fatalf("expected a 3-month free-period activation, got %+v", discounts.freePeriods)
	}
	if len(discounts.marked) != 1 || discounts.marked[0].DiscountMinor != 118800 {
		t.Fatalf("expected the redemption marked applied with the full renewal as discount, got %+v", discounts.marked)
	}
}

// A valid code at checkout is captured as a PENDING redemption (not applied yet),
// so an abandoned checkout never consumes a redemption slot.
func TestInitializeSubscriptionAuthorizationCapturesValidDiscountAsPending(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			QuarterlyRenewalMinor: 14700,
		},
	}
	discounts := &fakeDiscountRepository{
		code: ports.SubscriptionDiscountCode{
			DiscountCodeID:    "code-1",
			Code:              "WELCOME20",
			DiscountType:      "percentage",
			DiscountValue:     20,
			FirstPurchaseOnly: true,
			MaxPerAccount:     1,
		},
	}
	service := newDiscountTestService(businesses, &fakeSubscriptionPayments{}, discounts)

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		BillingCadence: "quarterly",
		Code:           " welcome20 ",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if link.RedirectURL == "" {
		t.Fatalf("expected a redirect link, got %+v", link)
	}
	if discounts.lookupCode != "WELCOME20" {
		t.Fatalf("expected the code normalized to upper-case, got %q", discounts.lookupCode)
	}
	if businesses.cadenceSet != "quarterly" {
		t.Fatalf("expected the cadence persisted, got %q", businesses.cadenceSet)
	}
	if len(discounts.created) != 1 {
		t.Fatalf("expected exactly one redemption captured, got %d", len(discounts.created))
	}
	captured := discounts.created[0]
	if captured.Status != "pending" {
		t.Fatalf("expected a pending capture, got %q", captured.Status)
	}
	// 20% off 14700 renewal = 2940 discount recorded for attribution.
	if captured.DiscountMinor != 2940 || captured.Cadence != "quarterly" || captured.PlanCode != "growth" {
		t.Fatalf("unexpected captured redemption: %+v", captured)
	}
	if captured.SubscriptionID != "sub-1" || captured.DiscountCodeID != "code-1" {
		t.Fatalf("expected the capture keyed to the subscription + code, got %+v", captured)
	}
}

// An ineligible (wrong plan) or expired code is rejected at checkout — never
// silently ignored — and nothing is captured or persisted.
func TestInitializeSubscriptionAuthorizationRejectsIneligibleAndExpiredCodes(t *testing.T) {
	t.Parallel()

	baseSubscription := ports.BusinessSubscriptionRecord{
		SubscriptionID:        "sub-1",
		BusinessID:            "business-1",
		OwnerEmail:            "owner@adwoa.test",
		PlanCode:              "growth",
		MonthlyFeeMinor:       4900,
		Status:                "trialing",
		QuarterlyRenewalMinor: 14700,
	}
	past := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC) // before the fixed clock

	cases := []struct {
		name string
		code ports.SubscriptionDiscountCode
		want error
	}{
		{
			name: "wrong plan",
			code: ports.SubscriptionDiscountCode{
				DiscountCodeID: "code-1",
				DiscountType:   "percentage",
				DiscountValue:  20,
				EligiblePlans:  []string{"studio"},
				MaxPerAccount:  1,
			},
			want: ErrDiscountCodeIneligible,
		},
		{
			name: "expired",
			code: ports.SubscriptionDiscountCode{
				DiscountCodeID: "code-1",
				DiscountType:   "percentage",
				DiscountValue:  20,
				MaxPerAccount:  1,
				ValidUntil:     &past,
			},
			want: ErrDiscountCodeExpired,
		},
	}
	for _, tc := range cases {
		businesses := &fakeBusinessIdentityRepository{subscription: baseSubscription}
		discounts := &fakeDiscountRepository{code: tc.code}
		service := newDiscountTestService(businesses, &fakeSubscriptionPayments{}, discounts)

		_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
			Scope:          common.TenantScope{BusinessID: "business-1"},
			BillingCadence: "quarterly",
			Code:           "SOMECODE",
		})
		if !errors.Is(err, tc.want) {
			t.Fatalf("%s: expected %v, got %v", tc.name, tc.want, err)
		}
		if len(discounts.created) != 0 {
			t.Fatalf("%s: a rejected code must capture nothing, got %+v", tc.name, discounts.created)
		}
		if businesses.cadenceSet != "" {
			t.Fatalf("%s: a rejected code must not persist the cadence or start billing", tc.name)
		}
	}
}

// The per-account cap is enforced at checkout: once a business has applied the
// code max_per_account times, a further checkout is refused.
func TestInitializeSubscriptionAuthorizationEnforcesPerAccountLimit(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			QuarterlyRenewalMinor: 14700,
		},
	}
	discounts := &fakeDiscountRepository{
		appliedForAccount: 1,
		code: ports.SubscriptionDiscountCode{
			DiscountCodeID: "code-1",
			DiscountType:   "percentage",
			DiscountValue:  20,
			MaxPerAccount:  1,
		},
	}
	service := newDiscountTestService(businesses, &fakeSubscriptionPayments{}, discounts)

	_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		BillingCadence: "quarterly",
		Code:           "WELCOME20",
	})
	if !errors.Is(err, ErrDiscountCodeExhausted) {
		t.Fatalf("expected the per-account cap to reject the code, got %v", err)
	}
	if len(discounts.created) != 0 {
		t.Fatalf("an exhausted code must capture nothing, got %+v", discounts.created)
	}
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

func newPlanChangeTestService(businesses *fakeBusinessIdentityRepository, payments ports.PaymentProvider, now time.Time) Service {
	return NewService(Dependencies{
		Businesses:    businesses,
		Sessions:      &fakeSessionRepository{},
		Passwords:     fakePasswordHasher{},
		AccessTokens:  fakeTokenIssuer{},
		RefreshTokens: fakeRefreshTokens{},
		Payments:      payments,
		IDs:           &sequenceIDs{ids: []common.ID{"charge-1"}},
		Clock:         fixedClock{now: now},
	})
}

// An UPGRADE charges the prorated difference for the remainder of the current
// period against the stored authorization, then switches the plan immediately.
// Proration = ceil( (newRenewal - currentRenewal) * daysRemaining / totalDays ):
// growth→studio quarterly renewal diff = 59700-29700 = 30000; a 92-day period with
// 30 days remaining → ceil(30000*30/92) = ceil(9782.6…) = 9783 (the ceil rounds up).
func TestChangeSubscriptionPlanUpgradeChargesProratedDifferenceAndSwitchesImmediately(t *testing.T) {
	t.Parallel()

	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC) // 92 days
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)       // 30 days remaining

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:          "sub-1",
			BusinessID:              "business-1",
			OwnerEmail:              "owner@adwoa.test",
			PlanCode:                "growth",
			MonthlyFeeMinor:         4900,
			Status:                  "active",
			BillingMode:             "recurring",
			ProviderSubscriptionRef: "AUTH_x",
			BillingCadence:          "quarterly",
			QuarterlyRenewalMinor:   29700,
			CurrentPeriodStart:      periodStart,
			CurrentPeriodEnd:        periodEnd,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID:                "plan-studio",
			Code:                  "studio",
			MonthlyFeeMinor:       9900,
			QuarterlyRenewalMinor: 59700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newPlanChangeTestService(businesses, payments, now)

	result, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "studio",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Immediate || result.PlanCode != "studio" {
		t.Fatalf("expected an immediate switch to studio, got %+v", result)
	}
	if result.ProratedChargeMinor != 9783 {
		t.Fatalf("expected prorated charge of 9783, got %d", result.ProratedChargeMinor)
	}
	if !result.EffectiveAt.Equal(now) {
		t.Fatalf("an upgrade should take effect now (%s), got %s", now, result.EffectiveAt)
	}
	// The prorated difference is charged on the stored recurring authorization.
	if payments.chargeInput.AmountMinor != 9783 || payments.chargeInput.AuthorizationCode != "AUTH_x" {
		t.Fatalf("expected the prorated difference charged on the stored authorization, got %+v", payments.chargeInput)
	}
	if !strings.HasPrefix(payments.chargeInput.Reference, "xtsub_upgrade_sub-1_studio_") {
		t.Fatalf("expected a deterministic upgrade ref, got %q", payments.chargeInput.Reference)
	}
	// The plan is switched immediately, keyed on the target plan, and the invoice ref
	// equals the charge ref (webhook idempotency), mirroring the activation charge.
	if businesses.upgradeApplied == nil {
		t.Fatal("expected the plan to be switched immediately")
	}
	if businesses.upgradeApplied.NewPlanID != "plan-studio" || businesses.upgradeApplied.AmountMinor != 9783 {
		t.Fatalf("expected the switch to the studio plan booking 9783, got %+v", *businesses.upgradeApplied)
	}
	if businesses.upgradeApplied.ChargeRef != payments.chargeInput.Reference {
		t.Fatalf("invoice ref must equal the charge reference, got %q vs %q",
			businesses.upgradeApplied.ChargeRef, payments.chargeInput.Reference)
	}
	if businesses.downgradeScheduled != nil {
		t.Fatal("an upgrade must not schedule a pending downgrade")
	}
}

// A DOWNGRADE records a pending plan change effective at the current period end and
// charges nothing / changes no entitlements now (no refund mid-cycle).
func TestChangeSubscriptionPlanDowngradeSchedulesPendingChangeAndDoesNotCharge(t *testing.T) {
	t.Parallel()

	periodEnd := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:          "sub-1",
			BusinessID:              "business-1",
			OwnerEmail:              "owner@adwoa.test",
			PlanCode:                "studio",
			MonthlyFeeMinor:         9900,
			Status:                  "active",
			BillingMode:             "recurring",
			ProviderSubscriptionRef: "AUTH_x",
			BillingCadence:          "quarterly",
			QuarterlyRenewalMinor:   59700,
			CurrentPeriodStart:      time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
			CurrentPeriodEnd:        periodEnd,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID:                "plan-growth",
			Code:                  "growth",
			MonthlyFeeMinor:       4900,
			QuarterlyRenewalMinor: 29700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newPlanChangeTestService(businesses, payments, now)

	result, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "growth",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Immediate || result.PlanCode != "growth" {
		t.Fatalf("expected a scheduled (not immediate) downgrade to growth, got %+v", result)
	}
	if result.ProratedChargeMinor != 0 {
		t.Fatalf("a downgrade must not charge, got %d", result.ProratedChargeMinor)
	}
	if !result.EffectiveAt.Equal(periodEnd) {
		t.Fatalf("a downgrade should take effect at the period end (%s), got %s", periodEnd, result.EffectiveAt)
	}
	// No charge attempted (the fake records the input only when ChargeAuthorization runs).
	if payments.chargeInput.AmountMinor != 0 || payments.chargeInput.Reference != "" {
		t.Fatalf("a downgrade must not charge the card, got %+v", payments.chargeInput)
	}
	if businesses.upgradeApplied != nil {
		t.Fatal("a downgrade must not switch the plan now")
	}
	if businesses.downgradeScheduled == nil {
		t.Fatal("expected a pending downgrade to be recorded")
	}
	if businesses.downgradeScheduled.NewPlanID != "plan-growth" || !businesses.downgradeScheduled.EffectiveAt.Equal(periodEnd) {
		t.Fatalf("expected the pending downgrade to target growth at the period end, got %+v", *businesses.downgradeScheduled)
	}
}

// Switching to the plan the business is already on is refused (no upgrade/downgrade).
func TestChangeSubscriptionPlanRejectsSamePlan(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			BusinessID:      "business-1",
			PlanCode:        "growth",
			MonthlyFeeMinor: 4900,
			Status:          "active",
			BillingCadence:  "quarterly",
		},
		planByCode: ports.PlanPricingRecord{PlanID: "plan-growth", Code: "growth", MonthlyFeeMinor: 4900},
	}
	service := newPlanChangeTestService(businesses, &fakeSubscriptionPayments{chargeStatus: "success"}, time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC))

	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "growth",
	})
	if !errors.Is(err, ErrPlanChangeSamePlan) {
		t.Fatalf("expected ErrPlanChangeSamePlan, got %v", err)
	}
}

// An upgrade that owes a prorated charge is refused when there is no active recurring
// authorization to charge against (e.g. billing was never set up).
func TestChangeSubscriptionPlanUpgradeRequiresActiveBilling(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			BusinessID:            "business-1",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "active",
			BillingMode:           "manual",
			BillingCadence:        "quarterly",
			QuarterlyRenewalMinor: 29700,
			CurrentPeriodStart:    time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
			CurrentPeriodEnd:      time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		},
		planByCode: ports.PlanPricingRecord{
			PlanID:                "plan-studio",
			Code:                  "studio",
			MonthlyFeeMinor:       9900,
			QuarterlyRenewalMinor: 59700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newPlanChangeTestService(businesses, payments, time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC))

	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "studio",
	})
	if !errors.Is(err, ErrPlanChangeBillingInactive) {
		t.Fatalf("expected ErrPlanChangeBillingInactive, got %v", err)
	}
	if payments.chargeInput.AmountMinor != 0 || businesses.upgradeApplied != nil {
		t.Fatal("nothing should be charged or switched when billing is inactive")
	}
}

// A non-owner/non-admin cannot change the plan.
func TestChangeSubscriptionPlanRequiresManagerRole(t *testing.T) {
	t.Parallel()

	service := newPlanChangeTestService(&fakeBusinessIdentityRepository{}, &fakeSubscriptionPayments{}, time.Now())
	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleStaff,
		PlanCode:  "studio",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for a staff actor, got %v", err)
	}
}

type fakeSessionRepository struct {
	created ports.CreateAuthSessionInput
	session ports.AuthSessionWithUser
	findErr error
	revoked []common.ID
}

func (repo *fakeSessionRepository) Create(_ context.Context, input ports.CreateAuthSessionInput) error {
	repo.created = input
	return nil
}

func (repo *fakeSessionRepository) FindByRefreshTokenHash(_ context.Context, _ string) (ports.AuthSessionWithUser, error) {
	if repo.findErr != nil {
		return ports.AuthSessionWithUser{}, repo.findErr
	}
	return repo.session, nil
}

func (repo *fakeSessionRepository) Revoke(_ context.Context, _ common.ID, sessionID common.ID) error {
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

type fakeEmailSender struct {
	message ports.EmailMessage
}

func (sender *fakeEmailSender) Send(_ context.Context, message ports.EmailMessage) error {
	sender.message = message
	return nil
}

type fakeTokenIssuer struct{}

func (fakeTokenIssuer) IssueAccessToken(_ context.Context, input ports.AccessTokenInput) (string, error) {
	return "access:" + input.Subject.String() + ":" + input.BusinessID.String() + ":" + string(input.Role), nil
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
