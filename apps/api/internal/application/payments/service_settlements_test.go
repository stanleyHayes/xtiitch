package paymentsapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// §3.2: the quote's VAT-on-fee is persisted with the charge (alongside
// commission_minor, which stays fee+tax) so the Money Desk can later split the
// Xtiitch fee from its tax using stored figures only.
func TestInitiateChargePersistsQuotedTax(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Name: "Ama", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}
	service := NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
		VATRates:   &fakeVATRates{rateBps: 2000},
	})

	if _, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeStandardFull,
		AmountMinor:   20000,
		Method:        money.PaymentMethodMomo,
		CustomerEmail: "buyer@example.com",
	}); err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if len(payments.created) != 1 {
		t.Fatalf("expected one payment recorded, got %d", len(payments.created))
	}
	created := payments.created[0]
	// 3% of 20000 = 600 fee; 20% VAT on the fee = 120 tax. commission_minor
	// stays fee+tax (720 — the split's transaction_charge); the tax part is
	// persisted alongside so the fee can be split back out without recomputing.
	if created.CommissionMinor != 720 || created.XtiitchTaxMinor != 120 {
		t.Fatalf("expected commission 720 (fee+tax) + persisted tax 120, got %+v", created)
	}
}

// §3.2: a charge confirmation must carry the provider-REPORTED fee into
// persistence — the Money Desk reads that stored figure and never recomputes.
func TestHandleProviderEventCarriesProviderFeeIntoConfirmation(t *testing.T) {
	t.Parallel()

	payments := &fakePaymentRepo{}
	provider := &fakeProvider{
		verifySig: true,
		event: ports.ProviderChargeEvent{
			EventType:         "charge.success",
			ProviderReference: "xt_fee_1",
			Succeeded:         true,
			AmountMinor:       20000,
			FeeMinor:          390,
			Signature:         "paystack:charge.success:xt_fee_1",
		},
	}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments, Businesses: &fakeChargeRepo{},
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	if err := service.HandleProviderEvent(context.Background(), []byte(`{}`), "sig"); err != nil {
		t.Fatalf("handle provider event: %v", err)
	}
	if !payments.confirmCalled {
		t.Fatal("expected the confirmation to reach the repository")
	}
	if payments.confirmInput.ProviderFeeMinor != 390 {
		t.Fatalf("expected the provider-reported fee 390 to be persisted, got %d", payments.confirmInput.ProviderFeeMinor)
	}
}

// §3.3: a sync mirrors the provider's settlement rows for the store's
// subaccount and stamps the throttle watermark.
func TestSyncSettlementsUpsertsProviderRowsAndMarksSynced(t *testing.T) {
	t.Parallel()

	settledAt := time.Date(2026, 7, 18, 9, 30, 0, 0, time.UTC)
	provider := &fakeProvider{
		settlements: []ports.ProviderSettlement{
			{ProviderReference: "paystack_settlement:11", SubaccountCode: "ACCT_1", AmountMinor: 9700, Status: "success", SettledAt: &settledAt, RawPayload: []byte(`{"id":11}`)},
			{ProviderReference: "paystack_settlement:12", SubaccountCode: "ACCT_1", AmountMinor: 4850, Status: "pending"},
		},
	}
	payments := &fakePaymentRepo{}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Verified: true, SubaccountRef: "ACCT_1",
	}}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments, Businesses: businesses,
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	result, err := service.SyncSettlements(context.Background(), SyncSettlementsCommand{BusinessID: "business-1"})
	if err != nil {
		t.Fatalf("sync settlements: %v", err)
	}
	if result.Skipped || result.Upserted != 2 {
		t.Fatalf("expected 2 upserted and not skipped, got %+v", result)
	}
	if provider.settlementsInput.SubaccountRef != "ACCT_1" {
		t.Fatalf("expected the provider pull filtered by the store's subaccount, got %+v", provider.settlementsInput)
	}
	if len(payments.upsertedSettlements) != 1 {
		t.Fatalf("expected one upsert batch, got %d", len(payments.upsertedSettlements))
	}
	batch := payments.upsertedSettlements[0]
	if len(batch) != 2 || batch[0].ProviderReference != "paystack_settlement:11" ||
		batch[0].AmountMinor != 9700 || batch[0].SettledAt == nil || string(batch[0].RawPayload) != `{"id":11}` {
		t.Fatalf("unexpected upsert mapping: %+v", batch)
	}
	if len(payments.syncedMarked) != 1 || payments.syncedMarked[0] != common.ID("business-1") {
		t.Fatalf("expected the sync watermark stamped once, got %+v", payments.syncedMarked)
	}
}

