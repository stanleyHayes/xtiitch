package catalogue

import "testing"

func TestSlugify(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		"Kente Wrap Dress":       "kente-wrap-dress",
		"  Bridal   Collection ": "bridal-collection",
		"Agbada & Cap!":          "agbada-cap",
		"Size 12":                "size-12",
		"---":                    "",
		"Été 2026":               "t-2026",
	}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Fatalf("Slugify(%q) = %q, want %q", in, want, got)
		}
	}
}

func TestNewHandleToken(t *testing.T) {
	t.Parallel()

	if got := NewHandleToken("8002d674-ab71-433d-8b78-0e028d5a88a0"); got != "8002d674ab" {
		t.Fatalf("expected 10-char alphanumeric token, got %q", got)
	}
	if got := NewHandleToken("AB"); got != "ab" {
		t.Fatalf("expected short token lowercased, got %q", got)
	}
}

func TestBuildHandle(t *testing.T) {
	t.Parallel()

	if got := BuildHandle("Kente Wrap", "a3f9k2x1qq"); got != "kente-wrap-a3f9k2x1qq" {
		t.Fatalf("unexpected handle %q", got)
	}
	// Unnameable input still yields an unguessable handle from the token.
	if got := BuildHandle("***", "a3f9k2x1qq"); got != "a3f9k2x1qq" {
		t.Fatalf("expected token-only handle, got %q", got)
	}
}

func TestStatusLifecycle(t *testing.T) {
	t.Parallel()

	if !StatusActive.IsPublic() || StatusRetired.IsPublic() || StatusDeleted.IsPublic() {
		t.Fatal("only active items should be public")
	}
	if !StatusActive.CanRetire() || StatusRetired.CanRetire() {
		t.Fatal("only active items can be retired")
	}
	if !StatusRetired.CanRestore() || StatusActive.CanRestore() {
		t.Fatal("only retired items can be restored")
	}
	if !StatusActive.CanDelete() || !StatusRetired.CanDelete() || StatusDeleted.CanDelete() {
		t.Fatal("deleted is terminal")
	}
}
