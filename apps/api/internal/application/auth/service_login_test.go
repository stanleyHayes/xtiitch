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

// A failed password login is counted toward the per-account lockout.
func TestLoginBusinessRecordsFailedAttempt(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		credentials: ports.BusinessUserCredentials{
			BusinessID: "business-1", UserID: "user-1",
			PasswordHash: "hashed:strong-password", Role: business.UserRoleOwner, IsActive: true,
		},
	}
	service := NewService(Dependencies{
		Businesses: businesses, Sessions: &fakeSessionRepository{}, Passwords: fakePasswordHasher{},
		AccessTokens: fakeTokenIssuer{}, RefreshTokens: fakeRefreshTokens{},
		IDs: &sequenceIDs{ids: []common.ID{"session-1"}}, Clock: fixedClock{now: time.Now()},
	})

	if _, err := service.LoginBusiness(context.Background(), LoginBusinessCommand{
		BusinessHandle: "ama-stitch", OwnerEmail: "ama@example.com", OwnerPassword: "wrong-password",
	}); !errors.Is(err, authdomain.ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if businesses.failedLoginsRecorded != 1 {
		t.Fatalf("a bad password must be counted toward the lockout, got %d", businesses.failedLoginsRecorded)
	}
}

// A locked account is refused BEFORE the password is even checked, and a correct
// password clears any accumulated failures.
func TestLoginBusinessLockoutAndClear(t *testing.T) {
	t.Parallel()

	now := time.Now()
	future := now.Add(10 * time.Minute)
	locked := &fakeBusinessIdentityRepository{
		credentials: ports.BusinessUserCredentials{
			BusinessID: "business-1", UserID: "user-1", LoginLockedUntil: &future,
			PasswordHash: "hashed:strong-password", Role: business.UserRoleOwner, IsActive: true,
		},
	}
	service := NewService(Dependencies{
		Businesses: locked, Sessions: &fakeSessionRepository{}, Passwords: fakePasswordHasher{},
		AccessTokens: fakeTokenIssuer{}, RefreshTokens: fakeRefreshTokens{},
		IDs: &sequenceIDs{ids: []common.ID{"session-1"}}, Clock: fixedClock{now: now},
	})
	// Even with the CORRECT password, a locked account is refused.
	if _, err := service.LoginBusiness(context.Background(), LoginBusinessCommand{
		BusinessHandle: "ama-stitch", OwnerEmail: "ama@example.com", OwnerPassword: "strong-password",
	}); !errors.Is(err, authdomain.ErrAccountLocked) {
		t.Fatalf("expected ErrAccountLocked for a locked account, got %v", err)
	}

	// A successful login on an unlocked account clears the failure counter.
	unlocked := &fakeBusinessIdentityRepository{
		credentials: ports.BusinessUserCredentials{
			BusinessID: "business-1", UserID: "user-1",
			PasswordHash: "hashed:strong-password", Role: business.UserRoleOwner, IsActive: true,
		},
	}
	service2 := NewService(Dependencies{
		Businesses: unlocked, Sessions: &fakeSessionRepository{}, Passwords: fakePasswordHasher{},
		AccessTokens: fakeTokenIssuer{}, RefreshTokens: fakeRefreshTokens{},
		IDs: &sequenceIDs{ids: []common.ID{"session-1"}}, Clock: fixedClock{now: now},
	})
	if _, err := service2.LoginBusiness(context.Background(), LoginBusinessCommand{
		BusinessHandle: "ama-stitch", OwnerEmail: "ama@example.com", OwnerPassword: "strong-password",
	}); err != nil {
		t.Fatalf("valid login should succeed, got %v", err)
	}
	if unlocked.failedLoginsCleared != 1 {
		t.Fatalf("a successful login must clear accumulated failures, got %d", unlocked.failedLoginsCleared)
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
