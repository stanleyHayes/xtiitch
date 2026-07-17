package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

func TestRunSubscriptionBillingSweepRequiresPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	businesses := &fakeAdminBusinesses{
		sweepResult: ports.AdminSubscriptionBillingSweepRecord{
			OverdueInvoicesFailed: 2,
			SubscriptionsCanceled: 1,
			BusinessesTouched:     2,
			RanAt:                 now,
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-sweep"},
	)

	record, err := service.RunSubscriptionBillingSweep(context.Background(), RunSubscriptionBillingSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		Reason:      " retry overdue links ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("run billing sweep: %v", err)
	}
	if businesses.sweepInput.ActorAdminUser != "operator-1" ||
		businesses.sweepInput.Reason != "retry overdue links" {
		t.Fatalf("expected normalized sweep input, got %+v", businesses.sweepInput)
	}
	if record.OverdueInvoicesFailed != 2 ||
		record.SubscriptionsCanceled != 1 ||
		record.BusinessesTouched != 2 {
		t.Fatalf("unexpected sweep record: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Ran subscription billing sweep" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["overdue_invoices_failed"] != "2" ||
		audits.created[0].Metadata["subscriptions_canceled"] != "1" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.RunSubscriptionBillingSweep(context.Background(), RunSubscriptionBillingSweepCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestRunSubscriptionRecurringSweepChargesDueSubscriptionsAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	futureBilling := now.Add(time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				OwnerEmail:              "owner@example.com",
				MonthlyFeeMinor:         12000, // display basis only; never charged
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   36000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				NextBillingAt:           &dueAt,
			},
			{
				SubscriptionID:        "subscription-2",
				BusinessID:            "business-2",
				BusinessName:          "Missing Auth",
				OwnerEmail:            "",
				MonthlyFeeMinor:       12000,
				BillingCadence:        "quarterly",
				QuarterlyRenewalMinor: 36000,
				Status:                "active",
				BillingMode:           "recurring",
				NextBillingAt:         &dueAt,
			},
			{
				SubscriptionID:          "subscription-3",
				BusinessID:              "business-3",
				BusinessName:            "Future Charge",
				OwnerEmail:              "future@example.com",
				MonthlyFeeMinor:         12000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_456",
				NextBillingAt:           &futureBilling,
			},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-recurring", "audit-recurring"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		Reason:      " collect recurring package fees ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	if record.DueSubscriptions != 2 ||
		record.ChargesAttempted != 1 ||
		record.ChargesPaid != 1 ||
		record.ChargesSkipped != 1 ||
		record.ChargesFailed != 0 ||
		record.ChargesPending != 0 {
		t.Fatalf("unexpected recurring sweep record: %+v", record)
	}
	if len(provider.charged) != 1 ||
		provider.charged[0].AuthorizationCode != "AUTH_123" ||
		provider.charged[0].CustomerEmail != "owner@example.com" ||
		provider.charged[0].AmountMinor != 36000 ||
		provider.charged[0].Reference != businesses.issuedSubscriptionInvoice.InvoiceRef {
		t.Fatalf("unexpected recurring charge input: %+v", provider.charged)
	}
	// Bills the cadence RENEWAL figure over the cadence's own length -- never the
	// monthly rate, which is a display basis only ("no monthly billing", Book §2).
	if businesses.issuedSubscriptionInvoice.BusinessID != "business-1" ||
		!businesses.issuedSubscriptionInvoice.DueAt.Equal(now.Add(72*time.Hour)) ||
		businesses.issuedSubscriptionInvoice.AmountMinor != 36000 ||
		businesses.issuedSubscriptionInvoice.PeriodMonths != 3 ||
		businesses.paidSubscriptionInvoice.InvoiceID != "invoice-recurring" {
		t.Fatalf("expected issued and paid invoice inputs, got issue=%+v paid=%+v",
			businesses.issuedSubscriptionInvoice, businesses.paidSubscriptionInvoice)
	}
	if len(audits.created) != 1 ||
		audits.created[0].Action != "Ran subscription recurring charge sweep" ||
		audits.created[0].Metadata["charges_paid"] != "1" ||
		audits.created[0].Metadata["charges_skipped"] != "1" {
		t.Fatalf("unexpected audit event: %+v", audits.created)
	}

	_, err = service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestRunSubscriptionRecurringSweepMarksProviderFailure(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				OwnerEmail:              "owner@example.com",
				MonthlyFeeMinor:         12000, // display basis only; never charged
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   36000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-recurring", "audit-recurring"},
	)
	service.payments = &fakePaymentProvider{
		chargeResult: ports.ChargeAuthorizationResult{Status: "failed"},
	}

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	if record.ChargesAttempted != 1 || record.ChargesFailed != 1 || record.ChargesPaid != 0 {
		t.Fatalf("unexpected recurring failure record: %+v", record)
	}
	if businesses.failedSubscriptionInvoice.InvoiceID != "invoice-recurring" ||
		businesses.failedSubscriptionInvoice.Reason != "Paystack recurring charge returned failed." {
		t.Fatalf("expected failed invoice input, got %+v", businesses.failedSubscriptionInvoice)
	}
}

func TestRunSubscriptionRecurringSweepBillsCadenceRenewalFigure(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Quarterly Threads",
				OwnerEmail:              "owner@example.com",
				MonthlyFeeMinor:         9900, // display basis only; must not be charged
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   29700,
				YearlyRenewalMinor:      118800,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_Q",
				NextBillingAt:           &dueAt,
			},
			{
				// Quarterly with a zero renewal figure (e.g. a free plan): the
				// cadence renewal guard must skip it entirely, just like the
				// legacy monthly_fee<=0 skip.
				SubscriptionID:          "subscription-2",
				BusinessID:              "business-2",
				BusinessName:            "Free Cadence",
				OwnerEmail:              "free@example.com",
				MonthlyFeeMinor:         9900,
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   0,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_FREE",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-recurring", "audit-recurring"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	// Only the funded quarterly subscription is due; the zero-renewal one is
	// skipped by the guard before it counts as due.
	if record.DueSubscriptions != 1 || record.ChargesAttempted != 1 || record.ChargesPaid != 1 {
		t.Fatalf("unexpected quarterly sweep record: %+v", record)
	}
	// The charge bills the quarterly RENEWAL figure, not the monthly fee.
	if len(provider.charged) != 1 ||
		provider.charged[0].AuthorizationCode != "AUTH_Q" ||
		provider.charged[0].AmountMinor != 29700 {
		t.Fatalf("expected a single 29700 quarterly charge, got %+v", provider.charged)
	}
	// The invoice records the same renewal amount and advances the period by 3
	// months (the cadence length), not 1.
	if businesses.issuedSubscriptionInvoice.BusinessID != "business-1" ||
		businesses.issuedSubscriptionInvoice.AmountMinor != 29700 ||
		businesses.issuedSubscriptionInvoice.PeriodMonths != 3 {
		t.Fatalf("expected quarterly renewal invoice (29700, 3 months), got %+v",
			businesses.issuedSubscriptionInvoice)
	}
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestRunSubscriptionRecurringSweepEnqueuesUpcomingReminderOnce(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	// Renewal is two days out — inside the three-day lead window but not yet due,
	// so the sweep enqueues an "upcoming renewal" reminder and attempts no charge.
	upcoming := now.Add(2 * 24 * time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				PlanName:                "Growth",
				OwnerEmail:              "owner@example.com",
				OwnerWhatsApp:           "233555000111",
				MonthlyFeeMinor:         12000, // display basis only; never charged
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   36000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				ProviderChannel:         "card",
				NextBillingAt:           &upcoming,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1", "audit-2", "audit-3", "audit-4"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	first, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep (first): %v", err)
	}
	// Not due yet: no charge attempted, exactly one reminder enqueued.
	if first.DueSubscriptions != 0 || first.ChargesAttempted != 0 || first.RemindersEnqueued != 1 {
		t.Fatalf("unexpected first sweep record: %+v", first)
	}
	if len(provider.charged) != 0 {
		t.Fatalf("expected no charge for an upcoming (not-yet-due) renewal, got %+v", provider.charged)
	}
	if len(businesses.renewalReminders) != 1 {
		t.Fatalf("expected one reminder enqueue attempt, got %d", len(businesses.renewalReminders))
	}
	reminder := businesses.renewalReminders[0]
	if reminder.Kind != string(notification.KindSubscriptionRenewalUpcoming) ||
		reminder.Channel != string(notification.ChannelWhatsApp) ||
		reminder.Recipient != "233555000111" ||
		reminder.RenewalAmountMinor != 36000 ||
		reminder.RepayURL != defaultRenewalRepayURL ||
		!reminder.RenewalAt.Equal(upcoming) {
		t.Fatalf("unexpected upcoming reminder input: %+v", reminder)
	}

	second, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep (second): %v", err)
	}
	// The same (subscription, period, kind) reminder must not be enqueued twice.
	if second.RemindersEnqueued != 0 {
		t.Fatalf("expected the reminder to be de-duplicated on the second sweep, got %+v", second)
	}
	if len(businesses.renewalReminders) != 2 ||
		businesses.renewalReminders[1].DedupKey != reminder.DedupKey {
		t.Fatalf("expected the second attempt to reuse the same dedup key, got %+v", businesses.renewalReminders)
	}
}

func TestRunSubscriptionRecurringSweepEnqueuesRepayReminderOnCardFailure(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				PlanName:                "Growth",
				OwnerEmail:              "owner@example.com",
				OwnerWhatsApp:           "233555000222",
				MonthlyFeeMinor:         12000, // display basis only; never charged
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   36000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				ProviderChannel:         "card",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-1", "audit-1", "audit-2"},
	)
	provider := &fakePaymentProvider{
		chargeResult: ports.ChargeAuthorizationResult{Status: "failed"},
	}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	// A card is still auto-charged; on failure a re-pay reminder is enqueued.
	if record.ChargesAttempted != 1 || record.ChargesFailed != 1 || record.RemindersEnqueued != 1 {
		t.Fatalf("unexpected card-failure sweep record: %+v", record)
	}
	if len(provider.charged) != 1 {
		t.Fatalf("expected the card to be charged once, got %+v", provider.charged)
	}
	if len(businesses.renewalReminders) != 1 {
		t.Fatalf("expected one re-pay reminder, got %d", len(businesses.renewalReminders))
	}
	reminder := businesses.renewalReminders[0]
	if reminder.Kind != string(notification.KindSubscriptionRenewalPastDue) ||
		reminder.Recipient != "233555000222" ||
		reminder.RenewalAmountMinor != 36000 ||
		reminder.RepayURL != defaultRenewalRepayURL {
		t.Fatalf("unexpected re-pay reminder input: %+v", reminder)
	}
}

func TestRunSubscriptionRecurringSweepMoMoIsReminderDrivenNotCharged(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Kofi Kente",
				PlanName:                "Growth",
				OwnerEmail:              "owner@example.com",
				OwnerWhatsApp:           "233555000333",
				MonthlyFeeMinor:         12000, // display basis only; never charged
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   36000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_MOMO",
				ProviderChannel:         "mobile_money",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1", "audit-2"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	// MoMo cannot be silently auto-debited: it is due and skipped for charging,
	// but a re-pay reminder is enqueued instead — never a failed-charge.
	if record.DueSubscriptions != 1 ||
		record.ChargesAttempted != 0 ||
		record.ChargesFailed != 0 ||
		record.ChargesSkipped != 1 ||
		record.RemindersEnqueued != 1 {
		t.Fatalf("unexpected MoMo sweep record: %+v", record)
	}
	if len(provider.charged) != 0 {
		t.Fatalf("MoMo must not be silently charged, got %+v", provider.charged)
	}
	if businesses.issuedSubscriptionInvoice.BusinessID != "" {
		t.Fatalf("MoMo must not issue a charge invoice, got %+v", businesses.issuedSubscriptionInvoice)
	}
	if len(businesses.renewalReminders) != 1 ||
		businesses.renewalReminders[0].Kind != string(notification.KindSubscriptionRenewalPastDue) ||
		businesses.renewalReminders[0].Recipient != "233555000333" {
		t.Fatalf("unexpected MoMo re-pay reminder: %+v", businesses.renewalReminders)
	}
}

// A subscription that never picked a cadence must not be billed. Before this,
// the helpers defaulted such a row to "charge the monthly fee, advance one
// month", so a recurring subscription predating the cadence column was billed
// monthly -- the one model the Pricing Book rules out. The row is skipped
// instead: we cannot know whether the owner wanted quarterly or yearly, and
// guessing bills a price they never agreed to.
func TestRunSubscriptionRecurringSweepNeverBillsASubscriptionWithNoCadence(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(-time.Minute)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Legacy Monthly",
				OwnerEmail:              "owner@example.com",
				MonthlyFeeMinor:         12000,
				BillingCadence:          "", // never chose one
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_LEGACY",
				NextBillingAt:           &dueAt,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-x", "audit-x"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	record, err := service.RunSubscriptionRecurringSweep(context.Background(), RunSubscriptionRecurringSweepCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run recurring sweep: %v", err)
	}
	if len(provider.charged) != 0 {
		t.Fatalf("expected no charge for a subscription with no cadence, got %+v", provider.charged)
	}
	if record.ChargesAttempted != 0 || record.DueSubscriptions != 0 {
		t.Fatalf("expected the subscription not to be due at all, got %+v", record)
	}
}

