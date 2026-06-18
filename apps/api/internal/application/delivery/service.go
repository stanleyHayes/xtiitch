// Package deliveryapp manages fulfilment handovers: arranging how a fulfilled
// order reaches the customer (pickup or delivery), listing the queue, and moving
// a handover forward or cancelling it. The handover lifecycle rules live in the
// delivery domain; this service applies them over the repository.
package deliveryapp

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
)

type Service struct {
	handovers ports.DeliveryRepository
	ids       ports.IDGenerator
}

type Dependencies struct {
	Handovers ports.DeliveryRepository
	IDs       ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{handovers: deps.Handovers, ids: deps.IDs}
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
