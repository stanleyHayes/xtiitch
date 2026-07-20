package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §14.3/§14.4 Reports & exports — read models + schedule persistence. The
// financial report is built from the SAME persisted Paystack figures as the
// Money Desk (§3.2/§14.5): sums and rows over stored columns, never locally
// derived fees.

// FinancialTotals mirrors the Money Desk formula (payment_repository
// MoneySummary) with an added window filter. Store share per payment is the
// persisted amount − persisted commission − persisted provider fee.
type FinancialTotals struct {
	ThroughPlatformMinor      int64
	CommissionMinor           int64
	XtiitchTaxMinor           int64
	PaystackFeeMinor          int64
	StoreShareMinor           int64
	SettledPayoutsMinor       int64
	ManualTakingsMinor        int64
	OfflineCommissionDueMinor int64
}

// FinancialPaymentRow is one payment in the financial export. Every fee column
// is the value PERSISTED from the provider webhook/quote — verbatim, never
// recomputed (§3.2). A zero fee column means "not reported by the provider".
type FinancialPaymentRow struct {
	CreatedAt         time.Time
	ProviderReference string
	Purpose           string
	Method            string
	Status            string
	AmountMinor       int64
	CommissionMinor   int64
	XtiitchTaxMinor   int64
	ProviderFeeMinor  int64
	StoreShareMinor   int64
}

// FinancialSettlementRow is one mirrored Paystack settlement (the payout
// history side of the export, §3.3).
type FinancialSettlementRow struct {
	CreatedAt         time.Time
	SettledAt         *time.Time
	ProviderReference string
	Status            string
	AmountMinor       int64
}

// FinancialTakingRow is one off-platform manual taking.
type FinancialTakingRow struct {
	TakenAt          time.Time
	AmountMinor      int64
	Method           string
	WhatFor          string
	CommissionMinor  int64
	CommissionStatus string
}

// FinancialReportData is the full §14.3 financial-records dataset.
type FinancialReportData struct {
	Totals      FinancialTotals
	Payments    []FinancialPaymentRow
	Settlements []FinancialSettlementRow
	Takings     []FinancialTakingRow
}

// SalesOrderRow is one order in the sales report (§14.1 sales export).
type SalesOrderRow struct {
	OrderID          common.ID
	CreatedAt        time.Time
	Status           string
	Flow             string
	DesignTitle      string
	CustomerName     string
	DeliveryMethod   string
	AgreedTotalMinor *int64
	SettledMinor     int64
}

type SalesReportData struct {
	Orders []SalesOrderRow
}

// ReportSchedule is a business's scheduled-report config (000108, §14.1:
// Growth monthly, Studio any cadence). One row per business.
type ReportSchedule struct {
	BusinessID common.ID
	ReportKind string
	Format     string
	Cadence    string
	Email      string
	Enabled    bool
	LastSentAt *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// ReportsRepository backs the §14.3/§14.4 exports and the schedule config.
// Tenant-scoped reads run under the caller's scope; the schedule sweep methods
// (DueSchedules/MarkScheduleSent) run cross-tenant under the RLS bypass, like
// the outbox transport — only the internal/admin runner may call them.
type ReportsRepository interface {
	FinancialReport(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) (FinancialReportData, error)
	SalesReport(ctx context.Context, scope common.TenantScope, window AnalyticsWindow) (SalesReportData, error)
	// GetSchedule returns ports.ErrNotFound when the business has no schedule.
	GetSchedule(ctx context.Context, scope common.TenantScope) (ReportSchedule, error)
	UpsertSchedule(ctx context.Context, scope common.TenantScope, schedule ReportSchedule) error
	// DueSchedules returns every enabled schedule whose cadence interval has
	// elapsed since last_sent_at (never-sent schedules are due immediately).
	DueSchedules(ctx context.Context, now time.Time) ([]ReportSchedule, error)
	MarkScheduleSent(ctx context.Context, businessID common.ID, sentAt time.Time) error
}
