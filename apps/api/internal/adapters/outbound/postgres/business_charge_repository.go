package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BusinessChargeRepository struct {
	pool *pgxpool.Pool
}

func NewBusinessChargeRepository(pool *pgxpool.Pool) BusinessChargeRepository {
	return BusinessChargeRepository{pool: pool}
}

func (repo BusinessChargeRepository) GetChargeContext(ctx context.Context, scope common.TenantScope) (ports.BusinessChargeContext, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessChargeContext{}, err
	}
	defer rollbackBusinessChargeUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, scope.BusinessID.String()); err != nil {
		return ports.BusinessChargeContext{}, err
	}

	var context ports.BusinessChargeContext
	if err := tx.QueryRow(ctx, `
		select
			b.business_id,
			b.name,
			b.verification_status = 'verified',
			coalesce(b.settlement_provider_subaccount, ''),
			p.commission_bps,
			coalesce(s.fee_pass_to_buyer, false)
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join store_settings s on s.business_id = b.business_id
		where b.business_id = $1
	`, scope.BusinessID.String()).Scan(
		&context.BusinessID,
		&context.Name,
		&context.Verified,
		&context.SubaccountRef,
		&context.CommissionBps,
		&context.FeePassToBuyer,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessChargeContext{}, ErrNotFound
		}
		return ports.BusinessChargeContext{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessChargeContext{}, err
	}

	return context, nil
}

func (repo BusinessChargeRepository) ProvisionSubaccount(
	ctx context.Context,
	businessID common.ID,
	subaccountRef string,
	settlementAccount string,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackBusinessChargeUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update businesses
		set settlement_provider = 'paystack',
			settlement_provider_subaccount = $2,
			settlement_mobile_money_number = $3,
			verification_status = 'verified',
			updated_at = now()
		where business_id = $1
	`, businessID.String(), subaccountRef, settlementAccount); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func rollbackBusinessChargeUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