func TestCadenceRenewalMinorAndCadenceMonths(t *testing.T) {
	t.Parallel()

	base := ports.AdminSubscriptionRecord{
		MonthlyFeeMinor:       9900,
		QuarterlyRenewalMinor: 29700,
		YearlyRenewalMinor:    118800,
	}
	cases := []struct {
		cadence    string
		wantAmount int64
		wantMonths int
	}{
		{"quarterly", 29700, 3},
		{"yearly", 118800, 12},
		// The only two billable cadences. Anything else yields a zero renewal
		// figure -- the "do not charge" signal subscriptionDueForRecurringCharge
		// honours -- and a zero period, so such a row is skipped, never billed.
		//
		// These used to return the MONTHLY fee on a one-month period, which is
		// precisely the billing the Pricing Book rules out ("no monthly billing --
		// billed quarterly or yearly only", rule 1 / §2 / checklist #1). The
		// monthly rate is the display unit and the basis for calculating the
		// figures above; it is never itself charged.
		{"monthly", 0, 0},
		{"", 0, 0},
		{"weekly", 0, 0},
	}
	for _, tc := range cases {
		sub := base
		sub.BillingCadence = tc.cadence
		if got := cadenceRenewalMinor(sub); got != tc.wantAmount {
			t.Errorf("cadenceRenewalMinor(%q) = %d, want %d", tc.cadence, got, tc.wantAmount)
		}
		if got := cadenceMonths(tc.cadence); got != tc.wantMonths {
			t.Errorf("cadenceMonths(%q) = %d, want %d", tc.cadence, got, tc.wantMonths)
		}
	}
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestSubscriptionAuthorizationLifecycleRequiresPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	nextBilling := now.Add(30 * 24 * time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:  "subscription-1",
				BusinessID:      "business-1",
				BusinessName:    "Ama Stitches",
				Handle:          "ama-stitches",
				OwnerEmail:      "Owner <Owner@Example.COM>",
				PlanCode:        "growth",
				PlanName:        "Growth",
				MonthlyFeeMinor: 12000, // display basis only; never charged
				// An admin authorization link charges the cadence RENEWAL figure. A
				// subscription with no cadence has nothing to charge, so the link is
				// refused rather than falling back to the monthly rate.
				BillingCadence:        "quarterly",
				QuarterlyRenewalMinor: 36000,
				Status:                "active",
				BillingMode:           "payment_link",
				NextBillingAt:         &nextBilling,
				CurrentPeriodStart:    now,
				CurrentPeriodEnd:      nextBilling,
				UpdatedAt:             now,
			},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		// Init consumes an ID for the checkout reference then one for its audit;
		// verify consumes one for the paid invoice then one for its audit.
		[]common.ID{"ref-init", "audit-init", "invoice-1", "audit-verify"},
	)
	provider := &fakePaymentProvider{
		authorizationInitResult: ports.InitializeAuthorizationResult{
			RedirectURL: "https://paystack.test/authorize/ref_123",
			AccessCode:  "access_123",
			Reference:   "ref_123",
		},
		authorizationVerifyResult: ports.VerifyAuthorizationResult{
			Succeeded:         true,
			AmountMinor:       12000,
			AuthorizationCode: "AUTH_123",
			CustomerCode:      "CUS_123",
			CustomerEmail:     "owner@example.com",
			Channel:           "card",
			Bank:              "Test Bank",
			Active:            true,
		},
	}
	service.payments = provider

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		CallbackURL: " https://admin.xtiitch.com/admin?section=subscriptions ",
		Reason:      " start recurring collection ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("initialize subscription authorization: %v", err)
	}
	if provider.authorizationInitialized.BusinessID != "business-1" ||
		provider.authorizationInitialized.CustomerEmail != "owner@example.com" ||
		provider.authorizationInitialized.CallbackURL != "https://admin.xtiitch.com/admin?section=subscriptions" {
		t.Fatalf("expected normalized authorization init input, got %+v", provider.authorizationInitialized)
	}
	if link.RedirectURL != "https://paystack.test/authorize/ref_123" ||
		link.Reference != "ref_123" ||
		link.OwnerEmail != "owner@example.com" {
		t.Fatalf("unexpected authorization link result: %+v", link)
	}

	record, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Reference:   " ref_123 ",
		Reason:      " verified direct debit ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("verify subscription authorization: %v", err)
	}
	if provider.authorizationVerified.Reference != "ref_123" {
		t.Fatalf("expected trimmed verify reference, got %+v", provider.authorizationVerified)
	}
	if businesses.subscriptionUpdate.BillingMode != "recurring" ||
		businesses.subscriptionUpdate.ProviderCustomerRef != "CUS_123" ||
		businesses.subscriptionUpdate.ProviderSubscriptionRef != "AUTH_123" ||
		businesses.subscriptionUpdate.Reason != "verified direct debit" {
		t.Fatalf("expected recurring subscription update, got %+v", businesses.subscriptionUpdate)
	}
	if record.BusinessID != "business-1" || record.BillingMode != "recurring" {
		t.Fatalf("unexpected verified subscription record: %+v", record)
	}
	if len(audits.created) != 2 ||
		audits.created[0].Action != "Initialized subscription authorization" ||
		audits.created[0].Metadata["reference"] != "ref_123" ||
		audits.created[1].Action != "Verified subscription authorization" ||
		audits.created[1].Metadata["provider_authorization"] != "AUTH_123" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) RunAdminSubscriptionBillingSweep(
	_ context.Context,
	input ports.RunAdminSubscriptionBillingSweepInput,
) (ports.AdminSubscriptionBillingSweepRecord, error) {
	repo.sweepInput = input
	if !repo.sweepResult.RanAt.IsZero() {
		return repo.sweepResult, nil
	}
	return ports.AdminSubscriptionBillingSweepRecord{
		RanAt: time.Now(),
	}, nil
}

