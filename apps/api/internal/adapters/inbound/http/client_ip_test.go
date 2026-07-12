package httpadapter

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIPFromXFF(t *testing.T) {
	cases := []struct {
		name   string
		header string
		hops   int
		want   string
	}{
		// Behind one trusted proxy (Render): the proxy-appended rightmost entry
		// is the real client; a spoofed leftmost value is ignored.
		{"spoofed leftmost ignored, trusted rightmost used", "1.1.1.1, 2.2.2.2", 1, "2.2.2.2"},
		{"attacker cannot forge: extra prepended entries don't reach the trusted slot", "9.9.9.9, 8.8.8.8, 7.7.7.7", 1, "7.7.7.7"},
		{"single entry, one hop", "203.0.113.7", 1, "203.0.113.7"},
		{"two trusted hops takes second from the right", "1.1.1.1, 2.2.2.2, 3.3.3.3", 2, "2.2.2.2"},
		{"ipv6 entry", "1.1.1.1, ::1", 1, "::1"},
		{"whitespace is trimmed", "1.1.1.1 ,  4.4.4.4 ", 1, "4.4.4.4"},
		// Fall back to r.RemoteAddr (return "") in every untrusted situation.
		{"hops zero trusts nothing", "1.1.1.1", 0, ""},
		{"negative hops trusts nothing", "1.1.1.1", -1, ""},
		{"empty header", "", 1, ""},
		{"too few entries for the hop count", "1.1.1.1", 2, ""},
		{"selected entry is not a valid IP", "not-an-ip", 1, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := clientIPFromXFF(tc.header, tc.hops); got != tc.want {
				t.Fatalf("clientIPFromXFF(%q, %d) = %q, want %q", tc.header, tc.hops, got, tc.want)
			}
		})
	}
}

func TestTrustedClientIPMiddleware(t *testing.T) {
	newReq := func(xff string) *http.Request {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.RemoteAddr = "10.0.0.1:54321" // the direct transport peer (the proxy)
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		return r
	}

	t.Run("one hop rewrites RemoteAddr to the trusted client IP", func(t *testing.T) {
		var seen string
		h := trustedClientIP(1)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			seen = r.RemoteAddr
		}))
		h.ServeHTTP(httptest.NewRecorder(), newReq("1.2.3.4, 5.6.7.8"))
		if seen != "5.6.7.8" {
			t.Fatalf("RemoteAddr = %q, want the proxy-appended 5.6.7.8", seen)
		}
	})

	t.Run("zero hops leaves RemoteAddr untouched even with a spoofed header", func(t *testing.T) {
		var seen string
		h := trustedClientIP(0)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			seen = r.RemoteAddr
		}))
		h.ServeHTTP(httptest.NewRecorder(), newReq("1.2.3.4"))
		if seen != "10.0.0.1:54321" {
			t.Fatalf("RemoteAddr = %q, want the untouched direct peer", seen)
		}
	})
}