// The read-path sync must not hammer the provider: a store synced inside the
// throttle window is skipped unless the sync is forced (webhook/operator).
func TestSyncSettlementsThrottlesUnlessForced(t *testing.T) {
	t.Parallel()

	synced := time.Now()
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Verified: true, SubaccountRef: "ACCT_1", SettlementsSyncedAt: &synced,
	}}
	provider := &fakeProvider{}
	payments := &fakePaymentRepo{}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments, Businesses: businesses,
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	result, err := service.SyncSettlements(context.Background(), SyncSettlementsCommand{BusinessID: "business-1"})
	if err != nil {
		t.Fatalf("sync settlements: %v", err)
	}
	if !result.Skipped {
		t.Fatalf("expected a recent watermark to skip the sync, got %+v", result)
	}
	if provider.listSettlementsCalls != 0 {
		t.Fatalf("expected no provider pull inside the throttle window, got %d", provider.listSettlementsCalls)
	}

	forced, err := service.SyncSettlements(context.Background(), SyncSettlementsCommand{BusinessID: "business-1", Force: true})
	if err != nil {
		t.Fatalf("forced sync settlements: %v", err)
	}
	if forced.Skipped || provider.listSettlementsCalls != 1 {
		t.Fatalf("expected the forced sync to bypass the throttle, got %+v (calls %d)", forced, provider.listSettlementsCalls)
	}
}

// A store without a subaccount settles nothing: the sync is a no-op, not an
// error (the operator sync iterates every store).
func TestSyncSettlementsSkipsStoreWithoutSubaccount(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{}
	service := NewService(Dependencies{
		Provider: provider, Payments: &fakePaymentRepo{}, Businesses: &fakeChargeRepo{context: ports.BusinessChargeContext{
			BusinessID: "business-1", Verified: true,
		}},
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	result, err := service.SyncSettlements(context.Background(), SyncSettlementsCommand{BusinessID: "business-1"})
	if err != nil {
		t.Fatalf("sync settlements: %v", err)
	}
	if !result.Skipped || provider.listSettlementsCalls != 0 {
		t.Fatalf("expected a subaccount-less store to be skipped without a provider call, got %+v", result)
	}
}

// §3.2: the Money Desk read kicks a best-effort sync — a provider failure must
// never break the read, and a fresh watermark must skip the pull entirely.
func TestMoneySummarySyncFailureNeverBreaksTheRead(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{settlementsErr: errors.New("paystack down")}
	payments := &fakePaymentRepo{summary: ports.MoneySummary{ThroughPlatformMinor: 20000, NetIncomeMinor: 19000}}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments,
		Businesses: &fakeChargeRepo{context: ports.BusinessChargeContext{
			BusinessID: "business-1", Verified: true, SubaccountRef: "ACCT_1",
		}},
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	summary, err := service.MoneySummary(context.Background(), common.TenantScope{BusinessID: "business-1"})
	if err != nil {
		t.Fatalf("money summary must survive a sync failure: %v", err)
	}
	if summary.NetIncomeMinor != 19000 {
		t.Fatalf("expected the repository summary through, got %+v", summary)
	}
	if provider.listSettlementsCalls != 1 {
		t.Fatalf("expected the read to attempt one sync, got %d", provider.listSettlementsCalls)
	}
}

// §4.10/§3.3: a transfer.* webhook records the event idempotently and forces a
// settlement refresh for the store the subaccount belongs to.
func TestTransferWebhookTriggersSettlementSync(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{
		verifySig: true,
		transferEvent: ports.ProviderTransferEvent{
			EventType:         "transfer.success",
			ProviderReference: "TRF_1",
			Status:            "success",
			SubaccountCode:    "ACCT_9",
			Succeeded:         true,
			Signature:         "paystack:transfer.success:TRF_1",
		},
		settlements: []ports.ProviderSettlement{
			{ProviderReference: "paystack_settlement:21", AmountMinor: 9700, Status: "success"},
		},
	}
	payments := &fakePaymentRepo{
		recordEventIsNew:     true,
		subaccountBusinessID: "business-9",
		subaccountFound:      true,
	}
	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-9", Verified: true, SubaccountRef: "ACCT_9",
	}}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments, Businesses: businesses,
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	if err := service.HandleProviderEvent(context.Background(), []byte(`{}`), "sig"); err != nil {
		t.Fatalf("handle transfer event: %v", err)
	}
	if len(payments.providerEvents) != 1 ||
		payments.providerEvents[0].EventSignature != "paystack:transfer.success:TRF_1" ||
		payments.providerEvents[0].EventType != "transfer.success" {
		t.Fatalf("expected the transfer event recorded idempotently, got %+v", payments.providerEvents)
	}
	if len(payments.subaccountLookups) != 1 || payments.subaccountLookups[0] != "ACCT_9" {
		t.Fatalf("expected the subaccount resolved to a store, got %+v", payments.subaccountLookups)
	}
	if len(payments.upsertedSettlements) != 1 || len(payments.syncedMarked) != 1 {
		t.Fatalf("expected a forced settlement sync for the store, got upserts %+v marks %+v",
			payments.upsertedSettlements, payments.syncedMarked)
	}
	if payments.confirmCalled {
		t.Fatal("a transfer event must never touch the charge confirmation path")
	}
}

