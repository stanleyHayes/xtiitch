package growthhttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	growthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/growth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestRecordAffiliateClickReturnsCreated(t *testing.T) {
	t.Parallel()

	service := &fakeGrowthService{}
	router := chi.NewRouter()
	NewHandler(service).Register(router)

	request := httptest.NewRequest(
		http.MethodPost,
		"/public/affiliates/SEWINGPRO/clicks",
		strings.NewReader(`{"visitor_id":"visitor-1","landing_url":"https://store.test/d/one","referrer_url":"https://ads.test"}`),
	)
	request.RemoteAddr = "198.51.100.10:4444"
	request.Header.Set("User-Agent", "Test browser")
	request.Header.Set("X-Forwarded-For", "203.0.113.10, 10.0.0.1")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", response.Code, response.Body.String())
	}
	if service.command.Code != "SEWINGPRO" ||
		service.command.VisitorID != "visitor-1" ||
		service.command.IPAddress != "203.0.113.10" ||
		service.command.UserAgent != "Test browser" {
		t.Fatalf("unexpected service command: %+v", service.command)
	}
	if !strings.Contains(response.Body.String(), `"click_id":"click-1"`) {
		t.Fatalf("expected click id response, got %s", response.Body.String())
	}
}

func TestRecordAffiliateClickMapsErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want int
		code string
	}{
		{name: "invalid input", err: growthapp.ErrInvalidInput, want: http.StatusBadRequest, code: "invalid_click"},
		{name: "unknown affiliate", err: growthapp.ErrAffiliateNotFound, want: http.StatusNotFound, code: "affiliate_not_found"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			router := chi.NewRouter()
			NewHandler(&fakeGrowthService{err: test.err}).Register(router)
			request := httptest.NewRequest(
				http.MethodPost,
				"/public/affiliates/SEWINGPRO/clicks",
				strings.NewReader(`{"visitor_id":"visitor-1"}`),
			)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != test.want || !strings.Contains(response.Body.String(), test.code) {
				t.Fatalf("expected %d/%s, got %d body=%s", test.want, test.code, response.Code, response.Body.String())
			}
		})
	}
}

