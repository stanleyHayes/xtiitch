package authapp

import (
	"context"
	"errors"
	"testing"
	"time"

	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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
		Scope:          common.TenantScope{BusinessID: "business-1"},
		ActorRole:      business.UserRoleAdmin,
		CardNumber:     " GHA-123456789-0 ",
		IDPhotoURL:     "https://cdn.example.com/card.jpg",
		IDPhotoBackURL: "https://cdn.example.com/card-back.jpg",
	})
	if err != nil {
		t.Fatalf("expected admin identity submission to pass, got %v", err)
	}
	if businesses.identityDocument.BusinessID != "business-1" ||
		businesses.identityDocument.CardNumber != "GHA-123456789-0" ||
		businesses.identityDocument.IDPhotoURL != "https://cdn.example.com/card.jpg" ||
		businesses.identityDocument.IDPhotoBackURL != "https://cdn.example.com/card-back.jpg" {
		t.Fatalf("unexpected identity document: %+v", businesses.identityDocument)
	}

	// Both the front and back photo are required.
	err = service.SubmitIdentityVerification(context.Background(), SubmitIdentityVerificationCommand{
		Scope:      common.TenantScope{BusinessID: "business-1"},
		ActorRole:  business.UserRoleAdmin,
		CardNumber: "GHA-123456789-0",
		IDPhotoURL: "https://cdn.example.com/card.jpg",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected missing back photo to be invalid input, got %v", err)
	}
}
