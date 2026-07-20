package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ListAdminPayoutsInput filters the §11.5 payouts CRM: a free-text query matched
// against business name, handle and owner legal name, plus limit/offset paging.
type ListAdminPayoutsInput struct {
	Query  string
	Limit  int
	Offset int
}

// AdminPayoutRecord is one row of the §11.5 payouts CRM — one per store. All
// figures are sums over PERSISTED provider-derived columns (Paystack is the
// source of truth, §3.2): total settled comes from mirrored settlement rows,
// fees/tax from the figures persisted per charge. AmountDueMinor uses the same
// formula as the store owner's own net income (§3.1): the store's net share
// plus manual takings less accrued offline commission, minus settled payouts —
// so admin and owner always see the same number.
type AdminPayoutRecord struct {
	BusinessID        common.ID
	BusinessName      string
	Handle            string
	OwnerLegalName    string
	MomoNetwork       string
	MomoNumber        string
	MomoAccountName   string
	SubaccountRef     string
	TotalSalesMinor   int64
	TotalSettledMinor int64
	XtiitchFeesMinor  int64
	XtiitchTaxMinor   int64
	AmountDueMinor    int64
	LastPayoutAt      *time.Time
	LastPayoutStatus  string
}

// AdminPayoutHistoryRecord is one settlement row in a store's payout history
// (§11.5 "Payout history: every payout made — amount, date, status").
type AdminPayoutHistoryRecord struct {
	SettlementID      common.ID
	ProviderReference string
	AmountMinor       int64
	Status            string
	SettledAt         *time.Time
	CreatedAt         time.Time
}

// AdminSettlementSyncRecord summarizes one operator-triggered settlement sync
// run (§3.3): how many stores synced, how many were skipped (throttled or no
// subaccount), how many failed, and the total settlement rows upserted.
type AdminSettlementSyncRecord struct {
	Synced   int
	Skipped  int
	Failed   int
	Upserted int
}
