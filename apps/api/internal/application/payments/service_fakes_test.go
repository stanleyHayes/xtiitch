package paymentsapp

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeProvider struct {
	subaccountRef        string
	subaccountCreated    bool
	subaccountUpdated    bool
	createInput          ports.CreateBusinessSubaccountInput
	updateInput          ports.UpdateBusinessSubaccountInput
	initCalled           bool
	verifySig            bool
	event                ports.ProviderChargeEvent
	transferEvent        ports.ProviderTransferEvent
	transferErr          error
	initResult           ports.InitializeTransactionResult
	initInput            ports.InitializeTransactionInput
	verifyResult         ports.VerifyAuthorizationResult
	verifyErr            error
	settlements          []ports.ProviderSettlement
	settlementsErr       error
	settlementsInput     ports.ListSettlementsInput
	listSettlementsCalls int
}

func (p *fakeProvider) CreateBusinessSubaccount(
	_ context.Context,
	input ports.CreateBusinessSubaccountInput,
) (ports.CreateBusinessSubaccountResult, error) {
	p.subaccountCreated = true
	p.createInput = input
	return ports.CreateBusinessSubaccountResult{ProviderReference: p.subaccountRef}, nil
}

func (p *fakeProvider) UpdateBusinessSubaccount(_ context.Context, input ports.UpdateBusinessSubaccountInput) error {
	p.subaccountUpdated = true
	p.updateInput = input
	return nil
}

type fakeMoMoOTP struct {
	requestedNumber string
	verifiedNumber  string
	verifiedCode    string
	requestErr      error
	verifyErr       error
}

func (f *fakeMoMoOTP) RequestBusinessPhoneOTP(_ context.Context, number string) error {
	f.requestedNumber = number
	return f.requestErr
}

func (f *fakeMoMoOTP) VerifyBusinessPhoneOTP(_ context.Context, number string, code string) error {
	if f.verifyErr != nil {
		return f.verifyErr
	}
	f.verifiedNumber = number
	f.verifiedCode = code
	return nil
}

func (p *fakeProvider) InitializeTransaction(
	_ context.Context,
	input ports.InitializeTransactionInput,
) (ports.InitializeTransactionResult, error) {
	p.initCalled = true
	p.initInput = input
	return p.initResult, nil
}

func (p *fakeProvider) InitializeAuthorization(
	context.Context,
	ports.InitializeAuthorizationInput,
) (ports.InitializeAuthorizationResult, error) {
	return ports.InitializeAuthorizationResult{}, nil
}

func (p *fakeProvider) VerifyAuthorization(context.Context, ports.VerifyAuthorizationInput) (ports.VerifyAuthorizationResult, error) {
	return p.verifyResult, p.verifyErr
}

func (p *fakeProvider) ChargeAuthorization(context.Context, ports.ChargeAuthorizationInput) (ports.ChargeAuthorizationResult, error) {
	return ports.ChargeAuthorizationResult{}, nil
}

func (p *fakeProvider) VerifyWebhookSignature(_ []byte, _ string) bool { return p.verifySig }

func (p *fakeProvider) PeekEventType(payload []byte) string {
	if p.transferEvent.EventType != "" {
		return p.transferEvent.EventType
	}
	return p.event.EventType
}

func (p *fakeProvider) ParseChargeEvent(_ []byte) (ports.ProviderChargeEvent, error) {
	return p.event, nil
}

func (p *fakeProvider) ParseTransferEvent(_ []byte) (ports.ProviderTransferEvent, error) {
	return p.transferEvent, p.transferErr
}

func (p *fakeProvider) ListSettlements(_ context.Context, input ports.ListSettlementsInput) ([]ports.ProviderSettlement, error) {
	p.listSettlementsCalls++
	p.settlementsInput = input
	if p.settlementsErr != nil {
		return nil, p.settlementsErr
	}
	return p.settlements, nil
}

type fakePaymentRepo struct {
	created       []ports.CreatePaymentInput
	confirmCalled bool
	confirmInput  ports.ConfirmPaymentInput
	confirmResult ports.ConfirmPaymentResult
	list          []ports.PaymentRecord
	taking        ports.ManualTakingInput
	summary       ports.MoneySummary
	summaryPeriod ports.MoneyPeriod

	byReference    map[string]ports.PaymentRecord
	byReferenceErr error

	providerEvents   []ports.RecordProviderEventInput
	recordEventIsNew bool
	recordEventErr   error

	subaccountBusinessID common.ID
	subaccountFound      bool
	subaccountLookups    []string

	upsertedSettlements [][]ports.ProviderSettlementInput
	upsertCount         int
	upsertErr           error

	settlementsList   []ports.ProviderSettlementRecord
	settlementsPaging []int
	settlementsPeriod ports.MoneyPeriod
	syncedMarked      []common.ID
	markSyncedErr     error
}

