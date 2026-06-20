package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// SetBusinessAddonInput upserts one business's add-on entitlement. Used by the
// admin flip to turn a paid add-on on or off for a single tenant (no money).
type SetBusinessAddonInput struct {
	BusinessID common.ID
	Addon      string
	Active     bool
}

// UpsertAddonBillingInput records the Paystack billing state for a paid add-on
// after a checkout. On a successful first charge: Active=true,
// BillingStatus="active", with the reusable authorization the renewal sweep
// charges each month. On a pending charge: Active=false, BillingStatus="pending"
// (the mandate is stored, but access is withheld until payment confirms).
type UpsertAddonBillingInput struct {
	BusinessID       common.ID
	Addon            string
	Active           bool
	BillingStatus    string
	AuthorizationRef string
	CustomerRef      string
	AmountMinor      int64
	Currency         string
	NextChargeAt     *time.Time
	LastChargedAt    *time.Time
	LastReference    string
}

// RecordAddonRenewalInput records the outcome of a renewal charge from the
// recurring sweep. Success extends next_charge_at and keeps the add-on active;
// failure marks it past_due and deactivates it (access is revoked until the
// business pays again).
type RecordAddonRenewalInput struct {
	BusinessID   common.ID
	Addon        string
	Success      bool
	Reference    string
	ChargedAt    time.Time
	NextChargeAt time.Time
}

// AddonChargeDue is one paid add-on whose next renewal charge is due. The owner
// email is joined in so the sweep can charge the stored authorization.
type AddonChargeDue struct {
	BusinessID       common.ID
	Addon            string
	AuthorizationRef string
	CustomerRef      string
	CustomerEmail    string
	AmountMinor      int64
	Currency         string
}

// AddonStatus is a tenant's own view of one add-on: whether it is active, how it
// was activated (billing_status), and when it next renews.
type AddonStatus struct {
	Addon         string
	Active        bool
	BillingStatus string
	AmountMinor   int64
	Currency      string
	NextChargeAt  *time.Time
}

// BusinessAddonRepository reads and writes business_addons entitlements.
//
// HasActiveAddon and GetAddonStatus answer "does *this* business have the
// add-on?" and MUST run tenant-scoped (RLS), so they can only ever concern the
// authenticated business. The remaining methods are admin/billing operations
// that target a tenant by id and run under the RLS bypass.
type BusinessAddonRepository interface {
	HasActiveAddon(ctx context.Context, scope common.TenantScope, addon string) (bool, error)
	GetAddonStatus(ctx context.Context, scope common.TenantScope, addon string) (AddonStatus, error)
	SetBusinessAddon(ctx context.Context, input SetBusinessAddonInput) error
	UpsertAddonBilling(ctx context.Context, input UpsertAddonBillingInput) error
	RecordAddonRenewal(ctx context.Context, input RecordAddonRenewalInput) error
	ListAddonChargesDue(ctx context.Context, now time.Time, limit int) ([]AddonChargeDue, error)
}
