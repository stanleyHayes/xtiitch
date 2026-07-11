package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestListBusinessVerificationsRequiresReviewPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		cases: []ports.AdminVerificationCaseRecord{
			{BusinessID: "business-1", BusinessName: "Ama Stitches"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	result, err := service.ListBusinessVerifications(
		context.Background(),
		ListBusinessVerificationsCommand{ActorRole: admindomain.RoleOperator},
	)
	if err != nil {
		t.Fatalf("list business verifications: %v", err)
	}
	if len(result) != 1 || !businesses.listCalled {
		t.Fatalf("expected operator to list verification cases, got result=%+v listCalled=%v", result, businesses.listCalled)
	}

	_, err = service.ListBusinessVerifications(
		context.Background(),
		ListBusinessVerificationsCommand{ActorRole: admindomain.RoleSupport},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestDecideBusinessVerificationUpdatesStatusAndWritesAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.DecideBusinessVerification(context.Background(), DecideBusinessVerificationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Decision:    BusinessVerificationDecisionApproved,
		Note:        "  owner and settlement account match  ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("decide business verification: %v", err)
	}
	if businesses.decided.BusinessID != "business-1" ||
		businesses.decided.Status != business.VerificationStatusVerified {
		t.Fatalf("expected approved status update, got %+v", businesses.decided)
	}
	if record.BusinessID != "business-1" || record.VerificationStatus != business.VerificationStatusVerified {
		t.Fatalf("unexpected decision result: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Approved business verification" ||
		event.TargetID != "business-1" ||
		event.Severity != admindomain.AuditSeverityInfo ||
		event.Metadata["operator_note"] != "owner and settlement account match" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.DecideBusinessVerification(context.Background(), DecideBusinessVerificationCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Decision:    BusinessVerificationDecision("bad"),
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid decision to be rejected, got %v", err)
	}
}

func TestListRiskReviewsRequiresRiskPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		riskReviews: []ports.AdminRiskReviewRecord{
			{ReviewKey: "payment_failures:business-1", BusinessName: "Ama Stitches", Level: "high", Status: "open"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	reviews, err := service.ListRiskReviews(context.Background(), ListRiskReviewsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list risk reviews: %v", err)
	}
	if len(reviews) != 1 || reviews[0].ReviewKey != "payment_failures:business-1" {
		t.Fatalf("unexpected risk review response: %+v", reviews)
	}

	_, err = service.ListRiskReviews(context.Background(), ListRiskReviewsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestSetRiskReviewStatusRequiresRiskPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.SetRiskReviewStatus(context.Background(), SetRiskReviewStatusCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ReviewKey:   " payment_failures:business-1 ",
		Status:      "closed",
		Reason:      " issue reconciled with provider ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("set risk review status: %v", err)
	}
	if businesses.riskUpdate.ReviewKey != "payment_failures:business-1" ||
		businesses.riskUpdate.Status != "closed" ||
		businesses.riskUpdate.Reason != "issue reconciled with provider" {
		t.Fatalf("expected normalized risk update, got %+v", businesses.riskUpdate)
	}
	if record.Status != "closed" || record.ReviewKey != "payment_failures:business-1" {
		t.Fatalf("unexpected risk review response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Closed risk review" ||
		audits.created[0].Severity != admindomain.AuditSeverityInfo ||
		audits.created[0].Metadata["status"] != "closed" ||
		audits.created[0].Metadata["reason"] != "issue reconciled with provider" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.SetRiskReviewStatus(context.Background(), SetRiskReviewStatusCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		ReviewKey:   "payment_failures:business-1",
		Status:      "open",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminVerificationCases(context.Context) ([]ports.AdminVerificationCaseRecord, error) {
	repo.listCalled = true
	return repo.cases, nil
}

func (repo *fakeAdminBusinesses) DecideAdminBusinessVerification(
	_ context.Context,
	input ports.AdminBusinessVerificationDecisionInput,
) (ports.AdminVerificationCaseRecord, error) {
	repo.decided = input
	return ports.AdminVerificationCaseRecord{
		BusinessID:         input.BusinessID,
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		OwnerName:          "Ama Owner",
		OwnerEmail:         "ama@example.com",
		PlanName:           "Growth",
		PlanCode:           "growth",
		VerificationStatus: input.Status,
		SubmittedAt:        time.Now(),
		UpdatedAt:          time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) ListAdminRiskReviews(context.Context) ([]ports.AdminRiskReviewRecord, error) {
	return repo.riskReviews, nil
}

func (repo *fakeAdminBusinesses) SetAdminRiskReviewStatus(
	_ context.Context,
	input ports.SetAdminRiskReviewStatusInput,
) (ports.AdminRiskReviewRecord, error) {
	repo.riskUpdate = input
	return ports.AdminRiskReviewRecord{
		ReviewKey:    input.ReviewKey,
		BusinessID:   "business-1",
		Title:        "Payment failure spike",
		BusinessName: "Ama Stitches",
		Level:        "high",
		Reason:       "3 failed payment(s) in the last 30 days.",
		Owner:        "Money rails",
		Status:       input.Status,
		UpdatedAt:    time.Now(),
	}, nil
}
