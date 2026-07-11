package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo CatalogueRepository) SetDesignPrice(
	ctx context.Context,
	scope common.TenantScope,
	designID common.ID,
	sizeBandID common.ID,
	priceMinor int64,
) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		// Pricing-mode exclusivity, enforced atomically with the write: a
		// customisation design is priced by deposit, never by band prices. Lock the
		// design row so a concurrent UpdateDesign cannot flip the mode between this
		// check and the insert.
		var customisationAllowed bool
		err := tx.QueryRow(ctx, `
			select customisation_allowed from designs
			where design_id = $1 and business_id = $2 and status <> 'deleted'
			for update
		`, designID.String(), scope.BusinessID.String()).Scan(&customisationAllowed)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if customisationAllowed {
			return ports.ErrPricingModeConflict
		}
		_, err = tx.Exec(ctx, `
			insert into design_prices (design_id, size_band_id, business_id, price_minor)
			values ($1, $2, $3, $4)
			on conflict (design_id, size_band_id)
			do update set price_minor = excluded.price_minor, updated_at = now()
		`, designID.String(), sizeBandID.String(), scope.BusinessID.String(), priceMinor)
		return err
	})
}

func (repo CatalogueRepository) ListDesignPrices(
	ctx context.Context,
	scope common.TenantScope,
	designID common.ID,
) ([]catalogue.BandPrice, error) {
	var prices []catalogue.BandPrice
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select dp.size_band_id, sb.label, dp.price_minor, sb.chart
			from design_prices dp
			join size_bands sb on sb.size_band_id = dp.size_band_id
			where dp.design_id = $1 and dp.business_id = $2
			order by sb.sequence, sb.label
		`, designID.String(), scope.BusinessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var p catalogue.BandPrice
			var chartRaw []byte
			if err := rows.Scan(&p.SizeBandID, &p.Label, &p.PriceMinor, &chartRaw); err != nil {
				return err
			}
			p.Chart = unmarshalSizeChart(chartRaw)
			prices = append(prices, p)
		}
		return rows.Err()
	})
	return prices, err
}

func (repo CatalogueRepository) SetDesignSizeBandOverride(
	ctx context.Context,
	scope common.TenantScope,
	input ports.DesignSizeBandOverrideInput,
) error {
	var labelArg any
	if input.Label != nil {
		labelArg = *input.Label
	}
	// chartArg stays nil (SQL NULL, "inherit master chart") unless ChartSet; when
	// set it is the {"items":[...]} document ('{}' when the chart is blanked).
	var chartArg any
	if input.ChartSet {
		chartJSON, err := marshalSizeChart(input.Chart)
		if err != nil {
			return err
		}
		chartArg = chartJSON
	}
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		// The design and band FKs are validated by Postgres cross-tenant (FK checks
		// bypass RLS), so confirm both belong to this business before writing —
		// mirrors the colour-variation ownership guard.
		if err := ensureDesignExists(ctx, tx, input.DesignID, input.BusinessID); err != nil {
			return err
		}
		if err := ensureSizeBandExists(ctx, tx, input.SizeBandID, input.BusinessID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			insert into design_size_band_overrides (
				override_id, design_id, business_id, size_band_id, label, chart
			)
			values ($1, $2, $3, $4, $5, $6)
			on conflict (design_id, size_band_id)
			do update set label = excluded.label, chart = excluded.chart, updated_at = now()
		`, input.OverrideID.String(), input.DesignID.String(), input.BusinessID.String(),
			input.SizeBandID.String(), labelArg, chartArg)
		return err
	})
}

func (repo CatalogueRepository) DeleteDesignSizeBandOverride(
	ctx context.Context,
	scope common.TenantScope,
	designID common.ID,
	sizeBandID common.ID,
) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		// Idempotent clear: reverting a band with no override in place is a no-op.
		_, err := tx.Exec(ctx, `
			delete from design_size_band_overrides
			where design_id = $1 and size_band_id = $2 and business_id = $3
		`, designID.String(), sizeBandID.String(), scope.BusinessID.String())
		return err
	})
}

func (repo CatalogueRepository) ListDesignSizeBandOverrides(
	ctx context.Context,
	scope common.TenantScope,
	designID common.ID,
) ([]catalogue.DesignSizeBandOverride, error) {
	var overrides []catalogue.DesignSizeBandOverride
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select override_id, design_id, business_id, size_band_id, label, chart
			from design_size_band_overrides
			where design_id = $1 and business_id = $2
		`, designID.String(), scope.BusinessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var o catalogue.DesignSizeBandOverride
			var label sql.NullString
			var chartRaw []byte
			if err := rows.Scan(&o.OverrideID, &o.DesignID, &o.BusinessID, &o.SizeBandID, &label, &chartRaw); err != nil {
				return err
			}
			if label.Valid {
				value := label.String
				o.Label = &value
			}
			// A non-NULL chart column (even '{}') is an explicit chart override;
			// NULL inherits the master band's chart.
			if chartRaw != nil {
				o.ChartSet = true
				o.Chart = unmarshalSizeChart(chartRaw)
			}
			overrides = append(overrides, o)
		}
		return rows.Err()
	})
	return overrides, err
}
