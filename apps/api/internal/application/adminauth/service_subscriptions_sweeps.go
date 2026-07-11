package adminauth

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

type RunSubscriptionBillingSweepCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Reason      string
	UserAgent   string
	IPAddress   string
}

type RunSubscriptionRecurringSweepCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Reason      string
	UserAgent   string
	IPAddress   string
}

type InitializeSubscriptionAuthorizationCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	CallbackURL string
	Reason      string
	UserAgent   string
	IPAddress   string
}

type SubscriptionAuthorizationLinkResult struct {
	BusinessID   common.ID
	BusinessName string
	OwnerEmail   string
	RedirectURL  string
	AccessCode   string
	Reference    string
}

type VerifySubscriptionAuthorizationCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	Reference   string
	Reason      string
	UserAgent   string
	IPAddress   string
}

func (s Service) RunSubscriptionBillingSweep(
	ctx context.Context,
	cmd RunSubscriptionBillingSweepCommand,
) (ports.AdminSubscriptionBillingSweepRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSubscriptionBillingSweepRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator billing sweep."
	}

	record, err := s.businesses.RunAdminSubscriptionBillingSweep(ctx, ports.RunAdminSubscriptionBillingSweepInput{
		ActorAdminUser: cmd.ActorUserID,
		Reason:         reason,
	})
	if err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	severity := admindomain.AuditSeverityInfo
	if record.OverdueInvoicesFailed > 0 || record.SubscriptionsCanceled > 0 {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Ran subscription billing sweep",
		TargetType:  "business_subscription",
		TargetID:    "billing_sweep",
		TargetLabel: "Subscription billing sweep",
		Summary: "Billing sweep failed " + strconv.Itoa(record.OverdueInvoicesFailed) +
			" overdue invoices and canceled " + strconv.Itoa(record.SubscriptionsCanceled) +
			" expired grace subscriptions.",
		Severity: severity,
		Metadata: map[string]string{
			"overdue_invoices_failed": strconv.Itoa(record.OverdueInvoicesFailed),
			"subscriptions_canceled":  strconv.Itoa(record.SubscriptionsCanceled),
			"businesses_touched":      strconv.Itoa(record.BusinessesTouched),
			"reason":                  reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionBillingSweepRecord{}, err
	}

	return record, nil
}

func (s Service) InitializeSubscriptionAuthorization(
	ctx context.Context,
	cmd InitializeSubscriptionAuthorizationCommand,
) (SubscriptionAuthorizationLinkResult, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return SubscriptionAuthorizationLinkResult{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return SubscriptionAuthorizationLinkResult{}, err
	}
	if s.businesses == nil || s.payments == nil {
		return SubscriptionAuthorizationLinkResult{}, authdomain.ErrForbidden
	}

	callbackURL, err := normalizePaymentURL(cmd.CallbackURL)
	if err != nil {
		return SubscriptionAuthorizationLinkResult{}, err
	}
	subscription, err := s.adminSubscriptionByBusiness(ctx, cmd.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationLinkResult{}, err
	}
	if subscription.MonthlyFeeMinor <= 0 || subscription.Status == "canceled" {
		return SubscriptionAuthorizationLinkResult{}, authdomain.ErrInvalidInput
	}
	ownerEmail, err := normalizeEmail(subscription.OwnerEmail)
	if err != nil {
		return SubscriptionAuthorizationLinkResult{}, authdomain.ErrInvalidInput
	}

	// Charge the cadence RENEWAL figure at a STANDARD Paystack checkout (the old
	// direct-debit mandate link is dead for this account). The business pays this
	// period now; a card also yields a reusable authorization the recurring sweep
	// charges thereafter (mobile money yields none — the sweep sends re-pay
	// reminders). VAT is applied once so the checkout amount matches the invoice
	// booked on verify, mirroring the recurring sweep.
	amountMinor := money.ApplyVAT(cadenceRenewalMinor(subscription), s.vatRateBps, s.vatInclusive).GrossMinor
	if amountMinor <= 0 {
		return SubscriptionAuthorizationLinkResult{}, authdomain.ErrInvalidInput
	}
	reference := "xtsubadm_" + s.ids.NewID().String()
	result, err := s.payments.InitializeAuthorization(ctx, ports.InitializeAuthorizationInput{
		BusinessID:    subscription.BusinessID,
		CustomerEmail: ownerEmail,
		CallbackURL:   callbackURL,
		AmountMinor:   amountMinor,
		Currency:      "GHS",
		Reference:     reference,
	})
	if err != nil {
		return SubscriptionAuthorizationLinkResult{}, err
	}
	if result.RedirectURL == "" || result.Reference == "" {
		return SubscriptionAuthorizationLinkResult{}, authdomain.ErrInvalidInput
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Initialized Paystack recurring authorization."
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Initialized subscription authorization",
		TargetType:  "business_subscription",
		TargetID:    subscription.BusinessID.String(),
		TargetLabel: subscription.BusinessName,
		Summary:     "Initialized a Paystack recurring authorization link for " + subscription.BusinessName + ".",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"business_id":  subscription.BusinessID.String(),
			"owner_email":  ownerEmail,
			"reference":    result.Reference,
			"callback_url": callbackURL,
			"reason":       reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return SubscriptionAuthorizationLinkResult{}, err
	}

	return SubscriptionAuthorizationLinkResult{
		BusinessID:   subscription.BusinessID,
		BusinessName: subscription.BusinessName,
		OwnerEmail:   ownerEmail,
		RedirectURL:  result.RedirectURL,
		AccessCode:   result.AccessCode,
		Reference:    result.Reference,
	}, nil
}

