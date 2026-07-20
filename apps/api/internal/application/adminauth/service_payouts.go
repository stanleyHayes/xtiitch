package adminauth

import (
	"context"
	"strings"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// SettlementSyncer refreshes one store's mirrored Paystack settlements (§3.3).
// Satisfied by the payments service; declared here, in the consumer, to keep
// the dependency narrow (same shape as orderapp's Payments interface).
type SettlementSyncer interface {
	SyncSettlements(ctx context.Context, cmd paymentsapp.SyncSettlementsCommand) (ports.SettlementSyncResult, error)
}

type ListPayoutsCommand struct {
	ActorRole admindomain.Role
	Query     string
	Limit     int
	Offset    int
}

type GetPayoutHistoryCommand struct {
	ActorRole  admindomain.Role
	BusinessID common.ID
	Limit      int
	Offset     int
}

type RunSettlementSyncCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	// BusinessID, when set, syncs that one store; nil syncs every store with a
	// subaccount on file (the worker/ops default).
	BusinessID *common.ID
	UserAgent  string
	IPAddress  string
}

// payout paging bounds: the CRM lists every store, so unbounded pages are an
// accident vector; the default matches the money-page payout table size.
const (
	defaultPayoutPageLimit = 50
	maxPayoutPageLimit     = 200
)

// ListPayouts is the §11.5 payouts CRM: one row per store, searchable by
// business name, handle or owner legal name, paged.
func (s Service) ListPayouts(ctx context.Context, cmd ListPayoutsCommand) ([]ports.AdminPayoutRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminPayouts(ctx, ports.ListAdminPayoutsInput{
		Query:  strings.TrimSpace(cmd.Query),
		Limit:  clampPayoutPageLimit(cmd.Limit),
		Offset: clampPayoutPageOffset(cmd.Offset),
	})
}

// GetPayoutHistory pages one store's mirrored settlement rows — the §11.5
// "Payout history" drill-down behind the CRM row.
func (s Service) GetPayoutHistory(ctx context.Context, cmd GetPayoutHistoryCommand) ([]ports.AdminPayoutHistoryRecord, error) {
	if cmd.BusinessID.IsZero() {
		return nil, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminPayoutHistory(ctx, cmd.BusinessID, clampPayoutPageLimit(cmd.Limit), clampPayoutPageOffset(cmd.Offset))
}

// RunSettlementSync pulls every subaccounted store's Paystack settlements (or
// one store's, when BusinessID is set) into the mirrored payout history (§3.3),
// for the worker/ops cadence and for support's "refresh this store" action.
// Syncs are forced (the operator asked) and audited; a single store's failure
// does not abort the rest of the run.
func (s Service) RunSettlementSync(ctx context.Context, cmd RunSettlementSyncCommand) (ports.AdminSettlementSyncRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSettlementSyncRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminSettlementSyncRecord{}, err
	}
	if s.businesses == nil || s.settlementSyncer == nil {
		return ports.AdminSettlementSyncRecord{}, authdomain.ErrForbidden
	}

	businessIDs := []common.ID{}
	if cmd.BusinessID != nil && !cmd.BusinessID.IsZero() {
		businessIDs = append(businessIDs, *cmd.BusinessID)
	} else {
		listed, err := s.businesses.ListSubaccountedBusinessIDs(ctx)
		if err != nil {
			return ports.AdminSettlementSyncRecord{}, err
		}
		businessIDs = listed
	}

	var record ports.AdminSettlementSyncRecord
	for _, businessID := range businessIDs {
		result, err := s.settlementSyncer.SyncSettlements(ctx, paymentsapp.SyncSettlementsCommand{BusinessID: businessID, Force: true})
		if err != nil {
			record.Failed++
			continue
		}
		if result.Skipped {
			record.Skipped++
			continue
		}
		record.Synced++
		record.Upserted += result.Upserted
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Ran settlement sync",
		TargetType:  "paystack_settlements",
		TargetID:    settlementSyncTargetID(cmd.BusinessID),
		TargetLabel: "Paystack settlements",
		Summary:     "Operator triggered a settlement sync from Paystack.",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"synced":   intString(record.Synced),
			"skipped":  intString(record.Skipped),
			"failed":   intString(record.Failed),
			"upserted": intString(record.Upserted),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminSettlementSyncRecord{}, err
	}

	return record, nil
}

func settlementSyncTargetID(businessID *common.ID) string {
	if businessID == nil || businessID.IsZero() {
		return "all"
	}
	return businessID.String()
}

func clampPayoutPageLimit(limit int) int {
	if limit <= 0 || limit > maxPayoutPageLimit {
		return defaultPayoutPageLimit
	}
	return limit
}

func clampPayoutPageOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}
