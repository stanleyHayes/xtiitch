// Package deliveryapp manages fulfilment handovers: arranging how a fulfilled
// order reaches the customer (pickup or delivery), listing the queue, and moving
// a handover forward or cancelling it. The handover lifecycle rules live in the
// delivery domain; this service applies them over the repository.
package deliveryapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
)

type Service struct {
	handovers ports.DeliveryRepository
	zones     ports.DeliveryZoneRepository
	ids       ports.IDGenerator
}

type Dependencies struct {
	Handovers ports.DeliveryRepository
	Zones     ports.DeliveryZoneRepository
	IDs       ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{handovers: deps.Handovers, zones: deps.Zones, ids: deps.IDs}
}

// ArrangeHandoverCommand is the validated request to arrange a handover for a
// fulfilled order.
type ArrangeHandoverCommand struct {
	Scope          common.TenantScope
	ActorRole      business.UserRole
	OrderID        common.ID
	Method         delivery.Method
	RecipientName  string
	RecipientPhone string
	Address        string
	Courier        string
	Note           string
}

// ArrangeHandover records how a fulfilled order will reach the customer. The
// method must be valid, and a delivery must carry a destination address
// (ErrInvalidHandoverState otherwise); the repository enforces that the order is
// fulfilled and that it has no other open handover.
func (s Service) ArrangeHandover(ctx context.Context, cmd ArrangeHandoverCommand) (common.ID, error) {
	if err := authorizeHandoverOperation(cmd.Scope, cmd.ActorRole); err != nil {
		return "", err
	}
	if cmd.OrderID.IsZero() {
		return "", authdomain.ErrInvalidInput
	}
	if !cmd.Method.Valid() {
		return "", ports.ErrInvalidHandoverState
	}
	if cmd.Method == delivery.MethodDelivery && cmd.Address == "" {
		return "", ports.ErrInvalidHandoverState
	}
	id := s.ids.NewID()
	if err := s.handovers.ArrangeHandover(ctx, cmd.Scope, ports.ArrangeHandoverInput{
		HandoverID:     id,
		OrderID:        cmd.OrderID,
		Method:         cmd.Method,
		RecipientName:  cmd.RecipientName,
		RecipientPhone: cmd.RecipientPhone,
		Address:        cmd.Address,
		Courier:        cmd.Courier,
		Note:           cmd.Note,
	}); err != nil {
		return "", err
	}
	return id, nil
}

// ListHandovers returns the business's handover queue.
func (s Service) ListHandovers(ctx context.Context, scope common.TenantScope) ([]ports.HandoverSummary, error) {
	return s.handovers.ListHandovers(ctx, scope)
}

type AdvanceHandoverCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	HandoverID common.ID
	Courier    string
	Note       string
}

// AdvanceHandover moves a handover one step forward in its flow (pickup: ->
// collected; delivery: -> dispatched -> delivered). The forward step is derived
// from the handover's method and current status, so a terminal handover cannot
// be advanced (ErrInvalidHandoverState). Optional courier/note are recorded with
// the move.
func (s Service) AdvanceHandover(ctx context.Context, cmd AdvanceHandoverCommand) error {
	if err := authorizeHandoverOperation(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.HandoverID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	state, err := s.handovers.GetHandover(ctx, cmd.Scope, cmd.HandoverID)
	if err != nil {
		return err
	}
	next, ok := delivery.NextOnAdvance(state.Method, state.Status)
	if !ok {
		return ports.ErrInvalidHandoverState
	}
	return s.handovers.SetHandoverStatus(ctx, cmd.Scope, ports.SetHandoverStatusInput{
		HandoverID: cmd.HandoverID,
		From:       state.Status,
		To:         next,
		Courier:    cmd.Courier,
		Note:       cmd.Note,
	})
}

type CancelHandoverCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	HandoverID common.ID
}