// EnqueueSubscriptionRenewalReminder records the reminder input and dedupes on
// the caller-supplied dedup key, mirroring the outbox unique index so tests can
// assert a reminder is enqueued at most once per (subscription, period, kind).
func (repo *fakeAdminBusinesses) EnqueueSubscriptionRenewalReminder(
	_ context.Context,
	input ports.EnqueueSubscriptionRenewalReminderInput,
) (ports.SubscriptionRenewalReminderResult, error) {
	repo.renewalReminders = append(repo.renewalReminders, input)
	if repo.renewalReminderSeen == nil {
		repo.renewalReminderSeen = map[string]bool{}
	}
	if repo.renewalReminderSeen[input.DedupKey] {
		return ports.SubscriptionRenewalReminderResult{Enqueued: false}, nil
	}
	repo.renewalReminderSeen[input.DedupKey] = true
	return ports.SubscriptionRenewalReminderResult{Enqueued: true}, nil
}

type fakePaymentProvider struct {
	initialized               ports.InitializeTransactionInput
	authorizationInitialized  ports.InitializeAuthorizationInput
	authorizationInitResult   ports.InitializeAuthorizationResult
	authorizationInitErr      error
	authorizationVerified     ports.VerifyAuthorizationInput
	authorizationVerifyResult ports.VerifyAuthorizationResult
	authorizationVerifyErr    error
	charged                   []ports.ChargeAuthorizationInput
	chargeResult              ports.ChargeAuthorizationResult
	chargeErr                 error
}

