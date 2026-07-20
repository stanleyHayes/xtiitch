package common

import "testing"

func TestNormalizeGhanaPhoneAcceptsEveryDocumentedForm(t *testing.T) {
	t.Parallel()

	const canonical = "233243503670"
	accepted := map[string]string{
		// canonical E.164 digits, with and without '+'
		"233243503670":     canonical,
		"+233243503670":    canonical,
		"+233 24 350 3670": canonical,
		// local 0-prefixed form
		"0243503670":     canonical,
		"024 350 3670":   canonical,
		"024-350-3670":   canonical,
		"  0243503670  ": canonical,
		// bare 9-digit local form
		"243503670":   canonical,
		"243 503 670": canonical,
	}
	for raw, want := range accepted {
		got, err := NormalizeGhanaPhone(raw)
		if err != nil {
			t.Fatalf("NormalizeGhanaPhone(%q): unexpected error %v", raw, err)
		}
		if got != want {
			t.Fatalf("NormalizeGhanaPhone(%q) = %q, want %q", raw, got, want)
		}
	}
}

func TestNormalizeGhanaPhoneRejectsUnusableForms(t *testing.T) {
	t.Parallel()

	rejected := []string{
		"",
		"   ",
		"abc",
		"12345",
		"02435036700",      // 11 digits: no accepted form
		"2332435036701",    // 13 digits: too long for E.164 Ghana
		"1234567890",       // 10 digits without the local 0 prefix
		"00243243503670",   // international dialling prefix is not accepted
		"+447700900123",    // foreign number
		"233 024 350 3670", // 13 digits once separators are stripped
	}
	for _, raw := range rejected {
		if got, err := NormalizeGhanaPhone(raw); err == nil {
			t.Fatalf("NormalizeGhanaPhone(%q) = %q, expected error", raw, got)
		}
	}
}

func TestNormalizeGhanaPhoneReturnsSentinel(t *testing.T) {
	t.Parallel()

	if _, err := NormalizeGhanaPhone("nope"); err != ErrInvalidPhone {
		t.Fatalf("expected ErrInvalidPhone, got %v", err)
	}
}
