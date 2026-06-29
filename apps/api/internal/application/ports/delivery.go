package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
)

// DeliveryRepository persists fulfilment handovers — how a finished order
// reaches the customer once production is complete.
type DeliveryRepository interface {
	// ArrangeHandover records a handover for a fulfilled order. The order must be
	// fulfilled and belong to the tenant (ErrInvalidOrderState when it exists but
	// is not fulfilled, ErrNotFound when it does not), and an order may have only
	// one open handover at a time (ErrHandoverInProgress, enforced race-proof by a
	// partial unique index).
	ArrangeHandover(ctx context.Context, scope common.TenantScope, input ArrangeHandoverInput) error
	// ListHandovers returns the tenant's handover queue: open (pending/dispatched)
	// first, then most-recently arranged.
	ListHandovers(ctx context.Context, scope common.TenantScope) ([]HandoverSummary, error)
	// GetHandover reads one handover's method and current status (tenant-scoped) so
	// a transition can be validated; ErrNotFound when it does not exist.
	GetHandover(ctx context.Context, scope common.TenantScope, handoverID common.ID) (HandoverState, error)
	// SetHandoverStatus moves a handover from one status to another. The update is
	// guarded on the current (From) status, so a concurrent change leaves the row
	// untouched and returns ErrNotFound — the from-state no longer matches.
	SetHandoverStatus(ctx context.Context, scope common.TenantScope, input SetHandoverStatusInput) error
}

// ArrangeHandoverInput is a request to arrange how a fulfilled order is handed
// over to the customer.
type ArrangeHandoverInput struct {
	HandoverID     common.ID
	OrderID        common.ID
	Method         delivery.Method
	RecipientName  string
	RecipientPhone string
	Address        string
	Courier        string
	Note           string
}

// SetHandoverStatusInput moves a handover between states under an optimistic
// guard on its current status.
type SetHandoverStatusInput struct {
	HandoverID common.ID
	From       delivery.Status
	To         delivery.Status
	// Courier and Note are recorded alongside the move (e.g. the courier reference
	// captured at dispatch). An empty string leaves the stored value unchanged.
	Courier string
	Note    string
}

// HandoverState is the minimal slice a transition reasons about.
type HandoverState struct {
	Method delivery.Method
	Status delivery.Status
}

// DeliveryZoneRepository persists a business's delivery zones — named areas each
// with a flat fee charged when a customer picks them at online checkout.
type DeliveryZoneRepository interface {
	// ListDeliveryZones returns every zone for the tenant (active and inactive),
	// ordered by sequence then name, for the dashboard manager.
	ListDeliveryZones(ctx context.Context, scope common.TenantScope) ([]DeliveryZone, error)
	// ListActiveDeliveryZones returns only the active zones, for the storefront
	// checkout picker.
	ListActiveDeliveryZones(ctx context.Context, scope common.TenantScope) ([]DeliveryZone, error)
	// CreateDeliveryZone adds a zone; a duplicate name within the tenant returns
	// ErrZoneNameTaken.
	CreateDeliveryZone(ctx context.Context, scope common.TenantScope, input CreateDeliveryZoneInput) error
	// UpdateDeliveryZone edits a zone's name, fee, ordering and active flag.
	UpdateDeliveryZone(ctx context.Context, scope common.TenantScope, input UpdateDeliveryZoneInput) error
	// DeleteDeliveryZone removes a zone; orders that referenced it keep their
	// snapshotted fee (the FK is ON DELETE SET NULL).
	DeleteDeliveryZone(ctx context.Context, scope common.TenantScope, zoneID common.ID) error
	// GetDeliveryZone reads one zone (tenant-scoped) so checkout can resolve its
	// fee; ErrNotFound when it does not exist for this tenant.
	GetDeliveryZone(ctx context.Context, scope common.TenantScope, zoneID common.ID) (DeliveryZone, error)
}

// DeliveryZone is a named delivery area with a flat fee (minor units).
type DeliveryZone struct {
	ID       common.ID
	Name     string
	FeeMinor int64
	Sequence int
	Active   bool
}

// CreateDeliveryZoneInput adds a delivery zone.
type CreateDeliveryZoneInput struct {
	ZoneID   common.ID
	Name     string
	FeeMinor int64
	Sequence int
}

// UpdateDeliveryZoneInput edits a delivery zone.
type UpdateDeliveryZoneInput struct {
	ZoneID   common.ID
	Name     string
	FeeMinor int64
	Sequence int
	Active   bool
}

// HandoverSummary is one row of the business's handover queue, with the order,
// customer, and design context the dashboard renders.
type HandoverSummary struct {
	HandoverID     common.ID
	OrderID        common.ID
	CustomerName   string
	CustomerPhone  string
	DesignTitle    string
	Method         string
	Status         string
	RecipientName  string
	RecipientPhone string
	Address        string
	Courier        string
	Note           string
	CreatedAt      time.Time
}
