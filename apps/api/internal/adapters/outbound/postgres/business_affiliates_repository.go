package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo BusinessAffiliateRepository) ListBusinessAffiliates(
	ctx context.Context,
	scope common.TenantScope,
) ([]ports.BusinessAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, businessAffiliateSelect("affiliates")+`
		where a.owner_business_id = $1::uuid
		order by
			case a.status when 'active' then 0 when 'paused' then 1 else 2 end,
			a.updated_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.BusinessAffiliateRecord{}
	for rows.Next() {
		record, scanErr := scanBusinessAffiliate(rows)
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

func (repo BusinessAffiliateRepository) CreateBusinessAffiliate(
	ctx context.Context,
	scope common.TenantScope,
	input ports.BusinessAffiliateInput,
) (ports.BusinessAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}

	record, err := scanBusinessAffiliate(tx.QueryRow(ctx, `
		with eligible_programme as (
			select p.*
			from affiliate_programmes p
			where p.affiliate_programme_id = $2::uuid
				and p.owner_type = 'business'
				and p.business_id = $3::uuid
				and p.status = 'active'
				and p.allowed_target_scope = $12
				and (
					($12 = 'store' and $13::uuid is null)
					or (
						$12 = 'collection'
						and exists (
							select 1 from collections c
							where c.collection_id = $13::uuid
								and c.business_id = $3::uuid
						)
					)
					or (
						$12 in ('design', 'product')
						and exists (
							select 1 from designs d
							where d.design_id = $13::uuid
								and d.business_id = $3::uuid
						)
					)
				)
		),
		inserted as (
			insert into affiliates (
				affiliate_id, affiliate_programme_id, owner_business_id,
				entity_type, code, display_name, contact_name, email, phone,
				commission_model, commission_rate, purchase_commission_bps,
				first_paid_plan_commission_bps, cookie_window_days,
				payout_mode, status, target_scope, target_ref_id,
				created_by_business_user_id, updated_by_business_user_id
			)
			select
				$1::uuid, p.affiliate_programme_id, p.business_id, 'person',
				$4, $5, $6, $7, $8, 'percentage', $9, $9, $10, $11,
				p.payout_mode, $14, $12, $13::uuid, $15::uuid, $15::uuid
			from eligible_programme p
			returning *
		)
		`+businessAffiliateSelect("inserted")+`
	`, input.AffiliateID.String(), input.AffiliateProgrammeID.String(),
		scope.BusinessID.String(), input.Code, input.DisplayName,
		input.ContactName, input.Email, input.Phone,
		input.PurchaseCommissionBPS, input.FirstPaidPlanCommissionBPS,
		input.CookieWindowDays, input.TargetScope, nullableID(input.TargetRefID),
		input.Status, input.ActorBusinessUserID.String()))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.BusinessAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessAffiliateRecord{}, ErrNotFound
		}
		return ports.BusinessAffiliateRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	return record, nil
}

func (repo BusinessAffiliateRepository) UpdateBusinessAffiliate(
	ctx context.Context,
	scope common.TenantScope,
	input ports.BusinessAffiliateInput,
) (ports.BusinessAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	record, err := scanBusinessAffiliate(tx.QueryRow(ctx, `
		with eligible_programme as (
			select p.*
			from affiliate_programmes p
			where p.affiliate_programme_id = $2::uuid
				and p.owner_type = 'business'
				and p.business_id = $3::uuid
				and p.status = 'active'
				and p.allowed_target_scope = $12
				and (
					($12 = 'store' and $13::uuid is null)
					or ($12 = 'collection' and exists (
						select 1 from collections c
						where c.collection_id = $13::uuid
							and c.business_id = $3::uuid
					))
					or ($12 in ('design', 'product') and exists (
						select 1 from designs d
						where d.design_id = $13::uuid
							and d.business_id = $3::uuid
					))
				)
		),
		updated as (
			update affiliates a
			set affiliate_programme_id = p.affiliate_programme_id,
				code = $4, display_name = $5, contact_name = $6,
				email = $7, phone = $8, commission_rate = $9,
				purchase_commission_bps = $9,
				first_paid_plan_commission_bps = $10,
				cookie_window_days = $11, payout_mode = p.payout_mode,
				target_scope = $12, target_ref_id = $13::uuid,
				status = $14, updated_by_business_user_id = $15::uuid,
				updated_at = now()
			from eligible_programme p
			where a.affiliate_id = $1::uuid
				and a.owner_business_id = $3::uuid
			returning a.*
		)
		`+businessAffiliateSelect("updated")+`
	`, input.AffiliateID.String(), input.AffiliateProgrammeID.String(),
		scope.BusinessID.String(), input.Code, input.DisplayName,
		input.ContactName, input.Email, input.Phone,
		input.PurchaseCommissionBPS, input.FirstPaidPlanCommissionBPS,
		input.CookieWindowDays, input.TargetScope, nullableID(input.TargetRefID),
		input.Status, input.ActorBusinessUserID.String()))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.BusinessAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessAffiliateRecord{}, ErrNotFound
		}
		return ports.BusinessAffiliateRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	return record, nil
}

func (repo BusinessAffiliateRepository) PauseBusinessAffiliate(
	ctx context.Context,
	scope common.TenantScope,
	affiliateID common.ID,
	actorBusinessUserID common.ID,
) (ports.BusinessAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	defer rollbackPaymentUnlessCommitted(ctx, tx)
	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	record, err := scanBusinessAffiliate(tx.QueryRow(ctx, `
		with updated as (
			update affiliates
			set status = 'paused',
				updated_by_business_user_id = $3::uuid,
				updated_at = now()
			where affiliate_id = $1::uuid
				and owner_business_id = $2::uuid
			returning *
		)
		`+businessAffiliateSelect("updated")+`
	`, affiliateID.String(), scope.BusinessID.String(),
		actorBusinessUserID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.BusinessAffiliateRecord{}, ErrNotFound
		}
		return ports.BusinessAffiliateRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	return record, nil
}

func scanBusinessAffiliate(row pgx.Row) (ports.BusinessAffiliateRecord, error) {
	var record ports.BusinessAffiliateRecord
	var targetRefID pgtype.Text
	err := row.Scan(
		&record.AffiliateID, &record.AffiliateProgrammeID,
		&record.ProgrammeName, &record.Code, &record.DisplayName,
		&record.ContactName, &record.Email, &record.Phone,
		&record.PurchaseCommissionBPS, &record.FirstPaidPlanCommissionBPS,
		&record.CookieWindowDays, &record.Status, &record.TargetScope,
		&targetRefID, &record.CreatedAt, &record.UpdatedAt,
	)
	if err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	if targetRefID.Valid {
		value := common.ID(targetRefID.String)
		record.TargetRefID = &value
	}
	return record, nil
}

func businessAffiliateSelect(source string) string {
	return `
		select
			a.affiliate_id::text, a.affiliate_programme_id::text, p.name,
			a.code, a.display_name, a.contact_name, a.email, a.phone,
			a.purchase_commission_bps::int,
			a.first_paid_plan_commission_bps::int,
			a.cookie_window_days::int, a.status, a.target_scope,
			a.target_ref_id::text, a.created_at, a.updated_at
		from ` + source + ` a
		join affiliate_programmes p
			on p.affiliate_programme_id = a.affiliate_programme_id
	`
}
