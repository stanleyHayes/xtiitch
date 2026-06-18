package ports

import "errors"

// ErrNotFound is the port-level "no such record" sentinel. Outbound repositories
// return it (or wrap it) so application services and inbound adapters can map a
// missing record to a 404 without depending on a specific data store.
var ErrNotFound = errors.New("not found")

// ErrUnknownMeasurementField is returned when a custom-order measurement carries
// a field id that does not belong to the order's business. The repository
// validates submitted keys against the tenant's own measurement fields, so the
// check is authoritative and fails closed; services map it to a 400.
var ErrUnknownMeasurementField = errors.New("unknown measurement field")

// ErrMeasurementSequenceTaken is returned when a business tries to give two
// measurement fields the same display position. The unique database index makes
// this race-proof.
var ErrMeasurementSequenceTaken = errors.New("measurement field sequence already exists")

// ErrInvalidOrderState is returned when a state transition would violate the
// order lifecycle, such as advancing a draft or already fulfilled order.
var ErrInvalidOrderState = errors.New("invalid order state")

// ErrPaymentInFlight is returned when a charge cannot be raised because an
// equivalent one is already pending — e.g. a second balance charge for an order
// that already has an initiated balance payment. It is the database-enforced
// backstop against double-charging a customer.
var ErrPaymentInFlight = errors.New("an equivalent payment is already in flight")

// ErrPromotionUnavailable is returned when a checkout promotion code does not
// resolve to a currently redeemable voucher for the tenant/order context.
var ErrPromotionUnavailable = errors.New("promotion unavailable")

// ErrPromotionCodeTaken is returned when a business or admin tries to create a
// non-archived promotion using a code that is already active for that scope.
var ErrPromotionCodeTaken = errors.New("promotion code already exists")

// ErrSubscriptionBillingUnavailable is returned when an admin billing action is
// attempted for a free, canceled, or otherwise non-billable subscription.
var ErrSubscriptionBillingUnavailable = errors.New("subscription billing unavailable")

// ErrSubscriptionInvoiceOpen is returned when an admin tries to issue another
// subscription invoice while one is still open.
var ErrSubscriptionInvoiceOpen = errors.New("subscription invoice already open")

// ErrPlanLimitExceeded is returned when a tenant-scoped write would exceed the
// business's current subscription/package entitlement.
var ErrPlanLimitExceeded = errors.New("plan limit exceeded")

// ErrSlotTaken is returned when a home-visit slot cannot be held because it is
// already held/booked, or is not an offerable open slot. The partial unique
// index on bookings makes this race-proof.
var ErrSlotTaken = errors.New("that visit slot is no longer available")

// ErrNoAvailability is returned when a business has published no home-visit
// availability that covers the requested time.
var ErrNoAvailability = errors.New("the business has no home-visit availability then")

// ErrHandoverInProgress is returned when a fulfilment handover cannot be
// arranged because the order already has an open (pending/dispatched) one. The
// partial unique index on handovers makes this race-proof — an order is out for
// fulfilment at most once at a time.
var ErrHandoverInProgress = errors.New("the order already has a handover in progress")

// ErrInvalidHandoverState is returned when a handover transition is not allowed
// from its current state — advancing or cancelling one that is already completed
// or cancelled, or a move the method does not permit.
var ErrInvalidHandoverState = errors.New("invalid handover state")
