package adminauth

import (
	"context"
	"fmt"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type ListBusinessesCommand struct {
	ActorRole admindomain.Role
}

type ListCustomersCommand struct {
	ActorRole admindomain.Role
}

type UpdateBusinessStatusCommand struct {
	ActorUserID       common.ID
	ActorRole         admindomain.Role
	BusinessID        common.ID
	OperationalStatus business.OperationalStatus
	Reason            string
	UserAgent         string
	IPAddress         string
}

func (s Service) ListBusinesses(ctx context.Context, cmd ListBusinessesCommand) ([]ports.AdminBusinessRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminBusinesses(ctx)
}

func (s Service) ListCustomers(ctx context.Context, cmd ListCustomersCommand) ([]ports.AdminCustomerRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminCustomers(ctx)
}

type ExportCustomerDataCommand struct {
	ActorRole  admindomain.Role
	CustomerID common.ID
}

// ExportCustomerData assembles a Data Protection Act (Act 843) subject-access
// export for one customer. It is read-only and gated by the same permission as
// the customer directory.
func (s Service) ExportCustomerData(ctx context.Context, cmd ExportCustomerDataCommand) (ports.AdminCustomerExportRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminCustomerExportRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminCustomerExportRecord{}, authdomain.ErrForbidden
	}
	if cmd.CustomerID.IsZero() {
		return ports.AdminCustomerExportRecord{}, authdomain.ErrInvalidInput
	}

	return s.businesses.ExportAdminCustomer(ctx, cmd.CustomerID)
}

// customerErasureConfirmation must be typed verbatim to authorise an erasure,
// guarding against accidental destructive clicks.
const customerErasureConfirmation = "ERASE CUSTOMER DATA"

type EraseCustomerDataCommand struct {
	ActorUserID  common.ID
	ActorRole    admindomain.Role
	CustomerID   common.ID
	Confirmation string
}

// EraseCustomerData anonymises a customer's personal data platform-wide for a
// Data Protection Act (Act 843) erasure request. It is destructive, so it needs
// the risk-management permission and an explicit typed confirmation, and it is
// recorded in the audit log at critical severity.
func (s Service) EraseCustomerData(ctx context.Context, cmd EraseCustomerDataCommand) (ports.AdminCustomerErasureRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.CustomerID.IsZero() {
		return ports.AdminCustomerErasureRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRisk); err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminCustomerErasureRecord{}, authdomain.ErrForbidden
	}
	if strings.TrimSpace(cmd.Confirmation) != customerErasureConfirmation {
		return ports.AdminCustomerErasureRecord{}, authdomain.ErrInvalidInput
	}

	record, err := s.businesses.EraseAdminCustomer(ctx, cmd.CustomerID)
	if err != nil {
		return ports.AdminCustomerErasureRecord{}, err
	}

	_ = s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Erased customer data",
		TargetType:  "customer",
		TargetID:    cmd.CustomerID.String(),
		TargetLabel: "Customer (Act 843 erasure)",
		Summary: fmt.Sprintf(
			"Anonymised customer personal data platform-wide. %d order(s) retained for accounting; "+
				"%d measurement set(s) and %d booking address(es) cleared.",
			record.OrdersRetained, record.MeasurementsCleared, record.BookingAddresses,
		),
		Severity: admindomain.AuditSeverityCritical,
		Metadata: map[string]string{"customer_id": cmd.CustomerID.String()},
	})

	return record, nil
}

func (s Service) UpdateBusinessStatus(
	ctx context.Context,
	cmd UpdateBusinessStatusCommand,
) (ports.AdminBusinessRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminBusinessRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminBusinessRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminBusinessRecord{}, authdomain.ErrForbidden
	}
	if !cmd.OperationalStatus.Valid() {
		return ports.AdminBusinessRecord{}, authdomain.ErrInvalidInput
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if cmd.OperationalStatus == business.OperationalStatusSuspended && reason == "" {
		reason = "Operator suspended tenant activity pending review."
	}
	if cmd.OperationalStatus == business.OperationalStatusActive && reason == "" {
		reason = "Operator reactivated tenant activity after review."
	}

	record, err := s.businesses.UpdateAdminBusinessStatus(ctx, ports.UpdateAdminBusinessStatusInput{
		BusinessID:           cmd.BusinessID,
		OperationalStatus:    cmd.OperationalStatus,
		SuspensionReason:     reason,
		SuspendedByAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminBusinessRecord{}, err
	}

	action := "Reactivated business"
	summary := "Operator reactivated tenant activity."
	severity := admindomain.AuditSeverityInfo
	if cmd.OperationalStatus == business.OperationalStatusSuspended {
		action = "Suspended business"
		summary = "Operator suspended tenant activity."
		severity = admindomain.AuditSeverityCritical
	}
	if reason != "" {
		summary += " Reason: " + reason
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "business",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.Name,
		Summary:     summary,
		Severity:    severity,
		Metadata: map[string]string{
			"operational_status":  string(record.OperationalStatus),
			"verification_status": string(record.VerificationStatus),
			"handle":              record.Handle,
			"reason":              reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminBusinessRecord{}, err
	}

	return record, nil
}
