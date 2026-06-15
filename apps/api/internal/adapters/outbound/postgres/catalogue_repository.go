package postgres

import (
	"context"
	"database/sql"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type CatalogueRepository struct {
	pool *pgxpool.Pool
}

func NewCatalogueRepository(pool *pgxpool.Pool) CatalogueRepository {
	return CatalogueRepository{pool: pool}
}

func nullableIDArg(id *common.ID) any {
	if id == nil {
		return nil
	}
	return id.String()
}

func nullableInt64Arg(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}

// --- Collections ---

func (repo CatalogueRepository) CreateCollection(ctx context.Context, scope common.TenantScope, input ports.CollectionInput) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			insert into collections (collection_id, business_id, name, theme, handle, status, sequence)
			values ($1, $2, $3, $4, $5, 'active', $6)
		`, input.CollectionID.String(), input.BusinessID.String(), input.Name, input.Theme, input.Handle, input.Sequence)
		return err
	})
}

func (repo CatalogueRepository) ListCollections(ctx context.Context, scope common.TenantScope) ([]catalogue.Collection, error) {
	var collections []catalogue.Collection
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select collection_id, business_id, name, theme, handle, status, sequence
			from collections
			where business_id = $1 and status <> 'deleted'
			order by sequence, name
		`, scope.BusinessID.String())
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

func (repo CatalogueRepository) SetCollectionStatus(ctx context.Context, scope common.TenantScope, collectionID common.ID, status catalogue.Status) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			update collections set status = $3, updated_at = now()
			where collection_id = $1 and business_id = $2
		`, collectionID.String(), scope.BusinessID.String(), string(status)); err != nil {
			return err
		}
		// Retiring a collection retires its active designs (Spec 4.7.1).
		if status == catalogue.StatusRetired {
			_, err := tx.Exec(ctx, `
				update designs set status = 'retired', updated_at = now()
				where collection_id = $1 and business_id = $2 and status = 'active'
			`, collectionID.String(), scope.BusinessID.String())
			return err
		}
		return nil
	})
}

// --- Designs ---

func (repo CatalogueRepository) CreateDesign(ctx context.Context, scope common.TenantScope, input ports.DesignInput) error {
	images := input.Images
	if images == nil {
		images = []string{}
	}
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			insert into designs (
				design_id, business_id, collection_id, title, description, images,
				customisation_allowed, deposit_override_minor, handle, status, sequence
			)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
		`, input.DesignID.String(), input.BusinessID.String(), nullableIDArg(input.CollectionID),
			input.Title, input.Description, images, input.CustomisationAllowed,
			nullableInt64Arg(input.DepositOverrideMinor), input.Handle, input.Sequence)
		return err
	})
}

func scanDesign(rows pgx.Rows) (catalogue.Design, error) {
	var d catalogue.Design
	var collectionID sql.NullString
	var depositOverride sql.NullInt64
	var status string
	if err := rows.Scan(
		&d.ID, &d.BusinessID, &collectionID, &d.Title, &d.Description, &d.Images,
		&d.CustomisationAllowed, &depositOverride, &d.Handle, &status, &d.Sequence,
	); err != nil {
		return catalogue.Design{}, err
	}
	d.Status = catalogue.Status(status)
	if collectionID.Valid {
		id := common.ID(collectionID.String)
		d.CollectionID = &id
	}
	if depositOverride.Valid {
		value := depositOverride.Int64
		d.DepositOverrideMinor = &value
	}
	return d, nil
}

const designColumns = `design_id, business_id, collection_id, title, description, images,
	customisation_allowed, deposit_override_minor, handle, status, sequence`

func (repo CatalogueRepository) ListDesigns(ctx context.Context, scope common.TenantScope) ([]catalogue.Design, error) {
	var designs []catalogue.Design
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `select `+designColumns+`
			from designs where business_id = $1 and status <> 'deleted'
			order by sequence, title`, scope.BusinessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			design, err := scanDesign(rows)
			if err != nil {
				return err
			}
			designs = append(designs, design)
		}
		return rows.Err()
	})
	return designs, err
}

func (repo CatalogueRepository) GetDesign(ctx context.Context, scope common.TenantScope, designID common.ID) (catalogue.Design, error) {
	var design catalogue.Design
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `select `+designColumns+`
			from designs where design_id = $1 and business_id = $2 and status <> 'deleted'`,
			designID.String(), scope.BusinessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()

		if !rows.Next() {
			if err := rows.Err(); err != nil {
				return err
			}
			return ErrNotFound
		}
		design, err = scanDesign(rows)
		return err
	})
	return design, err
}

func (repo CatalogueRepository) UpdateDesign(ctx context.Context, scope common.TenantScope, input ports.DesignInput) error {
	images := input.Images
	if images == nil {
		images = []string{}
	}
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			update designs
			set collection_id = $3, title = $4, description = $5, images = $6,
				customisation_allowed = $7, deposit_override_minor = $8, sequence = $9,
				updated_at = now()
			where design_id = $1 and business_id = $2 and status <> 'deleted'
		`, input.DesignID.String(), scope.BusinessID.String(), nullableIDArg(input.CollectionID),
			input.Title, input.Description, images, input.CustomisationAllowed,
			nullableInt64Arg(input.DepositOverrideMinor), input.Sequence)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

func (repo CatalogueRepository) SetDesignStatus(ctx context.Context, scope common.TenantScope, designID common.ID, status catalogue.Status) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			update designs set status = $3, updated_at = now()
			where design_id = $1 and business_id = $2
		`, designID.String(), scope.BusinessID.String(), string(status))
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

// --- Size bands & pricing ---

func (repo CatalogueRepository) CreateSizeBand(ctx context.Context, scope common.TenantScope, input ports.SizeBandInput) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			insert into size_bands (size_band_id, business_id, label, sequence)
			values ($1, $2, $3, $4)
		`, input.SizeBandID.String(), input.BusinessID.String(), input.Label, input.Sequence)
		return err
	})
}

func (repo CatalogueRepository) ListSizeBands(ctx context.Context, scope common.TenantScope) ([]catalogue.SizeBand, error) {
	var bands []catalogue.SizeBand
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select size_band_id, business_id, label, sequence
			from size_bands where business_id = $1 order by sequence, label
		`, scope.BusinessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var b catalogue.SizeBand
			if err := rows.Scan(&b.ID, &b.BusinessID, &b.Label, &b.Sequence); err != nil {
				return err
			}
			bands = append(bands, b)
		}
		return rows.Err()
	})
	return bands, err
}

func (repo CatalogueRepository) SetDesignPrice(ctx context.Context, scope common.TenantScope, designID common.ID, sizeBandID common.ID, priceMinor int64) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			insert into design_prices (design_id, size_band_id, business_id, price_minor)
			values ($1, $2, $3, $4)
			on conflict (design_id, size_band_id)
			do update set price_minor = excluded.price_minor, updated_at = now()
		`, designID.String(), sizeBandID.String(), scope.BusinessID.String(), priceMinor)
		return err
	})
}

func (repo CatalogueRepository) ListDesignPrices(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.BandPrice, error) {
	var prices []catalogue.BandPrice
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select dp.size_band_id, sb.label, dp.price_minor
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
			if err := rows.Scan(&p.SizeBandID, &p.Label, &p.PriceMinor); err != nil {
				return err
			}
			prices = append(prices, p)
		}
		return rows.Err()
	})
	return prices, err
}

func (repo CatalogueRepository) inTenantTx(ctx context.Context, scope common.TenantScope, fn func(tx pgx.Tx) error) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