func (fakePaymentProvider) CreateBusinessSubaccount(
	context.Context,
	ports.CreateBusinessSubaccountInput,
) (ports.CreateBusinessSubaccountResult, error) {
	return ports.CreateBusinessSubaccountResult{}, nil
}

func (fakePaymentProvider) UpdateBusinessSubaccount(context.Context, ports.UpdateBusinessSubaccountInput) error {
	return nil
}

func (provider *fakePaymentProvider) InitializeTransaction(
	_ context.Context,
	input ports.InitializeTransactionInput,
) (ports.InitializeTransactionResult, error) {
	provider.initialized = input
	return ports.InitializeTransactionResult{
		AuthorizationURL:  "https://paystack.test/" + input.Reference,
		ProviderReference: "PAY_" + input.Reference,
	}, nil
}

func (provider *fakePaymentProvider) InitializeAuthorization(
	_ context.Context,
	input ports.InitializeAuthorizationInput,
) (ports.InitializeAuthorizationResult, error) {
	provider.authorizationInitialized = input
	if provider.authorizationInitErr != nil {
		return ports.InitializeAuthorizationResult{}, provider.authorizationInitErr
	}
	if provider.authorizationInitResult.RedirectURL != "" ||
		provider.authorizationInitResult.Reference != "" {
		return provider.authorizationInitResult, nil
	}
	return ports.InitializeAuthorizationResult{
		RedirectURL: "https://paystack.test/authorize/" + input.BusinessID.String(),
		AccessCode:  "access_" + input.BusinessID.String(),
		Reference:   "auth_ref_" + input.BusinessID.String(),
	}, nil
}

