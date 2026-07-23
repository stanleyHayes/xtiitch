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
				style_category, customisation_allowed, deposit_override_minor,
				bespoke_display_minor, handle, status, sequence
			)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)
		`, input.DesignID.String(), input.BusinessID.String(), nullableIDArg(input.CollectionID),
			input.Title, input.Description, images, input.StyleCategory, input.CustomisationAllowed,
			nullableInt64Arg(input.DepositOverrideMinor), input.BespokeDisplayMinor,
			input.Handle, input.Sequence)
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
		&d.StyleCategory, &d.CustomisationAllowed, &depositOverride, &d.BespokeDisplayMinor, &d.Handle, &status, &d.Sequence,
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
	style_category, customisation_allowed, deposit_override_minor, bespoke_display_minor, handle, status, sequence`

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
				style_category = $7, customisation_allowed = $8, deposit_override_minor = $9,
				bespoke_display_minor = $10, sequence = $11,
				updated_at = now()
			where design_id = $1 and business_id = $2 and status <> 'deleted'
		`, input.DesignID.String(), input.BusinessID.String(), nullableIDArg(input.CollectionID),
			input.Title, input.Description, images, input.StyleCategory, input.CustomisationAllowed,
			nullableInt64Arg(input.DepositOverrideMinor), input.BespokeDisplayMinor, input.Sequence)
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
			`, input.DesignID.String(), input.BusinessID.String()); err != nil {
				return err
			}
		}
		return nil
	})
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo CatalogueRepository) SetDesignStatus(
	ctx context.Context,
	scope common.TenantScope,
	designID common.ID,
	status catalogue.Status,
) error {
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

// ensureDesignExists verifies that a live design belongs to the business. RLS on
// design_variations only constrains business_id, so a variation's design
// ownership must be checked explicitly.
func ensureDesignExists(ctx context.Context, tx pgx.Tx, designID common.ID, businessID common.ID) error {
	var exists bool
	err := tx.QueryRow(ctx, `
		select true from designs
		where design_id = $1 and business_id = $2 and status <> 'deleted'
	`, designID.String(), businessID.String()).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func ensureDesignCapacity(ctx context.Context, tx pgx.Tx, businessID common.ID) error {
	// Lock first, count second, in two statements. Counting inside the locking
	// statement does not serialise: under READ COMMITTED the statement runs on a
	// snapshot taken before the lock is granted, so a waiter would count as of
	// before the previous holder committed and both would pass the cap.
	var limit sql.NullInt64
	err := tx.QueryRow(ctx, `
		select p.design_limit::bigint
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1
		for update of b
	`, businessID.String()).Scan(&limit)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if !limit.Valid {
		// NULL is unlimited.
		return nil
	}

	var activeCount int64
	if err := tx.QueryRow(ctx, `
		select count(*)::bigint
		from designs d
		where d.business_id = $1 and d.status = 'active'
	`, businessID.String()).Scan(&activeCount); err != nil {
		return err
	}
	if activeCount >= limit.Int64 {
		return ports.ErrPlanLimitExceeded
	}
	return nil
}

// ensureImageCapacity caps the number of images a design may carry, from the
// plan's admin-editable image_limit (NULL = unlimited). Runs under tenant scope.
//
// This used to compare the plan CODE against the literal "free" and hardcode
// 2-or-5, which meant an admin could not change it without a deploy (Testing
// Report §7.3) and any plan code other than "free" -- including every
// operator-created plan -- silently got the paid cap.
func ensureImageCapacity(ctx context.Context, tx pgx.Tx, businessID common.ID, imageCount int) error {
	var limit sql.NullInt64
	err := tx.QueryRow(ctx, `
		select p.image_limit
		from businesses b
		join plans p on p.plan_id = b.plan_id
		where b.business_id = $1
	`, businessID.String()).Scan(&limit)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	// NULL is unlimited, so an unset limit imposes no cap.
	if limit.Valid && int64(imageCount) > limit.Int64 {
		return ports.ErrImageLimitExceeded
	}
	return nil
}