// CancelHandover cancels an open handover. A completed or already-cancelled one
// cannot be cancelled (ErrInvalidHandoverState).
func (s Service) CancelHandover(ctx context.Context, cmd CancelHandoverCommand) error {
	if err := authorizeHandoverOperation(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.HandoverID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	state, err := s.handovers.GetHandover(ctx, cmd.Scope, cmd.HandoverID)
	if err != nil {
		return err
	}
	if !delivery.CanCancel(state.Status) {
		return ports.ErrInvalidHandoverState
	}
	return s.handovers.SetHandoverStatus(ctx, cmd.Scope, ports.SetHandoverStatusInput{
		HandoverID: cmd.HandoverID,
		From:       state.Status,
		To:         delivery.StatusCancelled,
	})
}

func authorizeHandoverOperation(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	switch role {
	case business.UserRoleOwner, business.UserRoleAdmin, business.UserRoleStaff:
		return nil
	default:
		return authdomain.ErrForbidden
	}
}

// --- Delivery zones -------------------------------------------------------

// ListDeliveryZones returns every zone for the dashboard manager (active and
// inactive).
func (s Service) ListDeliveryZones(ctx context.Context, scope common.TenantScope) ([]ports.DeliveryZone, error) {
	return s.zones.ListDeliveryZones(ctx, scope)
}

// ListActiveDeliveryZones returns the active zones a storefront offers at
// checkout. It is a public read (no actor role).
func (s Service) ListActiveDeliveryZones(ctx context.Context, scope common.TenantScope) ([]ports.DeliveryZone, error) {
	return s.zones.ListActiveDeliveryZones(ctx, scope)
}

// ZoneCommand is the validated request to create or update a delivery zone.
type ZoneCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	ZoneID    common.ID
	Name      string
	FeeMinor  int64
	Sequence  int
	Active    bool
}

// CreateDeliveryZone adds a delivery zone. Configuring delivery pricing is an
// owner/admin operation; the name must be non-empty and the fee non-negative.
func (s Service) CreateDeliveryZone(ctx context.Context, cmd ZoneCommand) (common.ID, error) {
	if err := authorizeZoneManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return "", err
	}
	name := strings.TrimSpace(cmd.Name)
	if name == "" || cmd.FeeMinor < 0 {
		return "", authdomain.ErrInvalidInput
	}
	id := s.ids.NewID()
	if err := s.zones.CreateDeliveryZone(ctx, cmd.Scope, ports.CreateDeliveryZoneInput{
		ZoneID:   id,
		Name:     name,
		FeeMinor: cmd.FeeMinor,
		Sequence: cmd.Sequence,
	}); err != nil {
		return "", err
	}
	return id, nil
}

// UpdateDeliveryZone edits a delivery zone.
func (s Service) UpdateDeliveryZone(ctx context.Context, cmd ZoneCommand) error {
	if err := authorizeZoneManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	name := strings.TrimSpace(cmd.Name)
	if cmd.ZoneID.IsZero() || name == "" || cmd.FeeMinor < 0 {
		return authdomain.ErrInvalidInput
	}
	return s.zones.UpdateDeliveryZone(ctx, cmd.Scope, ports.UpdateDeliveryZoneInput{
		ZoneID:   cmd.ZoneID,
		Name:     name,
		FeeMinor: cmd.FeeMinor,
		Sequence: cmd.Sequence,
		Active:   cmd.Active,
	})
}

// DeleteDeliveryZone removes a delivery zone.
func (s Service) DeleteDeliveryZone(ctx context.Context, scope common.TenantScope, role business.UserRole, zoneID common.ID) error {
	if err := authorizeZoneManagement(scope, role); err != nil {
		return err
	}
	if zoneID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	return s.zones.DeleteDeliveryZone(ctx, scope, zoneID)
}

// authorizeZoneManagement gates delivery-pricing configuration to owners and
// admins (staff arrange handovers but do not set fees).
func authorizeZoneManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	switch role {
	case business.UserRoleOwner, business.UserRoleAdmin:
		return nil
	default:
		return authdomain.ErrForbidden
	}
}
