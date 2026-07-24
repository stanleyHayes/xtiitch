package postgres

import (
	"context"
	"database/sql"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// allTimeMoneyFigures runs the unfiltered aggregates that back the all-time
// income card (§3, exempt from the period filter) and the settled-payouts
// total. All-time income is the accrued store share plus off-platform takings,
// less accrued offline commission — cumulative since joining, never reduced by
// payouts. Kept out of MoneySummary so that read stays within its length bound.
func allTimeMoneyFigures(ctx context.Context, tx pgx.Tx, businessID string) (income, settledPayouts int64, err error) {
	var storeShare, manualTakings, offlineCommissionDue int64
	if err = tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor - commission_minor - coalesce(provider_fee_minor, 0)), 0)
		from payments
		where business_id = $1 and status = 'succeeded' and through_platform = true
	`, businessID).Scan(&storeShare); err != nil {
		return 0, 0, err
	}
	if err = tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0)
		from paystack_settlements
		where business_id = $1 and status = 'success'
	`, businessID).Scan(&settledPayouts); err != nil {
		return 0, 0, err
	}
	if err = tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0)
		from manual_takings
		where business_id = $1
	`, businessID).Scan(&manualTakings); err != nil {
		return 0, 0, err
	}
	if err = tx.QueryRow(ctx, `
		select coalesce(sum(commission_minor), 0)
		from manual_takings
		where business_id = $1 and commission_status in ('due', 'invoiced')
	`, businessID).Scan(&offlineCommissionDue); err != nil {
		return 0, 0, err
	}
	return storeShare + manualTakings - offlineCommissionDue, settledPayouts, nil
}

// scanMoneyTransactionRows drains the Money Desk ledger query into records.
// Split out of ListMoneyTransactions so that read stays within its length bound.
func scanMoneyTransactionRows(rows pgx.Rows) ([]ports.MoneyTransactionRecord, error) {
	var records []ports.MoneyTransactionRecord
	for rows.Next() {
		var record ports.MoneyTransactionRecord
		var paymentID string
		var orderID sql.NullString
		if err := rows.Scan(
			&paymentID,
			&orderID,
			&record.ProviderReference,
			&record.Purpose,
			&record.Method,
			&record.AmountMinor,
			&record.DesignCostMinor,
			&record.PaystackFeeMinor,
			&record.XtiitchFeeMinor,
			&record.XtiitchTaxMinor,
			&record.TakeHomeMinor,
			&record.DesignTitle,
			&record.CustomerName,
			&record.CreatedAt,
		); err != nil {
			return nil, err
		}
		record.PaymentID = common.ID(paymentID)
		if orderID.Valid {
			value := common.ID(orderID.String)
			record.OrderID = &value
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return records, nil
}
