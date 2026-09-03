package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminAffiliateProgrammes(
	ctx context.Context,
) ([]ports.AdminAffiliateProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminAffiliateProgrammesQuery()+`
		order by p.is_default desc, p.owner_type, p.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateProgrammeRecord{}
	for rows.Next() {
		record, scanErr := scanAdminAffiliateProgramme(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	milestones, err := listAdminPartnerMilestones(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		if records[index].OwnerType == "platform" && records[index].IsDefault {
			records[index].Milestones = milestones
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

func (repo AdminAuthRepository) CreateAdminAffiliateProgramme(
	ctx context.Context,
	input ports.CreateAdminAffiliateProgrammeInput,
) (ports.AdminAffiliateProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}

	record, err := scanAdminAffiliateProgramme(tx.QueryRow(ctx, `
		with inserted as (
			insert into affiliate_programmes (
				affiliate_programme_id, owner_type, business_id, name,
				description, status, default_purchase_commission_bps,
				default_first_paid_plan_commission_bps, cookie_window_days,
				hold_days, payout_mode, minimum_payout_minor,
				allowed_target_scope, created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10,
				$11, $12, $13, $14::uuid, $14::uuid
			)
			returning *
		)
		`+adminAffiliateProgrammeSelect("inserted")+`
	`, input.AffiliateProgrammeID.String(), input.OwnerType, nullableID(input.BusinessID),
		input.Name, input.Description, input.Status, input.DefaultPurchaseCommissionBPS,
		input.DefaultFirstPaidPlanCommissionBPS, input.CookieWindowDays, input.HoldDays,
		input.PayoutMode, input.MinimumPayoutMinor, input.AllowedTargetScope,
		input.ActorAdminUser.String()))
	if err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	return record, nil
}

func listAdminPartnerMilestones(ctx context.Context, tx pgx.Tx) ([]ports.AdminPartnerMilestoneRecord, error) {
	rows, err := tx.Query(ctx, `
		select partner_milestone_id::text, threshold, title, reward_description, status
		from partner_milestones order by threshold
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.AdminPartnerMilestoneRecord{}
	for rows.Next() {
		var record ports.AdminPartnerMilestoneRecord
		if err := rows.Scan(&record.MilestoneID, &record.Threshold, &record.Title, &record.RewardDescription, &record.Status); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

func (repo AdminAuthRepository) UpdateAdminAffiliateProgramme(
	ctx context.Context,
	input ports.UpdateAdminAffiliateProgrammeInput,
) (ports.AdminAffiliateProgrammeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}

	record, err := scanAdminAffiliateProgramme(tx.QueryRow(ctx, `
		with updated as (
			update affiliate_programmes
			set name = $2, description = $3, status = $4,
				default_purchase_commission_bps = $5,
				default_first_paid_plan_commission_bps = $6,
				cookie_window_days = $7, hold_days = $8, payout_mode = $9,
				minimum_payout_minor = $10, allowed_target_scope = $11,
				updated_by_admin_user_id = $12::uuid, updated_at = now()
			where affiliate_programme_id = $1::uuid
				and (not is_default or $4 = 'active')
			returning *
		)
		`+adminAffiliateProgrammeSelect("updated")+`
	`, input.AffiliateProgrammeID.String(), input.Name, input.Description,
		input.Status, input.DefaultPurchaseCommissionBPS,
		input.DefaultFirstPaidPlanCommissionBPS, input.CookieWindowDays,
		input.HoldDays, input.PayoutMode, input.MinimumPayoutMinor,
		input.AllowedTargetScope, input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateProgrammeRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	if record.OwnerType == "platform" && record.IsDefault {
		for _, milestone := range input.Milestones {
			tag, updateErr := tx.Exec(ctx, `
				update partner_milestones
				set threshold=$2, title=$3, reward_description=$4,
					status=$5, updated_at=now()
				where partner_milestone_id=$1::uuid
			`, milestone.MilestoneID.String(), milestone.Threshold, milestone.Title,
				milestone.RewardDescription, milestone.Status)
			if updateErr != nil {
				return ports.AdminAffiliateProgrammeRecord{}, updateErr
			}
			if tag.RowsAffected() != 1 {
				return ports.AdminAffiliateProgrammeRecord{}, ErrNotFound
			}
		}
		record.Milestones, err = listAdminPartnerMilestones(ctx, tx)
		if err != nil {
			return ports.AdminAffiliateProgrammeRecord{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	return record, nil
}

func scanAdminAffiliateProgramme(row pgx.Row) (ports.AdminAffiliateProgrammeRecord, error) {
	var record ports.AdminAffiliateProgrammeRecord
	var businessID pgtype.Text
	if err := row.Scan(
		&record.AffiliateProgrammeID, &record.OwnerType, &businessID,
		&record.BusinessName, &record.IsDefault, &record.Name,
		&record.Description, &record.Status,
		&record.DefaultPurchaseCommissionBPS,
		&record.DefaultFirstPaidPlanCommissionBPS, &record.CookieWindowDays,
		&record.HoldDays, &record.PayoutMode, &record.MinimumPayoutMinor,
		&record.AllowedTargetScope, &record.AffiliateCount,
		&record.CreatedAt, &record.UpdatedAt,
	); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	if businessID.Valid {
		value := common.ID(businessID.String)
		record.BusinessID = &value
	}
	return record, nil
}

func adminAffiliateProgrammesQuery() string {
	return adminAffiliateProgrammeSelect("affiliate_programmes")
}

func adminAffiliateProgrammeSelect(source string) string {
	return `
		select
			p.affiliate_programme_id::text, p.owner_type, p.business_id::text,
			coalesce(b.name, ''), p.is_default, p.name, p.description, p.status,
			p.default_purchase_commission_bps::int,
			p.default_first_paid_plan_commission_bps::int,
			p.cookie_window_days::int, p.hold_days::int, p.payout_mode,
			p.minimum_payout_minor::bigint, p.allowed_target_scope,
			(select count(*)::bigint from affiliates a
				where a.affiliate_programme_id = p.affiliate_programme_id),
			p.created_at, p.updated_at
		from ` + source + ` p
		left join businesses b on b.business_id = p.business_id
	`
}

func nullableID(value *common.ID) any {
	if value == nil {
		return nil
	}
	return value.String()
}
