package adminauthhttp

import (
	"testing"
	"time"
)

// A mistyped bound must be reported, not ignored. Silently dropping it would
// widen the window an investigator believes they are looking at, which is worse
// than refusing the request.
func TestParseAuditTime(t *testing.T) {
	for _, tc := range []struct {
		name  string
		raw   string
		ok    bool
		zero  bool
		wantY int
	}{
		{"empty means unbounded", "", true, true, 0},
		{"whitespace means unbounded", "   ", true, true, 0},
		{"plain date", "2026-03-04", true, false, 2026},
		{"rfc3339", "2026-03-04T10:30:00Z", true, false, 2026},
		{"mistyped date is refused", "04/03/2026", false, true, 0},
		{"nonsense is refused", "yesterday", false, true, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseAuditTime(tc.raw)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if got.IsZero() != tc.zero {
				t.Fatalf("zero = %v, want %v", got.IsZero(), tc.zero)
			}
			if !tc.zero && got.Year() != tc.wantY {
				t.Fatalf("year = %d, want %d", got.Year(), tc.wantY)
			}
		})
	}
}

// A malformed limit should mean "use the default", not fail the request.
func TestAtoiOr(t *testing.T) {
	for _, tc := range []struct {
		raw  string
		want int
	}{
		{"", 0},
		{"50", 50},
		{" 25 ", 25},
		{"-1", 0},
		{"abc", 0},
		{"9999", 9999}, // clamped downstream by the repository, not here
	} {
		if got := atoiOr(tc.raw, 0); got != tc.want {
			t.Fatalf("atoiOr(%q) = %d, want %d", tc.raw, got, tc.want)
		}
	}
}

var _ = time.Time{}
