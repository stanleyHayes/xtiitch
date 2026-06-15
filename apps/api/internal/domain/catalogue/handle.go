package catalogue

import "strings"

// handleTokenLength is the number of random characters appended to a slug so a
// design or collection handle is unguessable (a shopper cannot enumerate a
// store's catalogue by guessing slugs).
const handleTokenLength = 10

// Slugify turns a display name into a lowercase, hyphen-separated slug
// containing only [a-z0-9-], with no leading, trailing, or repeated hyphens.
func Slugify(name string) string {
	var builder strings.Builder
	pendingDash := false

	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			if pendingDash && builder.Len() > 0 {
				builder.WriteByte('-')
			}
			pendingDash = false
			builder.WriteRune(r)
		default:
			pendingDash = true
		}
	}

	return builder.String()
}

// NewHandleToken reduces a random source (e.g. a UUID) to a short, unguessable
// alphanumeric token.
func NewHandleToken(raw string) string {
	var builder strings.Builder
	for _, r := range strings.ToLower(raw) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
			if builder.Len() >= handleTokenLength {
				break
			}
		}
	}
	return builder.String()
}

// BuildHandle composes a public handle from a display name and a random token.
// The token keeps the handle unguessable even when names collide.
func BuildHandle(name string, token string) string {
	slug := Slugify(name)
	switch {
	case slug == "":
		return token
	case token == "":
		return slug
	default:
		return slug + "-" + token
	}
}
