package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type PaymentRepository struct {
	pool *pgxpool.Pool
}

func NewPaymentRepository(pool *pgxpool.Pool) PaymentRepository {
	return PaymentRepository{pool: pool}
}

func (repo PaymentRepository) Create(ctx context.Context, input ports.CreatePaymentInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	var method any
	if input.Method != "" {
		method = input.Method
	}
	var settleAmount any
	if input.SettleAmountMinor > 0 {
		settleAmount = input.SettleAmountMinor
	}
	var xtiitchTax any
	if input.XtiitchTaxMinor > 0 {
		xtiitchTax = input.XtiitchTaxMinor
	}

	if _, err := tx.Exec(ctx, `
		insert into payments (
			payment_id, business_id, order_id, booking_id, purpose, amount_minor, currency, method,
			provider_reference, status, through_platform, commission_minor, xtiitch_tax_minor, settle_amount_minor
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'initiated', true, $10, $11, $12)
	`,
		input.PaymentID.String(), input.BusinessID.String(),
		nullableIDArg(input.OrderID), nullableIDArg(input.BookingID),
		input.Purpose, input.AmountMinor, input.Currency, method,
		input.ProviderReference, input.CommissionMinor, xtiitchTax, settleAmount,
	); err != nil {
		// A second in-flight balance charge for the same order is rejected by the
		// partial unique index; surface it as the dedicated sentinel so callers
		// can refuse cleanly rather than double-charging the customer.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "payments_one_open_balance_idx" {
			return ports.ErrPaymentInFlight
		}
		return err
	}

	return tx.Commit(ctx)
}

// ConfirmFromProvider records the webhook event and advances the matching
// payment in a single transaction. The event's unique signature makes a
// re-delivered confirmation a no-op, and a payment only moves out of
// 'initiated' once.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo PaymentRepository) ConfirmFromProvider(
	ctx context.Context,
	input ports.ConfirmPaymentInput) (ports.ConfirmPaymentResult,
	error,
) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	// A webhook arrives without a tenant context and finds the payment by its
	// provider reference, so the event-record and lookup run with the RLS bypass.
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	isNew, err := recordProviderEvent(ctx, tx, input)
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	if !isNew {
		return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{AlreadyProcessed: true})
	}

	payment, found, err := lookupPaymentByReference(ctx, tx, input.ProviderReference)
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	if !found {
		invoice, invoiceFound, err := reconcileSubscriptionInvoiceFromProvider(ctx, tx, input)
		if err != nil {
			return ports.ConfirmPaymentResult{}, err
		}
		if invoiceFound {
			return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{
				PaymentFound:             false,
				SubscriptionInvoiceFound: true,
				BusinessID:               common.ID(invoice.businessID),
			})
		}
		adPayment, adPaymentFound, err := reconcileAdCampaignPaymentFromProvider(ctx, tx, input)
		if err != nil {
			return ports.ConfirmPaymentResult{}, err
		}
		if adPaymentFound {
			return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{
				PaymentFound:           false,
				AdCampaignPaymentFound: true,
				BusinessID:             common.ID(adPayment.businessID),
			})
		}
		return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{
			PaymentFound:             false,
			SubscriptionInvoiceFound: false,
		})
	}

	if err := applyConfirmation(ctx, tx, input, payment); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{PaymentFound: true, BusinessID: common.ID(payment.businessID)})
}

// scopedPayment is the slice of the payment a webhook needs to settle it.
type scopedPayment struct {
	paymentID   string
	businessID  string
	orderID     sql.NullString
	bookingID   sql.NullString
	amountMinor int64
	// settleAmountMinor is the order portion (net of any buyer-borne fee) that
	// counts toward settled_minor; it equals amountMinor for legacy/absorbed-fee
	// payments and is what the settlement path must credit.
	settleAmountMinor int64
	purpose           string
}

type subscriptionInvoiceProviderMatch struct {
	invoiceID      string
	subscriptionID string
	businessID     string
	invoiceRef     string
	status         string
}

type adCampaignPaymentProviderMatch struct {
	paymentID   string
	campaignID  string
	businessID  string
	headline    string
	status      string
	amountMinor int64
}

