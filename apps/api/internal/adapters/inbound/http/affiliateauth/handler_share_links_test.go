package affiliateauthhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	affiliateauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/affiliateauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// The affiliate QR download is the one endpoint whose failure the portal used
// to render as a full-page "Something went wrong" error, so its status codes
// are load-bearing: 401 must stay 401 (the web app refreshes the access token
// on 401 and retries), and a genuine encode failure must not masquerade as
// anything else. None of this was covered by a test before.

type shareLinksStub struct {
	Service // everything unimplemented; only ShareLinks is exercised here

	code       string
	url        string
	windowDays int
	err        error
}

func (s shareLinksStub) ShareLinks(context.Context, common.ID) (string, string, int, error) {
	if s.err != nil {
		return "", "", 0, s.err
	}
	return s.code, s.url, s.windowDays, nil
}

type verifierStub struct {
	err error
}

func (v verifierStub) VerifyAffiliateAccessToken(
	context.Context,
	string,
) (ports.VerifiedAffiliateAccessToken, error) {
	if v.err != nil {
		return ports.VerifiedAffiliateAccessToken{}, v.err
	}
	return ports.VerifiedAffiliateAccessToken{
		AccountID:   common.ID("affiliate-account-1"),
		AffiliateID: common.ID("affiliate-1"),
	}, nil
}

func newQRRequest(t *testing.T, service Service, verifier ports.AffiliateTokenVerifier, authHeader string) *httptest.ResponseRecorder {
	t.Helper()
	router := chi.NewRouter()
	NewHandler(service, verifier).Register(router)

	request := httptest.NewRequest(http.MethodGet, "/affiliate/share-links/qr.png", nil)
	if authHeader != "" {
		request.Header.Set("Authorization", authHeader)
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestShareLinkQRReturnsPNG(t *testing.T) {
	recorder := newQRRequest(t, shareLinksStub{
		code:       "BAAH01",
		url:        "https://business.xtiitch.com/register?affiliate_code=BAAH01",
		windowDays: 30,
	}, verifierStub{}, "Bearer token")

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Type"); got != "image/png" {
		t.Fatalf("Content-Type = %q, want image/png", got)
	}
	if got := recorder.Header().Get("Content-Disposition"); got == "" {
		t.Fatal("Content-Disposition missing; the browser would render the PNG instead of downloading it")
	}
	// A real PNG, not an error page with a PNG content type.
	if !bytes.HasPrefix(recorder.Body.Bytes(), []byte("\x89PNG\r\n\x1a\n")) {
		t.Fatalf("body is not a PNG (first bytes %q)", recorder.Body.Bytes()[:min(8, recorder.Body.Len())])
	}
}

// The web app treats 401 as "refresh the access token and retry once". If this
// ever regressed to 500, an affiliate whose token expired while the tab sat
// open would be shown a full-page error instead of being silently refreshed.
func TestShareLinkQRUnauthorized(t *testing.T) {
	for name, header := range map[string]string{
		"missing header": "",
		"not bearer":     "Basic abc",
		"short header":   "Bearer",
	} {
		t.Run(name, func(t *testing.T) {
			recorder := newQRRequest(t, shareLinksStub{}, verifierStub{}, header)
			if recorder.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", recorder.Code)
			}
		})
	}

	t.Run("rejected token", func(t *testing.T) {
		recorder := newQRRequest(t, shareLinksStub{}, verifierStub{err: errors.New("expired")}, "Bearer token")
		if recorder.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", recorder.Code)
		}
	})
}

// An empty share URL is the one input go-qrcode rejects outright ("no data to
// encode"). It must produce a NAMED error rather than a bare internal_error,
// so the cause is visible in production logs.
func TestShareLinkQREmptyURLIsNamed(t *testing.T) {
	recorder := newQRRequest(t, shareLinksStub{code: "", url: "", windowDays: 30}, verifierStub{}, "Bearer token")

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", recorder.Code)
	}
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not JSON: %v (%q)", err, recorder.Body.String())
	}
	if body.Error != "share_link_unavailable" {
		t.Fatalf("error = %q, want share_link_unavailable — a bare internal_error is undiagnosable in prod", body.Error)
	}
}

// A service failure must map through authError, not fall through as a PNG.
func TestShareLinkQRServiceFailure(t *testing.T) {
	recorder := newQRRequest(t, shareLinksStub{err: affiliateauthapp.ErrAffiliateUnavailable}, verifierStub{}, "Bearer token")

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", recorder.Code)
	}
	if got := recorder.Header().Get("Content-Type"); got == "image/png" {
		t.Fatal("failure served as image/png; the browser would download a broken file")
	}
}

// Long share URLs (a campaign-tagged link, say) must still encode. 768px at
// Medium recovery has ample capacity; this guards the regression where a
// larger code silently exceeds it.
func TestShareLinkQREncodesLongURL(t *testing.T) {
	long := "https://business.xtiitch.com/register?affiliate_code=BAAH01&utm_source=whatsapp&utm_medium=broadcast&utm_campaign=december-market-push-2026"
	recorder := newQRRequest(t, shareLinksStub{code: "BAAH01", url: long, windowDays: 30}, verifierStub{}, "Bearer token")

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	if !bytes.HasPrefix(recorder.Body.Bytes(), []byte("\x89PNG\r\n\x1a\n")) {
		t.Fatal("long URL did not produce a PNG")
	}
}
