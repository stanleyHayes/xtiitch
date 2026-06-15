package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
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
			collections_enabled, delivery_enabled, dispatch_enabled, brand_color
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
	if err := tx.QueryRow(ctx, `
		select b.name, b.handle, b.verification_status, p.code
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1
	`, scope.BusinessID.String()).Scan(&profile.Name, &profile.Handle, &profile.VerificationStatus, &profile.PlanCode); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.StoreProfile{}, ErrNotFound
		}
		return ports.StoreProfile{}, err
	}

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
			brand_color = $8, updated_at = now()
		where business_id = $1
	`, scope.BusinessID.String(),
		settings.BespokeEnabled, settings.MeasurementsEnabled, settings.CustomisationEnabled,
		settings.CollectionsEnabled, settings.DeliveryEnabled, settings.DispatchEnabled,
		settings.BrandColor,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
