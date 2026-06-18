package config

import "testing"

func TestLoadReadsLaunchConfirmationFlags(t *testing.T) {
	t.Setenv("XTIITCH_LEGAL_REVIEW_CONFIRMED", "true")
	t.Setenv("XTIITCH_GROWTH_POLICY_CONFIRMED", "1")

	loaded := Load()
	if !loaded.LegalReviewConfirmed {
		t.Fatal("expected legal review confirmation to be true")
	}
	if !loaded.GrowthPolicyConfirmed {
		t.Fatal("expected growth policy confirmation to be true")
	}
}

func TestLoadDefaultsLaunchConfirmationFlagsToFalse(t *testing.T) {
	t.Setenv("XTIITCH_LEGAL_REVIEW_CONFIRMED", "")
	t.Setenv("XTIITCH_GROWTH_POLICY_CONFIRMED", "false")

	loaded := Load()
	if loaded.LegalReviewConfirmed {
		t.Fatal("expected legal review confirmation to default false")
	}
	if loaded.GrowthPolicyConfirmed {
		t.Fatal("expected growth policy confirmation to be false")
	}
}
