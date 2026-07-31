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
)

func TestAffiliateApplicationApprovalCreatesPortalInviteAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 7, 30, 17, 0, 0, 0, time.UTC)
	businesses := &fakeAdminBusinesses{
		affiliateApplications: []ports.AdminAffiliateApplicationRecord{
			{ApplicationID: "application-1", RequestedCode: "AMACREATES"},
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"affiliate-1", "account-1", "activation-1", "audit-1"},
	)
	emails := &fakeReminderEmailSender{}
	service.emails = emails

	applications, err := service.ListAffiliateApplications(
		context.Background(),
		ListAffiliateApplicationsCommand{ActorRole: admindomain.RoleOperator},
	)
	if err != nil || len(applications) != 1 {
		t.Fatalf("list applications: records=%+v err=%v", applications, err)
	}

	record, err := service.DecideAffiliateApplication(
		context.Background(),
		DecideAffiliateApplicationCommand{
			ActorUserID:                "operator-1",
			ActorRole:                  admindomain.RoleOperator,
			ApplicationID:              "application-1",
			Decision:                   " approved ",
			ReviewNote:                 " audience reviewed ",
			PurchaseCommissionBPS:      1200,
			FirstPaidPlanCommissionBPS: 1800,
			CookieWindowDays:           45,
			PayoutMode:                 "manual",
			UserAgent:                  "test-agent",
			IPAddress:                  "127.0.0.1",
		},
	)
	if err != nil {
		t.Fatalf("approve application: %v", err)
	}
	input := businesses.decidedAffiliateApplication
	if record.Status != "approved" ||
		input.AffiliateID != "affiliate-1" ||
		input.AffiliateAccountID != "account-1" ||
		input.ActivationTokenID != "activation-1" ||
		input.ActivationTokenHash != "hash:refresh-token" ||
		input.ActivationTokenExpiresAt != now.Add(48*time.Hour) ||
		input.PurchaseCommissionBPS != 1200 ||
		input.FirstPaidPlanCommissionBPS != 1800 {
		t.Fatalf("unexpected approval input=%+v record=%+v", input, record)
	}
	if len(audits.created) != 1 ||
		audits.created[0].Action != "Approved affiliate application" {
		t.Fatalf("unexpected approval audit: %+v", audits.created)
	}
	if len(emails.sent) != 1 ||
		emails.sent[0].To != "ama@example.com" ||
		emails.sent[0].Subject != "Your Xtiitch affiliate application is approved" {
		t.Fatalf("unexpected approval email: %+v", emails.sent)
	}
}

func TestAffiliateApplicationDecisionValidatesRoleAndTerms(t *testing.T) {
	t.Parallel()

	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		&fakeAdminBusinesses{},
		time.Now(),
		[]common.ID{"unused"},
	)

	_, err := service.DecideAffiliateApplication(
		context.Background(),
		DecideAffiliateApplicationCommand{
			ActorUserID:   "support-1",
			ActorRole:     admindomain.RoleSupport,
			ApplicationID: "application-1",
			Decision:      "approved",
		},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role forbidden, got %v", err)
	}

	_, err = service.DecideAffiliateApplication(
		context.Background(),
		DecideAffiliateApplicationCommand{
			ActorUserID:           "operator-1",
			ActorRole:             admindomain.RoleOperator,
			ApplicationID:         "application-1",
			Decision:              "approved",
			PurchaseCommissionBPS: 0,
		},
	)
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid commission, got %v", err)
	}

	_, err = service.DecideAffiliateApplication(
		context.Background(),
		DecideAffiliateApplicationCommand{
			ActorUserID:   "operator-1",
			ActorRole:     admindomain.RoleOperator,
			ApplicationID: "application-1",
			Decision:      "rejected",
		},
	)
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected rejection reason, got %v", err)
	}
}
