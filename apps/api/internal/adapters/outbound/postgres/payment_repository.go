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

	if _, err := tx.Exec(ctx, `
		insert into payments (
			payment_id, business_id, order_id, booking_id, purpose, amount_minor, currency, method,
			provider_reference, status, through_platform, commission_minor, settle_amount_minor
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'initiated', true, $10, $11)
	`,
		input.PaymentID.String(), input.BusinessID.String(),
		nullableIDArg(input.OrderID), nullableIDArg(input.BookingID),
		input.Purpose, input.AmountMinor, input.Currency, method,
		input.ProviderReference, input.CommissionMinor, settleAmount,
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

// CreateMarketplaceCharge records a combined multi-store split charge and its
// per-shop members. It is a platform-level (cross-tenant) write — the charge
// spans several businesses — so it runs under the RLS bypass, like the webhook
// lookup. The webhook settles each member's checkout group when the single
// Paystack transaction succeeds (reconcileMarketplaceChargeFromProvider).
func (repo PaymentRepository) CreateMarketplaceCharge(ctx context.Context, input ports.MarketplaceChargeInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into marketplace_charges (charge_id, provider_reference, customer_email, total_minor, status)
		values ($1, $2, $3, $4, 'initiated')
	`, input.ChargeID.String(), input.ProviderReference, input.CustomerEmail, input.TotalMinor); err != nil {
		return err
	}
	for _, m := range input.Members {
		if _, err := tx.Exec(ctx, `
			insert into marketplace_charge_members (
				member_id, charge_id, business_id, checkout_group_id, anchor_order_id, net_minor, commission_minor
			)
			values ($1, $2, $3, $4, $5, $6, $7)
		`, m.MemberID.String(), input.ChargeID.String(), m.BusinessID.String(), m.CheckoutGroupID.String(),
			m.AnchorOrderID.String(), m.NetMinor, m.CommissionMinor); err != nil {
			return err
		}
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
		// §4 / P0.4: a combined marketplace charge is not a single-tenant payment
		// row — it settles across shops. Try it before the other non-order
		// reconciles; its provider reference is distinct so no overlap.
		mpFound, err := reconcileMarketplaceChargeFromProvider(ctx, tx, input)
		if err != nil {
			return ports.ConfirmPaymentResult{}, err
		}
		if mpFound {
			return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{PaymentFound: false})
		}
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
			commission_bps, commission_minor, commission_status, commission_note
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, input.TakingID.String(), input.BusinessID.String(), nullableIDArg(input.OrderID),
		input.AmountMinor, input.Method, input.WhatFor, input.CommissionBps,
		input.CommissionMinor, commissionStatus, input.CommissionNote); err != nil {
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

func (repo PaymentRepository) MoneySummary(ctx context.Context, scope common.TenantScope) (ports.MoneySummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.MoneySummary{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.MoneySummary{}, err
	}

	var summary ports.MoneySummary
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0), coalesce(sum(commission_minor), 0)
		from payments
		where business_id = $1 and status = 'succeeded' and through_platform = true
	`, scope.BusinessID.String()).Scan(&summary.ThroughPlatformMinor, &summary.CommissionMinor); err != nil {
		return ports.MoneySummary{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(amount_minor), 0) from manual_takings where business_id = $1
	`, scope.BusinessID.String()).Scan(&summary.ManualTakingsMinor); err != nil {
		return ports.MoneySummary{}, err
	}
	if err := tx.QueryRow(ctx, `
		select coalesce(sum(commission_minor), 0)
		from manual_takings
		where business_id = $1 and commission_status in ('due', 'invoiced')
	`, scope.BusinessID.String()).Scan(&summary.OfflineCommissionDueMinor); err != nil {
		return ports.MoneySummary{}, err
	}
	summary.NetIncomeMinor = summary.ThroughPlatformMinor -
		summary.CommissionMinor +
		summary.ManualTakingsMinor -
		summary.OfflineCommissionDueMinor

	if err := tx.Commit(ctx); err != nil {
		return ports.MoneySummary{}, err
	}
	return summary, nil
}

func rollbackPaymentUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
