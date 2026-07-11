package aiassist

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// stubAddons records add-on entitlements, flips, billing upserts, and renewals in
// memory, keyed by "business:addon", so the service can be exercised without a
// database.
type stubAddons struct {
	active     map[string]bool
	status     map[string]ports.AddonStatus
	sets       []ports.SetBusinessAddonInput
	billing    []ports.UpsertAddonBillingInput
	renewals   []ports.RecordAddonRenewalInput
	due        []ports.AddonChargeDue
	ownerEmail string
}

func newStubAddons() *stubAddons {
	return &stubAddons{active: map[string]bool{}, status: map[string]ports.AddonStatus{}}
}

func key(businessID, addon string) string { return businessID + ":" + addon }

func (s *stubAddons) HasActiveAddon(_ context.Context, scope common.TenantScope, addon string) (bool, error) {
	return s.active[key(scope.BusinessID.String(), addon)], nil
}

func (s *stubAddons) GetAddonStatus(_ context.Context, scope common.TenantScope, addon string) (ports.AddonStatus, error) {
	if status, ok := s.status[key(scope.BusinessID.String(), addon)]; ok {
		return status, nil
	}
	return ports.AddonStatus{Addon: addon, BillingStatus: "none"}, nil
}

func (s *stubAddons) SetBusinessAddon(_ context.Context, input ports.SetBusinessAddonInput) error {
	s.sets = append(s.sets, input)
	s.active[key(input.BusinessID.String(), input.Addon)] = input.Active
	return nil
}

func (s *stubAddons) UpsertAddonBilling(_ context.Context, input ports.UpsertAddonBillingInput) error {
	s.billing = append(s.billing, input)
	s.active[key(input.BusinessID.String(), input.Addon)] = input.Active
	return nil
}

func (s *stubAddons) RecordAddonRenewal(_ context.Context, input ports.RecordAddonRenewalInput) error {
	s.renewals = append(s.renewals, input)
	s.active[key(input.BusinessID.String(), input.Addon)] = input.Success
	return nil
}

func (s *stubAddons) ListAddonChargesDue(_ context.Context, _ time.Time, _ int) ([]ports.AddonChargeDue, error) {
	return s.due, nil
}

// upperAssistant uppercases the input so we can assert the assistant was called.
type upperAssistant struct{ called bool }

func (a *upperAssistant) Assist(_ context.Context, input ports.AssistInput) (string, error) {
	a.called = true
	return strings.ToUpper(input.Text), nil
}

// stubPayments is an in-memory Paystack stand-in for the add-on billing flow.
type stubPayments struct {
	initResult   ports.InitializeAuthorizationResult
	initErr      error
	initInput    ports.InitializeAuthorizationInput
	verifyResult ports.VerifyAuthorizationResult
	verifyErr    error
	chargeResult ports.ChargeAuthorizationResult
	chargeErr    error
	charges      []ports.ChargeAuthorizationInput
}

func (p *stubPayments) InitializeAuthorization(_ context.Context, input ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult, error) {
	p.initInput = input
	return p.initResult, p.initErr
}

func (p *stubPayments) VerifyAuthorization(_ context.Context, _ ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error) {
	return p.verifyResult, p.verifyErr
}

func (p *stubPayments) ChargeAuthorization(_ context.Context, input ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error) {
	p.charges = append(p.charges, input)
	return p.chargeResult, p.chargeErr
}

func (s *stubAddons) GetBusinessOwnerEmail(_ context.Context, _ common.TenantScope) (string, error) {
	if s.ownerEmail == "" {
		return "owner@test", nil
	}
	return s.ownerEmail, nil
}

type stubIDs struct{ n int }

func (s *stubIDs) NewID() common.ID {
	s.n++
	return common.ID(fmt.Sprintf("id-%d", s.n))
}

type fixedClock struct{ t time.Time }

func (c fixedClock) Now() time.Time { return c.t }

func newService(addons ports.BusinessAddonRepository, assistant ports.AiAssistant) Service {
	return NewService(Dependencies{Assistant: assistant, Addons: addons})
}

func newBillingService(addons ports.BusinessAddonRepository, payments PaymentAuthorizer) Service {
	return NewService(Dependencies{
		Assistant:        &upperAssistant{},
		Addons:           addons,
		Payments:         payments,
		IDs:              &stubIDs{},
		Clock:            fixedClock{t: time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)},
		PriceMinor:       5000,
		Currency:         "GHS",
		AssistantEnabled: true,
	})
}

// stubSettings is the admin master switch for the add-on in tests.
type stubSettings struct {
	enabled bool
	err     error
}

func (s stubSettings) AIAssistantAddonEnabled(_ context.Context) (bool, error) {
	return s.enabled, s.err
}

