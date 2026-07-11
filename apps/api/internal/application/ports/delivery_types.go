package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
)

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
