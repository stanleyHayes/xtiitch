package authapp

import (
	"context"
	"errors"
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

type fakeBusinessIdentityRepository struct {
	created      ports.CreateBusinessWithOwnerInput
	credentials  ports.BusinessUserCredentials
	lookupHandle string
	lookupEmail  string
}

func (repo *fakeBusinessIdentityRepository) CreateBusinessWithOwner(_ context.Context, input ports.CreateBusinessWithOwnerInput) (ports.BusinessOwnerIdentity, error) {
	repo.created = input
	return ports.BusinessOwnerIdentity{
		BusinessID:     input.BusinessID,
		BusinessUserID: input.OwnerUserID,
		Role:           business.UserRoleOwner,
	}, nil
}

func (repo *fakeBusinessIdentityRepository) FindBusinessUserByHandleAndEmail(_ context.Context, handle string, email string) (ports.BusinessUserCredentials, error) {
	repo.lookupHandle = handle
	repo.lookupEmail = email
	return repo.credentials, nil
}

type fakeSessionRepository struct {
	created ports.CreateAuthSessionInput
}

func (repo *fakeSessionRepository) Create(_ context.Context, input ports.CreateAuthSessionInput) error {
	repo.created = input
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
