package deliveryapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/delivery"
)

type fakeDeliveryRepo struct {
	arranged ports.ArrangeHandoverInput
	state    ports.HandoverState
	getErr   error
	set      ports.SetHandoverStatusInput
	setCalls int
}

func (r *fakeDeliveryRepo) ArrangeHandover(_ context.Context, _ common.TenantScope, input ports.ArrangeHandoverInput) error {
	r.arranged = input
	return nil
}

func (r *fakeDeliveryRepo) ListHandovers(context.Context, common.TenantScope) ([]ports.HandoverSummary, error) {
	return nil, nil
}

func (r *fakeDeliveryRepo) GetHandover(context.Context, common.TenantScope, common.ID) (ports.HandoverState, error) {
	return r.state, r.getErr
}

func (r *fakeDeliveryRepo) SetHandoverStatus(_ context.Context, _ common.TenantScope, input ports.SetHandoverStatusInput) error {
	r.set = input
	r.setCalls++
	return nil
}

type fixedIDs struct{ id common.ID }

func (f fixedIDs) NewID() common.ID { return f.id }

func scope() common.TenantScope { return common.TenantScope{BusinessID: "b1"} }

func TestArrangeHandoverValidatesMethodAndAddress(t *testing.T) {
	t.Parallel()

	// An unknown method is rejected before touching the repository.
	repo := &fakeDeliveryRepo{}
	svc := NewService(Dependencies{Handovers: repo, IDs: fixedIDs{id: "h1"}})
	if _, err := svc.ArrangeHandover(context.Background(), ArrangeHandoverCommand{
		Scope: scope(), ActorRole: business.UserRoleStaff, OrderID: "o1", Method: delivery.Method("teleport"),
	}); !errors.Is(err, ports.ErrInvalidHandoverState) {
		t.Fatalf("expected ErrInvalidHandoverState for a bad method, got %v", err)
	}
	if repo.arranged.OrderID != "" {
		t.Fatal("the repository must not be called for an invalid method")
	}

	// A delivery with no address is rejected.
	if _, err := svc.ArrangeHandover(context.Background(), ArrangeHandoverCommand{
		Scope: scope(), ActorRole: business.UserRoleAdmin, OrderID: "o1", Method: delivery.MethodDelivery, Address: "",
	}); !errors.Is(err, ports.ErrInvalidHandoverState) {
		t.Fatalf("expected ErrInvalidHandoverState for a delivery without an address, got %v", err)
	}

	// A valid delivery is arranged with a fresh id and the full input.
	id, err := svc.ArrangeHandover(context.Background(), ArrangeHandoverCommand{
		Scope: scope(), ActorRole: business.UserRoleOwner, OrderID: "o1",
		Method: delivery.MethodDelivery, Address: "12 Oxford St, Accra", RecipientName: "Ama",
	})
	if err != nil {
		t.Fatalf("arrange: %v", err)
	}
	if id != "h1" || repo.arranged.HandoverID != "h1" || repo.arranged.OrderID != "o1" ||
		repo.arranged.Method != delivery.MethodDelivery || repo.arranged.Address != "12 Oxford St, Accra" {
		t.Fatalf("unexpected arrange input: %+v (id=%q)", repo.arranged, id)
	}
}

