package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeAutomaticPayoutRepo struct {
	dispatches []ports.AffiliatePayoutDispatch
	recorded   []string
}

func (f *fakeAutomaticPayoutRepo) ClaimDueAffiliatePayout(_ context.Context, _ common.ID, _ time.Time) (ports.AffiliatePayoutDispatch, bool, error) {
	if len(f.dispatches) == 0 {
		return ports.AffiliatePayoutDispatch{}, false, nil
	}
	d := f.dispatches[0]
	f.dispatches = f.dispatches[1:]
	return d, true, nil
}
func (f *fakeAutomaticPayoutRepo) RecordAffiliatePayoutAttempt(_ context.Context, _ common.ID, _ string, status, failure string) error {
	f.recorded = append(f.recorded, status+":"+failure)
	return nil
}
func (*fakeAutomaticPayoutRepo) ApplyAffiliateTransferEvent(context.Context, string, string, string) (bool, error) {
	return false, nil
}

type fakeAutomaticTransferProvider struct {
	calls []ports.InitiateAffiliateTransferInput
	err   error
}

func (f *fakeAutomaticTransferProvider) InitiateAffiliateTransfer(_ context.Context, input ports.InitiateAffiliateTransferInput) (ports.InitiateAffiliateTransferResult, error) {
	f.calls = append(f.calls, input)
	if f.err != nil {
		return ports.InitiateAffiliateTransferResult{}, f.err
	}
	return ports.InitiateAffiliateTransferResult{TransferCode: "TRF_1", Status: "success"}, nil
}

func TestRunAffiliatePayoutSweepTransfersAndSettlesProviderSuccess(t *testing.T) {
	repo := &fakeAutomaticPayoutRepo{dispatches: []ports.AffiliatePayoutDispatch{{PayoutBatchID: "batch-1", RecipientCode: "RCP_1", Reference: "affiliate-batch-1", AmountMinor: 2500}}}
	provider := &fakeAutomaticTransferProvider{}
	service := Service{affiliatePayouts: repo, affiliatePayoutProvider: provider, ids: &sequenceIDs{ids: []common.ID{"batch-new", "unused"}}, clock: fixedClock{now: time.Date(2026, 9, 3, 12, 0, 0, 0, time.UTC)}}
	result, err := service.RunAffiliatePayoutSweep(context.Background(), RunAffiliatePayoutSweepCommand{ActorUserID: SystemActorUserID, ActorRole: admindomain.RoleOwner})
	if err != nil {
		t.Fatal(err)
	}
	if result.Claimed != 1 || result.Initiated != 1 || result.Settled != 1 || len(provider.calls) != 1 || provider.calls[0].AmountMinor != 2500 {
		t.Fatalf("unexpected result: %+v calls=%+v", result, provider.calls)
	}
	if len(repo.recorded) != 1 || repo.recorded[0] != "success:" {
		t.Fatalf("unexpected reconciliation: %v", repo.recorded)
	}
}

func TestRunAffiliatePayoutSweepKeepsProviderErrorRetryable(t *testing.T) {
	repo := &fakeAutomaticPayoutRepo{dispatches: []ports.AffiliatePayoutDispatch{{PayoutBatchID: "batch-1", RecipientCode: "RCP_1", Reference: "affiliate-batch-1", AmountMinor: 2500}}}
	provider := &fakeAutomaticTransferProvider{err: errors.New("timeout")}
	service := Service{affiliatePayouts: repo, affiliatePayoutProvider: provider, ids: &sequenceIDs{ids: []common.ID{"batch-new", "unused"}}, clock: fixedClock{now: time.Now()}}
	result, err := service.RunAffiliatePayoutSweep(context.Background(), RunAffiliatePayoutSweepCommand{ActorUserID: SystemActorUserID, ActorRole: admindomain.RoleOwner})
	if err != nil {
		t.Fatal(err)
	}
	if result.Failed != 1 || len(repo.recorded) != 1 || repo.recorded[0] != "failed:timeout" {
		t.Fatalf("unexpected retry state: %+v %v", result, repo.recorded)
	}
}