func newBillingServiceWith(addons ports.BusinessAddonRepository, payments PaymentAuthorizer, assistantEnabled bool, settings PlatformSettings) Service {
	return NewService(Dependencies{
		Assistant:        &upperAssistant{},
		Addons:           addons,
		Payments:         payments,
		Settings:         settings,
		IDs:              &stubIDs{},
		Clock:            fixedClock{t: time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)},
		PriceMinor:       5000,
		Currency:         "GHS",
		AssistantEnabled: assistantEnabled,
	})
}

// The add-on is not sellable where the AI is a passthrough no-op (no provider key):
// checkout is refused and status reports unavailable, so no one pays for nothing.
func TestAddonNotSellableWhenAIDisabled(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{initResult: ports.InitializeAuthorizationResult{RedirectURL: "https://pay", Reference: "r"}}
	svc := newBillingServiceWith(addons, payments, false, nil)

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	if _, err := svc.InitializeCheckout(context.Background(), scope, "https://x/cb"); !errors.Is(err, ErrBillingUnavailable) {
		t.Fatalf("expected ErrBillingUnavailable when the AI is not configured, got %v", err)
	}
	status, err := svc.AddonStatus(context.Background(), scope)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Available {
		t.Fatal("status must report the add-on unavailable when the AI is not configured")
	}
	if r, _ := svc.RunRenewalSweep(context.Background(), 0); r.Attempted != 0 {
		t.Fatal("renewal sweep must not charge when the add-on is unavailable")
	}
}

// The admin master switch overrides everything: even with the AI configured, an
// off switch makes the add-on unsellable / non-renewing.
func TestAddonMasterSwitchOffOverrides(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{initResult: ports.InitializeAuthorizationResult{RedirectURL: "https://pay", Reference: "r"}}
	svc := newBillingServiceWith(addons, payments, true, stubSettings{enabled: false})

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	if _, err := svc.InitializeCheckout(context.Background(), scope, "https://x/cb"); !errors.Is(err, ErrBillingUnavailable) {
		t.Fatalf("expected ErrBillingUnavailable when the admin switch is off, got %v", err)
	}
	status, err := svc.AddonStatus(context.Background(), scope)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Available {
		t.Fatal("status must report unavailable when the admin switch is off")
	}
}

