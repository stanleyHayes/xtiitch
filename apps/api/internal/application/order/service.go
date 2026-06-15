package orderapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

var ErrInvalidInput = errors.New("invalid order input")

type Service struct {
	orders ports.OrderRepository
	ids    ports.IDGenerator
}

type Dependencies struct {
	Orders ports.OrderRepository
	IDs    ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{orders: deps.Orders, ids: deps.IDs}
}

type CreateWalkInOrderCommand struct {
	Scope            common.TenantScope
	DesignID         common.ID
	SizeBandID       *common.ID
	CustomerName     string
	CustomerPhone    string
	CustomerEmail    string
	AgreedTotalMinor *int64
}

// CreateWalkInOrder records an in-person order against one of the business's
// designs and returns the order reference (the customer's tracking key).
func (s Service) CreateWalkInOrder(ctx context.Context, cmd CreateWalkInOrderCommand) (common.ID, error) {
	name := strings.TrimSpace(cmd.CustomerName)
	if cmd.DesignID == "" || name == "" {
		return "", ErrInvalidInput
	}

	orderID := s.ids.NewID()
	err := s.orders.CreateWalkInOrder(ctx, cmd.Scope, ports.CreateWalkInOrderInput{
		OrderID:          orderID,
		BusinessID:       cmd.Scope.BusinessID,
		CustomerID:       s.ids.NewID(),
		DesignID:         cmd.DesignID,
		SizeBandID:       cmd.SizeBandID,
		CustomerName:     name,
		CustomerPhone:    strings.TrimSpace(cmd.CustomerPhone),
		CustomerEmail:    strings.TrimSpace(cmd.CustomerEmail),
		AgreedTotalMinor: cmd.AgreedTotalMinor,
	})
	return orderID, err
}

func (s Service) ListOrders(ctx context.Context, scope common.TenantScope) ([]ports.OrderSummary, error) {
	return s.orders.ListOrders(ctx, scope)
}

func (s Service) AdvanceStage(ctx context.Context, scope common.TenantScope, orderID common.ID) (order.Tracking, error) {
	return s.orders.AdvanceStage(ctx, scope, orderID)
}

// GetTracking is the public "where is my cloth?" read, keyed by order reference.
func (s Service) GetTracking(ctx context.Context, orderID common.ID) (order.Tracking, error) {
	return s.orders.GetTracking(ctx, orderID)
}
