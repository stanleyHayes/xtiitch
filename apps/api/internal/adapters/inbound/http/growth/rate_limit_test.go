package growthhttp

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/time/rate"
)

func TestRouteRateLimiterIsolatedByClientAndReturnsRetryHint(t *testing.T) {
	t.Parallel()
	limiter := newRouteRateLimiter(rate.Limit(0.0001), 1)
	handler := limiter.middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodPost, "/", nil)
	request.RemoteAddr = "192.0.2.1:1234"
	first := httptest.NewRecorder()
	handler.ServeHTTP(first, request)
	if first.Code != http.StatusNoContent {
		t.Fatalf("first request should pass: %d", first.Code)
	}
	second := httptest.NewRecorder()
	handler.ServeHTTP(second, request)
	if second.Code != http.StatusTooManyRequests ||
		second.Header().Get("Retry-After") == "" {
		t.Fatalf("repeat abuse should be throttled: %d %+v",
			second.Code, second.Header())
	}
	other := httptest.NewRequest(http.MethodPost, "/", nil)
	other.RemoteAddr = "192.0.2.2:1234"
	third := httptest.NewRecorder()
	handler.ServeHTTP(third, other)
	if third.Code != http.StatusNoContent {
		t.Fatalf("another client must keep its own budget: %d", third.Code)
	}
}
