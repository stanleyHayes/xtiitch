package aiassist

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// stubAddons records add-on entitlements and flips in memory, keyed by
// "business:addon", so the service can be exercised without a database.
type stubAddons struct {
	active map[string]bool
	sets   []ports.SetBusinessAddonInput
}

func newStubAddons() *stubAddons {
	return &stubAddons{active: map[string]bool{}}
}

func key(businessID, addon string) string { return businessID + ":" + addon }

func (s *stubAddons) HasActiveAddon(_ context.Context, scope common.TenantScope, addon string) (bool, error) {
	return s.active[key(scope.BusinessID.String(), addon)], nil
}

func (s *stubAddons) SetBusinessAddon(_ context.Context, input ports.SetBusinessAddonInput) error {
	s.sets = append(s.sets, input)
	s.active[key(input.BusinessID.String(), input.Addon)] = input.Active
	return nil
}

// upperAssistant uppercases the input so we can assert the assistant was called.
type upperAssistant struct{ called bool }

func (a *upperAssistant) Assist(_ context.Context, input ports.AssistInput) (string, error) {
	a.called = true
	return strings.ToUpper(input.Text), nil
}

func newService(addons ports.BusinessAddonRepository, assistant ports.AiAssistant) Service {
	return NewService(Dependencies{Assistant: assistant, Addons: addons})
}

func TestAssistGatedWhenAddonInactive(t *testing.T) {
	addons := newStubAddons()
	assistant := &upperAssistant{}
	svc := newService(addons, assistant)

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	_, err := svc.Assist(context.Background(), scope, ports.AssistInput{Text: "hello", Instruction: "improve"})
	if !errors.Is(err, business.ErrAddonInactive) {
		t.Fatalf("expected ErrAddonInactive, got %v", err)
	}
	if assistant.called {
		t.Fatal("assistant must not be called when the add-on is inactive")
	}
}

func TestAssistRunsWhenAddonActive(t *testing.T) {
	addons := newStubAddons()
	addons.active[key("biz-1", business.AddonAIAssistant)] = true
	assistant := &upperAssistant{}
	svc := newService(addons, assistant)

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	out, err := svc.Assist(context.Background(), scope, ports.AssistInput{Text: "hello", Instruction: "improve"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "HELLO" {
		t.Fatalf("expected HELLO, got %q", out)
	}
}

func TestAssistEmptyTextRejected(t *testing.T) {
	svc := newService(newStubAddons(), &upperAssistant{})
	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	if _, err := svc.Assist(context.Background(), scope, ports.AssistInput{Text: "   "}); !errors.Is(err, ErrEmptyText) {
		t.Fatalf("expected ErrEmptyText, got %v", err)
	}
}

func TestSetAddonRejectsUnknownKey(t *testing.T) {
	addons := newStubAddons()
	svc := newService(addons, &upperAssistant{})
	if err := svc.SetAddon(context.Background(), common.ID("biz-1"), "not_a_real_addon", true); !errors.Is(err, ErrInvalidAddon) {
		t.Fatalf("expected ErrInvalidAddon, got %v", err)
	}
	if len(addons.sets) != 0 {
		t.Fatal("repository must not be written for an unknown add-on")
	}
}

func TestSetAddonUpsertsKnownKey(t *testing.T) {
	addons := newStubAddons()
	svc := newService(addons, &upperAssistant{})
	if err := svc.SetAddon(context.Background(), common.ID("biz-1"), business.AddonAIAssistant, true); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !addons.active[key("biz-1", business.AddonAIAssistant)] {
		t.Fatal("expected add-on to be active after SetAddon")
	}
}
