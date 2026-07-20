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
		FullLegalName:  "  Ama Serwaa Mensah  ",
		CardNumber:     " GHA-123456789-0 ",
		IDPhotoURL:     "https://cdn.example.com/card.jpg",
		IDPhotoBackURL: "https://cdn.example.com/card-back.jpg",
	})
	if err != nil {
		t.Fatalf("expected admin identity submission to pass, got %v", err)
	}
	if businesses.identityDocument.BusinessID != "business-1" ||
		businesses.identityDocument.FullLegalName != "Ama Serwaa Mensah" ||
		businesses.identityDocument.CardNumber != "GHA-123456789-0" ||
		businesses.identityDocument.IDPhotoURL != "https://cdn.example.com/card.jpg" ||
		businesses.identityDocument.IDPhotoBackURL != "https://cdn.example.com/card-back.jpg" {
		t.Fatalf("unexpected identity document: %+v", businesses.identityDocument)
	}

	// Both the front and back photo are required.
	err = service.SubmitIdentityVerification(context.Background(), SubmitIdentityVerificationCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		ActorRole:     business.UserRoleAdmin,
		FullLegalName: "Ama Serwaa Mensah",
		CardNumber:    "GHA-123456789-0",
		IDPhotoURL:    "https://cdn.example.com/card.jpg",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected missing back photo to be invalid input, got %v", err)
	}
}

// §2.3: the full legal name (exactly as printed on the Ghana Card) is required
// for NEW submissions — the admin reviewer matches it against the card photos,
// so a blank or absurdly long name must never reach review. Submissions stored
// before migration 000097 simply have no name on record; they are not affected
// because this validation only gates NEW writes.
func TestSubmitIdentityVerificationRequiresFullLegalName(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{}
	service := NewService(Dependencies{
		Businesses: businesses,
		Sessions:   &fakeSessionRepository{},
		Passwords:  fakePasswordHasher{},
		IDs:        &sequenceIDs{},
		Clock:      fixedClock{now: time.Now()},
	})

	base := SubmitIdentityVerificationCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		ActorRole:      business.UserRoleOwner,
		CardNumber:     "GHA-123456789-0",
		IDPhotoURL:     "https://cdn.example.com/card.jpg",
		IDPhotoBackURL: "https://cdn.example.com/card-back.jpg",
	}

	for _, name := range []string{"", "   ", string(make([]byte, maxFullLegalNameLength+1))} {
		cmd := base
		cmd.FullLegalName = name
		if err := service.SubmitIdentityVerification(context.Background(), cmd); !errors.Is(err, authdomain.ErrInvalidInput) {
			t.Fatalf("expected legal name %q to be invalid input, got %v", name, err)
		}
		if businesses.identityDocument.BusinessID != "" {
			t.Fatalf("an invalid legal name must not write a document: %+v", businesses.identityDocument)
		}
	}
}