func (s Service) VerifySubscriptionAuthorization(
	ctx context.Context,
	cmd VerifySubscriptionAuthorizationCommand,
) (ports.AdminSubscriptionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if s.businesses == nil || s.payments == nil {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrForbidden
	}
	reference := strings.TrimSpace(cmd.Reference)
	if reference == "" || len([]rune(reference)) > 160 || strings.ContainsAny(reference, " \t\r\n") {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}

	subscription, err := s.adminSubscriptionByBusiness(ctx, cmd.BusinessID)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	if subscription.MonthlyFeeMinor <= 0 || subscription.Status == "canceled" {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	result, err := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: reference})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	// The standard checkout already PAID this period; confirm it succeeded (a card
	// yields a reusable authorization for the sweep, mobile money yields none) and
	// never re-charge here (that would double-bill).
	if !result.Succeeded {
		return ports.AdminSubscriptionRecord{}, authdomain.ErrInvalidInput
	}
	customerRef := strings.TrimSpace(result.CustomerCode)
	authRef := strings.TrimSpace(result.AuthorizationCode)

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Verified Paystack recurring authorization."
	}

	// Book the period the checkout paid for as a PAID invoice so the recurring sweep
	// advances from HERE (never re-charging the just-paid period). The amount and
	// period length come from the same cadence source as the checkout and the sweep.
	// If an invoice is already open for this period (a prior verify/sweep), leave it
	// and only (re)capture the authorization — the operator-driven verify is not a
	// retrying webhook, so this stays effectively idempotent.
	amountMinor := money.ApplyVAT(cadenceRenewalMinor(subscription), s.vatRateBps, s.vatInclusive).GrossMinor
	invoiceID := s.ids.NewID()
	// DETERMINISTIC invoice_ref keyed to the checkout reference so a replayed verify
	// (refresh / double-click / callback + manual verify) collides on the invoice_ref
	// unique constraint and is caught below as "already booked" — never a second
	// invoice + a second period advance for one payment.
	invoiceRef := "xtsubadm_inv_" + reference
	_, issueErr := s.businesses.IssueAdminSubscriptionInvoice(ctx, ports.IssueAdminSubscriptionInvoiceInput{
		InvoiceID:          invoiceID,
		BusinessID:         subscription.BusinessID,
		InvoiceRef:         invoiceRef,
		ProviderInvoiceRef: reference,
		DueAt:              s.clock.Now().Add(72 * time.Hour),
		ActorAdminUser:     cmd.ActorUserID,
		Reason:             reason,
		AmountMinor:        amountMinor,
		PeriodMonths:       cadenceMonths(subscription.BillingCadence),
	})
	switch {
	case errors.Is(issueErr, ports.ErrSubscriptionInvoiceOpen), errors.Is(issueErr, ports.ErrSubscriptionBillingUnavailable):
		// Already booked for this period; skip to (re)capturing the authorization.
	case issueErr != nil:
		return ports.AdminSubscriptionRecord{}, issueErr
	default:
		if _, err := s.businesses.MarkAdminSubscriptionInvoicePaid(ctx, ports.MarkAdminSubscriptionInvoicePaidInput{
			InvoiceID:      invoiceID,
			ActorAdminUser: cmd.ActorUserID,
			Reason:         "Paid at Paystack checkout.",
		}); err != nil {
			return ports.AdminSubscriptionRecord{}, err
		}
	}

	record, err := s.businesses.UpdateAdminSubscription(ctx, ports.UpdateAdminSubscriptionInput{
		BusinessID:              subscription.BusinessID,
		Status:                  subscription.Status,
		BillingMode:             "recurring",
		ProviderCustomerRef:     customerRef,
		ProviderSubscriptionRef: authRef,
		// Persist the authorization channel so the recurring sweep knows whether it
		// can silently auto-charge (card) or must fall back to a re-pay reminder
		// (mobile money, which cannot be silently debited).
		ProviderChannel: normalizeAuthorizationChannel(result.Channel),
		Reason:          reason,
		ActorAdminUser:  cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Verified subscription authorization",
		TargetType:  "business_subscription",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     "Verified and stored a Paystack recurring authorization for " + record.BusinessName + ".",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"business_id":             record.BusinessID.String(),
			"reference":               reference,
			"provider_customer_ref":   strings.TrimSpace(result.CustomerCode),
			"provider_authorization":  strings.TrimSpace(result.AuthorizationCode),
			"provider_customer_email": strings.TrimSpace(result.CustomerEmail),
			"channel":                 strings.TrimSpace(result.Channel),
			"bank":                    strings.TrimSpace(result.Bank),
			"reason":                  reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}

	return record, nil
}