// FindByProviderReference resolves one payment by its provider reference under
// the caller's tenant scope. A reference that names another business's payment
// (or none at all) comes back as ErrNotFound — the public verify endpoint must
// not be able to tell the two apart.
func (repo PaymentRepository) FindByProviderReference(
	ctx context.Context,
	scope common.TenantScope,
	providerReference string,
) (ports.PaymentRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.PaymentRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.PaymentRecord{}, err
	}

	var record ports.PaymentRecord
	err = tx.QueryRow(ctx, `
		select payment_id, business_id, purpose, amount_minor, currency,
			coalesce(method, ''), provider_reference, status, commission_minor
		from payments
		where business_id = $1 and provider_reference = $2
	`, scope.BusinessID.String(), providerReference).Scan(
		&record.PaymentID,
		&record.BusinessID,
		&record.Purpose,
		&record.AmountMinor,
		&record.Currency,
		&record.Method,
		&record.ProviderReference,
		&record.Status,
		&record.CommissionMinor,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.PaymentRecord{}, ports.ErrNotFound
	}
	if err != nil {
		return ports.PaymentRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.PaymentRecord{}, err
	}
	return record, nil
}

func (repo PaymentRepository) ListByBusiness(ctx context.Context, scope common.TenantScope) ([]ports.PaymentRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, scope.BusinessID.String()); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select payment_id, business_id, purpose, amount_minor, currency,
			coalesce(method, ''), provider_reference, status, commission_minor
		from payments
		where business_id = $1
		order by created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}

	var records []ports.PaymentRecord
	for rows.Next() {
		var record ports.PaymentRecord
		if err := rows.Scan(
			&record.PaymentID,
			&record.BusinessID,
			&record.Purpose,
			&record.AmountMinor,
			&record.Currency,
			&record.Method,
			&record.ProviderReference,
			&record.Status,
			&record.CommissionMinor,
		); err != nil {
			rows.Close()
			return nil, err
		}
		records = append(records, record)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo PaymentRepository) RecordManualTaking(ctx context.Context, scope common.TenantScope, input ports.ManualTakingInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	commissionStatus := input.CommissionStatus
	if commissionStatus == "" {
		commissionStatus = "not_applicable"
		if input.CommissionMinor > 0 {
			commissionStatus = "due"
		}
	}

	// Off-platform money never goes through Paystack. Commission here is an
	// accrued receivable for later invoice/reconciliation, not a moved split.
	if _, err := tx.Exec(ctx, `
		insert into manual_takings (
			taking_id, business_id, order_id, amount_minor, method, what_for,
			commission_bps, commission_minor, commission_status, commission_note,
			logged_by_business_user_id
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, input.TakingID.String(), input.BusinessID.String(), nullableIDArg(input.OrderID),
		input.AmountMinor, input.Method, input.WhatFor, input.CommissionBps,
		input.CommissionMinor, commissionStatus, input.CommissionNote,
		nullableUserIDArg(input.LoggedByUserID)); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo PaymentRepository) ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ports.ManualTakingRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select taking_id, amount_minor, method, what_for,
			commission_bps, commission_minor, commission_status, commission_note, taken_at
		from manual_takings where business_id = $1
		order by taken_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}

	var records []ports.ManualTakingRecord
	for rows.Next() {
		var record ports.ManualTakingRecord
		if err := rows.Scan(
			&record.TakingID,
			&record.AmountMinor,
			&record.Method,
			&record.WhatFor,
			&record.CommissionBps,
			&record.CommissionMinor,
			&record.CommissionStatus,
			&record.CommissionNote,
			&record.TakenAt,
		); err != nil {
			rows.Close()
			return nil, err
		}
		records = append(records, record)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

// MoneySummary aggregates the Money Desk figures (§3.1) from PERSISTED
// provider-derived columns only — SQL sums over stored Paystack figures, which
// §3.2 allows; nothing here recomputes a fee. The store share per succeeded
// payment is amount_minor − commission_minor − coalesce(provider_fee_minor, 0)
// (commission_minor already carries the Xtiitch fee + its VAT). Net income is
// the amount due for payout: the accrued store share (plus off-platform
// takings, less accrued offline commission) MINUS the payouts already settled
// per the mirrored Paystack settlements — so it rises with sales and drops the
// moment a payout sync lands (§3.3). All-time income is the same figure without
// the payout deduction: cumulative earnings since joining, never reduced.
func (repo PaymentRepository) MoneySummary(ctx context.Context, scope common.TenantScope, period ports.MoneyPeriod) (ports.MoneySummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.MoneySummary{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.MoneySummary{}, err
	}

	var summary ports.MoneySummary
	var storeShareMinor int64
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0),
			coalesce(sum(commission_minor), 0),
			coalesce(sum(coalesce(xtiitch_tax_minor, 0)), 0),
			coalesce(sum(coalesce(provider_fee_minor, 0)), 0),
			coalesce(sum(amount_minor - commission_minor - coalesce(provider_fee_minor, 0)), 0)
		from payments
		where business_id = $1 and status = 'succeeded' and through_platform = true
			and ($2::timestamptz is null or created_at >= $2)
			and ($3::timestamptz is null or created_at < $3)
	`, scope.BusinessID.String(), period.From, period.To).Scan(
		&summary.ThroughPlatformMinor,
		&summary.CommissionMinor,
		&summary.XtiitchTaxMinor,
		&summary.PaystackFeeMinor,
		&storeShareMinor,
	); err != nil {
		return ports.MoneySummary{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0)
		from paystack_settlements
		where business_id = $1 and status = 'success'
			and ($2::timestamptz is null or coalesce(settled_at, created_at) >= $2)
			and ($3::timestamptz is null or coalesce(settled_at, created_at) < $3)
	`, scope.BusinessID.String(), period.From, period.To).Scan(&summary.SettledPayoutsMinor); err != nil {
		return ports.MoneySummary{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0)
		from manual_takings
		where business_id = $1
			and ($2::timestamptz is null or taken_at >= $2)
			and ($3::timestamptz is null or taken_at < $3)
	`, scope.BusinessID.String(), period.From, period.To).Scan(&summary.ManualTakingsMinor); err != nil {
		return ports.MoneySummary{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(commission_minor), 0)
		from manual_takings
		where business_id = $1 and commission_status in ('due', 'invoiced')
			and ($2::timestamptz is null or taken_at >= $2)
			and ($3::timestamptz is null or taken_at < $3)
	`, scope.BusinessID.String(), period.From, period.To).Scan(&summary.OfflineCommissionDueMinor); err != nil {
		return ports.MoneySummary{}, err
	}

	// The Xtiitch fee net of its tax: commission_minor persists fee+tax (the
	// split's transaction_charge), so the fee card is the persisted commission
	// minus the persisted tax — still a pure function of stored figures.
	summary.XtiitchFeeMinor = summary.CommissionMinor - summary.XtiitchTaxMinor
	summary.AllTimeIncomeMinor = storeShareMinor + summary.ManualTakingsMinor - summary.OfflineCommissionDueMinor
	summary.NetIncomeMinor = summary.AllTimeIncomeMinor - summary.SettledPayoutsMinor

	if err := tx.Commit(ctx); err != nil {
		return ports.MoneySummary{}, err
	}
	return summary, nil
}

func (repo PaymentRepository) ListMoneyTransactions(
	ctx context.Context,
	scope common.TenantScope,
	period ports.MoneyPeriod,
	limit int,
	offset int,
) ([]ports.MoneyTransactionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select p.payment_id::text,
			p.order_id::text,
			p.provider_reference,
			p.purpose,
			coalesce(p.method, ''),
			p.amount_minor,
			coalesce(p.settle_amount_minor, p.amount_minor) as design_cost_minor,
			coalesce(p.provider_fee_minor, 0) as paystack_fee_minor,
			greatest(p.commission_minor - coalesce(p.xtiitch_tax_minor, 0), 0) as xtiitch_fee_minor,
			coalesce(p.xtiitch_tax_minor, 0) as xtiitch_tax_minor,
			p.amount_minor - p.commission_minor - coalesce(p.provider_fee_minor, 0) as take_home_minor,
			coalesce(d.title, ''),
			coalesce(c.display_name, ''),
			p.created_at
		from payments p
		left join orders o on o.order_id = p.order_id and o.business_id = p.business_id
		left join designs d on d.design_id = o.design_id and d.business_id = p.business_id
		left join customers c on c.customer_id = o.customer_id
		where p.business_id = $1
			and p.status = 'succeeded'
			and p.through_platform = true
			and ($2::timestamptz is null or p.created_at >= $2)
			and ($3::timestamptz is null or p.created_at < $3)
		order by p.created_at desc
		limit $4 offset $5
	`, scope.BusinessID.String(), period.From, period.To, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

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

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

func rollbackPaymentUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
