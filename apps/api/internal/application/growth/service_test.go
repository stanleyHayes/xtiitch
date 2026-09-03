package growthapp

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestRecordAffiliateClickNormalizesAndHashesInput(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateClicks{}
	service := NewService(Dependencies{
		Affiliates: repo,
		IDs:        sequenceIDs{ids: []common.ID{"click-1"}},
	})

	record, err := service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code:        " sewing-pro ",
		VisitorID:   " visitor-1 ",
		LandingURL:  " https://demo.xtiitch.test/d/agbada ",
		ReferrerURL: " https://example.com/ad ",
		UserAgent:   "Test browser",
		IPAddress:   "203.0.113.10",
	})
	if err != nil {
		t.Fatalf("record affiliate click: %v", err)
	}
	if repo.input.ClickID != "click-1" ||
		repo.input.Code != "SEWING-PRO" ||
		repo.input.VisitorID != "visitor-1" ||
		repo.input.IPHash == "" ||
		repo.input.IPHash == "203.0.113.10" {
		t.Fatalf("expected normalized hashed input, got %+v", repo.input)
	}
	if record.Code != "SEWING-PRO" || record.ClickID != "click-1" {
		t.Fatalf("unexpected click response: %+v", record)
	}
}

func TestRecordAffiliateClickRequiresIdentifierAndKnownAffiliate(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Affiliates: &fakeAffiliateClicks{err: ports.ErrNotFound},
		IDs:        sequenceIDs{ids: []common.ID{"click-1"}},
	})

	_, err := service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code: "bad code!",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid code, got %v", err)
	}

	_, err = service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code: "SEWINGPRO",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected missing visitor/ip to be invalid, got %v", err)
	}

	_, err = service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code:      "SEWINGPRO",
		IPAddress: "203.0.113.10",
	})
	if !errors.Is(err, ErrAffiliateNotFound) {
		t.Fatalf("expected unknown affiliate mapping, got %v", err)
	}
}

func TestSubmitAffiliateApplicationNormalizesInput(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateApplications{}
	emails := &fakeGrowthEmailSender{}
	service := NewService(Dependencies{
		Applications:  repo,
		Emails:        emails,
		IDs:           sequenceIDs{ids: []common.ID{"application-1", "affiliate-1", "account-1", "activation-1"}},
		RefreshTokens: fakeGrowthRefreshTokens{},
		Clock:         fakeGrowthClock{now: time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)},
	})

	record, err := service.SubmitAffiliateApplication(
		context.Background(),
		SubmitAffiliateApplicationCommand{
			ApplicantType:     " Person ",
			DisplayName:       " Ama Creates ",
			ContactName:       " Ama Mensah ",
			Email:             " AMA@EXAMPLE.COM ",
			Phone:             " +233 20 000 0000 ",
			WebsiteURL:        "https://example.com/ama",
			RequestedCode:     " ama-creates ",
			AudienceSummary:   " Ghana fashion shoppers ",
			PromotionChannels: []string{" Instagram ", "instagram", "WhatsApp"},
			Consent:           true,
			IPAddress:         "203.0.113.50",
			UserAgent:         "Test browser",
			InviteCode:        "invitation-token",
		},
	)
	if err != nil {
		t.Fatalf("submit application: %v", err)
	}
	if record.ApplicationID != "application-1" ||
		repo.input.Email != "ama@example.com" ||
		repo.input.Phone != "+233200000000" ||
		repo.input.RequestedCode != "AMA-CREATES" ||
		len(repo.input.PromotionChannels) != 2 ||
		repo.input.IPHash == "" ||
		repo.input.IPHash == "203.0.113.50" ||
		repo.input.ConsentAt.IsZero() {
		t.Fatalf("unexpected normalized application: %+v", repo.input)
	}
	if repo.input.InviteCode != "invitation-token" {
		t.Fatalf("invitation code was not preserved: %+v", repo.input)
	}
	if len(emails.sent) != 1 ||
		emails.sent[0].To != "ama@example.com" ||
		emails.sent[0].Subject != "Activate your Xtiitch Affiliate account" {
		t.Fatalf("unexpected application email: %+v", emails.sent)
	}
	if !strings.Contains(emails.sent[0].Body, "https://affiliate.xtiitch.com/activate?token=") ||
		strings.Contains(emails.sent[0].Body, "partners.xtiitch.com") {
		t.Fatalf("unexpected activation URL in application email: %q", emails.sent[0].Body)
	}
}