func (r *fakePaymentRepo) Create(_ context.Context, input ports.CreatePaymentInput) error {
	r.created = append(r.created, input)
	return nil
}

func (r *fakePaymentRepo) ConfirmFromProvider(_ context.Context, input ports.ConfirmPaymentInput) (ports.ConfirmPaymentResult, error) {
	r.confirmCalled = true
	r.confirmInput = input
	return r.confirmResult, nil
}

func (r *fakePaymentRepo) FindByProviderReference(_ context.Context, _ common.TenantScope, providerReference string) (ports.PaymentRecord, error) {
	if r.byReferenceErr != nil {
		return ports.PaymentRecord{}, r.byReferenceErr
	}
	record, ok := r.byReference[providerReference]
	if !ok {
		return ports.PaymentRecord{}, ports.ErrNotFound
	}
	return record, nil
}

func (r *fakePaymentRepo) ListByBusiness(_ context.Context, _ common.TenantScope) ([]ports.PaymentRecord, error) {
	return r.list, nil
}

func (r *fakePaymentRepo) RecordManualTaking(_ context.Context, _ common.TenantScope, input ports.ManualTakingInput) error {
	r.taking = input
	return nil
}

func (r *fakePaymentRepo) ListManualTakings(_ context.Context, _ common.TenantScope, _ ports.MoneyPeriod) ([]ports.ManualTakingRecord, error) {
	return nil, nil
}

func (r *fakePaymentRepo) MoneySummary(_ context.Context, _ common.TenantScope, period ports.MoneyPeriod) (ports.MoneySummary, error) {
	r.summaryPeriod = period
	return r.summary, nil
}

func (r *fakePaymentRepo) ListMoneyTransactions(
	_ context.Context,
	_ common.TenantScope,
	_ ports.MoneyPeriod,
	_ int,
	_ int,
) ([]ports.MoneyTransactionRecord, error) {
	return nil, nil
}

func (r *fakePaymentRepo) RecordProviderEvent(_ context.Context, input ports.RecordProviderEventInput) (bool, error) {
	r.providerEvents = append(r.providerEvents, input)
	if r.recordEventErr != nil {
		return false, r.recordEventErr
	}
	return r.recordEventIsNew, nil
}

func (r *fakePaymentRepo) FindBusinessBySubaccount(_ context.Context, subaccountCode string) (common.ID, bool, error) {
	r.subaccountLookups = append(r.subaccountLookups, subaccountCode)
	return r.subaccountBusinessID, r.subaccountFound, nil
}

func (r *fakePaymentRepo) UpsertProviderSettlements(_ context.Context, _ common.ID, settlements []ports.ProviderSettlementInput) (int, error) {
	r.upsertedSettlements = append(r.upsertedSettlements, settlements)
	if r.upsertErr != nil {
		return 0, r.upsertErr
	}
	if r.upsertCount != 0 {
		return r.upsertCount, nil
	}
	return len(settlements), nil
}

func (r *fakePaymentRepo) ListProviderSettlements(
	_ context.Context, _ common.TenantScope, period ports.MoneyPeriod, limit int, offset int,
) ([]ports.ProviderSettlementRecord, error) {
	r.settlementsPeriod = period
	r.settlementsPaging = []int{limit, offset}
	return r.settlementsList, nil
}

func (r *fakePaymentRepo) MarkSettlementsSynced(_ context.Context, businessID common.ID) error {
	r.syncedMarked = append(r.syncedMarked, businessID)
	return r.markSyncedErr
}

type fakeChargeRepo struct {
	context       ports.BusinessChargeContext
	provisioned   bool
	provisionedAs ports.ProvisionSubaccountInput
}

func (r *fakeChargeRepo) GetChargeContext(_ context.Context, _ common.TenantScope) (ports.BusinessChargeContext, error) {
	return r.context, nil
}

func (r *fakeChargeRepo) ProvisionSubaccount(_ context.Context, input ports.ProvisionSubaccountInput) error {
	r.provisioned = true
	r.provisionedAs = input
	return nil
}

type sequenceIDs struct {
	ids []common.ID
}

func (s *sequenceIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
