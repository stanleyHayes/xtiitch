package business

import "errors"

// Add-on keys identify a paid feature a business buys separately from its plan.
// They are stored verbatim in business_addons.addon.
const (
	// AddonAIAssistant is the ✨ AI writing assistant: while active the business
	// gets unlimited use of the assist endpoint; while inactive that endpoint is
	// payment-gated.
	AddonAIAssistant = "ai_assistant"
)

// ErrAddonInactive is returned when a business invokes an add-on-gated feature
// (e.g. the AI writing assistant) without the add-on being active. Inbound
// adapters map it to 402 Payment Required so the UI can prompt the business to
// enable it.
var ErrAddonInactive = errors.New("add-on is not active")

// ValidAddon reports whether key names a known, billable add-on. Admin upserts
// and entitlement checks reject anything else so a typo can never silently grant
// or gate a feature.
func ValidAddon(key string) bool {
	switch key {
	case AddonAIAssistant:
		return true
	default:
		return false
	}
}
