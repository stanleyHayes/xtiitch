package ports

import "context"

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

type CreateAffiliateTransferRecipientInput struct {
	RecipientType string
	AccountName   string
	AccountNumber string
	BankCode      string
}

type CreateAffiliateTransferRecipientResult struct {
	RecipientCode string
}
