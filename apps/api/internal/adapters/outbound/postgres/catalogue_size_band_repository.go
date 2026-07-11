package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

// ensureSizeBandExists verifies that a size band belongs to the business. Like
// ensureDesignExists, this guards FK targets that Postgres validates cross-tenant.
func ensureSizeBandExists(ctx context.Context, tx pgx.Tx, sizeBandID common.ID, businessID common.ID) error {
	var exists bool
	err := tx.QueryRow(ctx, `
		select true from size_bands
		where size_band_id = $1 and business_id = $2
	`, sizeBandID.String(), businessID.String()).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
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

func sizeBandSequenceTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "size_bands_business_sequence_idx"
}
