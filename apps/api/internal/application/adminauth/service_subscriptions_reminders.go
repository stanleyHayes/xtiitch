package adminauth

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// renewalReminderLeadDays is the §13.3 renewal-reminder cadence — "Send at 15,
// 7 and 3 days before, and on the renewal date — by SMS and email, for
// quarterly and yearly plans alike, always stating the amount." Ascending so
// the sweep can pick the CURRENT window: the first lead day at or past the
// number of calendar days left until renewal.
var renewalReminderLeadDays = []int{0, 3, 7, 15}

// RunSubscriptionReminderSweep is the §13.3 proactive half of renewals: for
// every recurring, paid, active/trialing subscription it sends the lead-day
// reminder whose window is currently open (15/7/3 days out, or on the renewal
// date) by SMS (notification outbox) AND email (ports.EmailSender, nil-safe),
// always stating the full renewal figure (package + VAT + grossed-up
// Transaction fee, §4.1 — the same quote the charge path computes). Card
// subscriptions still auto-charge in the recurring sweep; these reminders are
// the heads-up — and for MoMo subscriptions, which cannot be silently
// auto-debited, they ARE the renewal path: the one-tap re-pay link points at
// the existing billing/onboarding flow. Dunning (past-due/grace) re-pay
// reminders stay in the recurring sweep, tied to the failed charge they follow.
//
// Idempotency: each (subscription, lead day, billing period) reminder is
// logged in subscription_reminders at most once (the period is pinned to the
// renewal timestamp), so daily sweeps never repeat a reminder; a new billing
// period re-arms every lead day. The email half rides the same log entry, so
// one lead day = one SMS + one email, never a drip.
//
//nolint:funlen,gocognit // one sweep must coordinate eligibility, both channels, and the shared delivery log consistently
func (s Service) RunSubscriptionReminderSweep(
	ctx context.Context,
	cmd RunSubscriptionReminderSweepCommand,
) (ports.AdminSubscriptionReminderSweepRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSubscriptionReminderSweepRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionReminderSweepRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionReminderSweepRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator renewal reminder sweep."
	}

	now := s.clock.Now()
	record := ports.AdminSubscriptionReminderSweepRecord{RanAt: now}
	subscriptions, err := s.businesses.ListAdminSubscriptions(ctx)
	if err != nil {
		return ports.AdminSubscriptionReminderSweepRecord{}, err
	}

	for _, subscription := range subscriptions {
		leadDay, due := renewalReminderLeadDayDue(subscription, now)
		if !due {
			continue
		}
		record.SubscriptionsEvaluated++

		enqueued, err := s.enqueueLeadDayReminder(ctx, subscription, leadDay)
		if err != nil {
			return ports.AdminSubscriptionReminderSweepRecord{}, err
		}
		if !enqueued {
			// Already sent for this (subscription, lead day, period): neither
			// channel fires again.
			continue
		}
		record.RemindersEnqueued++

		emailSent, err := s.sendLeadDayEmail(ctx, subscription, leadDay)
		if err != nil {
			// The email half is best-effort alongside the logged SMS half: a
			// Resend outage must not block other subscriptions or fail the run.
			// Counted and audited (warning) so a silent email gap is visible.
			record.EmailsFailed++
			continue
		}
		if emailSent {
			record.EmailsSent++
		}
	}

	severity := admindomain.AuditSeverityInfo
	if record.EmailsFailed > 0 {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Ran subscription renewal reminder sweep",
		TargetType:  "business_subscription",
		TargetID:    "renewal_reminder_sweep",
		TargetLabel: "Subscription renewal reminders",
		Summary: "Renewal reminder sweep enqueued " + strconv.Itoa(record.RemindersEnqueued) +
			" SMS reminders and sent " + strconv.Itoa(record.EmailsSent) +
			" emails (" + strconv.Itoa(record.EmailsFailed) + " email failures) across " +
			strconv.Itoa(record.SubscriptionsEvaluated) + " due subscriptions.",
		Severity: severity,
		Metadata: map[string]string{
			"subscriptions_evaluated": strconv.Itoa(record.SubscriptionsEvaluated),
			"reminders_enqueued":      strconv.Itoa(record.RemindersEnqueued),
			"emails_sent":             strconv.Itoa(record.EmailsSent),
			"emails_failed":           strconv.Itoa(record.EmailsFailed),
			"reason":                  reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionReminderSweepRecord{}, err
	}

	return record, nil
}

// renewalReminderLeadDayDue reports the §13.3 lead day whose reminder window is
// open for a subscription right now, if any. The window for lead day D opens D
// calendar days (UTC) before the renewal date and closes when the next smaller
// lead day's window opens — so exactly one lead day is "current" at any moment
// and a daily sweep fires each reminder once, on its day. A sweep day skipped
// by an outage catches up inside the still-open window rather than spamming
// every missed lead day at once; a window missed entirely stays missed (a
// stale "15 days before" reminder sent 6 days out is worse than none).
//
// Calendar-day comparison is what makes the on-date reminder fire ON the
// renewal date even when the sweep runs before the exact billing timestamp.
// Past-due rows (days left < 0) are the recurring sweep's dunning path, not
// this one's. Only recurring, paid (a cadence renewal figure exists),
// active/trialing subscriptions qualify — the same gate the old 3-day WhatsApp
// reminder used.
func renewalReminderLeadDayDue(subscription ports.AdminSubscriptionRecord, now time.Time) (int, bool) {
	if subscription.BillingMode != "recurring" ||
		cadenceRenewalMinor(subscription) <= 0 ||
		subscription.NextBillingAt == nil {
		return 0, false
	}
	switch subscription.Status {
	case "active", "trialing":
	default:
		return 0, false
	}
	daysLeft := calendarDaysBetween(now, *subscription.NextBillingAt)
	if daysLeft < 0 {
		return 0, false
	}
	for _, leadDay := range renewalReminderLeadDays {
		if daysLeft <= leadDay {
			return leadDay, true
		}
	}
	return 0, false
}

