package cataloguehttp

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestBusinessProductAffiliateRoutesAreNotRegistered(t *testing.T) {
	t.Parallel()
	router := chi.NewRouter()
	Handler{}.Register(router)

	paths := []string{
		"/business/affiliate-programmes",
		"/business/affiliate-programmes/programme-id",
		"/business/affiliates",
		"/business/affiliates/affiliate-id",
		"/business/affiliates/affiliate-id/pause",
		"/business/affiliate-attribution",
	}
	methods := []string{http.MethodGet, http.MethodPost, http.MethodPatch}
	for _, path := range paths {
		for _, method := range methods {
			request := httptest.NewRequest(method, path, nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusNotFound {
				t.Fatalf("expected parked route %s %s to return 404, got %d", method, path, response.Code)
			}
		}
	}
}
