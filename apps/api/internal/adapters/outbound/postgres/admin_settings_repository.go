package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo AdminAuthRepository) GetAdminPlatformSettings(ctx context.Context) (ports.AdminPlatformSettingsRecord, error) {
	if _, err := repo.pool.Exec(ctx, `
		insert into admin_platform_settings (settings_id)
		values (true)
		on conflict (settings_id) do nothing
	`); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	settings, err := scanAdminPlatformSettingsRecord(repo.pool.QueryRow(ctx, `
		select
			platform_name,
			support_email,
			verification_sla_hours,
			payout_review_threshold_pesewas,
			maintenance_mode,
			brand_logo_url,
			marketing_show_browse_store,
			marketing_show_discover,
			marketing_show_create_store,
			marketing_show_pricing,
			ai_assistant_addon_enabled,
			updated_at
		from admin_platform_settings
		where settings_id = true
		limit 1
	`))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminPlatformSettingsRecord{}, ErrNotFound
		}
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

func (repo AdminAuthRepository) UpdateAdminPlatformSettings(
	ctx context.Context,
	input ports.UpdateAdminPlatformSettingsInput,
) (ports.AdminPlatformSettingsRecord, error) {
	settings, err := scanAdminPlatformSettingsRecord(repo.pool.QueryRow(ctx, `
		insert into admin_platform_settings (
			settings_id,
			platform_name,
			support_email,
			verification_sla_hours,
			payout_review_threshold_pesewas,
			maintenance_mode,
			brand_logo_url,
			ai_assistant_addon_enabled
		)
		values (true, $1, $2, $3, $4, $5, $6, $7)
		on conflict (settings_id) do update
		set platform_name = excluded.platform_name,
			support_email = excluded.support_email,
			verification_sla_hours = excluded.verification_sla_hours,
			payout_review_threshold_pesewas = excluded.payout_review_threshold_pesewas,
			maintenance_mode = excluded.maintenance_mode,
			brand_logo_url = excluded.brand_logo_url,
			ai_assistant_addon_enabled = excluded.ai_assistant_addon_enabled,
			updated_at = now()
		returning
			platform_name,
			support_email,
			verification_sla_hours,
			payout_review_threshold_pesewas,
			maintenance_mode,
			brand_logo_url,
			marketing_show_browse_store,
			marketing_show_discover,
			marketing_show_create_store,
			marketing_show_pricing,
			ai_assistant_addon_enabled,
			updated_at
	`, input.PlatformName,
		input.SupportEmail,
		input.VerificationSLAHours,
		input.PayoutReviewThresholdPesewas,
		input.MaintenanceMode,
		input.BrandLogoURL,
		input.AIAssistantAddonEnabled,
	))
	if err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

// UpdateAdminMarketingFlags applies a partial update of the four marketing launch
// flags. coalesce keeps any flag whose input pointer is nil unchanged, so callers
// can toggle a single flag without sending the rest. The settings row is ensured
// first so the very first call (before any platform-settings write) succeeds.
func (repo AdminAuthRepository) UpdateAdminMarketingFlags(
	ctx context.Context,
	input ports.UpdateAdminMarketingFlagsInput,
) (ports.AdminPlatformSettingsRecord, error) {
	if _, err := repo.pool.Exec(ctx, `
		insert into admin_platform_settings (settings_id)
		values (true)
		on conflict (settings_id) do nothing
	`); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	settings, err := scanAdminPlatformSettingsRecord(repo.pool.QueryRow(ctx, `
		update admin_platform_settings
		set marketing_show_browse_store = coalesce($1, marketing_show_browse_store),
			marketing_show_discover = coalesce($2, marketing_show_discover),
			marketing_show_create_store = coalesce($3, marketing_show_create_store),
			marketing_show_pricing = coalesce($4, marketing_show_pricing),
			updated_at = now()
		where settings_id = true
		returning
			platform_name,
			support_email,
			verification_sla_hours,
			payout_review_threshold_pesewas,
			maintenance_mode,
			brand_logo_url,
			marketing_show_browse_store,
			marketing_show_discover,
			marketing_show_create_store,
			marketing_show_pricing,
			updated_at
	`, input.BrowseStore,
		input.Discover,
		input.CreateStore,
		input.Pricing,
	))
	if err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}

func scanAdminPlatformSettingsRecord(row pgx.Row) (ports.AdminPlatformSettingsRecord, error) {
	var settings ports.AdminPlatformSettingsRecord
	if err := row.Scan(
		&settings.PlatformName,
		&settings.SupportEmail,
		&settings.VerificationSLAHours,
		&settings.PayoutReviewThresholdPesewas,
		&settings.MaintenanceMode,
		&settings.BrandLogoURL,
		&settings.MarketingFlags.BrowseStore,
		&settings.MarketingFlags.Discover,
		&settings.MarketingFlags.CreateStore,
		&settings.MarketingFlags.Pricing,
		&settings.AIAssistantAddonEnabled,
		&settings.UpdatedAt,
	); err != nil {
		return ports.AdminPlatformSettingsRecord{}, err
	}

	return settings, nil
}