// With the AI configured AND the admin switch on, the add-on is available again.
func TestAddonAvailableWhenConfiguredAndSwitchedOn(t *testing.T) {
	svc := newBillingServiceWith(newStubAddons(), &stubPayments{}, true, stubSettings{enabled: true})
	available, err := svc.AddonAvailable(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !available {
		t.Fatal("expected the add-on available when configured and switched on")
	}
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

func TestInitializeCheckoutReturnsRedirect(t *testing.T) {
	payments := &stubPayments{initResult: ports.InitializeAuthorizationResult{RedirectURL: "https://pay.test/abc", Reference: "ref-1"}}
	svc := newBillingService(newStubAddons(), payments)

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	link, err := svc.InitializeCheckout(context.Background(), scope, "https://business.test/callback")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if link.RedirectURL != "https://pay.test/abc" || link.Reference != "ref-1" {
		t.Fatalf("unexpected link: %+v", link)
	}
	// The standard checkout must be priced at the add-on's first month.
	if payments.initInput.AmountMinor != 5000 || payments.initInput.Currency != "GHS" {
		t.Fatalf("expected the checkout priced at the 5000 add-on fee, got %+v", payments.initInput)
	}
}

func TestVerifyCheckoutActivatesOnSuccess(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{
		verifyResult: ports.VerifyAuthorizationResult{Succeeded: true, AuthorizationCode: "AUTH", CustomerCode: "CUS"},
	}
	svc := newBillingService(addons, payments)

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	result, err := svc.VerifyCheckout(context.Background(), scope, "ref-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Active || result.BillingStatus != "active" {
		t.Fatalf("expected active result, got %+v", result)
	}
	// The first month was PAID at checkout; verify must NOT re-charge.
	if len(payments.charges) != 0 {
		t.Fatalf("verify must not re-charge a standard checkout, got %+v", payments.charges)
	}
	if len(addons.billing) != 1 || !addons.billing[0].Active || addons.billing[0].AuthorizationRef != "AUTH" {
		t.Fatalf("expected active billing upsert with stored authorization, got %+v", addons.billing)
	}
	if !addons.active[key("biz-1", business.AddonAIAssistant)] {
		t.Fatal("expected add-on active after successful checkout")
	}
}

// A mobile-money checkout succeeds but yields NO reusable authorization; the add-on
// still activates (the monthly sweep re-prompts, as it cannot silently debit MoMo).
func TestVerifyCheckoutActivatesMobileMoneyWithoutAuthorization(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{
		verifyResult: ports.VerifyAuthorizationResult{Succeeded: true, Channel: "mobile_money"},
	}
	svc := newBillingService(addons, payments)

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	result, err := svc.VerifyCheckout(context.Background(), scope, "ref-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Active || result.BillingStatus != "active" {
		t.Fatalf("expected active result for a paid MoMo checkout, got %+v", result)
	}
	if len(payments.charges) != 0 {
		t.Fatalf("verify must not charge, got %+v", payments.charges)
	}
	if len(addons.billing) != 1 || addons.billing[0].AuthorizationRef != "" {
		t.Fatalf("expected active billing with no reusable authorization, got %+v", addons.billing)
	}
}

func TestVerifyCheckoutRejectsUnpaidCheckout(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{verifyResult: ports.VerifyAuthorizationResult{Succeeded: false}}
	svc := newBillingService(addons, payments)

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	if _, err := svc.VerifyCheckout(context.Background(), scope, "ref-1"); !errors.Is(err, ErrCheckoutNotConfirmed) {
		t.Fatalf("expected ErrCheckoutNotConfirmed, got %v", err)
	}
	if len(addons.billing) != 0 {
		t.Fatal("must not activate billing when the checkout was not paid")
	}
	if len(payments.charges) != 0 {
		t.Fatal("must not charge when the checkout was not paid")
	}
}

func TestRunRenewalSweepChargesDue(t *testing.T) {
	addons := newStubAddons()
	addons.due = []ports.AddonChargeDue{{
		BusinessID:       common.ID("biz-1"),
		Addon:            business.AddonAIAssistant,
		AuthorizationRef: "AUTH",
		CustomerEmail:    "owner@test",
		AmountMinor:      5000,
		Currency:         "GHS",
	}}
	payments := &stubPayments{chargeResult: ports.ChargeAuthorizationResult{Status: "success"}}
	svc := newBillingService(addons, payments)

	result, err := svc.RunRenewalSweep(context.Background(), 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Attempted != 1 || result.Charged != 1 || result.Failed != 0 {
		t.Fatalf("unexpected sweep result: %+v", result)
	}
	if len(addons.renewals) != 1 || !addons.renewals[0].Success {
		t.Fatalf("expected one successful renewal record, got %+v", addons.renewals)
	}
}

// A HARD charge failure (provider returned a non-activating status) deactivates
// the add-on and marks it past_due until the business re-pays.
func TestRunRenewalSweepDeactivatesOnFailure(t *testing.T) {
	addons := newStubAddons()
	addons.active[key("biz-1", business.AddonAIAssistant)] = true
	addons.due = []ports.AddonChargeDue{{
		BusinessID:       common.ID("biz-1"),
		Addon:            business.AddonAIAssistant,
		AuthorizationRef: "AUTH",
		CustomerEmail:    "owner@test",
		AmountMinor:      5000,
		Currency:         "GHS",
	}}
	payments := &stubPayments{chargeResult: ports.ChargeAuthorizationResult{Status: "failed"}}
	svc := newBillingService(addons, payments)

	result, err := svc.RunRenewalSweep(context.Background(), 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Failed != 1 {
		t.Fatalf("expected one failed charge, got %+v", result)
	}
	if len(addons.renewals) != 1 || addons.renewals[0].Success {
		t.Fatalf("expected a failed renewal record, got %+v", addons.renewals)
	}
	if addons.active[key("biz-1", business.AddonAIAssistant)] {
		t.Fatal("expected add-on deactivated after a failed renewal charge")
	}
}

// A TRANSPORT error (timeout/network) must NOT revoke access and must NOT advance
// the period — the charge may have gone through, so the add-on is left due and
// retried next sweep with the same deterministic reference (deduped by Paystack).
func TestRunRenewalSweepDefersOnTransportError(t *testing.T) {
	addons := newStubAddons()
	addons.active[key("biz-1", business.AddonAIAssistant)] = true
	addons.due = []ports.AddonChargeDue{{
		BusinessID:       common.ID("biz-1"),
		Addon:            business.AddonAIAssistant,
		AuthorizationRef: "AUTH",
		CustomerEmail:    "owner@test",
		AmountMinor:      5000,
		Currency:         "GHS",
	}}
	payments := &stubPayments{chargeErr: errors.New("paystack timeout")}
	svc := newBillingService(addons, payments)

	result, err := svc.RunRenewalSweep(context.Background(), 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Deferred != 1 || result.Failed != 0 || result.Charged != 0 {
		t.Fatalf("a transport error must defer, not fail/charge: %+v", result)
	}
	if len(addons.renewals) != 0 {
		t.Fatalf("no renewal outcome must be recorded on a transport error, got %+v", addons.renewals)
	}
	if !addons.active[key("biz-1", business.AddonAIAssistant)] {
		t.Fatal("the add-on must stay active (not revoked) on a transport error")
	}
}
