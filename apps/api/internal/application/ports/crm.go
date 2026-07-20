package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §15 Customer CRM — tenant-scoped read-and-annotate models over data the
// platform already persists (§15.3: "auto-populated, not manual … one customer
// record … tenant-scoped always"). The CRM NEVER creates customers: the order
// flow does (ResolveOrCreateCustomerByPhone + the order transaction's upsert).
// The relationship set is DERIVED — a customer belongs to a store's CRM when
// they have an order or a measurement record with that store (orders ∪
// order_measurements). The customer_businesses junction is NOT used: the order
// flow never writes it today, so deriving from it would show an empty CRM.

// CRM list segmentation (§15.1 Growth: "filter & segment the list …
// new/returning, last order"). The application validates the segment value;
// the repository just applies it.
const (
	CRMSegmentNew       = "new"       // first order with this store within the last 30 days
	CRMSegmentReturning = "returning" // more than one order with this store
	CRMSegmentLapsed    = "lapsed"    // no order with this store in 90+ days
)

// CRMCustomerQuery is the §15.1 customer-list read. The application has
// already entitlement-gated every field: Q is Starter+ (search), the
// tag/segment/spend/last-order filters are Growth+ — a plan without the level
// never reaches the repository with them set.
type CRMCustomerQuery struct {
	Q               string
	Tag             string
	Segment         string
	MinSpendMinor   *int64
	LastOrderBefore *time.Time
	LastOrderAfter  *time.Time
	// Now is the segment reference instant (new = first order within 30 days
	// of Now; lapsed = no order in the 90 days before Now), supplied by the
	// service clock so the math is deterministic under test.
	Now time.Time
	// Limit 0 means NO limit (the export path: a whole-list read); the paged
	// endpoint always passes a concrete limit.
	Limit  int
	Offset int
}

// CRMCustomerRow is one §15.1 list row. Source is the customer's first-order
// channel with this store ("online" / "walk_in") — orders carry no other
// origin/store-source field, and the CRM is single-store by definition (§15.3
// tenant-scoped), so "source store" from the matrix is always this store.
// OrdersCount/TotalSpendMinor/Tags are always populated by the repository; the
// APPLICATION blanks them for plans below the §15.1 ladder rung (spend/counts
// Starter+, tags Growth+), never the other way round.
type CRMCustomerRow struct {
	CustomerID      common.ID
	DisplayName     string
	Phone           string
	WhatsAppNumber  string
	Source          string
	LastOrderAt     *time.Time
	OrdersCount     int
	TotalSpendMinor int64
	Tags            []string
}

// CRMCustomerList is one page plus the unfiltered-by-page total (for the
// dashboard's pagination controls).
type CRMCustomerList struct {
	Customers []CRMCustomerRow
	Total     int
}

// CRMOrderSummary is one line of the §15.1 "full order history" on the
// profile: every non-draft order the customer placed with THIS store (drafts
// are abandoned checkouts, not orders — same rule as §14 analytics).
type CRMOrderSummary struct {
	OrderID          common.ID
	Status           string
	AgreedTotalMinor *int64
	SettledMinor     int64
	CreatedAt        time.Time
}

// CRMMeasurement is one saved measurement record on the profile (§15.1
// "saved measurements on the profile"): the SAME order_measurements rows the
// measurement module writes — never a parallel copy (§15.3).
type CRMMeasurement struct {
	MeasurementID common.ID
	OrderID       common.ID
	Source        string
	Values        map[string]string
	CreatedAt     time.Time
}

// CRMCustomerProfile is the §15.1 profile: contact details (power the
// call/WhatsApp buttons), full order history with this store, saved
// measurements, spend/order totals, the owner's note and tags. Note/Tags are
// tenant-owned annotations (000110/000111); the application blanks them below
// their ladder rungs (notes Starter+, tags Growth+).
type CRMCustomerProfile struct {
	CustomerID      common.ID
	DisplayName     string
	Phone           string
	WhatsAppNumber  string
	Email           string
	Source          string
	FirstOrderAt    *time.Time
	LastOrderAt     *time.Time
	OrdersCount     int
	TotalSpendMinor int64
	Orders          []CRMOrderSummary
	Measurements    []CRMMeasurement
	Note            string
	NoteUpdatedAt   *time.Time
	Tags            []string
}

// CRMCustomerNote is the persisted §15.1 note row after an upsert.
type CRMCustomerNote struct {
	Note      string
	UpdatedAt time.Time
}

// CRMLapsedCustomer is one row of the §15.1 "last-seen / lapsed view": no
// order with this store in 90+ days, longest-absent first.
type CRMLapsedCustomer struct {
	CustomerID  common.ID
	DisplayName string
	Phone       string
	LastOrderAt time.Time
}

// CRMInsights is the §15.1 Growth "new vs returning + last-seen / lapsed
// view". New = first order with this store within the last 30 days; returning
// = more than one order with this store; lapsed = no order in 90+ days.
type CRMInsights struct {
	NewCustomers30d    int
	ReturningCustomers int
	LapsedCustomers    []CRMLapsedCustomer
}

// CRMRepository serves the §15 reads and the two annotation writes. Every
// method runs under the caller's tenant scope (RLS + an explicit business_id
// predicate, §6): no store's CRM can ever read or annotate another store's
// customers. There is deliberately NO create-customer method (§15.3
// auto-populated: the record arrives via the order flow).
type CRMRepository interface {
	// ListCustomers returns the derived relationship set, newest-active first.
	ListCustomers(ctx context.Context, scope common.TenantScope, query CRMCustomerQuery) (CRMCustomerList, error)
	// GetCustomerProfile returns the single-customer profile, or ErrNotFound
	// when the customer has NO relationship with this store (cross-tenant
	// reads fail closed as an ordinary 404, §6).
	GetCustomerProfile(ctx context.Context, scope common.TenantScope, customerID common.ID) (CRMCustomerProfile, error)
	// UpsertNote saves the owner's note (one per business-customer). It is
	// ErrNotFound when the customer has no relationship with this store — a
	// store cannot annotate a stranger's customer.
	UpsertNote(ctx context.Context, scope common.TenantScope, customerID common.ID, note string) (CRMCustomerNote, error)
	// ReplaceTags swaps the customer's whole tag set for the given one
	// (delete-and-insert in one transaction). ErrNotFound like UpsertNote.
	ReplaceTags(ctx context.Context, scope common.TenantScope, customerID common.ID, tags []string) error
	// Insights computes the new/returning/lapsed figures as of `now`.
	Insights(ctx context.Context, scope common.TenantScope, now time.Time) (CRMInsights, error)
}
