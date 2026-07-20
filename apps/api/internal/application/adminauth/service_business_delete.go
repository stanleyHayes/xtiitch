package adminauth

import (
	"context"
	"strconv"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type DeleteBusinessCommand struct {
	ActorUserID      common.ID
	ActorRole        admindomain.Role
	BusinessID       common.ID
	ConfirmationName string
	UserAgent        string
	IPAddress        string
}

// DeleteBusiness hard-deletes a business and all tenant-owned data (§11.2). It
// is the most destructive operator action on the platform, so it needs the
// risk-management permission (like customer erasure) and a typed confirmation
// — the business's exact current name — and is audited at critical severity.
// Deleting an unknown id reports not-found, so a retried delete fails the same
// way instead of pretending success (idempotent-safe).
func (s Service) DeleteBusiness(
	ctx context.Context,
	cmd DeleteBusinessCommand,
) (ports.AdminBusinessDeleteRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminBusinessDeleteRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRisk); err != nil {
		return ports.AdminBusinessDeleteRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminBusinessDeleteRecord{}, authdomain.ErrForbidden
	}
	if strings.TrimSpace(cmd.ConfirmationName) == "" {
		return ports.AdminBusinessDeleteRecord{}, authdomain.ErrInvalidInput
	}

	record, err := s.businesses.DeleteAdminBusiness(ctx, ports.DeleteAdminBusinessInput{
		BusinessID:       cmd.BusinessID,
		ConfirmationName: cmd.ConfirmationName,
	})
	if err != nil {
		return ports.AdminBusinessDeleteRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Deleted business",
		TargetType:  "business",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.Name,
		Summary: "Permanently deleted the business and all tenant-owned data. " +
			"Customer identities were retained (global).",
		Severity: admindomain.AuditSeverityCritical,
		Metadata: map[string]string{
			"business_id":   record.BusinessID.String(),
			"name":          record.Name,
			"handle":        record.Handle,
			"rows_deleted":  strconv.Itoa(record.TotalRowsDeleted),
			"customer_data": "retained",
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminBusinessDeleteRecord{}, err
	}

	return record, nil
}
