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

// ErrInvalidOrderState is returned when a state transition would violate the
// order lifecycle, such as advancing a draft or already fulfilled order.
var ErrInvalidOrderState = errors.New("invalid order state")
