package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
		sequence := input.Sequence
		if sequence <= 0 {
			next, err := nextSequence(ctx, tx, "collections", " and status <> 'deleted'", input.BusinessID)
			if err != nil {
				return err
			}
			sequence = next
		}
		_, err := tx.Exec(ctx, `
			insert into collections (collection_id, business_id, name, theme, handle, status, sequence)
			values ($1, $2, $3, $4, $5, 'active', $6)
		`, input.CollectionID.String(), input.BusinessID.String(), input.Name, input.Theme, input.Handle, sequence)
		if collectionSequenceTaken(err) {
			return ports.ErrSequenceTaken
		}
		return err
	})
}

func (repo CatalogueRepository) UpdateCollection(ctx context.Context, scope common.TenantScope, input ports.CollectionUpdateInput) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		// On edit, a blank ( <=0 ) order keeps the collection's current position —
		// only an explicit number moves it (auto-numbering is for creation).
		tag, err := tx.Exec(ctx, `
			update collections
			set name = $3, theme = $4,
				sequence = case when $5 <= 0 then sequence else $5 end,
				updated_at = now()
			where collection_id = $1 and business_id = $2 and status <> 'deleted'
		`, input.CollectionID.String(), input.BusinessID.String(), input.Name, input.Theme, input.Sequence)
		if collectionSequenceTaken(err) {
			return ports.ErrSequenceTaken
		}
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
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
		if err := ensureDesignCapacity(ctx, tx, input.BusinessID); err != nil {
			return err
		}
		if err := ensureImageCapacity(ctx, tx, input.BusinessID, len(images)); err != nil {
			return err
		}
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
		if err := ensureImageCapacity(ctx, tx, scope.BusinessID, len(images)); err != nil {
			return err
		}
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
		// Pricing-mode exclusivity: a customisation design is priced by deposit,
		// not by size-band prices, so drop any stale band prices when it switches
		// to (or stays in) customisation mode. Keeps the storefront single-price
		// rule consistent with stored data.
		if input.CustomisationAllowed {
			if _, err := tx.Exec(ctx, `
				delete from design_prices where design_id = $1 and business_id = $2
			`, input.DesignID.String(), scope.BusinessID.String()); err != nil {
				return err
			}
		}
		return nil
	})
}

func (repo CatalogueRepository) SetDesignStatus(ctx context.Context, scope common.TenantScope, designID common.ID, status catalogue.Status) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		if status == catalogue.StatusActive {
			var currentStatus string
			err := tx.QueryRow(ctx, `
				select status
				from designs
				where design_id = $1 and business_id = $2
				for update
			`, designID.String(), scope.BusinessID.String()).Scan(&currentStatus)
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			if err != nil {
				return err
			}
			if currentStatus != string(catalogue.StatusActive) {
				if err := ensureDesignCapacity(ctx, tx, scope.BusinessID); err != nil {
					return err
				}
			}
		}
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
	chartJSON, err := marshalSizeChart(input.Chart)
	if err != nil {
		return err
	}
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		sequence := input.Sequence
		if sequence <= 0 {
			next, err := nextSequence(ctx, tx, "size_bands", "", input.BusinessID)
			if err != nil {
				return err
			}
			sequence = next
		}
		_, err := tx.Exec(ctx, `
			insert into size_bands (size_band_id, business_id, label, chart, sequence)
			values ($1, $2, $3, $4, $5)
		`, input.SizeBandID.String(), input.BusinessID.String(), input.Label, chartJSON, sequence)
		if sizeBandSequenceTaken(err) {
			return ports.ErrSequenceTaken
		}
		return err
	})
}

