package aiassist

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ErrEmptyText is returned when an assist request carries no text to work on.
var ErrEmptyText = errors.New("assist text is empty")

// ErrInvalidAddon is returned when an admin add-on flip names an unknown add-on.
var ErrInvalidAddon = errors.New("unknown add-on")

// maxAssistTextLen caps how much text the assistant will rewrite in one call.
// Mirrors the handler-side guard so the service is safe to call directly too.
const maxAssistTextLen = 4000

// Service runs the ✨ AI writing assistant. The assistant itself is a paid
// add-on billed separately from a business's plan: while the ai_assistant add-on
// is active the business gets unlimited use; while inactive Assist returns
// business.ErrAddonInactive (mapped to 402 by the handler). It also exposes the
// admin add-on flip used to enable/disable add-ons for a tenant by id.
type Service struct {
	assistant ports.AiAssistant
	addons    ports.BusinessAddonRepository
}

type Dependencies struct {
	Assistant ports.AiAssistant
	Addons    ports.BusinessAddonRepository
}

func NewService(deps Dependencies) Service {
	return Service{
		assistant: deps.Assistant,
		addons:    deps.Addons,
	}
}

// Assist rewrites the business's draft text per the requested instruction. It is
// gated behind the ai_assistant add-on: the entitlement is checked tenant-scoped
// (RLS) for the authenticated business before the model is ever called.
func (s Service) Assist(ctx context.Context, scope common.TenantScope, input ports.AssistInput) (string, error) {
	text := strings.TrimSpace(input.Text)
	if text == "" {
		return "", ErrEmptyText
	}
	if len(text) > maxAssistTextLen {
		return "", ErrEmptyText
	}

	active, err := s.addons.HasActiveAddon(ctx, scope, business.AddonAIAssistant)
	if err != nil {
		return "", err
	}
	if !active {
		return "", business.ErrAddonInactive
	}

	input.Text = text
	return s.assistant.Assist(ctx, input)
}

// SetAddon enables or disables a paid add-on for one tenant by id. This is an
// admin/billing operation (the caller is not the tenant); the repository runs it
// under the RLS bypass. Unknown add-on keys are rejected so a typo can never
// silently grant or gate a feature.
func (s Service) SetAddon(ctx context.Context, businessID common.ID, addon string, active bool) error {
	addon = strings.TrimSpace(addon)
	if businessID.IsZero() || !business.ValidAddon(addon) {
		return ErrInvalidAddon
	}
	return s.addons.SetBusinessAddon(ctx, ports.SetBusinessAddonInput{
		BusinessID: businessID,
		Addon:      addon,
		Active:     active,
	})
}
