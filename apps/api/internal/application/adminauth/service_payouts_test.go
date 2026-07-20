package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §11.5: the payouts CRM passes the search query through (trimmed) and clamps
// paging; the money-rails permission gates it.
func TestListPayoutsPassesQueryClampsPagingAndChecksPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		payouts: []ports.AdminPayoutRecord{
			{BusinessID: "business-1", BusinessName: "Ama Stitches", SubaccountRef: "ACCT_1", AmountDueMinor: 15000},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	records, err := service.ListPayouts(context.Background(), ListPayoutsCommand{
		ActorRole: admindomain.RoleOperator,
		Query:     "  ama  ",
		Limit:     9999,
		Offset:    -3,
	})
	if err != nil {
		t.Fatalf("list payouts: %v", err)
	}
	if len(records) != 1 || records[0].AmountDueMinor != 15000 {
		t.Fatalf("unexpected payout rows: %+v", records)
	}
	if businesses.payoutsInput.Query != "ama" {
		t.Fatalf("expected the trimmed query through, got %q", businesses.payoutsInput.Query)
	}
	if businesses.payoutsInput.Limit != defaultPayoutPageLimit || businesses.payoutsInput.Offset != 0 {
		t.Fatalf("expected absurd paging clamped to the defaults, got %+v", businesses.payoutsInput)
	}

	if _, err := service.ListPayouts(context.Background(), ListPayoutsCommand{ActorRole: admindomain.RoleSupport}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected the support role to be forbidden, got %v", err)
	}
}

func TestGetPayoutHistoryRequiresBusinessIDAndPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		payoutHistory: []ports.AdminPayoutHistoryRecord{
			{SettlementID: "s-1", ProviderReference: "paystack_settlement:11", AmountMinor: 9700, Status: "success"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	if _, err := service.GetPayoutHistory(context.Background(), GetPayoutHistoryCommand{ActorRole: admindomain.RoleOperator}); !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected a missing business id to be invalid input, got %v", err)
	}

	records, err := service.GetPayoutHistory(context.Background(), GetPayoutHistoryCommand{
		ActorRole:  admindomain.RoleOperator,
		BusinessID: "business-1",
	})
	if err != nil {
		t.Fatalf("get payout history: %v", err)
	}
	if len(records) != 1 || records[0].AmountMinor != 9700 {
		t.Fatalf("unexpected history rows: %+v", records)
	}
}

// §3.3: the operator sync iterates every subaccounted store (or one), counts
// synced/skipped/failed, sums the upserts, and writes an audit event.
func TestRunSettlementSyncAggregatesResultsAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		subaccountedBusinessIDs: []common.ID{"b-ok", "b-skip", "b-fail"},
	}
	syncer := &fakeSettlementSyncer{
		results: map[string]fakeSyncOutcome{
			"b-ok":   {result: ports.SettlementSyncResult{BusinessID: "b-ok", Upserted: 3}},
			"b-skip": {result: ports.SettlementSyncResult{BusinessID: "b-skip", Skipped: true}},
			"b-fail": {err: errors.New("paystack timeout")},
		},
	}
	service, audits := newTestServiceWithSyncer(businesses, syncer, []common.ID{"audit-1"})

	record, err := service.RunSettlementSync(context.Background(), RunSettlementSyncCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("run settlement sync: %v", err)
	}
	if record.Synced != 1 || record.Skipped != 1 || record.Failed != 1 || record.Upserted != 3 {
		t.Fatalf("unexpected sync aggregate: %+v", record)
	}
	if len(syncer.commands) != 3 {
		t.Fatalf("expected every subaccounted store synced, got %+v", syncer.commands)
	}
	for _, command := range syncer.commands {
		if !command.Force {
			t.Fatalf("expected the operator sync to force past the throttle, got %+v", command)
		}
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Ran settlement sync" ||
		audits.created[0].Metadata["synced"] != "1" ||
		audits.created[0].Metadata["failed"] != "1" ||
		audits.created[0].TargetID != "all" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}
}

// A single-store sync targets only that business and audits against it.
func TestRunSettlementSyncSingleStore(t *testing.T) {
	t.Parallel()

	businessID := common.ID("b-1")
	businesses := &fakeAdminBusinesses{}
	syncer := &fakeSettlementSyncer{
		results: map[string]fakeSyncOutcome{
			"b-1": {result: ports.SettlementSyncResult{BusinessID: "b-1", Upserted: 2}},
		},
	}
	service, audits := newTestServiceWithSyncer(businesses, syncer, []common.ID{"audit-1"})

	record, err := service.RunSettlementSync(context.Background(), RunSettlementSyncCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  &businessID,
	})
	if err != nil {
		t.Fatalf("run settlement sync: %v", err)
	}
	if record.Synced != 1 || record.Upserted != 2 {
		t.Fatalf("unexpected single-store sync result: %+v", record)
	}
	if len(syncer.commands) != 1 || syncer.commands[0].BusinessID != businessID {
		t.Fatalf("expected only the named store synced, got %+v", syncer.commands)
	}
	if audits.created[0].TargetID != "b-1" {
		t.Fatalf("expected the audit targeted at the store, got %+v", audits.created[0])
	}
}

func TestRunSettlementSyncFailsClosedWithoutSyncer(t *testing.T) {
	t.Parallel()

	service, _ := newTestServiceWithSyncer(&fakeAdminBusinesses{}, nil, []common.ID{"audit-1"})
	_, err := service.RunSettlementSync(context.Background(), RunSettlementSyncCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected the endpoint to fail closed with no syncer wired, got %v", err)
	}
}

type fakeSyncOutcome struct {
	result ports.SettlementSyncResult
	err    error
}

type fakeSettlementSyncer struct {
	commands []paymentsapp.SyncSettlementsCommand
	results  map[string]fakeSyncOutcome
}

func (f *fakeSettlementSyncer) SyncSettlements(_ context.Context, cmd paymentsapp.SyncSettlementsCommand) (ports.SettlementSyncResult, error) {
	f.commands = append(f.commands, cmd)
	outcome, ok := f.results[cmd.BusinessID.String()]
	if !ok {
		return ports.SettlementSyncResult{BusinessID: cmd.BusinessID}, nil
	}
	return outcome.result, outcome.err
}

// newTestServiceWithSyncer builds the admin service with the payout-sync
// dependency wired, reusing the shared test fixture shape.
func newTestServiceWithSyncer(
	businesses *fakeAdminBusinesses,
	syncer SettlementSyncer,
	ids []common.ID,
) (Service, *fakeAdminAudits) {
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		ids,
	)
	service.settlementSyncer = syncer
	return service, audits
}