func (repo CatalogueRepository) ListSizeBands(ctx context.Context, scope common.TenantScope) ([]catalogue.SizeBand, error) {
	var bands []catalogue.SizeBand
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select size_band_id, business_id, label, chart, sequence
			from size_bands where business_id = $1 order by sequence, label
		`, scope.BusinessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var b catalogue.SizeBand
			var chartRaw []byte
			if err := rows.Scan(&b.ID, &b.BusinessID, &b.Label, &chartRaw, &b.Sequence); err != nil {
				return err
			}
			b.Chart = unmarshalSizeChart(chartRaw)
			bands = append(bands, b)
		}
		return rows.Err()
	})
	return bands, err
}

func (repo CatalogueRepository) UpdateSizeBand(ctx context.Context, scope common.TenantScope, input ports.SizeBandUpdateInput) error {
	chartJSON, err := marshalSizeChart(input.Chart)
	if err != nil {
		return err
	}
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		// On edit, a blank ( <=0 ) order keeps the band's current position — only an
		// explicit number moves it (auto-numbering is for creation).
		tag, err := tx.Exec(ctx, `
			update size_bands
			set label = $3, chart = $4,
				sequence = case when $5 <= 0 then sequence else $5 end,
				updated_at = now()
			where size_band_id = $1 and business_id = $2
		`, input.SizeBandID.String(), input.BusinessID.String(), input.Label, chartJSON, input.Sequence)
		if sizeBandSequenceTaken(err) {
			return ports.ErrSequenceTaken
		}
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

func (repo CatalogueRepository) DeleteSizeBand(ctx context.Context, scope common.TenantScope, sizeBandID common.ID) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		// design_prices(size_band_id) FK is ON DELETE CASCADE, so removing a band
		// also clears its per-design prices.
		tag, err := tx.Exec(ctx, `
			delete from size_bands where size_band_id = $1 and business_id = $2
		`, sizeBandID.String(), scope.BusinessID.String())
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

func (repo CatalogueRepository) SetDesignPrice(ctx context.Context, scope common.TenantScope, designID common.ID, sizeBandID common.ID, priceMinor int64) error {
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

func ensureDesignCapacity(ctx context.Context, tx pgx.Tx, businessID common.ID) error {
	var limit sql.NullInt64
	var activeCount int64
	err := tx.QueryRow(ctx, `
		select p.design_limit::bigint,
			(
				select count(*)::bigint
				from designs d
				where d.business_id = b.business_id
					and d.status = 'active'
			) as active_designs
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1
		for update of b
	`, businessID.String()).Scan(&limit, &activeCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if limit.Valid && activeCount >= limit.Int64 {
		return ports.ErrPlanLimitExceeded
	}
	return nil
}

// ensureImageCapacity caps the number of images a design may carry by plan: the
// free plan allows 2, any paid plan allows 5 (Version-one review §"Adding a
// design" 4). Runs under tenant scope.
func ensureImageCapacity(ctx context.Context, tx pgx.Tx, businessID common.ID, imageCount int) error {
	var planCode string
	err := tx.QueryRow(ctx, `
		select p.code
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1
	`, businessID.String()).Scan(&planCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	limit := 5
	if planCode == "free" {
		limit = 2
	}
	if imageCount > limit {
		return ports.ErrImageLimitExceeded
	}
	return nil
}

// size_band_chart is the on-disk JSON shape for size_bands.chart. It is an object
// (not a bare array) so it stays compatible with the column's legacy '{}'
// default, which unmarshals cleanly to an empty Items slice.
type sizeBandChartRow struct {
	Items []sizeBandChartItemRow `json:"items"`
}

type sizeBandChartItemRow struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Unit  string `json:"unit"`
}

func marshalSizeChart(items []catalogue.SizeChartItem) ([]byte, error) {
	// Store an empty chart as the column's legacy '{}' default rather than
	// {"items":[]}, so unset bands keep a single canonical empty representation.
	if len(items) == 0 {
		return []byte("{}"), nil
	}
	doc := sizeBandChartRow{Items: make([]sizeBandChartItemRow, 0, len(items))}
	for _, item := range items {
		doc.Items = append(doc.Items, sizeBandChartItemRow{Name: item.Name, Value: item.Value, Unit: item.Unit})
	}
	return json.Marshal(doc)
}

func unmarshalSizeChart(raw []byte) []catalogue.SizeChartItem {
	if len(raw) == 0 {
		return nil
	}
	var doc sizeBandChartRow
	if err := json.Unmarshal(raw, &doc); err != nil || len(doc.Items) == 0 {
		return nil
	}
	out := make([]catalogue.SizeChartItem, 0, len(doc.Items))
	for _, item := range doc.Items {
		out = append(out, catalogue.SizeChartItem{Name: item.Name, Value: item.Value, Unit: item.Unit})
	}
	return out
}

// nextSequence returns the next free display position for an entity within a
// business, used to auto-number creation when the caller leaves the sequence
// blank (<=0). whereExtra (may be empty) MUST stay in sync with the table's
// unique sequence index predicate (migration 000057): collections pass
// " and status <> 'deleted'" to match collections_business_sequence_active_idx;
// size_bands pass "" because size_bands_business_sequence_idx is unconditional.
// table/whereExtra are package-internal constants, never request input.
func nextSequence(ctx context.Context, tx pgx.Tx, table, whereExtra string, businessID common.ID) (int, error) {
	var next int
	query := "select coalesce(max(sequence), 0) + 1 from " + table + " where business_id = $1" + whereExtra
	if err := tx.QueryRow(ctx, query, businessID.String()).Scan(&next); err != nil {
		return 0, err
	}
	return next, nil
}

func collectionSequenceTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "collections_business_sequence_active_idx"
}

func sizeBandSequenceTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "size_bands_business_sequence_idx"
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
