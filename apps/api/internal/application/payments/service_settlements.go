package paymentsapp

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// settlementSyncThrottle bounds read-path settlement syncs (§3.3): the Money
// Desk pulls the store's payouts from the provider so they show near real
// time, but not more than once per window per business. Webhook- and
// operator-triggered syncs pass Force and skip the throttle.
const settlementSyncThrottle = 5 * time.Minute

type SyncSettlementsCommand struct {
	BusinessID common.ID
	// Force bypasses the throttle watermark — used by transfer.* webhooks and
	// the operator sync endpoint, where the trigger itself is the signal that
	// settlements changed.
	Force bool
}

// SyncSettlements mirrors the store's Paystack Settlements — the §3.2 ground
// truth for what actually paid out — into the local payout history, so the
// Money Desk and the §11.5 CRM read the provider's own figures. Upserts are
// keyed on the provider settlement reference, so repeats are no-ops. A store
// without a subaccount has nothing to sync (Skipped); a store synced inside
// the throttle window is skipped unless forced.
func (s Service) SyncSettlements(ctx context.Context, cmd SyncSettlementsCommand) (ports.SettlementSyncResult, error) {
	result := ports.SettlementSyncResult{BusinessID: cmd.BusinessID}
	if cmd.BusinessID.IsZero() {
		return result, ErrInvalidCharge
	}

	info, err := s.businesses.GetChargeContext(ctx, common.TenantScope{BusinessID: cmd.BusinessID})
	if err != nil {
		return result, err
	}
	if info.SubaccountRef == "" {
		// No subaccount → Paystack settles nothing for this store; nothing to mirror.
		result.Skipped = true
		return result, nil
	}
	if !cmd.Force && info.SettlementsSyncedAt != nil && time.Since(*info.SettlementsSyncedAt) < settlementSyncThrottle {
		result.Skipped = true
		return result, nil
	}

	settlements, err := s.provider.ListSettlements(ctx, ports.ListSettlementsInput{
		SubaccountRef: info.SubaccountRef,
	})
	if err != nil {
		return result, err
	}

	inputs := make([]ports.ProviderSettlementInput, 0, len(settlements))
	for _, settlement := range settlements {
		inputs = append(inputs, ports.ProviderSettlementInput(settlement))
	}
	upserted, err := s.payments.UpsertProviderSettlements(ctx, info.BusinessID, inputs)
	if err != nil {
		return result, err
	}
	if err := s.payments.MarkSettlementsSynced(ctx, info.BusinessID); err != nil {
		return result, err
	}

	result.Upserted = upserted
	return result, nil
}

// ListPayouts pages the store's mirrored settlement rows — the §3.3 payout
// history behind the Money Desk's payout table. Same read posture as
// ListPayments: any authenticated member of the business may view it.
func (s Service) ListPayouts(ctx context.Context, scope common.TenantScope, period ports.MoneyPeriod, limit int, offset int) ([]ports.ProviderSettlementRecord, error) {
	if scope.BusinessID.IsZero() {
		return nil, ErrInvalidCharge
	}
	_, _ = s.SyncSettlements(ctx, SyncSettlementsCommand{BusinessID: scope.BusinessID})
	return s.payments.ListProviderSettlements(ctx, scope, period, limit, offset)
}
