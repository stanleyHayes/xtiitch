package adminauth

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

type fakeReminderEmailSender struct {
	sent []ports.EmailMessage
	err  error
}

func (sender *fakeReminderEmailSender) Send(_ context.Context, message ports.EmailMessage) error {
	if sender.err != nil {
		return sender.err
	}
	sender.sent = append(sender.sent, message)
	return nil
}

// §13.3: "Send at 15, 7 and 3 days before, and on the renewal date." The
// window for lead day D opens D calendar days (UTC) before the renewal date
// and closes when the next smaller lead day's window opens, so a daily sweep
// fires each reminder exactly once, on its day — and the on-date reminder
// fires on the renewal date itself, never before.
func TestRenewalReminderLeadDayDue(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		daysUntilRenewal int
		wantLeadDay      int
		wantDue          bool
	}{
		{16, 0, false}, // too far out: no window open yet
		{15, 15, true}, // the 15-day window opens
		{14, 15, true}, // still the current window (catch-up inside it)
		{8, 15, true},
		{7, 7, true}, // the 7-day window takes over
		{5, 7, true},
		{3, 3, true},
		{1, 3, true},
		{0, 0, true},   // the renewal date itself
		{-1, 0, false}, // past due: the dunning path's job, not this sweep's
	}
	for _, tc := range cases {
		next := now.Add(time.Duration(tc.daysUntilRenewal) * 24 * time.Hour)
		subscription := ports.AdminSubscriptionRecord{
			BillingMode:           "recurring",
			BillingCadence:        "quarterly",
			QuarterlyRenewalMinor: 36000,
			Status:                "active",
			NextBillingAt:         &next,
		}
		leadDay, due := renewalReminderLeadDayDue(subscription, now)
		if due != tc.wantDue || leadDay != tc.wantLeadDay {
			t.Errorf("daysUntilRenewal=%d: got (leadDay=%d, due=%v), want (%d, %v)",
				tc.daysUntilRenewal, leadDay, due, tc.wantLeadDay, tc.wantDue)
		}
	}

	// The on-date reminder fires on the renewal DATE even when the exact
	// billing timestamp is still ahead of the sweep time that day.
	sameDayLater := time.Date(2026, 6, 17, 23, 30, 0, 0, time.UTC)
	subscription := ports.AdminSubscriptionRecord{
		BillingMode:        "recurring",
		BillingCadence:     "yearly",
		YearlyRenewalMinor: 118800,
		Status:             "trialing",
		NextBillingAt:      &sameDayLater,
	}
	if leadDay, due := renewalReminderLeadDayDue(subscription, now); !due || leadDay != 0 {
		t.Fatalf("on-date reminder must fire on the renewal date, got (leadDay=%d, due=%v)", leadDay, due)
	}

	// Non-recurring / free (no cadence figure) / canceled rows never remind.
	inactive := ports.AdminSubscriptionRecord{
		BillingMode:           "manual",
		BillingCadence:        "quarterly",
		QuarterlyRenewalMinor: 36000,
		Status:                "active",
		NextBillingAt:         &sameDayLater,
	}
	if _, due := renewalReminderLeadDayDue(inactive, now); due {
		t.Fatal("a manual-billing subscription must not get an auto reminder")
	}
}