func TestAdvanceHandoverPicksTheForwardStep(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		method delivery.Method
		from   delivery.Status
		want   delivery.Status
	}{
		{"pickup collected", delivery.MethodPickup, delivery.StatusPending, delivery.StatusCompleted},
		{"delivery dispatched", delivery.MethodDelivery, delivery.StatusPending, delivery.StatusDispatched},
		{"delivery delivered", delivery.MethodDelivery, delivery.StatusDispatched, delivery.StatusCompleted},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeDeliveryRepo{state: ports.HandoverState{Method: tc.method, Status: tc.from}}
			svc := NewService(Dependencies{Handovers: repo, IDs: fixedIDs{}})
			if err := svc.AdvanceHandover(context.Background(), AdvanceHandoverCommand{
				Scope: scope(), ActorRole: business.UserRoleStaff, HandoverID: "h1", Courier: "DHL-123",
			}); err != nil {
				t.Fatalf("advance: %v", err)
			}
			if repo.set.From != tc.from || repo.set.To != tc.want || repo.set.Courier != "DHL-123" {
				t.Fatalf("unexpected set: %+v", repo.set)
			}
		})
	}

	// A terminal handover cannot be advanced and the repo is never written.
	repo := &fakeDeliveryRepo{state: ports.HandoverState{Method: delivery.MethodDelivery, Status: delivery.StatusCompleted}}
	svc := NewService(Dependencies{Handovers: repo, IDs: fixedIDs{}})
	if err := svc.AdvanceHandover(context.Background(), AdvanceHandoverCommand{
		Scope: scope(), ActorRole: business.UserRoleStaff, HandoverID: "h1",
	}); !errors.Is(err, ports.ErrInvalidHandoverState) {
		t.Fatalf("expected ErrInvalidHandoverState advancing a completed handover, got %v", err)
	}
	if repo.setCalls != 0 {
		t.Fatal("a terminal handover must not be written")
	}
}

func TestCancelHandoverGuardsTerminalState(t *testing.T) {
	t.Parallel()

	// An open handover is cancelled.
	repo := &fakeDeliveryRepo{state: ports.HandoverState{Method: delivery.MethodDelivery, Status: delivery.StatusDispatched}}
	svc := NewService(Dependencies{Handovers: repo, IDs: fixedIDs{}})
	if err := svc.CancelHandover(context.Background(), CancelHandoverCommand{
		Scope: scope(), ActorRole: business.UserRoleStaff, HandoverID: "h1",
	}); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if repo.set.From != delivery.StatusDispatched || repo.set.To != delivery.StatusCancelled {
		t.Fatalf("unexpected set: %+v", repo.set)
	}

	// A completed handover cannot be cancelled.
	done := &fakeDeliveryRepo{state: ports.HandoverState{Method: delivery.MethodPickup, Status: delivery.StatusCompleted}}
	doneSvc := NewService(Dependencies{Handovers: done, IDs: fixedIDs{}})
	if err := doneSvc.CancelHandover(context.Background(), CancelHandoverCommand{
		Scope: scope(), ActorRole: business.UserRoleStaff, HandoverID: "h1",
	}); !errors.Is(err, ports.ErrInvalidHandoverState) {
		t.Fatalf("expected ErrInvalidHandoverState cancelling a completed handover, got %v", err)
	}
	if done.setCalls != 0 {
		t.Fatal("a completed handover must not be written")
	}
}

func TestHandoverOperationsRequireKnownBusinessRole(t *testing.T) {
	t.Parallel()

	repo := &fakeDeliveryRepo{state: ports.HandoverState{Method: delivery.MethodPickup, Status: delivery.StatusPending}}
	svc := NewService(Dependencies{Handovers: repo, IDs: fixedIDs{id: "h1"}})
	_, err := svc.ArrangeHandover(context.Background(), ArrangeHandoverCommand{
		Scope:     scope(),
		ActorRole: business.UserRole("viewer"),
		OrderID:   "o1",
		Method:    delivery.MethodPickup,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected forbidden role, got %v", err)
	}
	if repo.arranged.HandoverID != "" {
		t.Fatalf("repository must not be called for forbidden arrange, got %+v", repo.arranged)
	}

	err = svc.AdvanceHandover(context.Background(), AdvanceHandoverCommand{
		Scope:      common.TenantScope{},
		ActorRole:  business.UserRoleOwner,
		HandoverID: "h1",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected missing tenant scope to be invalid, got %v", err)
	}
	if repo.setCalls != 0 {
		t.Fatal("repository must not be written for invalid scope")
	}
}
