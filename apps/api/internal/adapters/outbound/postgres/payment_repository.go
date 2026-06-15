package postgres

import (
	"context"
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
			payment_id, business_id, purpose, amount_minor, currency, method,
			provider_reference, status, through_platform, commission_minor
		)
		values ($1, $2, $3, $4, $5, $6, $7, 'initiated', true, $8)
	`, input.PaymentID.String(), input.BusinessID.String(), input.Purpose, input.AmountMinor, input.Currency, method, input.ProviderReference, input.CommissionMinor); err != nil {
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
	// provider reference, so this confirmation runs with the RLS bypass.
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	tag, err := tx.Exec(ctx, `
		insert into payment_provider_events (event_id, provider, event_signature, event_type, provider_reference)
		values (gen_random_uuid(), 'paystack', $1, $2, $3)
		on conflict (provider, event_signature) do nothing
	`, input.EventSignature, input.EventType, input.ProviderReference)
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}
	if tag.RowsAffected() == 0 {
		if err := tx.Commit(ctx); err != nil {
			return ports.ConfirmPaymentResult{}, err
		}
		return ports.ConfirmPaymentResult{AlreadyProcessed: true}, nil
	}

	var businessID string
	err = tx.QueryRow(ctx, `select business_id::text from payments where provider_reference = $1`, input.ProviderReference).Scan(&businessID)
	if errors.Is(err, pgx.ErrNoRows) {
		if err := tx.Commit(ctx); err != nil {
			return ports.ConfirmPaymentResult{}, err
		}
		return ports.ConfirmPaymentResult{PaymentFound: false}, nil
	}
	if err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	newStatus := "failed"
	if input.Succeeded {
		newStatus = "succeeded"
	}
	if _, err := tx.Exec(ctx, `
		update payments
		set status = $2, updated_at = now()
		where provider_reference = $1 and status = 'initiated'
	`, input.ProviderReference, newStatus); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.ConfirmPaymentResult{}, err
	}

	return ports.ConfirmPaymentResult{PaymentFound: true, BusinessID: common.ID(businessID)}, nil
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
