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
