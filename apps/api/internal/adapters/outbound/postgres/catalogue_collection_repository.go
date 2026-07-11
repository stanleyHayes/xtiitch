package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

func (repo CatalogueRepository) SetCollectionStatus(
	ctx context.Context,
	scope common.TenantScope,
	collectionID common.ID,
	status catalogue.Status,
) error {
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
