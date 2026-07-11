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

func TestSubscriptionInvoicesRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(48 * time.Hour)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"invoice-created", "audit-issue", "audit-paid", "audit-failed"},
	)

	issued, err := service.IssueSubscriptionInvoice(context.Background(), IssueSubscriptionInvoiceCommand{
		ActorUserID:        "operator-1",
		ActorRole:          admindomain.RoleOperator,
		BusinessID:         "business-1",
		ProviderInvoiceRef: " ps-invoice-1 ",
		PaymentURL:         " https://paystack.com/pay/subscription ",
		DueAt:              &dueAt,
		Reason:             " monthly fee ",
		UserAgent:          "test-agent",
		IPAddress:          "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("issue subscription invoice: %v", err)
	}
	if businesses.issuedSubscriptionInvoice.BusinessID != "business-1" ||
		businesses.issuedSubscriptionInvoice.ProviderInvoiceRef != "ps-invoice-1" ||
		businesses.issuedSubscriptionInvoice.PaymentURL != "https://paystack.com/pay/subscription" ||
		!businesses.issuedSubscriptionInvoice.DueAt.Equal(dueAt) ||
		businesses.issuedSubscriptionInvoice.InvoiceRef == "" {
		t.Fatalf("expected normalized issue input, got %+v", businesses.issuedSubscriptionInvoice)
	}
	if issued.LastInvoiceRef != businesses.issuedSubscriptionInvoice.InvoiceRef {
		t.Fatalf("expected issued record to carry invoice ref, got %+v", issued)
	}

	paid, err := service.MarkSubscriptionInvoicePaid(context.Background(), MarkSubscriptionInvoicePaidCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		InvoiceID:   "invoice-created",
		Reason:      " paid via link ",
	})
	if err != nil {
		t.Fatalf("mark subscription invoice paid: %v", err)
	}
	if businesses.paidSubscriptionInvoice.InvoiceID != "invoice-created" ||
		businesses.paidSubscriptionInvoice.Reason != "paid via link" ||
		paid.Status != "active" {
		t.Fatalf("expected paid input and active response, got input=%+v record=%+v", businesses.paidSubscriptionInvoice, paid)
	}

	failed, err := service.MarkSubscriptionInvoiceFailed(context.Background(), MarkSubscriptionInvoiceFailedCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		InvoiceID:   "invoice-created",
		Reason:      " card failed ",
	})
	if err != nil {
		t.Fatalf("mark subscription invoice failed: %v", err)
	}
	if businesses.failedSubscriptionInvoice.InvoiceID != "invoice-created" ||
		businesses.failedSubscriptionInvoice.Reason != "card failed" ||
		failed.Status != "past_due" {
		t.Fatalf("expected failed input and past-due response, got input=%+v record=%+v", businesses.failedSubscriptionInvoice, failed)
	}

	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Issued subscription invoice" ||
		audits.created[1].Action != "Marked subscription invoice paid" ||
		audits.created[2].Action != "Marked subscription invoice failed" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.IssueSubscriptionInvoice(context.Background(), IssueSubscriptionInvoiceCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) IssueAdminSubscriptionInvoice(
	_ context.Context,
	input ports.IssueAdminSubscriptionInvoiceInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.issuedSubscriptionInvoice = input
	return ports.AdminSubscriptionRecord{
		SubscriptionID:     "subscription-1",
		BusinessID:         input.BusinessID,
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		PlanCode:           "growth",
		PlanName:           "Growth",
		MonthlyFeeMinor:    12000,
		Status:             "active",
		BillingMode:        "payment_link",
		LastInvoiceRef:     input.InvoiceRef,
		NextBillingAt:      &input.DueAt,
		CurrentPeriodStart: time.Now(),
		CurrentPeriodEnd:   time.Now().Add(30 * 24 * time.Hour),
		UpdatedAt:          time.Now(),
		Invoices: []ports.AdminSubscriptionInvoiceRecord{
			{
				InvoiceID:      input.InvoiceID,
				SubscriptionID: "subscription-1",
				BusinessID:     input.BusinessID,
				InvoiceRef:     input.InvoiceRef,
				Status:         "issued",
				BillingMode:    "payment_link",
				AmountMinor:    12000,
				Currency:       "GHS",
				DueAt:          input.DueAt,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			},
		},
	}, nil
}

func (repo *fakeAdminBusinesses) MarkAdminSubscriptionInvoicePaid(
	_ context.Context,
	input ports.MarkAdminSubscriptionInvoicePaidInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.paidSubscriptionInvoice = input
	now := time.Now()
	return ports.AdminSubscriptionRecord{
		SubscriptionID:     "subscription-1",
		BusinessID:         "business-1",
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		PlanCode:           "growth",
		PlanName:           "Growth",
		MonthlyFeeMinor:    12000,
		Status:             "active",
		BillingMode:        "payment_link",
		LastInvoiceRef:     "XTSUB-INVOICE",
		LastPaymentAt:      &now,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   now.Add(30 * 24 * time.Hour),
		UpdatedAt:          now,
	}, nil
}

func (repo *fakeAdminBusinesses) MarkAdminSubscriptionInvoiceFailed(
	_ context.Context,
	input ports.MarkAdminSubscriptionInvoiceFailedInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.failedSubscriptionInvoice = input
	now := time.Now()
	next := now.Add(24 * time.Hour)
	return ports.AdminSubscriptionRecord{
		SubscriptionID:     "subscription-1",
		BusinessID:         "business-1",
		BusinessName:       "Ama Stitches",
		Handle:             "ama-stitches",
		PlanCode:           "growth",
		PlanName:           "Growth",
		MonthlyFeeMinor:    12000,
		Status:             "past_due",
		BillingMode:        "payment_link",
		LastInvoiceRef:     "XTSUB-INVOICE",
		NextBillingAt:      &next,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   now.Add(30 * 24 * time.Hour),
		UpdatedAt:          now,
	}, nil
}
