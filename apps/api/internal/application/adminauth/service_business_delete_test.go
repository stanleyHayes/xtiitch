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

func (repo *fakeAdminBusinesses) DeleteAdminBusiness(
	_ context.Context,
	input ports.DeleteAdminBusinessInput,
) (ports.AdminBusinessDeleteRecord, error) {
	repo.deletedBusiness = input
	if repo.deleteErr != nil {
		return ports.AdminBusinessDeleteRecord{}, repo.deleteErr
	}
	if repo.deleteResult.BusinessID != "" {
		return repo.deleteResult, nil
	}
	return ports.AdminBusinessDeleteRecord{
		BusinessID:       input.BusinessID,
		Name:             "Ama Stitches",
		Handle:           "ama-stitches",
		TotalRowsDeleted: 42,
	}, nil
}

// §11.2: deleting a business is the most destructive operator action, so the
// typed confirmation, the risk permission and the audit trail are all pinned.
func TestDeleteBusinessRequiresConfirmationAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.DeleteBusiness(context.Background(), DeleteBusinessCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		BusinessID:       "business-1",
		ConfirmationName: "Ama Stitches",
		UserAgent:        "test-agent",
		IPAddress:        "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("delete business: %v", err)
	}
	if businesses.deletedBusiness.BusinessID != "business-1" ||
		businesses.deletedBusiness.ConfirmationName != "Ama Stitches" {
		t.Fatalf("expected the delete input to pass through, got %+v", businesses.deletedBusiness)
	}
	if record.Name != "Ama Stitches" || record.TotalRowsDeleted != 42 {
		t.Fatalf("unexpected delete record: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Deleted business" ||
		event.TargetType != "business" ||
		event.TargetID != "business-1" ||
		event.TargetLabel != "Ama Stitches" ||
		event.Severity != admindomain.AuditSeverityCritical ||
		event.Metadata["handle"] != "ama-stitches" ||
		event.Metadata["rows_deleted"] != "42" {
		t.Fatalf("unexpected audit event: %+v", event)
	}
}

func TestDeleteBusinessRejectsMissingConfirmation(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	_, err := service.DeleteBusiness(context.Background(), DeleteBusinessCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid input without a confirmation, got %v", err)
	}
	if businesses.deletedBusiness.BusinessID != "" {
		t.Fatal("an unconfirmed delete must never reach the repository")
	}
}

func TestDeleteBusinessPermissionAndNotFound(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{deleteErr: ports.ErrNotFound}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	// Support agents may review businesses but never delete them.
	_, err := service.DeleteBusiness(context.Background(), DeleteBusinessCommand{
		ActorUserID:      "support-1",
		ActorRole:        admindomain.RoleSupport,
		BusinessID:       "business-1",
		ConfirmationName: "Ama Stitches",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	// An unknown id surfaces the repository's not-found, so a retried delete
	// reports 404 rather than pretending success (idempotent-safe).
	_, err = service.DeleteBusiness(context.Background(), DeleteBusinessCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		BusinessID:       "missing-business",
		ConfirmationName: "Ama Stitches",
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected not found for an unknown business, got %v", err)
	}
}
