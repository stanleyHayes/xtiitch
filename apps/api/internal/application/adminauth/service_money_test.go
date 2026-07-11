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

func TestGetMoneyRailsRequiresMoneyPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		moneyRails: ports.AdminMoneyRailsRecord{
			WebhookEvents: []ports.AdminMoneyWebhookEventRecord{
				{ID: "payment-1", ProviderReference: "xt_ref_1", Status: "verified"},
			},
			PayoutReviews: []ports.AdminMoneyPayoutReviewRecord{
				{ID: "business-1", BusinessName: "Ama Stitches", Status: "ready"},
			},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	moneyRails, err := service.GetMoneyRails(context.Background(), GetMoneyRailsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("get money rails: %v", err)
	}
	if len(moneyRails.WebhookEvents) != 1 || len(moneyRails.PayoutReviews) != 1 {
		t.Fatalf("unexpected money rails response: %+v", moneyRails)
	}

	_, err = service.GetMoneyRails(context.Background(), GetMoneyRailsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestQueueMoneyReplayRequiresMoneyPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"replay-1", "audit-1"},
	)

	record, err := service.QueueMoneyReplay(context.Background(), QueueMoneyReplayCommand{
		ActorUserID:       "operator-1",
		ActorRole:         admindomain.RoleOperator,
		ProviderReference: " xt_ref_1 ",
		Reason:            " customer says checkout was charged ",
		UserAgent:         "test-agent",
		IPAddress:         "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("queue money replay: %v", err)
	}
	if businesses.replay.ProviderReference != "xt_ref_1" ||
		businesses.replay.ReplayRequestID != "replay-1" ||
		businesses.replay.Reason != "customer says checkout was charged" {
		t.Fatalf("expected normalized replay request, got %+v", businesses.replay)
	}
	if record.ReplayRequestID != "replay-1" || record.ProviderReference != "xt_ref_1" {
		t.Fatalf("unexpected replay response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Queued money replay" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["reason"] != "customer says checkout was charged" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.QueueMoneyReplay(context.Background(), QueueMoneyReplayCommand{
		ActorUserID:       "support-1",
		ActorRole:         admindomain.RoleSupport,
		ProviderReference: "xt_ref_1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestReverseMoneyPaymentRequiresMoneyPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.ReverseMoneyPayment(context.Background(), ReverseMoneyPaymentCommand{
		ActorUserID:       "operator-1",
		ActorRole:         admindomain.RoleOperator,
		ProviderReference: " xt_ref_refund ",
		Reason:            " provider refund confirmed ",
		UserAgent:         "test-agent",
		IPAddress:         "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("reverse money payment: %v", err)
	}
	if businesses.reversal.ProviderReference != "xt_ref_refund" ||
		businesses.reversal.Reason != "provider refund confirmed" ||
		!record.PaymentReversed ||
		record.PromotionRedemptionCount != 1 ||
		record.ReferralRewardCount != 2 {
		t.Fatalf("expected normalized reversal and counts, input=%+v record=%+v", businesses.reversal, record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Reversed payment impact" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["provider_reference"] != "xt_ref_refund" ||
		audits.created[0].Metadata["promotion_redemptions"] != "1" ||
		audits.created[0].Metadata["referral_rewards"] != "2" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.ReverseMoneyPayment(context.Background(), ReverseMoneyPaymentCommand{
		ActorUserID:       "support-1",
		ActorRole:         admindomain.RoleSupport,
		ProviderReference: "xt_ref_refund",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestSetSettlementReviewHoldRequiresMoneyPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.SetSettlementReviewHold(context.Background(), SetSettlementReviewHoldCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Hold:        true,
		Reason:      " webhook mismatch needs review ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("set settlement hold: %v", err)
	}
	if businesses.hold.BusinessID != "business-1" ||
		!businesses.hold.Hold ||
		businesses.hold.Reason != "webhook mismatch needs review" {
		t.Fatalf("expected normalized hold input, got %+v", businesses.hold)
	}
	if !record.HoldActive || record.Status != "blocked" {
		t.Fatalf("unexpected hold response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Placed settlement review hold" ||
		audits.created[0].Severity != admindomain.AuditSeverityCritical ||
		audits.created[0].Metadata["hold_active"] != "true" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.SetSettlementReviewHold(context.Background(), SetSettlementReviewHoldCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
		Hold:        false,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) GetAdminMoneyRails(context.Context) (ports.AdminMoneyRailsRecord, error) {
	if repo.moneyRails.UpdatedAt.IsZero() {
		repo.moneyRails.UpdatedAt = time.Now()
	}
	return repo.moneyRails, nil
}

func (repo *fakeAdminBusinesses) QueueAdminMoneyReplay(
	_ context.Context,
	input ports.QueueAdminMoneyReplayInput,
) (ports.AdminMoneyReplayRequestRecord, error) {
	repo.replay = input
	return ports.AdminMoneyReplayRequestRecord{
		ReplayRequestID:   input.ReplayRequestID,
		ProviderReference: input.ProviderReference,
		PaymentID:         "payment-1",
		BusinessName:      "Ama Stitches",
		Reason:            input.Reason,
		Status:            "queued",
		CreatedAt:         time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) ReverseAdminMoneyPayment(
	_ context.Context,
	input ports.ReverseAdminMoneyPaymentInput,
) (ports.AdminMoneyReversalRecord, error) {
	repo.reversal = input
	orderID := common.ID("order-1")
	return ports.AdminMoneyReversalRecord{
		PaymentID:                "payment-1",
		ProviderReference:        input.ProviderReference,
		BusinessID:               "business-1",
		BusinessName:             "Ama Stitches",
		OrderID:                  &orderID,
		PaymentReversed:          true,
		PromotionRedemptionCount: 1,
		AffiliateConversionCount: 1,
		ReferralCount:            1,
		ReferralRewardCount:      2,
		GeneratedPromotionCount:  1,
		Reason:                   input.Reason,
		ReversedAt:               time.Now(),
	}, nil
}

func (repo *fakeAdminBusinesses) SetAdminSettlementReviewHold(
	_ context.Context,
	input ports.SetAdminSettlementReviewHoldInput,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	repo.hold = input
	return ports.AdminMoneyPayoutReviewRecord{
		ID:              input.BusinessID.String(),
		BusinessName:    "Ama Stitches",
		SubaccountRef:   "DEV_SUB_1",
		Status:          "blocked",
		SettlementMinor: 10000,
		CommissionMinor: 300,
		NextAction:      input.Reason,
		HoldActive:      input.Hold,
		HoldReason:      input.Reason,
	}, nil
}
