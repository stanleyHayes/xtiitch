package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminPlans(ctx context.Context) ([]ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminPlansQuery()+`
		order by p.is_active desc, p.monthly_fee_minor, p.yearly_fee_minor, p.created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminPlanRecord{}
	for rows.Next() {
		record, err := scanAdminPlanRecord(rows)
		if err != nil {
			return nil, err
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

func (repo AdminAuthRepository) CreateAdminPlan(
	ctx context.Context,
	input ports.CreateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := scanAdminPlanRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into plans (
				code,
				name,
				monthly_fee_minor,
				yearly_fee_minor,
				quarterly_first_minor,
				quarterly_renewal_minor,
				yearly_first_minor,
				yearly_renewal_minor,
				commission_bps,
				design_limit,
				features,
				is_active
			)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, true)
			returning *
		)
		`+adminPlanSelect("inserted")+`
	`, input.Code,
		input.Name,
		input.MonthlyFeeMinor,
		input.YearlyFeeMinor,
		input.QuarterlyFirstMinor,
		input.QuarterlyRenewalMinor,
		input.YearlyFirstMinor,
		input.YearlyRenewalMinor,
		input.CommissionBPS,
		nullableIntArg(input.DesignLimit),
		planFeaturesArg(input.Features),
	))
	if err != nil {
		if planCodeTaken(err) {
			return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminPlanRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminPlan(
	ctx context.Context,
	input ports.UpdateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := scanAdminPlanRecord(tx.QueryRow(ctx, `
		with updated as (
			update plans
			set name = $2,
				monthly_fee_minor = $3,
				yearly_fee_minor = $4,
				quarterly_first_minor = $5,
				quarterly_renewal_minor = $6,
				yearly_first_minor = $7,
				yearly_renewal_minor = $8,
				commission_bps = $9,
				design_limit = $10,
				features = $11::jsonb,
				is_active = $12,
				updated_at = now()
			where plan_id = $1::uuid
			returning *
		)
		`+adminPlanSelect("updated")+`
	`, input.PlanID.String(),
		input.Name,
		input.MonthlyFeeMinor,
		input.YearlyFeeMinor,
		input.QuarterlyFirstMinor,
		input.QuarterlyRenewalMinor,
		input.YearlyFirstMinor,
		input.YearlyRenewalMinor,
		input.CommissionBPS,
		nullableIntArg(input.DesignLimit),
		planFeaturesArg(input.Features),
		input.IsActive,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPlanRecord{}, ErrNotFound
		}
		return ports.AdminPlanRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminPlan(
	ctx context.Context,
	input ports.ArchiveAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := scanAdminPlanRecord(tx.QueryRow(ctx, `
		with updated as (
			update plans
			set is_active = false,
				updated_at = now()
			where plan_id = $1::uuid
			returning *
		)
		`+adminPlanSelect("updated")+`
	`, input.PlanID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPlanRecord{}, ErrNotFound
		}
		return ports.AdminPlanRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ListAdminPlanEntitlements(
	ctx context.Context,
) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	records, err := listAdminPlanEntitlements(ctx, tx)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

func (repo AdminAuthRepository) UpdateAdminPlanEntitlements(
	ctx context.Context,
	input ports.UpdateAdminPlanEntitlementsInput,
) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	affectedPlans := map[common.ID]struct{}{}
	for _, value := range input.Values {
		if _, err := tx.Exec(ctx, `
			insert into plan_entitlement_values (
				plan_id,
				feature_key,
				enabled,
				limit_value
			)
			values ($1::uuid, $2, $3, $4)
			on conflict (plan_id, feature_key) do update set
				enabled = excluded.enabled,
				limit_value = excluded.limit_value,
				updated_at = now()
		`, value.PlanID.String(),
			value.FeatureKey,
			value.Enabled,
			nullableIntArg(value.LimitValue),
		); err != nil {
			if adminEntitlementInvalid(err) {
				return nil, authdomain.ErrInvalidInput
			}
			return nil, err
		}
		affectedPlans[value.PlanID] = struct{}{}
	}

	for planID := range affectedPlans {
		if err := mirrorAdminPlanRuntimeEntitlements(ctx, tx, planID); err != nil {
			return nil, err
		}
	}

	records, err := listAdminPlanEntitlements(ctx, tx)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

func scanAdminPlanRecord(row pgx.Row) (ports.AdminPlanRecord, error) {
	var record ports.AdminPlanRecord
	var designLimit pgtype.Int4
	var features []byte
	if err := row.Scan(
		&record.PlanID,
		&record.Code,
		&record.Name,
		&record.MonthlyFeeMinor,
		&record.YearlyFeeMinor,
		&record.QuarterlyFirstMinor,
		&record.QuarterlyRenewalMinor,
		&record.YearlyFirstMinor,
		&record.YearlyRenewalMinor,
		&record.CommissionBPS,
		&designLimit,
		&features,
		&record.IsActive,
		&record.BusinessCount,
		&record.ActiveSubscriptionCount,
		&record.EstimatedMRRMinor,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	record.DesignLimit = int4Ptr(designLimit)
	parsed := map[string]bool{}
	if len(features) > 0 {
		if err := json.Unmarshal(features, &parsed); err != nil {
			return ports.AdminPlanRecord{}, err
		}
	}
	record.Features = business.SanitizeFeatures(parsed)
	return record, nil
}

// planFeaturesArg sanitizes an admin-supplied benefit map down to known catalogue
// keys and serialises it for the plans.features jsonb column.
func planFeaturesArg(features map[string]bool) string {
	raw, err := json.Marshal(business.SanitizeFeatures(features))
	if err != nil || len(raw) == 0 {
		return "{}"
	}
	return string(raw)
}

func listAdminPlanEntitlements(
	ctx context.Context,
	tx pgx.Tx,
) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	rows, err := tx.Query(ctx, `
		select
			f.feature_key,
			f.label,
			f.description,
			f.category,
			f.value_type,
			f.unit,
			f.sort_order,
			f.is_active,
			f.created_at,
			f.updated_at,
			p.plan_id::text,
			p.code,
			coalesce(v.enabled, false),
			v.limit_value,
			coalesce(v.updated_at, f.updated_at)
		from plan_entitlement_features f
		cross join plans p
		left join plan_entitlement_values v
			on v.plan_id = p.plan_id
		   and v.feature_key = f.feature_key
		where f.is_active = true
		order by f.sort_order, f.label, p.is_active desc, p.monthly_fee_minor, p.code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminPlanEntitlementFeatureRecord{}
	indexByKey := map[string]int{}
	for rows.Next() {
		var feature ports.AdminPlanEntitlementFeatureRecord
		var value ports.AdminPlanEntitlementValueRecord
		var limitValue pgtype.Int4
		if err := rows.Scan(
			&feature.FeatureKey,
			&feature.Label,
			&feature.Description,
			&feature.Category,
			&feature.ValueType,
			&feature.Unit,
			&feature.SortOrder,
			&feature.IsActive,
			&feature.CreatedAt,
			&feature.UpdatedAt,
			&value.PlanID,
			&value.PlanCode,
			&value.Enabled,
			&limitValue,
			&value.UpdatedAt,
		); err != nil {
			return nil, err
		}
		value.LimitValue = int4Ptr(limitValue)
		index, ok := indexByKey[feature.FeatureKey]
		if !ok {
			feature.Values = []ports.AdminPlanEntitlementValueRecord{}
			records = append(records, feature)
			index = len(records) - 1
			indexByKey[feature.FeatureKey] = index
		}
		records[index].Values = append(records[index].Values, value)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return records, nil
}

func mirrorAdminPlanRuntimeEntitlements(ctx context.Context, tx pgx.Tx, planID common.ID) error {
	_, err := tx.Exec(ctx, `
		with runtime as (
			select
				v.plan_id,
				coalesce(
					jsonb_object_agg(v.feature_key, true) filter (
						where v.enabled
						  and v.feature_key in (
							  'custom_brand_color',
							  'custom_logo',
							  'custom_banner',
							  'custom_layout',
							  'design_waitlist',
							  'online_ordering'
						  )
					),
					'{}'::jsonb
				) as features
			from plan_entitlement_values v
			where v.plan_id = $1::uuid
			group by v.plan_id
		),
		designs as (
			select limit_value
			from plan_entitlement_values
			where plan_id = $1::uuid and feature_key = 'designs' and enabled = true
		)
		update plans p
		set features = coalesce(runtime.features, '{}'::jsonb),
			design_limit = (select limit_value from designs),
			updated_at = now()
		from runtime
		where p.plan_id = runtime.plan_id
	`, planID.String())
	return err
}

func adminPlansQuery() string {
	return adminPlanSelect("plans")
}

func adminPlanSelect(source string) string {
	return `
		select
			p.plan_id::text,
			p.code,
			p.name,
			p.monthly_fee_minor::bigint,
			p.yearly_fee_minor::bigint,
			p.quarterly_first_minor::bigint,
			p.quarterly_renewal_minor::bigint,
			p.yearly_first_minor::bigint,
			p.yearly_renewal_minor::bigint,
			p.commission_bps::int,
			p.design_limit,
			coalesce(p.features, '{}'::jsonb),
			p.is_active,
			coalesce(b.business_count, 0)::int,
			coalesce(s.active_subscription_count, 0)::int,
			(coalesce(s.billable_subscription_count, 0) * p.monthly_fee_minor)::bigint,
			p.created_at,
			p.updated_at
		from ` + source + ` p
		left join lateral (
			select count(*)::int as business_count
			from businesses b
			where b.plan_id = p.plan_id
		) b on true
		left join lateral (
			select
				count(*) filter (where s.status <> 'canceled')::int as active_subscription_count,
				count(*) filter (
					where s.status <> 'canceled' and p.monthly_fee_minor > 0
				)::int as billable_subscription_count
			from business_subscriptions s
			where s.plan_id = p.plan_id
		) s on true
	`
}

func planCodeTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "plans_code_key"
}

func adminEntitlementInvalid(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		(pgErr.Code == pgForeignKeyViolation || pgErr.Code == pgCheckViolation)
}