func TestRecordAffiliateClickRejectsUnknownJSON(t *testing.T) {
	t.Parallel()

	router := chi.NewRouter()
	NewHandler(&fakeGrowthService{}).Register(router)
	request := httptest.NewRequest(
		http.MethodPost,
		"/public/affiliates/SEWINGPRO/clicks",
		strings.NewReader(`{"visitor_id":"visitor-1","extra":true}`),
	)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestReferralCodeReturnsPublicRewardDetails(t *testing.T) {
	t.Parallel()

	service := &fakeGrowthService{}
	router := chi.NewRouter()
	NewHandler(service).Register(router)

	request := httptest.NewRequest(http.MethodGet, "/public/referrals/REFAMA", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.referralCommand.Code != "REFAMA" {
		t.Fatalf("expected referral command to receive code, got %+v", service.referralCommand)
	}
	if !strings.Contains(response.Body.String(), `"code":"REFAMA"`) ||
		!strings.Contains(response.Body.String(), `"title":"Customer referrals"`) ||
		!strings.Contains(response.Body.String(), `"qualifying_order_min_minor":10000`) {
		t.Fatalf("expected referral reward response, got %s", response.Body.String())
	}
}

func TestReferralCodeMapsMissingCode(t *testing.T) {
	t.Parallel()

	router := chi.NewRouter()
	NewHandler(&fakeGrowthService{referralErr: growthapp.ErrReferralNotFound}).Register(router)
	request := httptest.NewRequest(http.MethodGet, "/public/referrals/MISSING", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound || !strings.Contains(response.Body.String(), "referral_not_found") {
		t.Fatalf("expected 404 referral_not_found, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestSponsoredPlacementsReturnsActiveCampaigns(t *testing.T) {
	t.Parallel()

	service := &fakeGrowthService{}
	router := chi.NewRouter()
	NewHandler(service).Register(router)

	request := httptest.NewRequest(http.MethodGet, "/public/sponsored?limit=4", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if service.sponsoredLimit != 4 {
		t.Fatalf("expected service limit 4, got %d", service.sponsoredLimit)
	}
	if !strings.Contains(response.Body.String(), `"campaign_id":"campaign-1"`) ||
		!strings.Contains(response.Body.String(), `"business_name":"Demo Atelier"`) {
		t.Fatalf("expected sponsored placement response, got %s", response.Body.String())
	}
}

func TestRecordSponsoredEventReturnsCreated(t *testing.T) {
	t.Parallel()

	service := &fakeGrowthService{}
	router := chi.NewRouter()
	NewHandler(service).Register(router)

	request := httptest.NewRequest(
		http.MethodPost,
		"/public/sponsored/campaign-1/events",
		strings.NewReader(`{"event_type":"impression","visitor_id":"visitor-1","page_url":"https://xtiitch.test","referrer_url":"https://search.test"}`),
	)
	request.RemoteAddr = "198.51.100.10:4444"
	request.Header.Set("User-Agent", "Test browser")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", response.Code, response.Body.String())
	}
	if service.sponsoredEvent.CampaignID != "campaign-1" ||
		service.sponsoredEvent.EventType != "impression" ||
		service.sponsoredEvent.VisitorID != "visitor-1" ||
		service.sponsoredEvent.UserAgent != "Test browser" ||
		service.sponsoredEvent.IPAddress != "198.51.100.10" {
		t.Fatalf("unexpected sponsored event command: %+v", service.sponsoredEvent)
	}
	if !strings.Contains(response.Body.String(), `"event_id":"event-1"`) {
		t.Fatalf("expected event id response, got %s", response.Body.String())
	}
}

func TestRecordSponsoredEventMapsMissingCampaign(t *testing.T) {
	t.Parallel()

	router := chi.NewRouter()
	NewHandler(&fakeGrowthService{sponsoredErr: growthapp.ErrSponsoredAdNotFound}).Register(router)
	request := httptest.NewRequest(
		http.MethodPost,
		"/public/sponsored/campaign-1/events",
		strings.NewReader(`{"event_type":"click","visitor_id":"visitor-1"}`),
	)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound || !strings.Contains(response.Body.String(), "sponsored_ad_not_found") {
		t.Fatalf("expected 404 sponsored_ad_not_found, got %d body=%s", response.Code, response.Body.String())
	}
}

type fakeGrowthService struct {
	command         growthapp.RecordAffiliateClickCommand
	sponsoredEvent  growthapp.RecordSponsoredAdEventCommand
	referralCommand growthapp.ResolveReferralCodeCommand
	sponsoredLimit  int
	err             error
	sponsoredErr    error
	referralErr     error
}

func (service *fakeGrowthService) RecordAffiliateClick(
	_ context.Context,
	command growthapp.RecordAffiliateClickCommand,
) (ports.AffiliateClickRecord, error) {
	service.command = command
	if service.err != nil {
		return ports.AffiliateClickRecord{}, service.err
	}
	return ports.AffiliateClickRecord{
		ClickID:     "click-1",
		AffiliateID: "affiliate-1",
		Code:        command.Code,
		ClickedAt:   time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC),
	}, nil
}

func (service *fakeGrowthService) ListSponsoredPlacements(
	_ context.Context,
	command growthapp.ListSponsoredPlacementsCommand,
) ([]ports.SponsoredPlacementRecord, error) {
	service.sponsoredLimit = command.Limit
	if service.sponsoredErr != nil {
		return nil, service.sponsoredErr
	}
	return []ports.SponsoredPlacementRecord{
		{
			CampaignID:     "campaign-1",
			BusinessID:     "business-1",
			BusinessName:   "Demo Atelier",
			BusinessHandle: "demo-atelier",
			PlacementType:  "featured_business",
			TargetLabel:    "Demo Atelier",
			Headline:       "Handmade occasion wear",
			Description:    "A verified Xtiitch business.",
			StoreHandle:    "demo-atelier",
			ImageURL:       "https://images.test/demo.webp",
			StartsAt:       time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC),
			EndsAt:         time.Date(2026, 6, 20, 12, 0, 0, 0, time.UTC),
		},
	}, nil
}

func (service *fakeGrowthService) RecordSponsoredAdEvent(
	_ context.Context,
	command growthapp.RecordSponsoredAdEventCommand,
) (ports.SponsoredAdEventRecord, error) {
	service.sponsoredEvent = command
	if service.sponsoredErr != nil {
		return ports.SponsoredAdEventRecord{}, service.sponsoredErr
	}
	return ports.SponsoredAdEventRecord{
		EventID:    "event-1",
		CampaignID: common.ID(command.CampaignID),
		EventType:  command.EventType,
		OccurredAt: time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC),
	}, nil
}

func (service *fakeGrowthService) ResolveReferralCode(
	_ context.Context,
	command growthapp.ResolveReferralCodeCommand,
) (ports.ReferralCodeRecord, error) {
	service.referralCommand = command
	if service.referralErr != nil {
		return ports.ReferralCodeRecord{}, service.referralErr
	}
	maxReward := int64(5000)
	startsAt := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	return ports.ReferralCodeRecord{
		ReferralCodeID:       "ref-code-1",
		ReferralProgrammeID:  "ref-programme-1",
		OwnerType:            "customer",
		Code:                 command.Code,
		Title:                "Customer referrals",
		Audience:             "customers",
		ReferrerRewardKind:   "voucher",
		RefereeRewardKind:    "voucher",
		RewardType:           "fixed",
		RewardValue:          5000,
		MaxRewardMinor:       &maxReward,
		QualifyingOrderMinor: 10000,
		RewardHoldDays:       14,
		StartsAt:             &startsAt,
		Status:               "active",
	}, nil
}
