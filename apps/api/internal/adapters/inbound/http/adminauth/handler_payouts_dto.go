package adminauthhttp

type settlementSyncRequest struct {
	// BusinessID, when set, syncs that one store; empty syncs every store with
	// a subaccount on file (the worker/ops default).
	BusinessID string `json:"business_id"`
}

type payoutRowResponse struct {
	BusinessID        string `json:"business_id"`
	BusinessName      string `json:"business_name"`
	Handle            string `json:"handle"`
	OwnerLegalName    string `json:"owner_legal_name"`
	MomoNetwork       string `json:"momo_network"`
	MomoNumber        string `json:"momo_number"`
	MomoAccountName   string `json:"momo_account_name"`
	SubaccountCode    string `json:"subaccount_code"`
	TotalSalesMinor   int64  `json:"total_sales_minor"`
	TotalSettledMinor int64  `json:"total_settled_minor"`
	XtiitchFeesMinor  int64  `json:"xtiitch_fees_minor"`
	XtiitchTaxMinor   int64  `json:"xtiitch_tax_minor"`
	AmountDueMinor    int64  `json:"amount_due_minor"`
	LastPayoutAt      string `json:"last_payout_at"`
	LastPayoutStatus  string `json:"last_payout_status"`
}

type payoutHistoryRowResponse struct {
	SettlementID string `json:"settlement_id"`
	Reference    string `json:"reference"`
	AmountMinor  int64  `json:"amount_minor"`
	Status       string `json:"status"`
	SettledAt    string `json:"settled_at"`
	CreatedAt    string `json:"created_at"`
}

type settlementSyncResponse struct {
	Synced   int `json:"synced"`
	Skipped  int `json:"skipped"`
	Failed   int `json:"failed"`
	Upserted int `json:"upserted"`
}
