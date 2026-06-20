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
	active   map[string]bool
	status   map[string]ports.AddonStatus
	sets     []ports.SetBusinessAddonInput
	billing  []ports.UpsertAddonBillingInput
	renewals []ports.RecordAddonRenewalInput
	due      []ports.AddonChargeDue
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
	verifyResult ports.VerifyAuthorizationResult
	verifyErr    error
	chargeResult ports.ChargeAuthorizationResult
	chargeErr    error
	charges      []ports.ChargeAuthorizationInput
}

func (p *stubPayments) InitializeAuthorization(_ context.Context, _ ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult, error) {
	return p.initResult, p.initErr
}

func (p *stubPayments) VerifyAuthorization(_ context.Context, _ ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error) {
	return p.verifyResult, p.verifyErr
}

func (p *stubPayments) ChargeAuthorization(_ context.Context, input ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error) {
	p.charges = append(p.charges, input)
	return p.chargeResult, p.chargeErr
}

type stubProfiles struct{ email string }

func (s stubProfiles) GetBusinessSubscription(_ context.Context, _ common.ID) (ports.BusinessSubscriptionRecord, error) {
	return ports.BusinessSubscriptionRecord{OwnerEmail: s.email}, nil
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

func newBillingService(addons ports.BusinessAddonRepository, payments PaymentAuthorizer, profiles BillingProfiles) Service {
	return NewService(Dependencies{
		Assistant:  &upperAssistant{},
		Addons:     addons,
		Payments:   payments,
		Profiles:   profiles,
		IDs:        &stubIDs{},
		Clock:      fixedClock{t: time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)},
		PriceMinor: 5000,
		Currency:   "GHS",
	})
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
	svc := newBillingService(newStubAddons(), payments, stubProfiles{email: "owner@test"})

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	link, err := svc.InitializeCheckout(context.Background(), scope, "https://business.test/callback")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if link.RedirectURL != "https://pay.test/abc" || link.Reference != "ref-1" {
		t.Fatalf("unexpected link: %+v", link)
	}
}

func TestVerifyCheckoutActivatesOnSuccess(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{
		verifyResult: ports.VerifyAuthorizationResult{Active: true, AuthorizationCode: "AUTH", CustomerCode: "CUS"},
		chargeResult: ports.ChargeAuthorizationResult{Status: "success"},
	}
	svc := newBillingService(addons, payments, stubProfiles{email: "owner@test"})

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	result, err := svc.VerifyCheckout(context.Background(), scope, "ref-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Active || result.BillingStatus != "active" {
		t.Fatalf("expected active result, got %+v", result)
	}
	if len(payments.charges) != 1 || payments.charges[0].AmountMinor != 5000 {
		t.Fatalf("expected one 5000 charge, got %+v", payments.charges)
	}
	if len(addons.billing) != 1 || !addons.billing[0].Active || addons.billing[0].AuthorizationRef != "AUTH" {
		t.Fatalf("expected active billing upsert with stored authorization, got %+v", addons.billing)
	}
	if !addons.active[key("biz-1", business.AddonAIAssistant)] {
		t.Fatal("expected add-on active after successful checkout")
	}
}

func TestVerifyCheckoutFailsWhenChargeFails(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{
		verifyResult: ports.VerifyAuthorizationResult{Active: true, AuthorizationCode: "AUTH", CustomerCode: "CUS"},
		chargeResult: ports.ChargeAuthorizationResult{Status: "failed"},
	}
	svc := newBillingService(addons, payments, stubProfiles{email: "owner@test"})

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	if _, err := svc.VerifyCheckout(context.Background(), scope, "ref-1"); !errors.Is(err, ErrCheckoutNotConfirmed) {
		t.Fatalf("expected ErrCheckoutNotConfirmed, got %v", err)
	}
	if len(addons.billing) != 0 {
		t.Fatal("must not activate billing when the charge fails")
	}
}

func TestVerifyCheckoutRejectsUnverifiedAuthorization(t *testing.T) {
	addons := newStubAddons()
	payments := &stubPayments{verifyResult: ports.VerifyAuthorizationResult{Active: false}}
	svc := newBillingService(addons, payments, stubProfiles{email: "owner@test"})

	scope := common.TenantScope{BusinessID: common.ID("biz-1")}
	if _, err := svc.VerifyCheckout(context.Background(), scope, "ref-1"); !errors.Is(err, ErrCheckoutNotConfirmed) {
		t.Fatalf("expected ErrCheckoutNotConfirmed, got %v", err)
	}
	if len(payments.charges) != 0 {
		t.Fatal("must not charge when the authorization is not active")
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
	svc := newBillingService(addons, payments, stubProfiles{email: "owner@test"})

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
	payments := &stubPayments{chargeErr: errors.New("paystack down")}
	svc := newBillingService(addons, payments, stubProfiles{email: "owner@test"})

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
