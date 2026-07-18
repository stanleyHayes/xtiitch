package adminauth

import (
	"context"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

type ListSubscriptionsCommand struct {
	ActorRole admindomain.Role
}

type UpdateSubscriptionCommand struct {
	ActorUserID             common.ID
	ActorRole               admindomain.Role
	BusinessID              common.ID
	Status                  string
	BillingMode             string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
	Reason                  string
	UserAgent               string
	IPAddress               string
}

func (s Service) ListSubscriptions(
	ctx context.Context,
	cmd ListSubscriptionsCommand,
) ([]ports.AdminSubscriptionRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminSubscriptions(ctx)
}

func (s Service) UpdateSubscription(
	ctx context.Context,
	cmd UpdateSubscriptionCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}

	status, err := normalizeSubscriptionStatus(cmd.Status)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	billingMode, err := normalizeSubscriptionBillingMode(cmd.BillingMode)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	providerCustomerRef, providerSubscriptionRef, err := normalizeSubscriptionProviderRefs(
		billingMode,
		cmd.ProviderCustomerRef,
		cmd.ProviderSubscriptionRef,
	)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = subscriptionUpdateSummary(status, billingMode)
	}

	record, err := s.businesses.UpdateAdminSubscription(ctx, ports.UpdateAdminSubscriptionInput{
		BusinessID:              cmd.BusinessID,
		Status:                  status,
		BillingMode:             billingMode,
		ProviderCustomerRef:     providerCustomerRef,
		ProviderSubscriptionRef: providerSubscriptionRef,
		Reason:                  reason,
		ActorAdminUser:          cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated subscription",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     subscriptionUpdateSummary(status, billingMode),
		Severity:    subscriptionUpdateSeverity(status),
		Metadata: map[string]string{
			"status":                    status,
			"billing_mode":              billingMode,
			"plan":                      record.PlanCode,
			"provider_customer_ref":     providerCustomerRef,
			"provider_subscription_ref": providerSubscriptionRef,
			"reason":                    reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}
func normalizeSubscriptionStatus(value string) (string, error) {
	switch strings.TrimSpace(value) {
	case "active", "trialing", "past_due", "grace_period", "cancel_at_period_end", "canceled":
		return strings.TrimSpace(value), nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

func normalizeSubscriptionBillingMode(value string) (string, error) {
	switch strings.TrimSpace(value) {
	case "manual", "payment_link", "recurring":
		return strings.TrimSpace(value), nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

func normalizeSubscriptionProviderRefs(
	billingMode string,
	customerRef string,
	subscriptionRef string,
) (string, string, error) {
	if billingMode == "manual" {
		return "", "", nil
	}

	normalizedCustomerRef, err := normalizeProviderReference(customerRef)
	if err != nil {
		return "", "", err
	}
	normalizedSubscriptionRef, err := normalizeProviderReference(subscriptionRef)
	if err != nil {
		return "", "", err
	}
	if billingMode == "recurring" && normalizedSubscriptionRef == "" {
		return "", "", authdomain.ErrInvalidInput
	}
	return normalizedCustomerRef, normalizedSubscriptionRef, nil
}

func normalizeProviderReference(value string) (string, error) {
	ref := strings.TrimSpace(value)
	if ref == "" {
		return "", nil
	}
	if len([]rune(ref)) > 160 || strings.ContainsAny(ref, " \t\r\n") {
		return "", authdomain.ErrInvalidInput
	}
	return ref, nil
}

func subscriptionUpdateSummary(status string, billingMode string) string {
	return "Subscription moved to " + strings.ReplaceAll(status, "_", " ") +
		" using " + strings.ReplaceAll(billingMode, "_", " ") + " billing."
}
func subscriptionUpdateSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "past_due", "grace_period", "cancel_at_period_end":
		return admindomain.AuditSeverityWarning
	case "canceled":
		return admindomain.AuditSeverityCritical
	default:
		return admindomain.AuditSeverityInfo
	}
}

// cadenceRenewalMinor is the single source of truth for the amount (GHS minor
// units) a recurring charge must bill for one billing cycle, chosen by the
// subscription's cadence. Quarterly and yearly bill their fixed Pricing-Book
// renewal figures.
//
// There is NO monthly branch, by rule: "there is no monthly billing — billed
// quarterly or yearly only" (Pricing Book rule 1, §2, checklist #1). The monthly
// rate is a display unit and the basis for calculating those figures; it is
// never itself charged. This used to default to MonthlyFeeMinor, which meant any
// subscription still carrying the legacy 'monthly' cadence was billed GHS
// 49/99/199 every month -- the exact billing the book forbids.
//
// An unrecognised cadence returns 0, which is already the documented "do not
// charge" signal that subscriptionDueForRecurringCharge honours, so such a row is
// skipped rather than billed at a figure nobody specified. Migration 000091
// leaves no such rows and constrains the column, so this is a backstop.
func cadenceRenewalMinor(subscription ports.AdminSubscriptionRecord) int64 {
	switch subscription.BillingCadence {
	case "quarterly":
		return subscription.QuarterlyRenewalMinor
	case "yearly":
		return subscription.YearlyRenewalMinor
	default:
		return 0
	}
}

// cadenceMonths is the single source of truth for how many months one billing
// cycle covers, so the SUCCESS-path period advance moves by the right length.
//
// Returns 0 for an unrecognised cadence rather than defaulting to 1 month: a
// silent 1 is what let a legacy row advance monthly. Callers pair it with
// cadenceRenewalMinor, which returns 0 for the same input, so such a row is never
// charged and never advanced.
func cadenceMonths(cadence string) int {
	switch cadence {
	case "quarterly":
		return 3
	case "yearly":
		return 12
	default:
		return 0
	}
}
func subscriptionDueForRecurringCharge(subscription ports.AdminSubscriptionRecord, now time.Time) bool {
	if cadenceRenewalMinor(subscription) <= 0 ||
		subscription.BillingMode != "recurring" ||
		subscription.Status == "canceled" ||
		subscription.Status == "cancel_at_period_end" ||
		subscription.NextBillingAt == nil ||
		subscription.NextBillingAt.After(now) {
		return false
	}
	for _, invoice := range subscription.Invoices {
		if invoice.Status == "issued" {
			return false
		}
	}
	return true
}

// subscriptionAwaitingCadence reports a subscription that is set up to renew but
// has never had a cadence chosen, so nothing about it is billable: cadenceRenewalMinor
// yields no figure and cadenceMonths no period. Only meaningful for rows that
// would otherwise be due -- a free plan or a canceled one is not "awaiting"
// anything, and a row whose next_billing_at is still in the future is a healthy
// not-yet-due row, not one stuck for want of a cadence.
func subscriptionAwaitingCadence(subscription ports.AdminSubscriptionRecord, now time.Time) bool {
	return subscription.BillingMode == "recurring" &&
		subscription.Status != "canceled" &&
		subscription.Status != "cancel_at_period_end" &&
		subscription.NextBillingAt != nil &&
		!subscription.NextBillingAt.After(now) &&
		cadenceMonths(subscription.BillingCadence) <= 0
}

func subscriptionRecurringChargeReady(subscription ports.AdminSubscriptionRecord) bool {
	return strings.TrimSpace(subscription.OwnerEmail) != "" &&
		strings.TrimSpace(subscription.ProviderSubscriptionRef) != ""
}

// subscriptionUsesMoMo reports whether the stored authorization is a mobile-money
// authorization, which cannot be silently auto-debited and so is reminder-driven
// rather than charged by the sweep. An empty/unknown channel is treated as
// card-like, preserving the existing silent auto-charge behaviour.
func subscriptionUsesMoMo(subscription ports.AdminSubscriptionRecord) bool {
	return normalizeAuthorizationChannel(subscription.ProviderChannel) == "mobile_money"
}

// renewalReminderRecipient is the business owner's WhatsApp number (falling back
// to their phone) — the destination for a subscription renewal reminder. Empty
// means there is no reachable owner contact, so no reminder is enqueued.
func renewalReminderRecipient(subscription ports.AdminSubscriptionRecord) string {
	if whatsApp := strings.TrimSpace(subscription.OwnerWhatsApp); whatsApp != "" {
		return whatsApp
	}
	return strings.TrimSpace(subscription.OwnerPhone)
}

// subscriptionUpcomingReminderDue reports whether an active recurring, paid
// subscription is within leadDays of its next_billing_at but not yet due — the
// window for the proactive "your plan renews soon — tap to pay" reminder.
func subscriptionUpcomingReminderDue(subscription ports.AdminSubscriptionRecord, now time.Time, leadDays int) bool {
	if subscription.BillingMode != "recurring" ||
		cadenceRenewalMinor(subscription) <= 0 ||
		subscription.NextBillingAt == nil {
		return false
	}
	switch subscription.Status {
	case "active", "trialing":
	default:
		return false
	}
	next := *subscription.NextBillingAt
	if !next.After(now) {
		// Already due or past: handled by the charge / re-pay path, not "upcoming".
		return false
	}
	windowStart := next.Add(-time.Duration(leadDays) * 24 * time.Hour)
	return !now.Before(windowStart)
}

// emitRenewalReminder enqueues a renewal reminder (idempotently) and, when a new
// reminder was actually enqueued, bumps the sweep's RemindersEnqueued counter.
func (s Service) emitRenewalReminder(
	ctx context.Context,
	subscription ports.AdminSubscriptionRecord,
	kind notification.Kind,
	graceEndsAt *time.Time,
	record *ports.AdminSubscriptionRecurringSweepRecord,
) error {
	enqueued, err := s.enqueueRenewalReminder(ctx, subscription, kind, graceEndsAt)
	if err != nil {
		return err
	}
	if enqueued {
		record.RemindersEnqueued++
	}
	return nil
}
