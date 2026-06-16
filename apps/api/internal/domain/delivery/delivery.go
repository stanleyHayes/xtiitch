// Package delivery models the last operational leg of an order: once production
// is complete, how the finished garment reaches the customer. A handover is
// either a pickup (the customer collects) or a delivery (the business sends it
// to an address). The package owns the method/status vocabulary and the rules
// for how a handover may move through its lifecycle; persistence and money live
// elsewhere (Xtiitch never holds funds, so nothing here touches payments).
package delivery

// Method is how a finished order reaches the customer.
type Method string

const (
	MethodPickup   Method = "pickup"
	MethodDelivery Method = "delivery"
)

// Valid reports whether the method is one the system knows.
func (m Method) Valid() bool {
	return m == MethodPickup || m == MethodDelivery
}

// Status is the handover's lifecycle state. A pickup runs pending -> completed; a
// delivery runs pending -> dispatched -> completed. Either can be cancelled while
// still open.
type Status string

const (
	StatusPending    Status = "pending"
	StatusDispatched Status = "dispatched"
	StatusCompleted  Status = "completed"
	StatusCancelled  Status = "cancelled"
)

// Valid reports whether the status is one the system knows.
func (s Status) Valid() bool {
	switch s {
	case StatusPending, StatusDispatched, StatusCompleted, StatusCancelled:
		return true
	default:
		return false
	}
}

// Terminal reports whether the handover has reached an end state, after which it
// no longer changes.
func (s Status) Terminal() bool {
	return s == StatusCompleted || s == StatusCancelled
}

// NextOnAdvance returns the status an "advance" action moves the handover to,
// given its method and current status. Advancing is the forward step in the
// fulfilment flow: a pickup goes straight to completed (the customer collected
// it); a delivery goes pending -> dispatched (it left the shop) -> completed (it
// reached the customer). It returns ok=false when there is no forward step — the
// handover is already terminal, or the state/method pair is not a valid one.
func NextOnAdvance(method Method, from Status) (Status, bool) {
	switch method {
	case MethodPickup:
		if from == StatusPending {
			return StatusCompleted, true
		}
	case MethodDelivery:
		switch from {
		case StatusPending:
			return StatusDispatched, true
		case StatusDispatched:
			return StatusCompleted, true
		}
	}
	return "", false
}

// CanCancel reports whether a handover in this status can still be cancelled.
// Only an open (pending or dispatched) handover can; a completed or cancelled
// one is already terminal.
func CanCancel(from Status) bool {
	return from == StatusPending || from == StatusDispatched
}
