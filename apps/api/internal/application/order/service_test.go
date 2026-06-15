package orderapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

func TestCreateWalkInOrderRejectsMissingDesignOrCustomer(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{Orders: &fakeOrderRepo{}, IDs: &seqIDs{ids: []common.ID{"order-1", "customer-1"}}})

	if _, err := service.CreateWalkInOrder(context.Background(), CreateWalkInOrderCommand{
		Scope: common.TenantScope{BusinessID: "b1"}, DesignID: "", CustomerName: "Ama",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for missing design, got %v", err)
	}
	if _, err := service.CreateWalkInOrder(context.Background(), CreateWalkInOrderCommand{
		Scope: common.TenantScope{BusinessID: "b1"}, DesignID: "d1", CustomerName: "  ",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for missing customer, got %v", err)
	}
}

func TestCreateWalkInOrderRecordsScopedInput(t *testing.T) {
	t.Parallel()

	repo := &fakeOrderRepo{}
	service := NewService(Dependencies{Orders: repo, IDs: &seqIDs{ids: []common.ID{"order-1", "customer-1"}}})

	id, err := service.CreateWalkInOrder(context.Background(), CreateWalkInOrderCommand{
		Scope:        common.TenantScope{BusinessID: "b1"},
		DesignID:     "d1",
		CustomerName: "  Ama Boateng  ",
	})
	if err != nil {
		t.Fatalf("create walk-in order: %v", err)
	}
	if id != common.ID("order-1") {
		t.Fatalf("unexpected order id %q", id)
	}
	if repo.input.OrderID != "order-1" || repo.input.CustomerID != "customer-1" || repo.input.BusinessID != "b1" {
		t.Fatalf("unexpected ids on input: %+v", repo.input)
	}
	if repo.input.CustomerName != "Ama Boateng" {
		t.Fatalf("expected trimmed customer name, got %q", repo.input.CustomerName)
	}
}

type fakeOrderRepo struct {
	input ports.CreateWalkInOrderInput
}

func (r *fakeOrderRepo) CreateWalkInOrder(_ context.Context, _ common.TenantScope, input ports.CreateWalkInOrderInput) error {
	r.input = input
	return nil
}

func (r *fakeOrderRepo) ListOrders(_ context.Context, _ common.TenantScope) ([]ports.OrderSummary, error) {
	return nil, nil
}

func (r *fakeOrderRepo) AdvanceStage(_ context.Context, _ common.TenantScope, _ common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

func (r *fakeOrderRepo) GetTracking(_ context.Context, _ common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

type seqIDs struct {
	ids []common.ID
}

func (s *seqIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