// A re-delivered transfer event is a no-op: the idempotency row exists, so no
// second sync runs (§3.3 idempotency via the payment_provider_events pattern).
func TestTransferWebhookRedeliverySkipsSync(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{
		verifySig: true,
		transferEvent: ports.ProviderTransferEvent{
			EventType:         "transfer.success",
			ProviderReference: "TRF_1",
			SubaccountCode:    "ACCT_9",
			Signature:         "paystack:transfer.success:TRF_1",
		},
	}
	payments := &fakePaymentRepo{recordEventIsNew: false}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments, Businesses: &fakeChargeRepo{},
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	if err := service.HandleProviderEvent(context.Background(), []byte(`{}`), "sig"); err != nil {
		t.Fatalf("handle transfer event: %v", err)
	}
	if provider.listSettlementsCalls != 0 || len(payments.upsertedSettlements) != 0 {
		t.Fatalf("expected a redelivered event to skip the sync, got calls %d upserts %+v",
			provider.listSettlementsCalls, payments.upsertedSettlements)
	}
}

// A transfer event for a subaccount we do not recognize is still recorded (the
// delivery is genuine) but refreshes nothing.
func TestTransferWebhookUnknownSubaccountIsANoOp(t *testing.T) {
	t.Parallel()

	provider := &fakeProvider{
		verifySig: true,
		transferEvent: ports.ProviderTransferEvent{
			EventType:         "transfer.failed",
			ProviderReference: "TRF_2",
			SubaccountCode:    "ACCT_unknown",
			Signature:         "paystack:transfer.failed:TRF_2",
		},
	}
	payments := &fakePaymentRepo{recordEventIsNew: true, subaccountFound: false}
	service := NewService(Dependencies{
		Provider: provider, Payments: payments, Businesses: &fakeChargeRepo{},
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	if err := service.HandleProviderEvent(context.Background(), []byte(`{}`), "sig"); err != nil {
		t.Fatalf("handle transfer event: %v", err)
	}
	if len(payments.providerEvents) != 1 {
		t.Fatalf("expected the unknown-store event still recorded, got %+v", payments.providerEvents)
	}
	if provider.listSettlementsCalls != 0 {
		t.Fatalf("expected no sync for an unknown subaccount, got %d calls", provider.listSettlementsCalls)
	}
}

// The payout history endpoint's service path pages the mirrored rows.
func TestListPayoutsPassesScopeAndPaging(t *testing.T) {
	t.Parallel()

	settledAt := time.Date(2026, 7, 18, 9, 30, 0, 0, time.UTC)
	payments := &fakePaymentRepo{
		settlementsList: []ports.ProviderSettlementRecord{
			{SettlementID: "s-1", ProviderReference: "paystack_settlement:11", AmountMinor: 9700, Status: "success", SettledAt: &settledAt},
		},
	}
	service := NewService(Dependencies{
		Provider: &fakeProvider{}, Payments: payments, Businesses: &fakeChargeRepo{},
		IDs: &sequenceIDs{ids: []common.ID{"unused"}},
	})

	records, err := service.ListPayouts(context.Background(), common.TenantScope{BusinessID: "business-1"}, 25, 50)
	if err != nil {
		t.Fatalf("list payouts: %v", err)
	}
	if len(records) != 1 || records[0].AmountMinor != 9700 {
		t.Fatalf("unexpected payout records: %+v", records)
	}
	if payments.settlementsPaging[0] != 25 || payments.settlementsPaging[1] != 50 {
		t.Fatalf("expected limit/offset passthrough, got %+v", payments.settlementsPaging)
	}
}