func TestSubmitAffiliateApplicationRejectsInvalidWhatsAppNumber(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Applications:  &fakeAffiliateApplications{},
		IDs:           sequenceIDs{ids: []common.ID{"application-1", "affiliate-1", "account-1", "activation-1"}},
		RefreshTokens: fakeGrowthRefreshTokens{},
		Clock:         fakeGrowthClock{now: time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)},
	})
	_, err := service.SubmitAffiliateApplication(context.Background(), SubmitAffiliateApplicationCommand{
		DisplayName: "Ama Creates", ContactName: "Ama Mensah", Email: "ama@example.com",
		Phone: "not-whatsapp", RequestedCode: "AMACREATES",
		PromotionChannels: []string{"whatsapp"}, Consent: true,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid WhatsApp number, got %v", err)
	}
}

func TestNormalizeAffiliateWhatsApp(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "Ghana local", input: "024 350 3670", want: "+233243503670"},
		{name: "Ghana country code", input: "233 24 350 3670", want: "+233243503670"},
		{name: "international", input: "+44 7700 900123", want: "+447700900123"},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got, err := normalizeAffiliateWhatsApp(test.input)
			if err != nil || got != test.want {
				t.Fatalf("normalizeAffiliateWhatsApp(%q) = %q, %v; want %q", test.input, got, err, test.want)
			}
		})
	}
}

func TestSubmitAffiliateApplicationValidatesConsentAndCodeConflict(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Applications:  &fakeAffiliateApplications{err: ports.ErrAffiliateCodeTaken},
		IDs:           sequenceIDs{ids: []common.ID{"application-1", "affiliate-1", "account-1", "activation-1"}},
		RefreshTokens: fakeGrowthRefreshTokens{},
		Clock:         fakeGrowthClock{now: time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)},
	})

	_, err := service.SubmitAffiliateApplication(
		context.Background(),
		SubmitAffiliateApplicationCommand{Consent: false},
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected consent validation, got %v", err)
	}

	_, err = service.SubmitAffiliateApplication(
		context.Background(),
		SubmitAffiliateApplicationCommand{
			DisplayName:       "Ama Creates",
			ContactName:       "Ama Mensah",
			Email:             "ama@example.com",
			Phone:             "+233200000000",
			RequestedCode:     "AMACREATES",
			PromotionChannels: []string{"instagram"},
			Consent:           true,
		},
	)
	if !errors.Is(err, ErrAffiliateCodeTaken) {
		t.Fatalf("expected affiliate code conflict, got %v", err)
	}
}

func TestListSponsoredPlacementsCapsLimit(t *testing.T) {
	t.Parallel()

	repo := &fakeSponsoredPlacements{}
	service := NewService(Dependencies{
		Sponsored: repo,
	})

	_, err := service.ListSponsoredPlacements(context.Background(), ListSponsoredPlacementsCommand{
		Limit: 99,
	})
	if err != nil {
		t.Fatalf("list sponsored placements: %v", err)
	}
	if repo.listInput.Limit != 12 {
		t.Fatalf("expected capped limit 12, got %+v", repo.listInput)
	}
}

func TestRecordSponsoredAdEventNormalizesVisitorAndMapsMissingCampaign(t *testing.T) {
	t.Parallel()

	repo := &fakeSponsoredPlacements{err: ports.ErrNotFound}
	service := NewService(Dependencies{
		Sponsored: repo,
		IDs:       sequenceIDs{ids: []common.ID{"event-1"}},
	})

	_, err := service.RecordSponsoredAdEvent(context.Background(), RecordSponsoredAdEventCommand{
		CampaignID:  "aaaaaaaa-5555-5555-5555-555555555551",
		EventType:   " click ",
		VisitorID:   " visitor-1 ",
		PageURL:     " https://xtiitch.test ",
		ReferrerURL: " https://referrer.test ",
		UserAgent:   "Test browser",
		IPAddress:   "203.0.113.20",
	})
	if !errors.Is(err, ErrSponsoredAdNotFound) {
		t.Fatalf("expected missing campaign mapping, got %v", err)
	}
	if repo.eventInput.EventID != "event-1" ||
		repo.eventInput.CampaignID != "aaaaaaaa-5555-5555-5555-555555555551" ||
		repo.eventInput.EventType != "click" ||
		repo.eventInput.VisitorID != "visitor-1" ||
		repo.eventInput.IPHash == "" ||
		repo.eventInput.PageURL != "https://xtiitch.test" {
		t.Fatalf("expected normalized event input, got %+v", repo.eventInput)
	}
}

