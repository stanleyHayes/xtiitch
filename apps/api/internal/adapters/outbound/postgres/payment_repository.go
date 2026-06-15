package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
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

	if _, err := tx.Exec(ctx, `
		insert into payments (
			payment_id, business_id, order_id, purpose, amount_minor, currency, method,
			provider_reference, status, through_platform, commission_minor
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, 'initiated', true, $9)
	`, input.PaymentID.String(), input.BusinessID.String(), nullableIDArg(input.OrderID), input.Purpose, input.AmountMinor, input.Currency, method, input.ProviderReference, input.CommissionMinor); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ConfirmFromProvider records the webhook event and advances the matching
// payment in a single transaction. The event's unique signature makes a
// re-delivered confirmation a no-op, and a payment only moves out of
// 'initiated' once.
func (repo PaymentRepository) ConfirmFromProvider(ctx context.Context, input ports.ConfirmPaymentInput) (ports.ConfirmPaymentResult, error) {
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
		return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{PaymentFound: false})
	}

	if err := applyConfirmation(ctx, tx, input, payment); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	return commitConfirm(ctx, tx, ports.ConfirmPaymentResult{PaymentFound: true, BusinessID: common.ID(payment.businessID)})
}

// scopedPayment is the slice of the payment a webhook needs to settle it.
type scopedPayment struct {
	businessID  string
	orderID     sql.NullString
	amountMinor int64
}

// recordProviderEvent writes the idempotency row and reports whether this was a
// first delivery. A re-delivered event conflicts and affects no rows.
func recordProviderEvent(ctx context.Context, tx pgx.Tx, input ports.ConfirmPaymentInput) (bool, error) {
	tag, err := tx.Exec(ctx, `
		insert into payment_provider_events (event_id, provider, event_signature, event_type, provider_reference)
		values (gen_random_uuid(), 'paystack', $1, $2, $3)
		on conflict (provider, event_signature) do nothing
	`, input.EventSignature, input.EventType, input.ProviderReference)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// lookupPaymentByReference resolves the payment (and its tenant) by provider
// reference. It runs under the bypass because the tenant is not yet known.
func lookupPaymentByReference(ctx context.Context, tx pgx.Tx, providerReference string) (scopedPayment, bool, error) {
	var payment scopedPayment
	err := tx.QueryRow(ctx, `
		select business_id::text, order_id::text, amount_minor
		from payments where provider_reference = $1
	`, providerReference).Scan(&payment.businessID, &payment.orderID, &payment.amountMinor)
	if errors.Is(err, pgx.ErrNoRows) {
		return scopedPayment{}, false, nil
	}
	if err != nil {
		return scopedPayment{}, false, err
	}
	return payment, true, nil
}

// applyConfirmation advances the payment and, on a genuine success transition,
// confirms its order. The tenant is known now, so it drops the cross-tenant
// bypass and scopes to that business: every write here runs under real
// row-level security, forced to this one tenant.
func applyConfirmation(ctx context.Context, tx pgx.Tx, input ports.ConfirmPaymentInput, payment scopedPayment) error {
	if err := clearTenantBypass(ctx, tx); err != nil {
		return err
	}
	if err := setTenantScope(ctx, tx, common.TenantScope{BusinessID: common.ID(payment.businessID)}); err != nil {
		return err
	}

	newStatus := "failed"
	if input.Succeeded {
		newStatus = "succeeded"
	}
	tag, err := tx.Exec(ctx, `
		update payments
		set status = $2, updated_at = now()
		where provider_reference = $1 and status = 'initiated'
	`, input.ProviderReference, newStatus)
	if err != nil {
		return err
	}

	// The payment row is the single source of truth for settlement: confirm the
	// order only when this very event moved the payment initiated -> succeeded
	// (RowsAffected == 1). Gating on the inbound flag instead would let a
	// charge.success that arrives after a charge.failed settle the order while
	// the payment stays failed.
	if input.Succeeded && tag.RowsAffected() == 1 && payment.orderID.Valid {
		return confirmOrderOnPayment(ctx, tx, payment.businessID, payment.orderID.String, payment.amountMinor)
	}
	return nil
}

// commitConfirm commits the confirmation transaction and yields its result.
func commitConfirm(ctx context.Context, tx pgx.Tx, result ports.ConfirmPaymentResult) (ports.ConfirmPaymentResult, error) {
	if err := tx.Commit(ctx); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	return result, nil
}

// confirmOrderOnPayment moves the order from draft to confirmed at its first
// stage and credits the settled amount. Every statement is constrained to the
// payment's own business, so a stray cross-tenant order_id finds no row and
// settles nothing — defence in depth alongside the now-restored RLS.
func confirmOrderOnPayment(ctx context.Context, tx pgx.Tx, businessID, orderID string, amountMinor int64) error {
	var stageID string
	err := tx.QueryRow(ctx, `
		select st.stage_id
		from orders o
		join stage_templates st on st.business_id = o.business_id and st.flow = o.flow
		where o.order_id = $1 and o.business_id = $2
		order by st.sequence
		limit 1
	`, orderID, businessID).Scan(&stageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update orders
		set status = 'confirmed', current_stage_id = $2,
			settled_minor = settled_minor + $3, updated_at = now()
		where order_id = $1 and business_id = $4 and status = 'draft'
	`, orderID, stageID, amountMinor, businessID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	_, err = tx.Exec(ctx, `
		insert into stage_events (event_id, business_id, order_id, stage_id)
		select gen_random_uuid(), o.business_id, o.order_id, $2
		from orders o where o.order_id = $1 and o.business_id = $3
	`, orderID, stageID, businessID)
	return err
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

func rollbackPaymentUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
