package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BusinessAffiliateRepository struct {
	pool *pgxpool.Pool
}

func NewBusinessAffiliateRepository(pool *pgxpool.Pool) BusinessAffiliateRepository {
	return BusinessAffiliateRepository{pool: pool}
}

func (repo BusinessAffiliateRepository) ListBusinessAffiliateProgrammes(
	ctx context.Context,
	scope common.TenantScope,
) ([]ports.BusinessAffiliateProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, businessAffiliateProgrammeSelect("affiliate_programmes")+`
		where p.owner_type = 'business' and p.business_id = $1::uuid
		order by
			case p.status when 'active' then 0 when 'draft' then 1
				when 'paused' then 2 else 3 end,
			p.updated_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.BusinessAffiliateProgrammeRecord{}
	for rows.Next() {
		record, scanErr := scanBusinessAffiliateProgramme(rows)
		if scanErr != nil {
			return nil, scanErr
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

func (repo BusinessAffiliateRepository) CreateBusinessAffiliateProgramme(
	ctx context.Context,
	scope common.TenantScope,
	input ports.BusinessAffiliateProgrammeInput,
) (ports.BusinessAffiliateProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}

	record, err := scanBusinessAffiliateProgramme(tx.QueryRow(ctx, `
		with inserted as (
			insert into affiliate_programmes (
				affiliate_programme_id, owner_type, business_id, name,
				description, status, default_purchase_commission_bps,
				default_first_paid_plan_commission_bps, cookie_window_days,
				hold_days, payout_mode, minimum_payout_minor,
				allowed_target_scope, created_by_business_user_id,
				updated_by_business_user_id
			)
			values (
				$1::uuid, 'business', $2::uuid, $3, $4, $5, $6, $7,
				$8, $9, $10, $11, $12, $13::uuid, $13::uuid
			)
			returning *
		)
		`+businessAffiliateProgrammeSelect("inserted")+`
	`, input.AffiliateProgrammeID.String(), scope.BusinessID.String(),
		input.Name, input.Description, input.Status,
		input.DefaultPurchaseCommissionBPS,
		input.DefaultFirstPaidPlanCommissionBPS, input.CookieWindowDays,
		input.HoldDays, input.PayoutMode, input.MinimumPayoutMinor,
		input.AllowedTargetScope, input.ActorBusinessUserID.String()))
	if err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	return record, nil
}

func (repo BusinessAffiliateRepository) UpdateBusinessAffiliateProgramme(
	ctx context.Context,
	scope common.TenantScope,
	input ports.BusinessAffiliateProgrammeInput,
) (ports.BusinessAffiliateProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}

	record, err := scanBusinessAffiliateProgramme(tx.QueryRow(ctx, `
		with updated as (
			update affiliate_programmes
			set name = $3, description = $4, status = $5,
				default_purchase_commission_bps = $6,
				default_first_paid_plan_commission_bps = $7,
				cookie_window_days = $8, hold_days = $9, payout_mode = $10,
				minimum_payout_minor = $11, allowed_target_scope = $12,
				updated_by_business_user_id = $13::uuid, updated_at = now()
			where affiliate_programme_id = $1::uuid
				and owner_type = 'business'
				and business_id = $2::uuid
			returning *
		)
		`+businessAffiliateProgrammeSelect("updated")+`
	`, input.AffiliateProgrammeID.String(), scope.BusinessID.String(),
		input.Name, input.Description, input.Status,
		input.DefaultPurchaseCommissionBPS,
		input.DefaultFirstPaidPlanCommissionBPS, input.CookieWindowDays,
		input.HoldDays, input.PayoutMode, input.MinimumPayoutMinor,
		input.AllowedTargetScope, input.ActorBusinessUserID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessAffiliateProgrammeRecord{}, ErrNotFound
		}
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	return record, nil
}

func scanBusinessAffiliateProgramme(
	row pgx.Row,
) (ports.BusinessAffiliateProgrammeRecord, error) {
	var record ports.BusinessAffiliateProgrammeRecord
	err := row.Scan(
		&record.AffiliateProgrammeID, &record.BusinessID, &record.Name,
		&record.Description, &record.Status,
		&record.DefaultPurchaseCommissionBPS,
		&record.DefaultFirstPaidPlanCommissionBPS, &record.CookieWindowDays,
		&record.HoldDays, &record.PayoutMode, &record.MinimumPayoutMinor,
		&record.AllowedTargetScope, &record.AffiliateCount,
		&record.CreatedAt, &record.UpdatedAt,
	)
	if err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	return record, nil
}

func businessAffiliateProgrammeSelect(source string) string {
	return `
		select
			p.affiliate_programme_id::text, p.business_id::text, p.name,
			p.description, p.status, p.default_purchase_commission_bps::int,
			p.default_first_paid_plan_commission_bps::int,
			p.cookie_window_days::int, p.hold_days::int, p.payout_mode,
			p.minimum_payout_minor::bigint, p.allowed_target_scope,
			(select count(*)::bigint from affiliates a
				where a.affiliate_programme_id = p.affiliate_programme_id),
			p.created_at, p.updated_at
		from ` + source + ` p
	`
}
