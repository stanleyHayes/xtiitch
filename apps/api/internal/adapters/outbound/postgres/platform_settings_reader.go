package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// PlatformSettingsReader reads the single-row platform settings for callers that
// only need a specific flag (e.g. the AI add-on service checking its master
// switch), without depending on the full admin repository. admin_platform_settings
// is a global, non-RLS table, so a plain pool query is correct.
type PlatformSettingsReader struct {
	pool *pgxpool.Pool
}

func NewPlatformSettingsReader(pool *pgxpool.Pool) PlatformSettingsReader {
	return PlatformSettingsReader{pool: pool}
}

// AIAssistantAddonEnabled returns the admin master switch for the paid AI writing
// add-on. When the settings row does not exist yet it defaults to true, matching
// the column default (sellable wherever the AI is configured).
func (r PlatformSettingsReader) AIAssistantAddonEnabled(ctx context.Context) (bool, error) {
	var enabled bool
	err := r.pool.QueryRow(ctx, `
		select ai_assistant_addon_enabled
		from admin_platform_settings
		where settings_id = true
		limit 1
	`).Scan(&enabled)
	if err != nil {
		if err == pgx.ErrNoRows {
			return true, nil
		}
		return false, err
	}
	return enabled, nil
}

// VATRateBps returns the live, admin-editable VAT rate (§4.1) that charge paths
// apply across all payments. When the settings row does not exist yet it
// defaults to Ghana's standard 20%, matching the column default added by
// migration 000094.
func (r PlatformSettingsReader) VATRateBps(ctx context.Context) (int, error) {
	var rateBps int
	err := r.pool.QueryRow(ctx, `
		select vat_rate_bps
		from admin_platform_settings
		where settings_id = true
		limit 1
	`).Scan(&rateBps)
	if err != nil {
		if err == pgx.ErrNoRows {
			return money.GhanaStandardVATRateBps, nil
		}
		return 0, err
	}
	return rateBps, nil
}