// calendarDaysBetween counts whole UTC calendar days from now's date to
// next's date: 0 on the same day, 15 exactly fifteen days before, negative
// once the renewal date has passed.
func calendarDaysBetween(now time.Time, next time.Time) int {
	now = now.UTC()
	next = next.UTC()
	nowDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	nextDay := time.Date(next.Year(), next.Month(), next.Day(), 0, 0, 0, 0, time.UTC)
	return int(nextDay.Sub(nowDay).Hours() / 24)
}

// enqueueLeadDayReminder writes the SMS half of one lead-day reminder to the
// notification outbox, idempotently. The period key pins the reminder to the
// billing period (the renewal timestamp) AND the lead day, so each of the four
// §13.3 reminders is logged once per period while the outbox dedup key derives
// from the same pair. It returns whether a new reminder was enqueued; a
// missing owner contact is a silent no-op (same rule as the past-due path).
func (s Service) enqueueLeadDayReminder(
	ctx context.Context,
	subscription ports.AdminSubscriptionRecord,
	leadDay int,
) (bool, error) {
	recipient := renewalReminderRecipient(subscription)
	if recipient == "" || subscription.SubscriptionID.IsZero() || subscription.NextBillingAt == nil {
		return false, nil
	}

	periodKey := strconv.FormatInt(subscription.NextBillingAt.UTC().Unix(), 10) +
		":lead" + strconv.Itoa(leadDay)
	reference := notification.SubscriptionReminderReference(subscription.SubscriptionID.String(), periodKey)

	result, err := s.businesses.EnqueueSubscriptionRenewalReminder(ctx, ports.EnqueueSubscriptionRenewalReminderInput{
		SubscriptionID: subscription.SubscriptionID,
		BusinessID:     subscription.BusinessID,
		Kind:           string(notification.KindSubscriptionRenewalUpcoming),
		PeriodKey:      periodKey,
		DedupKey:       notification.DedupKey(notification.KindSubscriptionRenewalUpcoming, reference),
		Channel:        string(notification.ChannelSMS),
		Recipient:      recipient,
		PlanName:       subscription.PlanName,
		// State the gross figure the renewal will actually charge (package +
		// VAT + Transaction fee, §4.1), so the reminded amount matches the
		// charge — §13.3: "always stating the amount".
		RenewalAmountMinor: s.subscriptionChargeTotal(ctx, cadenceRenewalMinor(subscription)),
		RenewalAt:          *subscription.NextBillingAt,
		RepayURL:           s.renewalRepayURL,
		LeadDay:            &leadDay,
	})
	if err != nil {
		return false, err
	}
	return result.Enqueued, nil
}

// sendLeadDayEmail delivers the email half of one lead-day reminder to the
// business owner's email address (business_users), reporting whether an email
// was actually sent. Nil-safe: with no email sender configured, or no owner
// email on record, it is a silent skip (false, nil) — the SMS half already
// went out and the run must not fail for it.
func (s Service) sendLeadDayEmail(
	ctx context.Context,
	subscription ports.AdminSubscriptionRecord,
	leadDay int,
) (bool, error) {
	if s.emails == nil {
		return false, nil
	}
	ownerEmail, err := normalizeEmail(subscription.OwnerEmail)
	if err != nil {
		return false, nil
	}
	amountMinor := s.subscriptionChargeTotal(ctx, cadenceRenewalMinor(subscription))
	when := fmt.Sprintf("in %d days", leadDay)
	if leadDay == 0 {
		when = "today"
	}
	amount := fmt.Sprintf("GHS %.2f", float64(amountMinor)/100)
	renewalDate := subscription.NextBillingAt.UTC().Format("2006-01-02")

	body := fmt.Sprintf(
		"Hello %s,\n\n"+
			"Your Xtiitch %s subscription renews %s (%s).\n"+
			"Amount due: %s (package + Tax fee + transaction fee).\n\n"+
			"Pay here to keep your paid features: %s\n\n"+
			"If your plan is set to auto-renew by card, this is a heads-up — no action is needed.\n",
		strings.TrimSpace(subscription.BusinessName),
		strings.TrimSpace(subscription.PlanName),
		when,
		renewalDate,
		amount,
		s.renewalRepayURL,
	)

	err = s.emails.Send(ctx, ports.EmailMessage{
		To:      ownerEmail,
		Subject: fmt.Sprintf("Your Xtiitch %s plan renews %s — %s due", strings.TrimSpace(subscription.PlanName), when, amount),
		Body:    body,
	})
	if err != nil {
		return false, err
	}
	return true, nil
}
