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
