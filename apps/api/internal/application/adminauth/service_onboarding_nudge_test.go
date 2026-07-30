package adminauth

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestRunVerificationNudgeSweepEmailsStalledOwners(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 7, 30, 15, 0, 0, 0, time.UTC)
	emails := &fakeReminderEmailSender{}
	businesses := &fakeAdminBusinesses{
		nudgeCandidates: []ports.BusinessOnboardingNudgeCandidate{
			{
				BusinessID:   "biz-1",
				BusinessName: "Ama Stitches",
				Handle:       "ama-stitches",
				OwnerName:    "Ama",
				OwnerEmail:   "ama@example.com",
				CreatedAt:    now.Add(-24 * time.Hour),
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
	service.emails = emails
	service.dashboardURL = "https://app.xtiitch.com"

	record, err := service.RunVerificationNudgeSweep(context.Background(), RunVerificationNudgeSweepCommand{
		ActorUserID: SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
		Reason:      "test",
	})
	if err != nil {
		t.Fatalf("nudge sweep: %v", err)
	}
	if record.Candidates != 1 || record.EmailsSent != 1 || record.EmailsFailed != 0 {
		t.Fatalf("unexpected sweep record: %+v", record)
	}
	if len(emails.sent) != 1 {
		t.Fatalf("expected one email, got %d", len(emails.sent))
	}
	mail := emails.sent[0]
	if mail.To != "ama@example.com" {
		t.Fatalf("unexpected recipient: %q", mail.To)
	}
	if !strings.Contains(mail.Body, "https://app.xtiitch.com/dashboard/settings#verification") {
		t.Fatalf("body missing verification deep link: %q", mail.Body)
	}
	if !strings.Contains(mail.HTMLBody, "Verify your business") {
		t.Fatalf("html missing CTA button: %q", mail.HTMLBody)
	}
	if len(businesses.claimedReminders) != 1 || businesses.claimedReminders[0] != "biz-1" {
		t.Fatalf("expected reminder claim, got %+v", businesses.claimedReminders)
	}
}

func TestRunVerificationNudgeSweepSkipsAlreadyClaimed(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 7, 30, 15, 0, 0, 0, time.UTC)
	emails := &fakeReminderEmailSender{}
	businesses := &fakeAdminBusinesses{
		nudgeCandidates: []ports.BusinessOnboardingNudgeCandidate{
			{BusinessID: "biz-1", OwnerEmail: "ama@example.com", BusinessName: "Ama"},
		},
		claimAlreadySent: true,
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1"},
	)
	service.emails = emails

	record, err := service.RunVerificationNudgeSweep(context.Background(), RunVerificationNudgeSweepCommand{
		ActorUserID: SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
	})
	if err != nil {
		t.Fatalf("nudge sweep: %v", err)
	}
	if record.EmailsSent != 0 || len(emails.sent) != 0 {
		t.Fatalf("already-claimed reminder must not email again: %+v sent=%d", record, len(emails.sent))
	}
}
