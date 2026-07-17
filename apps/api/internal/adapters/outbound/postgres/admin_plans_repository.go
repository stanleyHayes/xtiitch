package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

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

	// Seed the new plan's entitlement rows from the same input, in the same tx.
	// plan_entitlement_values is the source of truth for features/design_limit, so
	// a plan created without rows would be born with the matrix showing all-false
	// while plans.features said otherwise — and the first matrix save would then
	// "revert" settings the admin never made.
	if err := seedAdminPlanEntitlementValues(ctx, tx, record.PlanID, input.Features, input.DesignLimit); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

// seedAdminPlanEntitlementValues gives a new plan one row per active feature, so
// it shows up complete in the admin matrix and mirrors consistently from birth.
func seedAdminPlanEntitlementValues(
	ctx context.Context,
	tx pgx.Tx,
	planID common.ID,
	features map[string]bool,
	designLimit *int,
) error {
	if _, err := tx.Exec(ctx, `
		insert into plan_entitlement_values (plan_id, feature_key, enabled, limit_value)
		select
			$1::uuid,
			f.feature_key,
			case
				-- Limit rows are granted by default; the CAP is what restricts them
				-- (blank = unlimited). Defaulting them off would mirror design_limit
				-- to 0, so a brand-new plan could not hold a single design.
				when f.value_type = 'limit' then true
				else coalesce(($2::jsonb ->> f.feature_key)::boolean, false)
			end,
			case when f.feature_key = 'designs' then $3::integer else null end
		from plan_entitlement_features f
		where f.is_active = true
		on conflict (plan_id, feature_key) do nothing
	`, planID.String(), planFeaturesArg(features), nullableIntArg(designLimit)); err != nil {
		return err
	}
	return mirrorAdminPlanRuntimeEntitlements(ctx, tx, planID)
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

	// design_limit and features are deliberately NOT set here. They are projections
	// of plan_entitlement_values, written only by the entitlements matrix mirror.
	// This statement used to write them too, from the plan dialog's own fields --
	// two writers, one column set, no cross-reference. Saving the dialog after a
	// matrix edit silently reset both (the dialog always posted a full features
	// object, never a patch), and the next matrix save silently reverted the
	// dialog. Whoever clicked last won, with a success toast either way.
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
				is_active = $10,
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
			f.enforced,
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
			&feature.Enforced,
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

// mirroredLimitColumns maps each limit-type entitlement key to the plans column
// that projects it. plan_entitlement_values is the source of truth; these columns
// are the runtime read model the product reads.
var mirroredLimitColumns = []struct {
	featureKey string
	column     string
	// disabledMeansZero says what switching the entitlement OFF projects to.
	//
	// For a CAP it is 0: off withholds the feature. For a monitoring THRESHOLD it
	// is false -> NULL, because 0 would flag EVERY store -- the exact opposite of
	// off. Same column type, same matrix control, opposite meaning, so each key
	// has to state which it is.
	disabledMeansZero bool
}{
	{"designs", "design_limit", true},
	{"images_per_design", "image_limit", true},
	{"variations_per_design", "variation_limit", true},
	{"staff_accounts", "staff_limit", true},
	// Not a cap: orders are uncapped on every tier (Pricing Book §5). This is the
	// internal review threshold only.
	{"orders_per_month", "order_review_threshold", false},
}

// mirroredLimitClause renders one column's projection.
//
// The three cases are all load-bearing and must not be simplified into a
// coalesce: absent, withheld, and "granted, no number" are three different facts
// that a coalesce would collapse into one.
func mirroredLimitClause(featureKey, column string, disabledMeansZero bool) string {
	disabled := "null"
	if disabledMeansZero {
		// Withheld. MUST NOT fall through to NULL: NULL means unlimited, so turning
		// the entitlement OFF would grant strictly MORE than leaving it on -- which
		// is exactly what happened before this case existed.
		disabled = "0"
	}
	return fmt.Sprintf(`%[2]s = case
				-- No row for this plan (e.g. created before its entitlements were
				-- seeded): we know nothing, so keep what is set. Falling through to
				-- NULL would read as "unlimited" and silently uncap the plan.
				when not exists (select 1 from lim where feature_key = '%[1]s') then p.%[2]s
				when not (select enabled from lim where feature_key = '%[1]s') then %[3]s
				-- Granted: the configured number, where blank (NULL) means unlimited
				-- (caps) or never-flag (thresholds).
				else (select limit_value from lim where feature_key = '%[1]s')
			end`, featureKey, column, disabled)
}

func mirrorAdminPlanRuntimeEntitlements(ctx context.Context, tx pgx.Tx, planID common.ID) error {
	_, err := tx.Exec(ctx, mirrorAdminPlanEntitlementsSQL(), planID.String())
	return err
}

// mirrorAdminPlanEntitlementsSQL builds the projection statement. Split out so it
// can be inspected and exercised directly against a database.
func mirrorAdminPlanEntitlementsSQL() string {
	clauses := make([]string, 0, len(mirroredLimitColumns))
	for _, limit := range mirroredLimitColumns {
		clauses = append(clauses, mirroredLimitClause(limit.featureKey, limit.column, limit.disabledMeansZero))
	}

	return `
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
							  'online_ordering',
							  'remove_powered_by_badge'
						  )
					),
					'{}'::jsonb
				) as features
			from plan_entitlement_values v
			where v.plan_id = $1::uuid
			group by v.plan_id
		),
		lim as (
			-- (plan_id, feature_key) is the primary key, so each key is at most one row.
			select feature_key, enabled, limit_value
			from plan_entitlement_values
			where plan_id = $1::uuid
		)
		update plans p
		set features = coalesce(runtime.features, '{}'::jsonb),
			`+strings.Join(clauses, ",\n\t\t\t")+`,
			updated_at = now()
		from runtime
		where p.plan_id = runtime.plan_id
	`
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
