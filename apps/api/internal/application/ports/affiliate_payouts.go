package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// AffiliatePayoutProvider provisions a Paystack beneficiary for commissions
// that have completed the Partner programme's maturity window. This is a
// transfer recipient, not a transaction subaccount: Partner earnings are paid
// later and must never be split out before refund/fraud holds mature.
type AffiliatePayoutProvider interface {
	CreateAffiliateTransferRecipient(
		context.Context,
		CreateAffiliateTransferRecipientInput,
	) (CreateAffiliateTransferRecipientResult, error)
}

type AffiliateTransferProvider interface {
	InitiateAffiliateTransfer(context.Context, InitiateAffiliateTransferInput) (InitiateAffiliateTransferResult, error)
}

type CreateAffiliateTransferRecipientInput struct {
	RecipientType string
	AccountName   string
	AccountNumber string
	BankCode      string
}

type CreateAffiliateTransferRecipientResult struct {
	RecipientCode string
}

type InitiateAffiliateTransferInput struct {
	AmountMinor   int64
	RecipientCode string
	Reference     string
	Reason        string
}

type InitiateAffiliateTransferResult struct {
	TransferCode string
	Status       string
}

type AffiliatePayoutDispatch struct {
	PayoutBatchID common.ID
	AffiliateID   common.ID
	RecipientCode string
	Reference     string
	AmountMinor   int64
}

// AffiliatePayoutAutomationRepository owns the durable claim/reconcile state.
// A claim never settles commissions; only a provider success does that.
type AffiliatePayoutAutomationRepository interface {
	ClaimDueAffiliatePayout(context.Context, common.ID, time.Time) (AffiliatePayoutDispatch, bool, error)
	RecordAffiliatePayoutAttempt(context.Context, common.ID, string, string, string) error
	ApplyAffiliateTransferEvent(context.Context, string, string, string) (bool, error)
}
