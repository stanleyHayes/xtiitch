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

func TestListCustomersRequiresReviewPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		customers: []ports.AdminCustomerRecord{
			{CustomerID: "customer-1", DisplayName: "Ama Customer"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	result, err := service.ListCustomers(
		context.Background(),
		ListCustomersCommand{ActorRole: admindomain.RoleOperator},
	)
	if err != nil {
		t.Fatalf("list customers: %v", err)
	}
	if len(result) != 1 || !businesses.customersListed {
		t.Fatalf("expected operator to list customers, got result=%+v listed=%v", result, businesses.customersListed)
	}

	_, err = service.ListCustomers(
		context.Background(),
		ListCustomersCommand{ActorRole: admindomain.RoleSupport},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateBusinessStatusSuspendsAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateBusinessStatus(context.Background(), UpdateBusinessStatusCommand{
		ActorUserID:       "operator-1",
		ActorRole:         admindomain.RoleOperator,
		BusinessID:        "business-1",
		OperationalStatus: business.OperationalStatusSuspended,
		Reason:            " chargeback pattern under review ",
		UserAgent:         "test-agent",
		IPAddress:         "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update business status: %v", err)
	}
	if businesses.statusUpdate.BusinessID != "business-1" ||
		businesses.statusUpdate.OperationalStatus != business.OperationalStatusSuspended ||
		businesses.statusUpdate.SuspensionReason != "chargeback pattern under review" ||
		businesses.statusUpdate.SuspendedByAdminUser != "operator-1" {
		t.Fatalf("expected normalized suspension update, got %+v", businesses.statusUpdate)
	}
	if record.BusinessID != "business-1" || record.OperationalStatus != business.OperationalStatusSuspended {
		t.Fatalf("unexpected status response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Suspended business" ||
		event.TargetID != "business-1" ||
		event.Severity != admindomain.AuditSeverityCritical ||
		event.Metadata["reason"] != "chargeback pattern under review" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.UpdateBusinessStatus(context.Background(), UpdateBusinessStatusCommand{
		ActorUserID:       "support-1",
		ActorRole:         admindomain.RoleSupport,
		BusinessID:        "business-1",
		OperationalStatus: business.OperationalStatusActive,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminBusinesses(context.Context) ([]ports.AdminBusinessRecord, error) {
	if repo.businesses != nil {
		return repo.businesses, nil
	}
	return []ports.AdminBusinessRecord{
		{
			BusinessID:         "business-1",
			Name:               "Ama Stitches",
			Handle:             "ama-stitches",
			OwnerName:          "Ama Owner",
			OwnerEmail:         "ama@example.com",
			PlanName:           "Growth",
			PlanCode:           "growth",
			VerificationStatus: business.VerificationStatusVerified,
			OperationalStatus:  business.OperationalStatusActive,
			LastActiveAt:       time.Now(),
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		},
	}, nil
}

func (repo *fakeAdminBusinesses) ListAdminCustomers(context.Context) ([]ports.AdminCustomerRecord, error) {
	repo.customersListed = true
	return repo.customers, nil
}

func (repo *fakeAdminBusinesses) ExportAdminCustomer(_ context.Context, customerID common.ID) (ports.AdminCustomerExportRecord, error) {
	return ports.AdminCustomerExportRecord{CustomerID: customerID}, nil
}

func (repo *fakeAdminBusinesses) EraseAdminCustomer(_ context.Context, customerID common.ID) (ports.AdminCustomerErasureRecord, error) {
	return ports.AdminCustomerErasureRecord{CustomerID: customerID}, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminBusinessStatus(
	_ context.Context,
	input ports.UpdateAdminBusinessStatusInput,
) (ports.AdminBusinessRecord, error) {
	repo.statusUpdate = input
	return ports.AdminBusinessRecord{
		BusinessID:         input.BusinessID,
		Name:               "Ama Stitches",
		Handle:             "ama-stitches",
		OwnerName:          "Ama Owner",
		OwnerEmail:         "ama@example.com",
		PlanName:           "Growth",
		PlanCode:           "growth",
		VerificationStatus: business.VerificationStatusVerified,
		OperationalStatus:  input.OperationalStatus,
		SuspensionReason:   input.SuspensionReason,
		LastActiveAt:       time.Now(),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}, nil
}
