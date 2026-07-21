package checkoutapp

import (
	"net/url"
	"strings"
)

// maxCallbackURLLength bounds the post-payment return URL a checkout may carry
// (§5.2: after a successful payment the customer is redirected back to the
// cart). It only stops abuse payloads; real storefront URLs are far shorter.
const maxCallbackURLLength = 2048

// CleanCallbackURL validates the optional callback_url a checkout (or a
// re-initiated payment link) carries. Empty means "no redirect" — the provider
// default applies and behaviour is exactly as before the field existed. A
// present value must be an absolute https URL; http is accepted only for
// loopback hosts (localhost dev / e2e runs). Anything else is rejected as
// invalid input: this URL is sent to the payment provider verbatim, so it must
// never become an open-redirect or non-http(s) scheme (javascript:, intent:,
// ...) vector.
func CleanCallbackURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	if len(trimmed) > maxCallbackURLLength {
		return "", ErrInvalidInput
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || !parsed.IsAbs() || parsed.Host == "" {
		return "", ErrInvalidInput
	}
	switch strings.ToLower(parsed.Scheme) {
	case "https":
		return trimmed, nil
	case "http":
		if isLoopbackHost(parsed.Hostname()) {
			return trimmed, nil
		}
	}
	return "", ErrInvalidInput
}

// isLoopbackHost reports whether the host names a local interface, where plain
// http is legitimate (local storefront dev servers, docker e2e runs).
func isLoopbackHost(host string) bool {
	switch strings.ToLower(host) {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return strings.HasSuffix(strings.ToLower(host), ".localhost")
}
