package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo CatalogueRepository) ListDesignVariations(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.DesignVariation, error) {
	var variations []catalogue.DesignVariation
	err := repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			select variation_id, design_id, business_id, name, images, is_default, sequence
			from design_variations
			where design_id = $1 and business_id = $2
			order by sequence, created_at
		`, designID.String(), scope.BusinessID.String())
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var v catalogue.DesignVariation
			if err := rows.Scan(&v.ID, &v.DesignID, &v.BusinessID, &v.Name, &v.Images, &v.IsDefault, &v.Sequence); err != nil {
				return err
			}
			variations = append(variations, v)
		}
		return rows.Err()
	})
	return variations, err
}

func (repo CatalogueRepository) CreateDesignVariation(ctx context.Context, scope common.TenantScope, input ports.DesignVariationInput) error {
	images := input.Images
	if images == nil {
		images = []string{}
	}
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		if err := ensureDesignExists(ctx, tx, input.DesignID, input.BusinessID); err != nil {
			return err
		}
		if err := ensureVariationCapacity(ctx, tx, input.BusinessID, input.DesignID); err != nil {
			return err
		}
		if err := ensureImageCapacity(ctx, tx, input.BusinessID, len(images)); err != nil {
			return err
		}
		sequence, err := resolveVariationSequence(ctx, tx, input.DesignID, input.BusinessID, input.Sequence)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			insert into design_variations (
				variation_id, design_id, business_id, name, images, is_default, sequence
			)
			values ($1, $2, $3, $4, $5, $6, $7)
		`, input.VariationID.String(), input.DesignID.String(), input.BusinessID.String(),
			input.Name, images, input.IsDefault, sequence)
		return err
	})
}

func (repo CatalogueRepository) UpdateDesignVariation(ctx context.Context, scope common.TenantScope, input ports.DesignVariationUpdateInput) error {
	images := input.Images
	if images == nil {
		images = []string{}
	}
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		if err := ensureImageCapacity(ctx, tx, input.BusinessID, len(images)); err != nil {
			return err
		}
		// A blank ( <=0 ) sequence keeps the variation's current position — only an
		// explicit number moves it.
		tag, err := tx.Exec(ctx, `
			update design_variations
			set name = $3, images = $4, is_default = $5,
				sequence = case when $6 <= 0 then sequence else $6 end,
				updated_at = now()
			where variation_id = $1 and business_id = $2
		`, input.VariationID.String(), input.BusinessID.String(),
			input.Name, images, input.IsDefault, input.Sequence)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

func (repo CatalogueRepository) DeleteDesignVariation(ctx context.Context, scope common.TenantScope, variationID common.ID) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			delete from design_variations where variation_id = $1 and business_id = $2
		`, variationID.String(), scope.BusinessID.String())
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

// ReorderDesignVariations rewrites the display order of a design's variations to
// match orderedIDs (1-based positions). Ids not belonging to the design or the
// tenant are simply not matched.
func (repo CatalogueRepository) ReorderDesignVariations(ctx context.Context, scope common.TenantScope, designID common.ID, orderedIDs []common.ID) error {
	return repo.inTenantTx(ctx, scope, func(tx pgx.Tx) error {
		for position, id := range orderedIDs {
			if _, err := tx.Exec(ctx, `
				update design_variations set sequence = $4, updated_at = now()
				where variation_id = $1 and design_id = $2 and business_id = $3
			`, id.String(), designID.String(), scope.BusinessID.String(), position+1); err != nil {
				return err
			}
		}
		return nil
	})
}

// resolveVariationSequence returns the display position for a new variation:
// requested when > 0, otherwise the next free position for the design.
func resolveVariationSequence(ctx context.Context, tx pgx.Tx, designID common.ID, businessID common.ID, requested int) (int, error) {
	if requested > 0 {
		return requested, nil
	}
	var next int
	err := tx.QueryRow(ctx, `
		select coalesce(max(sequence), 0) + 1 from design_variations
		where design_id = $1 and business_id = $2
	`, designID.String(), businessID.String()).Scan(&next)
	return next, err
}

// ensureVariationCapacity enforces the per-design colour-variation plan cap
// (Free 2 / Starter 3 / Growth 5 / Studio 10, counting the design's implicit
// default variation). It locks the business row so a concurrent create cannot
// race past the cap.
func ensureVariationCapacity(ctx context.Context, tx pgx.Tx, businessID common.ID, designID common.ID) error {
	var planCode string
	var storedCount int
	err := tx.QueryRow(ctx, `
		select p.code,
			(
				select count(*)::int
				from design_variations dv
				where dv.design_id = $2 and dv.business_id = b.business_id
			) as stored_variations
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1
		for update of b
	`, businessID.String(), designID.String()).Scan(&planCode, &storedCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if !catalogue.VariationCreateAllowed(planCode, storedCount) {
		return ports.ErrVariationLimitReached
	}
	return nil
}