func (s Service) RunSubscriptionRecurringSweep(
	ctx context.Context,
	cmd RunSubscriptionRecurringSweepCommand,
) (ports.AdminSubscriptionRecurringSweepRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSubscriptionRecurringSweepRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionRecurringSweepRecord{}, err
	}
	if s.businesses == nil || s.payments == nil {
		return ports.AdminSubscriptionRecurringSweepRecord{}, authdomain.ErrForbidden
	}

	// Apply any downgrades scheduled to take effect at the end of the paid period
	// before charging renewals, so a downgraded subscription bills the new (lower)
	// plan this cycle and its entitlements move at the period boundary. Idempotent;
	// safe to run every sweep.
	if s.planChanges != nil {
		if _, err := s.planChanges.ApplyDuePlanChanges(ctx); err != nil {
			return ports.AdminSubscriptionRecurringSweepRecord{}, err
		}
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator recurring charge sweep."
	}

	now := s.clock.Now()
	record := ports.AdminSubscriptionRecurringSweepRecord{RanAt: now}
	subscriptions, err := s.businesses.ListAdminSubscriptions(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecurringSweepRecord{}, err
	}

	for _, subscription := range subscriptions {
		// (a) Upcoming-renewal reminder: renewalReminderLeadDays before
		// next_billing_at, before it is due. Card and MoMo subscriptions both get
		// it — a card still auto-charges below, but the heads-up "tap to pay" nudge
		// is harmless and de-duplicated per billing period.
		if subscriptionUpcomingReminderDue(subscription, now, renewalReminderLeadDays) {
			if err := s.emitRenewalReminder(ctx, subscription, notification.KindSubscriptionRenewalUpcoming, nil, &record); err != nil {
				return ports.AdminSubscriptionRecurringSweepRecord{}, err
			}
		}

		if !subscriptionDueForRecurringCharge(subscription, now) {
			continue
		}
		record.DueSubscriptions++

		// MoMo authorizations usually cannot be silently auto-debited, so a due
		// MoMo subscription is reminder-driven: enqueue a re-pay reminder instead
		// of attempting a silent charge that would only fail and spam. The business
		// re-pays via the billing/onboarding flow, which advances the period.
		if subscriptionUsesMoMo(subscription) {
			record.ChargesSkipped++
			if err := s.emitRenewalReminder(ctx, subscription, notification.KindSubscriptionRenewalPastDue, subscription.GraceEndsAt, &record); err != nil {
				return ports.AdminSubscriptionRecurringSweepRecord{}, err
			}
			continue
		}

		if !subscriptionRecurringChargeReady(subscription) {
			record.ChargesSkipped++
			continue
		}

		// Both the amount charged and the period the invoice covers are chosen
		// by the subscription's cadence in one place (cadenceRenewalMinor /
		// cadenceMonths) so the ChargeAuthorization amount and the SUCCESS-path
		// period advance always agree. VAT is applied once here (rate 0 / inclusive
		// leaves it unchanged) so the issued invoice and the charge match, mirroring
		// the activation path in auth.Service.
		amountMinor := money.ApplyVAT(cadenceRenewalMinor(subscription), s.vatRateBps, s.vatInclusive).GrossMinor
		periodMonths := cadenceMonths(subscription.BillingCadence)

		invoiceID := s.ids.NewID()
		invoiceRef := subscriptionInvoiceRef(invoiceID)
		_, err := s.businesses.IssueAdminSubscriptionInvoice(ctx, ports.IssueAdminSubscriptionInvoiceInput{
			InvoiceID:          invoiceID,
			BusinessID:         subscription.BusinessID,
			InvoiceRef:         invoiceRef,
			ProviderInvoiceRef: invoiceRef,
			DueAt:              now.Add(72 * time.Hour),
			ActorAdminUser:     cmd.ActorUserID,
			Reason:             reason,
			AmountMinor:        amountMinor,
			PeriodMonths:       periodMonths,
		})
		if errors.Is(err, ports.ErrSubscriptionInvoiceOpen) ||
			errors.Is(err, ports.ErrSubscriptionBillingUnavailable) {
			record.ChargesSkipped++
			continue
		}
		if err != nil {
			return ports.AdminSubscriptionRecurringSweepRecord{}, err
		}

		record.ChargesAttempted++
		charge, err := s.payments.ChargeAuthorization(ctx, ports.ChargeAuthorizationInput{
			BusinessID:        subscription.BusinessID,
			AuthorizationCode: subscription.ProviderSubscriptionRef,
			CustomerEmail:     subscription.OwnerEmail,
			AmountMinor:       amountMinor,
			Currency:          "GHS",
			Reference:         invoiceRef,
		})
		if err != nil {
			// A transport/timeout error is AMBIGUOUS — Paystack may have already
			// debited the card. Verify the invoice reference before deciding: if the
			// charge actually succeeded, mark it PAID so the next sweep cycle cannot
			// issue a fresh invoice and charge the card a second time. Only when the
			// verify is reachable and confirms the money did NOT move do we mark it
			// failed (the previous, double-charge-prone behaviour).
			if verify, verifyErr := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: invoiceRef}); verifyErr == nil && verify.Succeeded {
				if _, markErr := s.businesses.MarkAdminSubscriptionInvoicePaid(ctx, ports.MarkAdminSubscriptionInvoicePaidInput{
					InvoiceID:      invoiceID,
					ActorAdminUser: cmd.ActorUserID,
					Reason:         "Recovered a timed-out recurring charge that had actually succeeded.",
				}); markErr != nil {
					return ports.AdminSubscriptionRecurringSweepRecord{}, markErr
				}
				record.ChargesPaid++
				continue
			}
			failed, markErr := s.businesses.MarkAdminSubscriptionInvoiceFailed(ctx, ports.MarkAdminSubscriptionInvoiceFailedInput{
				InvoiceID:      invoiceID,
				ActorAdminUser: cmd.ActorUserID,
				Reason:         recurringChargeFailureReason(err.Error()),
			})
			if markErr != nil {
				return ports.AdminSubscriptionRecurringSweepRecord{}, markErr
			}
			record.ChargesFailed++
			// (b) The card charge failed and the subscription is now past due / in
			// grace: remind the business to re-pay before the grace window ends.
			if err := s.emitRenewalReminder(ctx, subscription, notification.KindSubscriptionRenewalPastDue, failed.GraceEndsAt, &record); err != nil {
				return ports.AdminSubscriptionRecurringSweepRecord{}, err
			}
			continue
		}

		switch normalizeProviderChargeStatus(charge.Status) {
		case "success":
			if _, err := s.businesses.MarkAdminSubscriptionInvoicePaid(ctx, ports.MarkAdminSubscriptionInvoicePaidInput{
				InvoiceID:      invoiceID,
				ActorAdminUser: cmd.ActorUserID,
				Reason:         "Paystack recurring charge succeeded.",
			}); err != nil {
				return ports.AdminSubscriptionRecurringSweepRecord{}, err
			}
			record.ChargesPaid++
		case "pending":
			record.ChargesPending++
		default:
			failed, err := s.businesses.MarkAdminSubscriptionInvoiceFailed(ctx, ports.MarkAdminSubscriptionInvoiceFailedInput{
				InvoiceID:      invoiceID,
				ActorAdminUser: cmd.ActorUserID,
				Reason:         "Paystack recurring charge returned " + normalizeProviderChargeStatus(charge.Status) + ".",
			})
			if err != nil {
				return ports.AdminSubscriptionRecurringSweepRecord{}, err
			}
			record.ChargesFailed++
			// (b) A non-success provider status is also a failed renewal: remind the
			// business to re-pay before the grace window ends.
			if err := s.emitRenewalReminder(ctx, subscription, notification.KindSubscriptionRenewalPastDue, failed.GraceEndsAt, &record); err != nil {
				return ports.AdminSubscriptionRecurringSweepRecord{}, err
			}
		}
	}

	severity := admindomain.AuditSeverityInfo
	if record.ChargesFailed > 0 || record.ChargesSkipped > 0 {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Ran subscription recurring charge sweep",
		TargetType:  "business_subscription",
		TargetID:    "recurring_charge_sweep",
		TargetLabel: "Subscription recurring charges",
		Summary: "Recurring charge sweep attempted " + strconv.Itoa(record.ChargesAttempted) +
			" charges, paid " + strconv.Itoa(record.ChargesPaid) +
			", left " + strconv.Itoa(record.ChargesPending) +
			" pending, failed " + strconv.Itoa(record.ChargesFailed) +
			", skipped " + strconv.Itoa(record.ChargesSkipped) +
			", and enqueued " + strconv.Itoa(record.RemindersEnqueued) + " renewal reminders.",
		Severity: severity,
		Metadata: map[string]string{
			"due_subscriptions":  strconv.Itoa(record.DueSubscriptions),
			"charges_attempted":  strconv.Itoa(record.ChargesAttempted),
			"charges_paid":       strconv.Itoa(record.ChargesPaid),
			"charges_pending":    strconv.Itoa(record.ChargesPending),
			"charges_failed":     strconv.Itoa(record.ChargesFailed),
			"charges_skipped":    strconv.Itoa(record.ChargesSkipped),
			"reminders_enqueued": strconv.Itoa(record.RemindersEnqueued),
			"reason":             reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionRecurringSweepRecord{}, err
	}

	return record, nil
}

