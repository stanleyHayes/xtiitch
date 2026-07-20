package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// RecordProviderEvent writes the idempotency row for a NON-charge provider
// event (transfer.*) and reports whether this was a first delivery. It is the
// same ledger ConfirmFromProvider uses, so a charge and a transfer event can
// never collide (their signatures carry the event type). Runs under the RLS
// bypass: a webhook arrives without a tenant context.
func (repo PaymentRepository) RecordProviderEvent(ctx context.Context, input ports.RecordProviderEventInput) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return false, err
	}

	tag, err := tx.Exec(ctx, `
		insert into payment_provider_events (event_id, provider, event_signature, event_type, provider_reference)
		values (gen_random_uuid(), 'paystack', $1, $2, $3)
		on conflict (provider, event_signature) do nothing
	`, input.EventSignature, input.EventType, input.ProviderReference)
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// FindBusinessBySubaccount resolves the business owning a provider subaccount
// code — how a transfer.* webhook (which names a subaccount, not a tenant)
// finds the store whose settlements should be refreshed (§4.10). Cross-tenant
// by necessity, like the provider-reference lookup.
func (repo PaymentRepository) FindBusinessBySubaccount(ctx context.Context, subaccountCode string) (common.ID, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return "", false, err
	}

	var businessID string
	scanErr := tx.QueryRow(ctx, `
		select business_id::text from businesses where settlement_provider_subaccount = $1
	`, subaccountCode).Scan(&businessID)
	if scanErr != nil && !errors.Is(scanErr, pgx.ErrNoRows) {
		return "", false, scanErr
	}
	if err := tx.Commit(ctx); err != nil {
		return "", false, err
	}
	if errors.Is(scanErr, pgx.ErrNoRows) {
		return "", false, nil
	}
	return common.ID(businessID), true, nil
}

// UpsertProviderSettlements mirrors the provider's settlement rows for one
// business (§3.2/§3.3), keyed on the provider settlement reference so a
// repeated sync upserts in place rather than duplicating. The tenant is known
// (the sync resolved the business first), so the writes run under its real
// row-level scope. Returns the number of rows written.
func (repo PaymentRepository) UpsertProviderSettlements(
	ctx context.Context,
	businessID common.ID,
	settlements []ports.ProviderSettlementInput,
) (int, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, common.TenantScope{BusinessID: businessID}); err != nil {
		return 0, err
	}

	upserted := 0
	for _, settlement := range settlements {
		rawPayload := settlement.RawPayload
		if len(rawPayload) == 0 {
			rawPayload = []byte("{}")
		}
		tag, err := tx.Exec(ctx, `
			insert into paystack_settlements (
				settlement_id, business_id, provider_reference, subaccount_code,
				amount_minor, status, settled_at, raw_payload
			)
			values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
			on conflict (provider_reference) do update
			set amount_minor = excluded.amount_minor,
				status = excluded.status,
				settled_at = excluded.settled_at,
				subaccount_code = excluded.subaccount_code,
				raw_payload = excluded.raw_payload,
				updated_at = now()
		`, businessID.String(), settlement.ProviderReference, settlement.SubaccountCode,
			settlement.AmountMinor, settlement.Status, settlement.SettledAt, rawPayload)
		if err != nil {
			return 0, err
		}
		upserted += int(tag.RowsAffected())
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return upserted, nil
}

// ListProviderSettlements pages a business's mirrored settlement rows, most
// recent first — the §3.3 payout history behind the Money Desk and the §11.5
// per-store history.
func (repo PaymentRepository) ListProviderSettlements(
	ctx context.Context,
	scope common.TenantScope,
	limit int,
	offset int,
) ([]ports.ProviderSettlementRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select settlement_id, provider_reference, amount_minor, status, settled_at, created_at
		from paystack_settlements
		where business_id = $1
		order by created_at desc
		limit $2 offset $3
	`, scope.BusinessID.String(), limit, offset)
	if err != nil {
		return nil, err
	}

	var records []ports.ProviderSettlementRecord
	for rows.Next() {
		var record ports.ProviderSettlementRecord
		if err := rows.Scan(
			&record.SettlementID,
			&record.ProviderReference,
			&record.AmountMinor,
			&record.Status,
			&record.SettledAt,
			&record.CreatedAt,
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

// MarkSettlementsSynced stamps the business's settlement-sync watermark (§3.3),
// which throttles read-path syncs.
func (repo PaymentRepository) MarkSettlementsSynced(ctx context.Context, businessID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, common.TenantScope{BusinessID: businessID}); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update businesses set settlement_synced_at = now() where business_id = $1
	`, businessID.String()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
