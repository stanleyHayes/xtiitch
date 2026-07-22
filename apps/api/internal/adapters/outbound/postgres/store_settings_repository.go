package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type StoreSettingsRepository struct {
	pool *pgxpool.Pool
}

func NewStoreSettingsRepository(pool *pgxpool.Pool) StoreSettingsRepository {
	return StoreSettingsRepository{pool: pool}
}

func (repo StoreSettingsRepository) Get(ctx context.Context, scope common.TenantScope) (ports.StoreSettings, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.StoreSettings{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.StoreSettings{}, err
	}

	var settings ports.StoreSettings
	if err := tx.QueryRow(ctx, `
		select bespoke_enabled, measurements_enabled, customisation_enabled,
			collections_enabled, delivery_enabled, dispatch_enabled, brand_color,
			coalesce(logo_url, ''), coalesce(banner_url, ''), layout_variant,
			fee_pass_xtiitch_fee, fee_pass_tax, fee_pass_paystack_fee
		from store_settings
		where business_id = $1
	`, scope.BusinessID.String()).Scan(
		&settings.BespokeEnabled,
		&settings.MeasurementsEnabled,
		&settings.CustomisationEnabled,
		&settings.CollectionsEnabled,
		&settings.DeliveryEnabled,
		&settings.DispatchEnabled,
		&settings.BrandColor,
		&settings.LogoURL,
		&settings.BannerURL,
		&settings.LayoutVariant,
		&settings.FeePassXtiitchFee,
		&settings.FeePassTax,
		&settings.FeePassPaystackFee,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.StoreSettings{}, ErrNotFound
		}
		return ports.StoreSettings{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.StoreSettings{}, err
	}

	return settings, nil
}

//nolint:funlen,gocognit // assembles the tenant profile and optional store settings inside one scoped read transaction
func (repo StoreSettingsRepository) GetProfile(ctx context.Context, scope common.TenantScope) (ports.StoreProfile, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.StoreProfile{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.StoreProfile{}, err
	}

	var profile ports.StoreProfile
	var featuresRaw []byte
	if err := tx.QueryRow(ctx, `
		select b.name, b.handle, b.verification_status,
			coalesce(b.settlement_provider_subaccount, '') <> '' as payout_ready,
			coalesce(b.settlement_bank, ''),
			coalesce(b.settlement_mobile_money_number, ''),
			coalesce(b.settlement_momo_account_name, ''),
			p.code, coalesce(p.features, '{}'::jsonb),
			-- NULL means unlimited; the dashboard must not turn that into a cap.
			p.design_limit,
			p.image_limit,
			p.variation_limit,
			-- Activation required: a PAID plan that has never been charged (a fresh
			-- 'trialing' signup OR a grandfathered 'active' account with no billing).
			(p.monthly_fee_minor > 0 and not coalesce(s.first_purchase_consumed, false))
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join business_subscriptions s on s.business_id = b.business_id
		where b.business_id = $1
	`, scope.BusinessID.String()).Scan(
		&profile.Name, &profile.Handle, &profile.VerificationStatus,
		&profile.PayoutReady, &profile.SettlementBank, &profile.SettlementAccount,
		&profile.SettlementAccountName,
		&profile.PlanCode, &featuresRaw, &profile.DesignLimit,
		&profile.ImageLimit, &profile.VariationLimit,
		&profile.ActivationRequired,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.StoreProfile{}, ErrNotFound
		}
		return ports.StoreProfile{}, err
	}

	features := map[string]bool{}
	if len(featuresRaw) > 0 {
		if err := json.Unmarshal(featuresRaw, &features); err != nil {
			return ports.StoreProfile{}, err
		}
	}
	profile.Entitlements = business.SanitizeFeatures(features)

	// The numeric entitlements (§11.1) live only in the matrix — the plans.features
	// jsonb is boolean-only. Read them live so the dashboard can unlock analytics /
	// CRM depth per plan without a deploy. NULL limit (unlimited/full) surfaces as
	// -1; disabled rows are withheld entirely.
	profile.EntitlementLimits = map[string]int{}
	limitRows, err := tx.Query(ctx, `
		select v.feature_key, v.limit_value
		from plan_entitlement_values v
		join plan_entitlement_features f on f.feature_key = v.feature_key
		join businesses b on b.plan_id = v.plan_id
		where b.business_id = $1
			and f.value_type = 'limit'
			and f.is_active
			and v.enabled
	`, scope.BusinessID.String())
	if err != nil {
		return ports.StoreProfile{}, err
	}
	defer limitRows.Close()
	for limitRows.Next() {
		var key string
		var value pgtype.Int4
		if err := limitRows.Scan(&key, &value); err != nil {
			return ports.StoreProfile{}, err
		}
		profile.EntitlementLimits[key] = -1
		if value.Valid {
			profile.EntitlementLimits[key] = int(value.Int32)
		}
	}
	if err := limitRows.Err(); err != nil {
		return ports.StoreProfile{}, err
	}
	limitRows.Close()

	if err := tx.Commit(ctx); err != nil {
		return ports.StoreProfile{}, err
	}

	return profile, nil
}

func (repo StoreSettingsRepository) Update(ctx context.Context, scope common.TenantScope, settings ports.StoreSettings) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update store_settings
		set bespoke_enabled = $2, measurements_enabled = $3, customisation_enabled = $4,
			collections_enabled = $5, delivery_enabled = $6, dispatch_enabled = $7,
			brand_color = $8, logo_url = nullif($9, ''), banner_url = nullif($10, ''),
			layout_variant = $11,
			fee_pass_xtiitch_fee = $12, fee_pass_tax = $13, fee_pass_paystack_fee = $14,
			updated_at = now()
		where business_id = $1
	`, scope.BusinessID.String(),
		settings.BespokeEnabled, settings.MeasurementsEnabled, settings.CustomisationEnabled,
		settings.CollectionsEnabled, settings.DeliveryEnabled, settings.DispatchEnabled,
		settings.BrandColor, settings.LogoURL, settings.BannerURL, settings.LayoutVariant,
		settings.FeePassXtiitchFee, settings.FeePassTax, settings.FeePassPaystackFee,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
