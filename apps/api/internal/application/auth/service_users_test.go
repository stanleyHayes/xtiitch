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