// normalizeAuthorizationChannel lower-cases and trims a Paystack authorization
// channel ('card', 'mobile_money', 'bank', …) for stable comparison.
func normalizeAuthorizationChannel(channel string) string {
	return strings.ToLower(strings.TrimSpace(channel))
}

// enqueueRenewalReminder builds the idempotency key for one (subscription,
// period, kind) reminder and enqueues it to the notification outbox via the
// repository. The period is pinned to the renewal timestamp (upcoming) or the
// grace-window end (past due) so repeated sweeps within a cycle dedupe. It
// returns whether a new reminder was enqueued; a missing owner contact or
// billing date is a silent no-op.
func (s Service) enqueueRenewalReminder(
	ctx context.Context,
	subscription ports.AdminSubscriptionRecord,
	kind notification.Kind,
	graceEndsAt *time.Time,
) (bool, error) {
	recipient := renewalReminderRecipient(subscription)
	if recipient == "" || subscription.SubscriptionID.IsZero() || subscription.NextBillingAt == nil {
		return false, nil
	}

	periodTime := *subscription.NextBillingAt
	if kind == notification.KindSubscriptionRenewalPastDue && graceEndsAt != nil {
		periodTime = *graceEndsAt
	}
	periodKey := strconv.FormatInt(periodTime.UTC().Unix(), 10)
	reference := notification.SubscriptionReminderReference(subscription.SubscriptionID.String(), periodKey)

	result, err := s.businesses.EnqueueSubscriptionRenewalReminder(ctx, ports.EnqueueSubscriptionRenewalReminderInput{
		SubscriptionID: subscription.SubscriptionID,
		BusinessID:     subscription.BusinessID,
		Kind:           string(kind),
		PeriodKey:      periodKey,
		DedupKey:       notification.DedupKey(kind, reference),
		Channel:        string(notification.ChannelWhatsApp),
		Recipient:      recipient,
		PlanName:       subscription.PlanName,
		// Show the gross (VAT-inclusive) figure the sweep will actually charge, so
		// the "tap to pay" amount matches the charge. Rate 0 leaves it unchanged.
		RenewalAmountMinor: money.ApplyVAT(cadenceRenewalMinor(subscription), s.vatRateBps, s.vatInclusive).GrossMinor,
		RenewalAt:          *subscription.NextBillingAt,
		GraceEndsAt:        graceEndsAt,
		RepayURL:           s.renewalRepayURL,
	})
	if err != nil {
		return false, err
	}
	return result.Enqueued, nil
}
