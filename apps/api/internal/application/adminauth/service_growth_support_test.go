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

func TestListSupportTicketsRequiresSupportPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		supportTickets: []ports.AdminSupportTicketRecord{
			{TicketKey: "failed_payment:payment-1", BusinessName: "Ama Stitches", Priority: "urgent", Status: "open"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	tickets, err := service.ListSupportTickets(context.Background(), ListSupportTicketsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if err != nil {
		t.Fatalf("list support tickets: %v", err)
	}
	if len(tickets) != 1 || tickets[0].TicketKey != "failed_payment:payment-1" {
		t.Fatalf("unexpected support ticket response: %+v", tickets)
	}

	_, err = service.ListSupportTickets(context.Background(), ListSupportTicketsCommand{
		ActorRole: "viewer",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected invalid role to be forbidden, got %v", err)
	}
}

func TestUpdateSupportTicketRequiresSupportPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateSupportTicket(context.Background(), UpdateSupportTicketCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		TicketKey:   " failed_payment:payment-1 ",
		Status:      "open",
		Assignment:  "self",
		Note:        " taking this one ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update support ticket: %v", err)
	}
	if businesses.supportUpdate.TicketKey != "failed_payment:payment-1" ||
		businesses.supportUpdate.Assignment != "self" ||
		businesses.supportUpdate.Note != "taking this one" {
		t.Fatalf("expected normalized support update, got %+v", businesses.supportUpdate)
	}
	if record.Status != "open" || record.AssignedAdminUserID != "support-1" {
		t.Fatalf("unexpected support ticket response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Assigned support ticket" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["assignment"] != "self" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.UpdateSupportTicket(context.Background(), UpdateSupportTicketCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		TicketKey:   "failed_payment:payment-1",
		Status:      "invalid",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid status, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminSupportTickets(context.Context) ([]ports.AdminSupportTicketRecord, error) {
	return repo.supportTickets, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminSupportTicket(
	_ context.Context,
	input ports.UpdateAdminSupportTicketInput,
) (ports.AdminSupportTicketRecord, error) {
	repo.supportUpdate = input
	assigned := common.ID("")
	if input.Assignment == "self" {
		assigned = input.ActorAdminUser
	}
	return ports.AdminSupportTicketRecord{
		TicketKey:           input.TicketKey,
		BusinessID:          "business-1",
		Subject:             "Customer payment needs follow-up",
		BusinessName:        "Ama Stitches",
		Priority:            "urgent",
		Summary:             "Payment failed.",
		Category:            "Payments",
		Status:              input.Status,
		AssignedAdminUserID: assigned,
		AssignedAdminEmail:  "support@example.com",
		AssignedAdminName:   "Support Agent",
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}, nil
}
