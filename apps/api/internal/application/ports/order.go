package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

type OrderRepository interface {
	// CreateWalkInOrder records an in-person order: it creates the customer,
	// creates the order confirmed at the first ready-made stage, and logs the
	// stage event, all in one transaction (Spec 8.5).
	CreateWalkInOrder(ctx context.Context, scope common.TenantScope, input CreateWalkInOrderInput) error
	// CreateOnlineOrder records an online standard order as draft: it is confirmed
	// at its first stage only when its payment succeeds (see the payment webhook).
	CreateOnlineOrder(ctx context.Context, scope common.TenantScope, input CreateOnlineOrderInput) error
	// DiscardDraftOrder removes a still-draft order and the customer row that was
	// created with it, scoped to the tenant. It compensates a checkout whose
	// payment could not be raised, so no un-payable draft is left behind.
	DiscardDraftOrder(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) error
	ListOrders(ctx context.Context, scope common.TenantScope) ([]OrderSummary, error)
	// AdvanceStage moves an order to the next stage in its flow, marking it
	// fulfilled when it reaches the last stage.
	AdvanceStage(ctx context.Context, scope common.TenantScope, orderID common.ID) (order.Tracking, error)
	// GetTracking is the public, account-free "where is my cloth?" read, keyed
	// by the unguessable order reference (cross-tenant by credential).
	GetTracking(ctx context.Context, orderID common.ID) (order.Tracking, error)
}

type CreateWalkInOrderInput struct {
	OrderID          common.ID
	BusinessID       common.ID
	CustomerID       common.ID
	DesignID         common.ID
	SizeBandID       *common.ID
	CustomerName     string
	CustomerPhone    string
	CustomerEmail    string
	AgreedTotalMinor *int64
}

type CreateOnlineOrderInput struct {
	OrderID          common.ID
	BusinessID       common.ID
	CustomerID       common.ID
	DesignID         common.ID
	SizeBandID       *common.ID
	CustomerName     string
	CustomerPhone    string
	CustomerEmail    string
	AgreedTotalMinor int64
}

type OrderSummary struct {
	OrderID          common.ID
	DesignTitle      string
	CustomerName     string
	Status           string
	StageName        string
	Colour           string
	AgreedTotalMinor *int64
}
