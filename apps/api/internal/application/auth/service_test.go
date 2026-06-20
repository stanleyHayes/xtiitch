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
	created           ports.CreateBusinessWithOwnerInput
	createErr         error
	credentials       ports.BusinessUserCredentials
	findErr           error
	lookupHandle      string
	lookupEmail       string
	users             []ports.BusinessUserRecord
	listScope         common.TenantScope
	listErr           error
	createdUser       ports.CreateBusinessUserInput
	createUserErr     error
	updatedUser       ports.UpdateBusinessUserInput
	updateScope       common.TenantScope
	updateUserErr     error
	updatedPassword   ports.UpdateBusinessUserPasswordInput
	updatePasswordErr error
	transferredOwner  ports.TransferBusinessOwnerInput
	transferScope     common.TenantScope
	transferErr       error
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

func (repo *fakeBusinessIdentityRepository) ListActivePlans(_ context.Context) ([]ports.PublicPlanRecord, error) {
	return nil, nil
}

func (repo *fakeBusinessIdentityRepository) GetBusinessSubscription(_ context.Context, _ common.ID) (ports.BusinessSubscriptionRecord, error) {
	return ports.BusinessSubscriptionRecord{}, nil
}

func (repo *fakeBusinessIdentityRepository) ActivateRecurringBilling(_ context.Context, _ ports.ActivateRecurringBillingInput) error {
	return nil
}

func (repo *fakeBusinessIdentityRepository) FindBusinessUserByHandleAndEmail(_ context.Context, handle string, email string) (ports.BusinessUserCredentials, error) {
	repo.lookupHandle = handle
	repo.lookupEmail = email
	if repo.findErr != nil {
		return ports.BusinessUserCredentials{}, repo.findErr
	}
	return repo.credentials, nil
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