//nolint:funlen // table of assertions across both reminder channels
func TestRunSubscriptionReminderSweepSendsSMSAndEmailOnce(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	renewal := now.Add(7 * 24 * time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Ama Stitches",
				PlanName:                "Growth",
				OwnerEmail:              "owner@example.com",
				OwnerPhone:              "233555000111",
				MonthlyFeeMinor:         12000, // display basis only; never the renewal figure
				BillingCadence:          "quarterly",
				QuarterlyRenewalMinor:   36000,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_123",
				ProviderChannel:         "card",
				NextBillingAt:           &renewal,
			},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1", "audit-2"},
	)
	emails := &fakeReminderEmailSender{}
	service.emails = emails

	first, err := service.RunSubscriptionReminderSweep(context.Background(), RunSubscriptionReminderSweepCommand{
		ActorUserID: SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("run reminder sweep (first): %v", err)
	}
	if first.SubscriptionsEvaluated != 1 || first.RemindersEnqueued != 1 || first.EmailsSent != 1 || first.EmailsFailed != 0 {
		t.Fatalf("unexpected first sweep record: %+v", first)
	}

	// The SMS half: one outbox row, SMS channel, the upcoming kind, the lead
	// day pinned, ALWAYS stating the full renewal figure (package + VAT +
	// transaction fee) and the one-tap re-pay link.
	if len(businesses.renewalReminders) != 1 {
		t.Fatalf("expected one reminder enqueue attempt, got %d", len(businesses.renewalReminders))
	}
	reminder := businesses.renewalReminders[0]
	if reminder.Kind != string(notification.KindSubscriptionRenewalUpcoming) ||
		reminder.Channel != string(notification.ChannelSMS) ||
		reminder.Recipient != "233555000111" ||
		reminder.RenewalAmountMinor != 36716 ||
		reminder.RepayURL != defaultRenewalRepayURL ||
		reminder.LeadDay == nil || *reminder.LeadDay != 7 ||
		!strings.Contains(reminder.PeriodKey, ":lead7") ||
		!reminder.RenewalAt.Equal(renewal) {
		t.Fatalf("unexpected lead-day reminder input: %+v", reminder)
	}

	// The email half: to the owner's email, amount stated in subject AND body.
	if len(emails.sent) != 1 {
		t.Fatalf("expected one reminder email, got %d", len(emails.sent))
	}
	email := emails.sent[0]
	if email.To != "owner@example.com" ||
		!strings.Contains(email.Subject, "GHS 367.16") ||
		!strings.Contains(email.Subject, "in 7 days") ||
		!strings.Contains(email.Body, "Ama Stitches") ||
		!strings.Contains(email.Body, "GHS 367.16") ||
		!strings.Contains(email.Body, defaultRenewalRepayURL) {
		t.Fatalf("unexpected reminder email: %+v", email)
	}

	// Second sweep the same day: the (subscription, lead day, period) log
	// dedupes — neither channel fires again.
	second, err := service.RunSubscriptionReminderSweep(context.Background(), RunSubscriptionReminderSweepCommand{
		ActorUserID: SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("run reminder sweep (second): %v", err)
	}
	if second.RemindersEnqueued != 0 || second.EmailsSent != 0 {
		t.Fatalf("expected the reminder to be de-duplicated on the second sweep, got %+v", second)
	}
	if len(businesses.renewalReminders) != 2 ||
		businesses.renewalReminders[1].DedupKey != reminder.DedupKey {
		t.Fatalf("expected the second attempt to reuse the same dedup key, got %+v", businesses.renewalReminders)
	}
	if len(emails.sent) != 1 {
		t.Fatalf("the email half must not repeat either, got %d emails", len(emails.sent))
	}

	if len(audits.created) != 2 || audits.created[0].Action != "Ran subscription renewal reminder sweep" ||
		audits.created[0].Metadata["reminders_enqueued"] != "1" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.RunSubscriptionReminderSweep(context.Background(), RunSubscriptionReminderSweepCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

// MoMo renewals (§13.3): a mobile-money authorization cannot be silently
// auto-debited, so the lead-day reminders — one-tap re-pay link included — ARE
// the renewal path. They fire for MoMo subscriptions exactly as for card.
func TestRunSubscriptionReminderSweepMoMoGetsRepayReminder(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	renewal := now.Add(3 * 24 * time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:          "subscription-1",
				BusinessID:              "business-1",
				BusinessName:            "Kofi Kente",
				PlanName:                "Studio",
				OwnerEmail:              "kofi@example.com",
				OwnerWhatsApp:           "233555000333",
				MonthlyFeeMinor:         19900,
				BillingCadence:          "yearly",
				YearlyRenewalMinor:      238800,
				Status:                  "active",
				BillingMode:             "recurring",
				ProviderSubscriptionRef: "AUTH_MOMO",
				ProviderChannel:         "mobile_money",
				NextBillingAt:           &renewal,
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1"},
	)
	emails := &fakeReminderEmailSender{}
	service.emails = emails

	record, err := service.RunSubscriptionReminderSweep(context.Background(), RunSubscriptionReminderSweepCommand{
		ActorUserID: SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("run reminder sweep: %v", err)
	}
	if record.RemindersEnqueued != 1 || record.EmailsSent != 1 {
		t.Fatalf("unexpected MoMo reminder record: %+v", record)
	}
	if len(businesses.renewalReminders) != 1 {
		t.Fatalf("expected one MoMo re-pay reminder, got %+v", businesses.renewalReminders)
	}
	reminder := businesses.renewalReminders[0]
	if reminder.Channel != string(notification.ChannelSMS) ||
		reminder.Recipient != "233555000333" ||
		reminder.RepayURL != defaultRenewalRepayURL ||
		reminder.LeadDay == nil || *reminder.LeadDay != 3 ||
		reminder.RenewalAmountMinor != 243549 {
		t.Fatalf("unexpected MoMo re-pay reminder: %+v", reminder)
	}
}

// A failed email never blocks the SMS half, the rest of the run, or the audit:
// it is counted and the sweep still succeeds (the SMS log already dedupes the
// pair, so a flapping Resend must not spam retries either).
func TestRunSubscriptionReminderSweepEmailFailureIsCountedNotFatal(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	renewal := now.Add(15 * 24 * time.Hour)
	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{
				SubscriptionID:        "subscription-1",
				BusinessID:            "business-1",
				BusinessName:          "Ama Stitches",
				PlanName:              "Growth",
				OwnerEmail:            "owner@example.com",
				OwnerPhone:            "233555000111",
				BillingCadence:        "quarterly",
				QuarterlyRenewalMinor: 36000,
				Status:                "active",
				BillingMode:           "recurring",
				NextBillingAt:         &renewal,
			},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1", "audit-2"},
	)
	service.emails = &fakeReminderEmailSender{err: errors.New("resend down")}

	record, err := service.RunSubscriptionReminderSweep(context.Background(), RunSubscriptionReminderSweepCommand{
		ActorUserID: SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("email failure must not fail the sweep: %v", err)
	}
	if record.RemindersEnqueued != 1 || record.EmailsSent != 0 || record.EmailsFailed != 1 {
		t.Fatalf("unexpected record: %+v", record)
	}
	if len(audits.created) != 1 || audits.created[0].Severity != admindomain.AuditSeverityWarning {
		t.Fatalf("expected a warning audit for the email failure, got %+v", audits.created)
	}

	// Nil email sender (Resend unconfigured): the SMS half still goes out and
	// the email half is a silent skip, not a failure.
	businesses.renewalReminders = nil
	businesses.renewalReminderSeen = nil
	service.emails = nil
	record, err = service.RunSubscriptionReminderSweep(context.Background(), RunSubscriptionReminderSweepCommand{
		ActorUserID: SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("nil email sender must not fail the sweep: %v", err)
	}
	if record.RemindersEnqueued != 1 || record.EmailsSent != 0 || record.EmailsFailed != 0 {
		t.Fatalf("unexpected nil-sender record: %+v", record)
	}
}