func TestRecordSponsoredAdEventRequiresValidTypeAndIdentifier(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Sponsored: &fakeSponsoredPlacements{},
		IDs:       sequenceIDs{ids: []common.ID{"event-1"}},
	})

	_, err := service.RecordSponsoredAdEvent(context.Background(), RecordSponsoredAdEventCommand{
		CampaignID: "aaaaaaaa-5555-5555-5555-555555555551",
		EventType:  "view",
		VisitorID:  "visitor-1",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid event type, got %v", err)
	}

	_, err = service.RecordSponsoredAdEvent(context.Background(), RecordSponsoredAdEventCommand{
		CampaignID: "aaaaaaaa-5555-5555-5555-555555555551",
		EventType:  "impression",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected missing visitor/ip to be invalid, got %v", err)
	}
}

type fakeAffiliateClicks struct {
	input ports.RecordAffiliateClickInput
	err   error
}

type fakeAffiliateApplications struct {
	input      ports.SubmitAffiliateApplicationInput
	err        error
	codeExists bool
}

func (repo *fakeAffiliateApplications) AffiliateCodeExists(context.Context, string) (bool, error) {
	return repo.codeExists, repo.err
}

type fakeGrowthEmailSender struct {
	sent []ports.EmailMessage
}

type fakeGrowthRefreshTokens struct{}

func (fakeGrowthRefreshTokens) NewRefreshToken() (string, error) { return "activation-token", nil }
func (fakeGrowthRefreshTokens) HashRefreshToken(string) string {
	return "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}

type fakeGrowthClock struct{ now time.Time }

func (clock fakeGrowthClock) Now() time.Time { return clock.now }

func (sender *fakeGrowthEmailSender) Send(
	_ context.Context,
	message ports.EmailMessage,
) error {
	sender.sent = append(sender.sent, message)
	return nil
}

func (repo *fakeAffiliateApplications) SubmitAffiliateApplication(
	_ context.Context,
	input ports.SubmitAffiliateApplicationInput,
) (ports.AffiliateApplicationRecord, error) {
	repo.input = input
	if repo.err != nil {
		return ports.AffiliateApplicationRecord{}, repo.err
	}
	return ports.AffiliateApplicationRecord{
		ApplicationID: input.ApplicationID,
		DisplayName:   input.DisplayName,
		Email:         input.Email,
		RequestedCode: input.RequestedCode,
		Status:        "approved",
		CreatedAt:     time.Now(),
	}, nil
}

func (repo *fakeAffiliateClicks) RecordAffiliateClick(
	_ context.Context,
	input ports.RecordAffiliateClickInput,
) (ports.AffiliateClickRecord, error) {
	repo.input = input
	if repo.err != nil {
		return ports.AffiliateClickRecord{}, repo.err
	}
	return ports.AffiliateClickRecord{
		ClickID:     input.ClickID,
		AffiliateID: "affiliate-1",
		Code:        input.Code,
		ClickedAt:   time.Now(),
	}, nil
}

func (repo *fakeAffiliateClicks) ReserveAffiliateAttribution(
	context.Context,
	common.TenantScope,
	ports.ReserveAffiliateAttributionInput,
) (ports.AffiliateAttributionReservation, error) {
	return ports.AffiliateAttributionReservation{}, nil
}

type fakeSponsoredPlacements struct {
	listInput  ports.ListActiveSponsoredPlacementsInput
	eventInput ports.RecordSponsoredAdEventInput
	err        error
}

func (repo *fakeSponsoredPlacements) ListActiveSponsoredPlacements(
	_ context.Context,
	input ports.ListActiveSponsoredPlacementsInput,
) ([]ports.SponsoredPlacementRecord, error) {
	repo.listInput = input
	return []ports.SponsoredPlacementRecord{
		{CampaignID: "campaign-1", BusinessName: "Demo Atelier"},
	}, nil
}

func (repo *fakeSponsoredPlacements) RecordSponsoredAdEvent(
	_ context.Context,
	input ports.RecordSponsoredAdEventInput,
) (ports.SponsoredAdEventRecord, error) {
	repo.eventInput = input
	if repo.err != nil {
		return ports.SponsoredAdEventRecord{}, repo.err
	}
	return ports.SponsoredAdEventRecord{
		EventID:    input.EventID,
		CampaignID: input.CampaignID,
		EventType:  input.EventType,
		OccurredAt: time.Now(),
	}, nil
}

type sequenceIDs struct {
	ids []common.ID
}

func (seq sequenceIDs) NewID() common.ID {
	if len(seq.ids) == 0 {
		return "generated"
	}
	return seq.ids[0]
}
