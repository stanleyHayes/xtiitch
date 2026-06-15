package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type StorefrontRepository struct {
	pool *pgxpool.Pool
}

func NewStorefrontRepository(pool *pgxpool.Pool) StorefrontRepository {
	return StorefrontRepository{pool: pool}
}

// inBypassTx runs a read with the RLS bypass on. The storefront reaches across
// tenants only to resolve a public handle to one business; everything it returns
// is that one business's active, public catalogue.
func (repo StorefrontRepository) inBypassTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo StorefrontRepository) ResolveStore(ctx context.Context, handle string) (ports.Storefront, error) {
	var store ports.Storefront
	err := repo.inBypassTx(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			select b.business_id, b.name, b.handle,
				ss.brand_color, ss.bespoke_enabled, ss.measurements_enabled,
				ss.customisation_enabled, ss.collections_enabled, ss.delivery_enabled, ss.dispatch_enabled
			from businesses b
			join store_settings ss on ss.business_id = b.business_id
			where lower(b.handle) = lower($1)
		`, handle).Scan(
			&store.BusinessID, &store.Name, &store.Handle,
			&store.BrandColor, &store.Settings.BespokeEnabled, &store.Settings.MeasurementsEnabled,
			&store.Settings.CustomisationEnabled, &store.Settings.CollectionsEnabled,
			&store.Settings.DeliveryEnabled, &store.Settings.DispatchEnabled,
		)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.Storefront{}, ErrNotFound
	}
	store.Settings.BrandColor = store.BrandColor
	return store, err
}

func (repo StorefrontRepository) ListActiveDesigns(ctx context.Context, businessID common.ID) ([]ports.StorefrontDesign, error) {
	var results []ports.StorefrontDesign
	err := repo.inBypassTx(ctx, func(tx pgx.Tx) error {
		designs, err := queryActiveDesigns(ctx, tx, `business_id = $1`, businessID.String())
		if err != nil {
			return err
		}
		results, err = attachPrices(ctx, tx, designs)
		return err
	})
	return results, err
}

func (repo StorefrontRepository) SearchActiveDesigns(ctx context.Context, businessID common.ID, query string) ([]ports.StorefrontDesign, error) {
	var results []ports.StorefrontDesign
	err := repo.inBypassTx(ctx, func(tx pgx.Tx) error {
		designs, err := queryActiveDesigns(ctx, tx, `business_id = $1 and title ilike '%' || $2 || '%'`, businessID.String(), query)
		if err != nil {
			return err
		}
		results, err = attachPrices(ctx, tx, designs)
		return err
	})
	return results, err
}

func (repo StorefrontRepository) GetActiveDesignByHandle(ctx context.Context, handle string) (ports.StorefrontDesign, error) {
	var result ports.StorefrontDesign
	err := repo.inBypassTx(ctx, func(tx pgx.Tx) error {
		designs, err := queryActiveDesigns(ctx, tx, `handle = $1`, handle)
		if err != nil {
			return err
		}
		if len(designs) == 0 {
			return ErrNotFound
		}
		withPrices, err := attachPrices(ctx, tx, designs[:1])
		if err != nil {
			return err
		}
		result = withPrices[0]
		return nil
	})
	return result, err
}

func (repo StorefrontRepository) ListActiveCollections(ctx context.Context, businessID common.ID) ([]catalogue.Collection, error) {
	var collections []catalogue.Collection
	err := repo.inBypassTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select collection_id, business_id, name, theme, handle, status, sequence
			from collections where business_id = $1 and status = 'active'
			order by sequence, name
		`, businessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var c catalogue.Collection
			var status string
			if err := rows.Scan(&c.ID, &c.BusinessID, &c.Name, &c.Theme, &c.Handle, &status, &c.Sequence); err != nil {
				return err
			}
			c.Status = catalogue.Status(status)
			collections = append(collections, c)
		}
		return rows.Err()
	})
	return collections, err
}

func (repo StorefrontRepository) GetActiveCollectionByHandle(ctx context.Context, handle string) (ports.StorefrontCollection, error) {
	var result ports.StorefrontCollection
	err := repo.inBypassTx(ctx, func(tx pgx.Tx) error {
		var c catalogue.Collection
		var status string
		if err := tx.QueryRow(ctx, `
			select collection_id, business_id, name, theme, handle, status, sequence
			from collections where handle = $1 and status = 'active'
		`, handle).Scan(&c.ID, &c.BusinessID, &c.Name, &c.Theme, &c.Handle, &status, &c.Sequence); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}
		c.Status = catalogue.Status(status)
		result.Collection = c

		designs, err := queryActiveDesigns(ctx, tx, `collection_id = $1`, c.ID.String())
		if err != nil {
			return err
		}
		result.Designs, err = attachPrices(ctx, tx, designs)
		return err
	})
	return result, err
}

func queryActiveDesigns(ctx context.Context, tx pgx.Tx, where string, args ...any) ([]catalogue.Design, error) {
	rows, err := tx.Query(ctx, `select `+designColumns+`
		from designs where status = 'active' and `+where+`
		order by sequence, title`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var designs []catalogue.Design
	for rows.Next() {
		design, err := scanDesign(rows)
		if err != nil {
			return nil, err
		}
		designs = append(designs, design)
	}
	return designs, rows.Err()
}

func attachPrices(ctx context.Context, tx pgx.Tx, designs []catalogue.Design) ([]ports.StorefrontDesign, error) {
	results := make([]ports.StorefrontDesign, 0, len(designs))
	for _, design := range designs {
		rows, err := tx.Query(ctx, `
			select dp.size_band_id, sb.label, dp.price_minor
			from design_prices dp
			join size_bands sb on sb.size_band_id = dp.size_band_id
			where dp.design_id = $1
			order by sb.sequence, sb.label
		`, design.ID.String())
		if err != nil {
			return nil, err
		}

		var prices []catalogue.BandPrice
		for rows.Next() {
			var price catalogue.BandPrice
			if err := rows.Scan(&price.SizeBandID, &price.Label, &price.PriceMinor); err != nil {
				rows.Close()
				return nil, err
			}
			prices = append(prices, price)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}

		results = append(results, ports.StorefrontDesign{Design: design, Prices: prices})
	}
	return results, nil
}