func (provider *fakePaymentProvider) VerifyAuthorization(
	_ context.Context,
	input ports.VerifyAuthorizationInput,
) (ports.VerifyAuthorizationResult, error) {
	provider.authorizationVerified = input
	if provider.authorizationVerifyErr != nil {
		return ports.VerifyAuthorizationResult{}, provider.authorizationVerifyErr
	}
	if provider.authorizationVerifyResult.AuthorizationCode != "" ||
		provider.authorizationVerifyResult.CustomerCode != "" {
		return provider.authorizationVerifyResult, nil
	}
	return ports.VerifyAuthorizationResult{
		AuthorizationCode: "AUTH_" + input.Reference,
		CustomerCode:      "CUS_" + input.Reference,
		CustomerEmail:     "owner@example.com",
		Channel:           "direct_debit",
		Bank:              "Test Bank",
		Active:            true,
	}, nil
}

func (provider *fakePaymentProvider) ChargeAuthorization(
	_ context.Context,
	input ports.ChargeAuthorizationInput,
) (ports.ChargeAuthorizationResult, error) {
	provider.charged = append(provider.charged, input)
	if provider.chargeErr != nil {
		return ports.ChargeAuthorizationResult{}, provider.chargeErr
	}
	if provider.chargeResult.Status != "" || provider.chargeResult.ProviderReference != "" {
		return provider.chargeResult, nil
	}
	return ports.ChargeAuthorizationResult{
		ProviderReference: input.Reference,
		Status:            "success",
		AmountMinor:       input.AmountMinor,
		Currency:          input.Currency,
	}, nil
}

func (fakePaymentProvider) VerifyWebhookSignature([]byte, string) bool {
	return true
}

func (fakePaymentProvider) ParseChargeEvent([]byte) (ports.ProviderChargeEvent, error) {
	return ports.ProviderChargeEvent{}, nil
}
