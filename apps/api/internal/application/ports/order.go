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
	// ResolveOrCreateCustomerByPhone atomically resolves-or-creates the customer for
	// a phone under an advisory lock, so concurrent first-time orders from the same
	// phone share one identity instead of racing to create duplicates. The phone is
	// canonicalized to 233XXXXXXXXX (§5.3.4) first, so the 024… guest form and the
	// 233… OTP-login form resolve the SAME row; an unnormalizable phone returns
	// common.ErrInvalidPhone. Returns (id, created); created=true means a fresh
	// row was minted (for cleanup).
	ResolveOrCreateCustomerByPhone(ctx context.Context, phone string, newID common.ID) (common.ID, bool, error)
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
	// ListStageTemplates returns the business's ordered production stages per flow,
	// so the dashboard can render every stage column (even empty ones), not just
	// the stages live orders happen to sit in.
	ListStageTemplates(ctx context.Context, scope common.TenantScope) ([]StageTemplate, error)
}
