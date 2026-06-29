package ports

import (
	"context"
	"time"

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
	// CreateOnlineOrderGroup records several online standard orders as draft in one
	// transaction, all sharing the same customer and checkout group, so a single
	// combined payment can confirm them together. It is all-or-nothing: any failure
	// rolls back the whole group.
	CreateOnlineOrderGroup(ctx context.Context, scope common.TenantScope, inputs []CreateOnlineOrderInput) error
	// DiscardDraftOrderGroup removes every still-draft order in a checkout group and
	// the customer created with it, compensating a combined checkout whose payment
	// could not be raised.
	DiscardDraftOrderGroup(ctx context.Context, scope common.TenantScope, groupID, customerID common.ID) error
	// FindCustomerIDByPhone resolves an existing (non-erased) customer by phone so
	// repeat guest orders link to one identity; the bool reports a match.
	FindCustomerIDByPhone(ctx context.Context, phone string) (common.ID, bool, error)
	// DiscardDraftOrder removes a still-draft order and the customer row that was
	// created with it, scoped to the tenant. It compensates a checkout whose
	// payment could not be raised, so no un-payable draft is left behind.
	DiscardDraftOrder(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) error
	// SetDraftOrderAgreedTotal updates the payable total on a still-draft
	// standard online order, used after a promotion reservation lowers the charge
	// before the payment is raised.
	SetDraftOrderAgreedTotal(ctx context.Context, scope common.TenantScope, orderID common.ID, agreedTotalMinor int64) error
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
	// SetAgreedTotal records the negotiated total for a confirmed custom order so
	// its balance can be collected. The total must be at least what has already
	// been settled; an order that is not a confirmed custom order, or a total
	// below the settled amount, returns ErrInvalidOrderState.
	SetAgreedTotal(ctx context.Context, scope common.TenantScope, orderID common.ID, agreedTotalMinor int64) error
	// GetOrderBilling reads the financial state a balance charge needs for one
	// order (type, status, agreed total, settled, customer email), tenant-scoped.
	GetOrderBilling(ctx context.Context, scope common.TenantScope, orderID common.ID) (OrderBilling, error)
}

// OrderBilling is the slice of an order a balance charge reasons about.
type OrderBilling struct {
	OrderType        string
	Status           string
	AgreedTotalMinor *int64
	SettledMinor     int64
	CustomerEmail    string
	// BalanceInFlight is true when an initiated balance payment already exists
	// for the order, so a second balance charge must be refused.
	BalanceInFlight bool
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
	// CheckoutGroupID links this order to the other orders paid by one combined
	// cart charge. Nil for a stand-alone order.
	CheckoutGroupID *common.ID
	// Delivery snapshot, set only when the customer chose delivery at checkout.
	// For a combined cart the snapshot rides the anchor order (the fee is added to
	// the cart total once). DeliveryMethod is "" for the default (no handover yet).
	DeliveryMethod   string
	DeliveryAddress  string
	DeliveryFeeMinor int64
	DeliveryZoneID   *common.ID
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
	// Channel records where the order came from: "online" (customer chose
	// come-to-shop at online checkout) or "walk_in" (staff logged it in person).
	// Empty defaults to "online" for back-compatibility.
	Channel string
	// MeasurementID and Measurements are set when staff captured the customer's
	// measurements at the counter; Measurements maps the business's measurement
	// field ids to entered values. Stored against the order with source 'shop'.
	MeasurementID common.ID
	Measurements  map[string]string
}

type OrderSummary struct {
	OrderID          common.ID
	DesignTitle      string
	CustomerName     string
	CustomerPhone    string
	CustomerEmail    string
	Status           string
	OrderType        string
	SizeMode         string
	Channel          string
	StageName        string
	Colour           string
	AgreedTotalMinor *int64
	SettledMinor     int64
	PaymentStatus    string
	PaymentPurpose   string
	PaymentAmount    *int64
	CreatedAt        time.Time
}
