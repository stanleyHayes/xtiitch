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
	// CreateCustomOrder records an online custom (bespoke) order as draft and, for
	// the self-measure route, stores the customer's measurements against it in the
	// same transaction. Confirmation happens via the deposit payment webhook. It
	// fails closed if the business has no bespoke stages or if a measurement key is
	// not one of the business's measurement fields (ErrUnknownMeasurementField).
	CreateCustomOrder(ctx context.Context, scope common.TenantScope, input CreateCustomOrderInput) error
	// CreateCustomOrderConfirmed records a come-to-shop custom order already
	// confirmed at the first bespoke stage, with no online payment (everything is
	// arranged in person).
	CreateCustomOrderConfirmed(ctx context.Context, scope common.TenantScope, input CreateCustomOrderConfirmedInput) error
	// DiscardCustomDraftOrder compensates a custom-order checkout whose deposit
	// could not be raised: it removes the measurement, the still-draft order, and
	// the customer, scoped to the tenant.
	DiscardCustomDraftOrder(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) error
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

type CreateCustomOrderInput struct {
	OrderID       common.ID
	BusinessID    common.ID
	CustomerID    common.ID
	DesignID      common.ID
	SizeMode      string
	CustomerName  string
	CustomerPhone string
	CustomerEmail string
	// MeasurementID and Measurements are set only for the self-measure route;
	// Measurements maps the business's measurement field ids to entered values.
	MeasurementID common.ID
	Measurements  map[string]string
}

type CreateCustomOrderConfirmedInput struct {
	OrderID       common.ID
	BusinessID    common.ID
	CustomerID    common.ID
	DesignID      common.ID
	SizeMode      string
	CustomerName  string
	CustomerPhone string
	CustomerEmail string
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
