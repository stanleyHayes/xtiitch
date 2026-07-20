package adminauthhttp

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

// §2.3: the admin reviewer must see the owner's full legal name (exactly as
// printed on the Ghana Card) alongside the card number and both photos, in
// both the case list and the decision response — they share this mapper.
func TestBusinessVerificationResponseIncludesFullLegalName(t *testing.T) {
	t.Parallel()

	response := newBusinessVerificationResponse(ports.AdminVerificationCaseRecord{
		BusinessID:         "business-1",
		BusinessName:       "Ama Stitch",
		Handle:             "ama-stitch",
		VerificationStatus: business.VerificationStatusPending,
		FullLegalName:      "Ama Serwaa Mensah",
		IDCardNumber:       "GHA-123456789-0",
		IDPhotoURL:         "https://cdn.example.com/card.jpg",
		IDPhotoBackURL:     "https://cdn.example.com/card-back.jpg",
		SubmittedAt:        time.Now(),
		UpdatedAt:          time.Now(),
	})

	if response.FullLegalName != "Ama Serwaa Mensah" {
		t.Fatalf("expected the legal name in the case payload, got %q", response.FullLegalName)
	}
	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}
	if !strings.Contains(string(encoded), `"full_legal_name":"Ama Serwaa Mensah"`) {
		t.Fatalf("expected a full_legal_name JSON field, got %s", encoded)
	}
}

// Submissions stored before migration 000097 have no legal name on record; the
// field must still be present (empty) so the reviewer's payload shape is stable.
func TestBusinessVerificationResponseDefaultsEmptyLegalName(t *testing.T) {
	t.Parallel()

	response := newBusinessVerificationResponse(ports.AdminVerificationCaseRecord{
		BusinessID:         "business-1",
		VerificationStatus: business.VerificationStatusPending,
		SubmittedAt:        time.Now(),
		UpdatedAt:          time.Now(),
	})

	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}
	if !strings.Contains(string(encoded), `"full_legal_name":""`) {
		t.Fatalf("expected an empty full_legal_name field for legacy submissions, got %s", encoded)
	}
}
