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

type fakeGrowthService struct {
	command growthapp.RecordAffiliateClickCommand
	err     error
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
