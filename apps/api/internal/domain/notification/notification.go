// Package notification models the business→customer messages a lifecycle event
// produces — "your order is confirmed", "your order is ready". Events write a
// durable, deduplicated intent to a transactional outbox in the same database
// transaction as the state change, so a confirmed order always has its message
// recorded and a message is never recorded for a change that rolled back. The
// transport that actually sends each message (WhatsApp/SMS) drains the outbox
// separately; this package owns only the vocabulary and the idempotency key.
package notification

// Channel is the medium a message is sent over.
type Channel string

const (
	ChannelWhatsApp Channel = "whatsapp"
	ChannelSMS      Channel = "sms"
)

// Valid reports whether the channel is one the system knows.
func (c Channel) Valid() bool {
	return c == ChannelWhatsApp || c == ChannelSMS
}

// Kind is the lifecycle event a message announces. Each kind fires at most once
// per reference (see DedupKey).
type Kind string

const (
	KindOrderConfirmed     Kind = "order_confirmed"
	KindOrderFulfilled     Kind = "order_fulfilled"
	KindBookingConfirmed   Kind = "booking_confirmed"
	KindBalancePaid        Kind = "balance_paid"
	KindHandoverDispatched Kind = "handover_dispatched"
	KindHandoverCompleted  Kind = "handover_completed"

	// KindSubscriptionRenewalUpcoming reminds a business that its subscription is
	// about to renew (a few days ahead) with a one-tap re-pay call to action. It
	// is the MoMo-aware nudge: a mobile-money authorization cannot be silently
	// auto-debited, so the business pays via the billing/onboarding flow instead.
	KindSubscriptionRenewalUpcoming Kind = "subscription_renewal_upcoming"
	// KindSubscriptionRenewalPastDue reminds a business that a renewal payment did
	// not go through (a MoMo renewal that could not be silently charged, or a
	// failed card charge that entered grace) and to re-pay before the store is
	// downgraded.
	KindSubscriptionRenewalPastDue Kind = "subscription_renewal_past_due"
)

// Valid reports whether the kind is one the system knows.
func (k Kind) Valid() bool {
	switch k {
	case KindOrderConfirmed, KindOrderFulfilled, KindBookingConfirmed, KindBalancePaid,
		KindHandoverDispatched, KindHandoverCompleted,
		KindSubscriptionRenewalUpcoming, KindSubscriptionRenewalPastDue:
		return true
	default:
		return false
	}
}

// DedupKey builds the idempotency key for a per-reference event: a given kind
// fires at most once per reference (e.g. one order_confirmed per order). The
// outbox's unique index over (business, dedup key) makes a repeated enqueue —
// from a redelivered webhook or a retried transaction — a no-op.
func DedupKey(kind Kind, reference string) string {
	return string(kind) + ":" + reference
}

// SubscriptionReminderReference builds the reference for a renewal reminder: a
// given reminder kind fires at most once per (subscription, billing period).
// periodKey pins the reminder to one billing cycle (the renewal timestamp for an
// upcoming reminder, the grace-window end for a past-due one), so repeated sweeps
// within a cycle dedupe while a new cycle re-arms the reminder. Pair it with
// DedupKey to derive the outbox idempotency key.
func SubscriptionReminderReference(subscriptionID, periodKey string) string {
	return subscriptionID + "@" + periodKey
}
