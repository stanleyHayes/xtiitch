package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ReportsRepository is the read side of the §14.3/§14.4 exports. The financial
// dataset reads the SAME persisted Paystack figures as the Money Desk — stored
// amounts, stored commission, stored provider fee, mirrored settlements —
// summed/listed, never recomputed (§3.2/§14.5).
type ReportsRepository struct {
	pool *pgxpool.Pool
}

func NewReportsRepository(pool *pgxpool.Pool) ReportsRepository {
	return ReportsRepository{pool: pool}
}

//nolint:funlen,gocognit,gocyclo // the report is a single consistent snapshot composed from several optional aggregates
func (repo ReportsRepository) FinancialReport(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) (ports.FinancialReportData, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.FinancialReportData{}, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.FinancialReportData{}, err
	}

	lower := windowLowerArg(window)
	var data ports.FinancialReportData

	// Totals: the Money Desk formula (payment_repository.MoneySummary) with the
	// export window applied. Store share = amount − commission − provider fee,
	// all persisted columns.
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0),
			coalesce(sum(commission_minor), 0),
			coalesce(sum(coalesce(xtiitch_tax_minor, 0)), 0),
			coalesce(sum(coalesce(provider_fee_minor, 0)), 0),
			coalesce(sum(amount_minor - commission_minor - coalesce(provider_fee_minor, 0)), 0)
		from payments
		where business_id = $1 and status = 'succeeded' and through_platform = true
			and ($2::timestamptz is null or created_at >= $2) and created_at < $3
	`, scope.BusinessID.String(), lower, window.To).Scan(
		&data.Totals.ThroughPlatformMinor, &data.Totals.CommissionMinor,
		&data.Totals.XtiitchTaxMinor, &data.Totals.PaystackFeeMinor, &data.Totals.StoreShareMinor,
	); err != nil {
		return ports.FinancialReportData{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0)
		from paystack_settlements
		where business_id = $1 and status = 'success'
			and ($2::timestamptz is null or created_at >= $2) and created_at < $3
	`, scope.BusinessID.String(), lower, window.To).Scan(&data.Totals.SettledPayoutsMinor); err != nil {
		return ports.FinancialReportData{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0)
		from manual_takings
		where business_id = $1
			and ($2::timestamptz is null or taken_at >= $2) and taken_at < $3
	`, scope.BusinessID.String(), lower, window.To).Scan(&data.Totals.ManualTakingsMinor); err != nil {
		return ports.FinancialReportData{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(commission_minor), 0)
		from manual_takings
		where business_id = $1 and commission_status in ('due', 'invoiced')
			and ($2::timestamptz is null or taken_at >= $2) and taken_at < $3
	`, scope.BusinessID.String(), lower, window.To).Scan(&data.Totals.OfflineCommissionDueMinor); err != nil {
		return ports.FinancialReportData{}, err
	}

	// Payments: money that actually moved (succeeded through-platform), so the
	// listing always reconciles with the totals above (§14.5 one data source).
	rows, err := tx.Query(ctx, `
		select created_at, provider_reference, purpose, coalesce(method, ''), status,
			amount_minor, commission_minor,
			coalesce(xtiitch_tax_minor, 0), coalesce(provider_fee_minor, 0),
			amount_minor - commission_minor - coalesce(provider_fee_minor, 0) as store_share
		from payments
		where business_id = $1 and status = 'succeeded' and through_platform = true
			and ($2::timestamptz is null or created_at >= $2) and created_at < $3
		order by created_at
	`, scope.BusinessID.String(), lower, window.To)
	if err != nil {
		return ports.FinancialReportData{}, err
	}
	for rows.Next() {
		var row ports.FinancialPaymentRow
		if err := rows.Scan(
			&row.CreatedAt, &row.ProviderReference, &row.Purpose, &row.Method, &row.Status,
			&row.AmountMinor, &row.CommissionMinor, &row.XtiitchTaxMinor,
			&row.ProviderFeeMinor, &row.StoreShareMinor,
		); err != nil {
			rows.Close()
			return ports.FinancialReportData{}, err
		}
		data.Payments = append(data.Payments, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.FinancialReportData{}, err
	}

	// Settlements: the mirrored Paystack payout history (§3.3), every status.
	rows, err = tx.Query(ctx, `
		select created_at, settled_at, provider_reference, status, amount_minor
		from paystack_settlements
		where business_id = $1
			and ($2::timestamptz is null or created_at >= $2) and created_at < $3
		order by created_at
	`, scope.BusinessID.String(), lower, window.To)
	if err != nil {
		return ports.FinancialReportData{}, err
	}
	for rows.Next() {
		var row ports.FinancialSettlementRow
		if err := rows.Scan(&row.CreatedAt, &row.SettledAt, &row.ProviderReference, &row.Status, &row.AmountMinor); err != nil {
			rows.Close()
			return ports.FinancialReportData{}, err
		}
		data.Settlements = append(data.Settlements, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.FinancialReportData{}, err
	}

	rows, err = tx.Query(ctx, `
		select taken_at, amount_minor, method, what_for, commission_minor, commission_status
		from manual_takings
		where business_id = $1
			and ($2::timestamptz is null or taken_at >= $2) and taken_at < $3
		order by taken_at
	`, scope.BusinessID.String(), lower, window.To)
	if err != nil {
		return ports.FinancialReportData{}, err
	}
	for rows.Next() {
		var row ports.FinancialTakingRow
		if err := rows.Scan(&row.TakenAt, &row.AmountMinor, &row.Method, &row.WhatFor, &row.CommissionMinor, &row.CommissionStatus); err != nil {
			rows.Close()
			return ports.FinancialReportData{}, err
		}
		data.Takings = append(data.Takings, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.FinancialReportData{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.FinancialReportData{}, err
	}
	return data, nil
}

func (repo ReportsRepository) SalesReport(ctx context.Context, scope common.TenantScope, window ports.AnalyticsWindow) (ports.SalesReportData, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.SalesReportData{}, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.SalesReportData{}, err
	}

	rows, err := tx.Query(ctx, `
		select o.order_id, o.created_at, o.status, o.flow,
			d.title, coalesce(c.display_name, ''), coalesce(o.delivery_method, ''),
			o.agreed_total_minor, o.settled_minor
		from orders o
		join designs d on d.design_id = o.design_id and d.business_id = o.business_id
		left join customers c on c.customer_id = o.customer_id
		where o.business_id = $1 and o.status <> 'draft'
			and ($2::timestamptz is null or o.created_at >= $2) and o.created_at < $3
		order by o.created_at
	`, scope.BusinessID.String(), windowLowerArg(window), window.To)
	if err != nil {
		return ports.SalesReportData{}, err
	}
	defer rows.Close()

	var data ports.SalesReportData
	for rows.Next() {
		var row ports.SalesOrderRow
		if err := rows.Scan(
			&row.OrderID, &row.CreatedAt, &row.Status, &row.Flow,
			&row.DesignTitle, &row.CustomerName, &row.DeliveryMethod,
			&row.AgreedTotalMinor, &row.SettledMinor,
		); err != nil {
			return ports.SalesReportData{}, err
		}
		data.Orders = append(data.Orders, row)
	}
	if err := rows.Err(); err != nil {
		return ports.SalesReportData{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.SalesReportData{}, err
	}
	return data, nil
}
