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

// Reply-To addresses for automated email. Every automated message is SENT from
// the noreply@ address but must carry a working Reply-To that reaches a human:
// operational mail (orders, verification, account) routes replies to support@,
// and money mail (receipts, renewals, payouts) routes replies to billing@.
// Automated mail is never SENT through support@/billing@ — only replied-to
// there, which keeps high-volume sending isolated on noreply@.
const (
	ReplyToOperational = "support@xtiitch.com"
	ReplyToBilling     = "billing@xtiitch.com"
)

// Kind is the lifecycle event a message announces. Each kind fires at most once
// per reference (see DedupKey).
type Kind string

const (
	KindOrderConfirmed Kind = "order_confirmed"
	// KindOrderStageAdvanced tells the customer their order moved to a new
	// production stage. Stages are business-defined (stage_templates), so one kind
	// carries the stage name and the transport composes the per-stage wording. It
	// dedupes per (order, stage) — see StageAdvanceReference — so each transition
	// fires exactly once while every stage still gets its own message.
	KindOrderStageAdvanced Kind = "order_stage_advanced"
	KindOrderFulfilled     Kind = "order_fulfilled"
	KindBookingConfirmed   Kind = "booking_confirmed"
	KindBalancePaid        Kind = "balance_paid"
	KindHandoverDispatched Kind = "handover_dispatched"
	KindHandoverCompleted  Kind = "handover_completed"

	// KindNewOrderOwner alerts the STORE OWNER (not the customer) that a new order
	// came in, so they can action it — especially a bespoke order needing a direct
	// price negotiation. Recipient is the owner's phone (business_users.phone).
	KindNewOrderOwner Kind = "new_order_owner"

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
	case KindOrderConfirmed, KindOrderStageAdvanced, KindOrderFulfilled, KindBookingConfirmed,
		KindBalancePaid, KindHandoverDispatched, KindHandoverCompleted, KindNewOrderOwner,
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

// StageAdvanceReference builds the reference for a stage-advance message: a
// given order fires at most one message per stage it reaches. Pinning the
// reference to the stage (not just the order) lets every stage transition
// notify while a redelivered/retried advance to the same stage dedupes. Pair it
// with DedupKey to derive the outbox idempotency key.
func StageAdvanceReference(orderID, stageID string) string {
	return orderID + "@" + stageID
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
