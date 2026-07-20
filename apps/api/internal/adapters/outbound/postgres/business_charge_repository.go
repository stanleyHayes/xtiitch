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
			coalesce(b.settlement_bank, ''),
			coalesce(b.settlement_mobile_money_number, ''),
			coalesce(b.settlement_momo_account_name, ''),
			b.settlement_synced_at,
			p.commission_bps,
			coalesce(s.fee_pass_xtiitch_fee, false),
			coalesce(s.fee_pass_tax, false),
			coalesce(s.fee_pass_paystack_fee, false)
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join store_settings s on s.business_id = b.business_id
		where b.business_id = $1
	`, scope.BusinessID.String()).Scan(
		&context.BusinessID,
		&context.Name,
		&context.Verified,
		&context.SubaccountRef,
		&context.SettlementBank,
		&context.SettlementAccount,
		&context.MoMoAccountName,
		&context.SettlementsSyncedAt,
		&context.CommissionBps,
		&context.FeePassXtiitchFee,
		&context.FeePassTax,
		&context.FeePassPaystackFee,
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

// ProvisionSubaccount mirrors the accepted payout details onto the business row.
// settlement_momo_verified_at is stamped here rather than passed in because the
// only caller reaches this line having just proved the number by OTP — the
// timestamp attests to that proof, so it is written in the same statement as the
// number it describes.
//
// It deliberately does NOT touch verification_status (§2.2): payout setup used
// to mark the business 'verified' here, which let an owner skip Ghana Card
// verification entirely by setting up payouts first. Verification now comes ONLY
// from an admin approving the identity submission (DecideAdminBusinessVerification);
// this write is payout plumbing, not identity evidence.
func (repo BusinessChargeRepository) ProvisionSubaccount(
	ctx context.Context,
	input ports.ProvisionSubaccountInput,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackBusinessChargeUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update businesses
		set settlement_provider = 'paystack',
			settlement_provider_subaccount = $2,
			settlement_bank = $3,
			settlement_mobile_money_number = $4,
			settlement_momo_account_name = $5,
			settlement_momo_verified_at = now(),
			updated_at = now()
		where business_id = $1
	`,
		input.BusinessID.String(),
		input.SubaccountRef,
		input.SettlementBank,
		input.SettlementAccount,
		input.SettlementAccountName,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func rollbackBusinessChargeUnlessCommitted(ctx context.Context, tx pgx.Tx) {
	_ = tx.Rollback(ctx)
}
