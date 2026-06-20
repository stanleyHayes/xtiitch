package aiassist

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ErrEmptyText is returned when an assist request carries no text to work on.
var ErrEmptyText = errors.New("assist text is empty")

// ErrInvalidAddon is returned when an admin add-on flip names an unknown add-on.
var ErrInvalidAddon = errors.New("unknown add-on")

// ErrBillingUnavailable is returned when the add-on billing flow is invoked but
// the payment provider / owner email / price are not configured.
var ErrBillingUnavailable = errors.New("add-on billing is not available")

// ErrCheckoutNotConfirmed is returned when a checkout reference cannot be
// verified into an active Paystack authorization (or the first charge fails).
var ErrCheckoutNotConfirmed = errors.New("add-on checkout could not be confirmed")

// maxAssistTextLen caps how much text the assistant will rewrite in one call.
// Mirrors the handler-side guard so the service is safe to call directly too.
const maxAssistTextLen = 4000

// addonChargeMonths is the billing period: one month of access per charge.
const defaultAddonCurrency = "GHS"

// PaymentAuthorizer is the slice of the payment provider the add-on billing flow
// needs: set up a reusable direct-debit authorization, verify it, and charge it
// for the first month and each renewal. The Paystack client satisfies this.
type PaymentAuthorizer interface {
	InitializeAuthorization(ctx context.Context, input ports.InitializeAuthorizationInput) (ports.InitializeAuthorizationResult, error)
	VerifyAuthorization(ctx context.Context, input ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error)
	ChargeAuthorization(ctx context.Context, input ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error)
}

// Service runs the ✨ AI writing assistant. The assistant itself is a paid
// add-on billed separately from a business's plan: while the ai_assistant add-on
// is active the business gets unlimited use; while inactive Assist returns
// business.ErrAddonInactive (mapped to 402 by the handler). The service also
// owns the add-on billing flow (Paystack checkout + monthly renewal sweep) and
// the admin add-on flip.
//
// Billing is *optimistic*: a Paystack charge returning "success" OR "pending"
// activates/keeps the add-on (next charge in one month); only an explicit
// failure withholds (at checkout) or revokes (at renewal). Most charges are
// synchronous success and mobile-money "pending" almost always resolves to
// success, so optimism avoids making a paying customer wait or revoking a paid
// customer; the downside is at most one cycle of access on a charge that
// ultimately fails. A Paystack webhook for exact reconciliation is a follow-up
// (see apps/api/AI_ADDON_TODO.md). Xtiitch never holds funds — Paystack charges
// the customer directly.
type Service struct {
	assistant  ports.AiAssistant
	addons     ports.BusinessAddonRepository
	payments   PaymentAuthorizer
	ids        ports.IDGenerator
	clock      ports.Clock
	priceMinor int64
	currency   string
}

type Dependencies struct {
	Assistant  ports.AiAssistant
	Addons     ports.BusinessAddonRepository
	Payments   PaymentAuthorizer
	IDs        ports.IDGenerator
	Clock      ports.Clock
	PriceMinor int64
	Currency   string
}

func NewService(deps Dependencies) Service {
	currency := strings.TrimSpace(deps.Currency)
	if currency == "" {
		currency = defaultAddonCurrency
	}
	return Service{
		assistant:  deps.Assistant,
		addons:     deps.Addons,
		payments:   deps.Payments,
		ids:        deps.IDs,
		clock:      deps.Clock,
		priceMinor: deps.PriceMinor,
		currency:   currency,
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
// admin operation (the caller is not the tenant); the repository runs it under
// the RLS bypass. Unknown add-on keys are rejected so a typo can never silently
// grant or gate a feature.
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

// AddonStatusView is a tenant's own view of the AI Assistant add-on, plus the
// price to enable/renew it (from config, not the row's stored amount).
type AddonStatusView struct {
	Addon         string
	Active        bool
	BillingStatus string
	PriceMinor    int64
	Currency      string
	NextChargeAt  *time.Time
}

// AddonStatus returns the authenticated business's AI Assistant add-on status.
func (s Service) AddonStatus(ctx context.Context, scope common.TenantScope) (AddonStatusView, error) {
	status, err := s.addons.GetAddonStatus(ctx, scope, business.AddonAIAssistant)
	if err != nil {
		return AddonStatusView{}, err
	}
	return AddonStatusView{
		Addon:         business.AddonAIAssistant,
		Active:        status.Active,
		BillingStatus: status.BillingStatus,
		PriceMinor:    s.priceMinor,
		Currency:      s.currency,
		NextChargeAt:  status.NextChargeAt,
	}, nil
}

// CheckoutLink is the Paystack redirect a business follows to authorize the
// add-on's recurring direct debit.
type CheckoutLink struct {
	RedirectURL string
	Reference   string
}

// InitializeCheckout starts a Paystack direct-debit authorization for the AI
// Assistant add-on and returns the redirect link. The business is charged on
// VerifyCheckout (and monthly thereafter), never here.
func (s Service) InitializeCheckout(ctx context.Context, scope common.TenantScope, callbackURL string) (CheckoutLink, error) {
	if scope.BusinessID.IsZero() || s.payments == nil || s.priceMinor <= 0 {
		return CheckoutLink{}, ErrBillingUnavailable
	}
	email, err := s.addons.GetBusinessOwnerEmail(ctx, scope)
	if err != nil {
		return CheckoutLink{}, err
	}
	email = strings.TrimSpace(email)
	if email == "" {
		return CheckoutLink{}, ErrBillingUnavailable
	}
	result, err := s.payments.InitializeAuthorization(ctx, ports.InitializeAuthorizationInput{
		BusinessID:    scope.BusinessID,
		CustomerEmail: email,
		CallbackURL:   strings.TrimSpace(callbackURL),
	})
	if err != nil {
		return CheckoutLink{}, err
	}
	if strings.TrimSpace(result.RedirectURL) == "" || strings.TrimSpace(result.Reference) == "" {
		return CheckoutLink{}, ErrBillingUnavailable
	}
	return CheckoutLink{RedirectURL: result.RedirectURL, Reference: result.Reference}, nil
}

// CheckoutResult is the outcome of confirming an add-on checkout.
type CheckoutResult struct {
	Active        bool
	BillingStatus string
}

// VerifyCheckout confirms the Paystack authorization the business completed,
// charges the first month, and — on a charge that activates (success/pending) —
// turns the add-on on and stores the reusable authorization for the monthly
// renewal sweep. A hard charge failure leaves the add-on off.
func (s Service) VerifyCheckout(ctx context.Context, scope common.TenantScope, reference string) (CheckoutResult, error) {
	if scope.BusinessID.IsZero() || s.payments == nil || s.priceMinor <= 0 {
		return CheckoutResult{}, ErrBillingUnavailable
	}
	reference = strings.TrimSpace(reference)
	if reference == "" || len([]rune(reference)) > 160 || strings.ContainsAny(reference, " \t\r\n") {
		return CheckoutResult{}, ErrCheckoutNotConfirmed
	}

	verify, err := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: reference})
	if err != nil {
		return CheckoutResult{}, err
	}
	authCode := strings.TrimSpace(verify.AuthorizationCode)
	customerCode := strings.TrimSpace(verify.CustomerCode)
	if !verify.Active || authCode == "" || customerCode == "" {
		return CheckoutResult{}, ErrCheckoutNotConfirmed
	}

	email := strings.TrimSpace(verify.CustomerEmail)
	if email == "" {
		ownerEmail, emailErr := s.addons.GetBusinessOwnerEmail(ctx, scope)
		if emailErr != nil {
			return CheckoutResult{}, emailErr
		}
		email = strings.TrimSpace(ownerEmail)
	}

	now := s.clock.Now().UTC()
	chargeRef := addonChargeRef(s.ids.NewID())
	charge, err := s.payments.ChargeAuthorization(ctx, ports.ChargeAuthorizationInput{
		BusinessID:        scope.BusinessID,
		AuthorizationCode: authCode,
		CustomerEmail:     email,
		AmountMinor:       s.priceMinor,
		Currency:          s.currency,
		Reference:         chargeRef,
	})
	if err != nil {
		return CheckoutResult{}, err
	}
	if !chargeActivates(charge.Status) {
		return CheckoutResult{}, ErrCheckoutNotConfirmed
	}

	nextCharge := now.AddDate(0, 1, 0)
	if err := s.addons.UpsertAddonBilling(ctx, ports.UpsertAddonBillingInput{
		BusinessID:       scope.BusinessID,
		Addon:            business.AddonAIAssistant,
		Active:           true,
		BillingStatus:    "active",
		AuthorizationRef: authCode,
		CustomerRef:      customerCode,
		AmountMinor:      s.priceMinor,
		Currency:         s.currency,
		NextChargeAt:     &nextCharge,
		LastChargedAt:    &now,
		LastReference:    chargeRef,
	}); err != nil {
		return CheckoutResult{}, err
	}
	return CheckoutResult{Active: true, BillingStatus: "active"}, nil
}

// RenewalSweepResult summarises one run of the add-on renewal sweep.
type RenewalSweepResult struct {
	Attempted int
	Charged   int
	Failed    int
}

// RunRenewalSweep charges every paid add-on whose monthly renewal is due. A
// charge that activates (success/pending) extends the next charge by a month and
// keeps the add-on active; a hard failure marks it past_due and revokes access
// until the business pays again. Intended to be called on a schedule alongside
// the subscription recurring sweep.
func (s Service) RunRenewalSweep(ctx context.Context, limit int) (RenewalSweepResult, error) {
	if s.payments == nil {
		return RenewalSweepResult{}, ErrBillingUnavailable
	}
	now := s.clock.Now().UTC()
	due, err := s.addons.ListAddonChargesDue(ctx, now, limit)
	if err != nil {
		return RenewalSweepResult{}, err
	}

	var result RenewalSweepResult
	for _, item := range due {
		result.Attempted++
		chargeRef := addonChargeRef(s.ids.NewID())
		charge, chargeErr := s.payments.ChargeAuthorization(ctx, ports.ChargeAuthorizationInput{
			BusinessID:        item.BusinessID,
			AuthorizationCode: item.AuthorizationRef,
			CustomerEmail:     item.CustomerEmail,
			AmountMinor:       item.AmountMinor,
			Currency:          item.Currency,
			Reference:         chargeRef,
		})
		success := chargeErr == nil && chargeActivates(charge.Status)

		nextCharge := now.AddDate(0, 1, 0)
		if err := s.addons.RecordAddonRenewal(ctx, ports.RecordAddonRenewalInput{
			BusinessID:   item.BusinessID,
			Addon:        item.Addon,
			Success:      success,
			Reference:    chargeRef,
			ChargedAt:    now,
			NextChargeAt: nextCharge,
		}); err != nil {
			return RenewalSweepResult{}, err
		}
		if success {
			result.Charged++
		} else {
			result.Failed++
		}
	}
	return result, nil
}

// addonChargeRef builds a unique, idempotent Paystack reference for an add-on
// charge from a fresh id.
func addonChargeRef(id common.ID) string {
	return "addon-aiast-" + id.String()
}

// chargeActivates reports whether a Paystack charge status should grant access.
// See the Service doc comment for the optimistic-activation rationale.
func chargeActivates(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "success", "pending":
		return true
	default:
		return false
	}
}
