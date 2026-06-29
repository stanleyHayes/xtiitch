package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// DeliveryZoneRepository persists a business's delivery zones (named areas with a
// flat fee). Reads and writes run under the tenant scope so RLS isolates them.
type DeliveryZoneRepository struct {
	pool *pgxpool.Pool
}

func NewDeliveryZoneRepository(pool *pgxpool.Pool) DeliveryZoneRepository {
	return DeliveryZoneRepository{pool: pool}
}

func (repo DeliveryZoneRepository) ListDeliveryZones(ctx context.Context, scope common.TenantScope) ([]ports.DeliveryZone, error) {
	return repo.listZones(ctx, scope, false)
}

func (repo DeliveryZoneRepository) ListActiveDeliveryZones(ctx context.Context, scope common.TenantScope) ([]ports.DeliveryZone, error) {
	return repo.listZones(ctx, scope, true)
}

func (repo DeliveryZoneRepository) listZones(ctx context.Context, scope common.TenantScope, activeOnly bool) ([]ports.DeliveryZone, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	query := `
		select zone_id::text, name, fee_minor, sequence, active
		from delivery_zones
		where business_id = $1
	`
	if activeOnly {
		query += ` and active = true`
	}
	query += ` order by sequence, name`

	rows, err := tx.Query(ctx, query, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	zones := make([]ports.DeliveryZone, 0)
	for rows.Next() {
		var z ports.DeliveryZone
		var id string
		if err := rows.Scan(&id, &z.Name, &z.FeeMinor, &z.Sequence, &z.Active); err != nil {
			return nil, err
		}
		z.ID = common.ID(id)
		zones = append(zones, z)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return zones, nil
}

func (repo DeliveryZoneRepository) GetDeliveryZone(ctx context.Context, scope common.TenantScope, zoneID common.ID) (ports.DeliveryZone, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.DeliveryZone{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.DeliveryZone{}, err
	}

	var z ports.DeliveryZone
	var id string
	if err := tx.QueryRow(ctx, `
		select zone_id::text, name, fee_minor, sequence, active
		from delivery_zones where zone_id = $1 and business_id = $2
	`, zoneID.String(), scope.BusinessID.String()).Scan(&id, &z.Name, &z.FeeMinor, &z.Sequence, &z.Active); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.DeliveryZone{}, ports.ErrNotFound
		}
		return ports.DeliveryZone{}, err
	}
	z.ID = common.ID(id)

	if err := tx.Commit(ctx); err != nil {
		return ports.DeliveryZone{}, err
	}
	return z, nil
}

func (repo DeliveryZoneRepository) CreateDeliveryZone(ctx context.Context, scope common.TenantScope, input ports.CreateDeliveryZoneInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into delivery_zones (zone_id, business_id, name, fee_minor, sequence, active)
		values ($1, $2, $3, $4, $5, true)
	`, input.ZoneID.String(), scope.BusinessID.String(), input.Name, input.FeeMinor, input.Sequence); err != nil {
		if isZoneNameTaken(err) {
			return ports.ErrZoneNameTaken
		}
		return err
	}

	return tx.Commit(ctx)
}

func (repo DeliveryZoneRepository) UpdateDeliveryZone(ctx context.Context, scope common.TenantScope, input ports.UpdateDeliveryZoneInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update delivery_zones
		set name = $3, fee_minor = $4, sequence = $5, active = $6, updated_at = now()
		where zone_id = $1 and business_id = $2
	`, input.ZoneID.String(), scope.BusinessID.String(), input.Name, input.FeeMinor, input.Sequence, input.Active)
	if err != nil {
		if isZoneNameTaken(err) {
			return ports.ErrZoneNameTaken
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrNotFound
	}

	return tx.Commit(ctx)
}

func (repo DeliveryZoneRepository) DeleteDeliveryZone(ctx context.Context, scope common.TenantScope, zoneID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		delete from delivery_zones where zone_id = $1 and business_id = $2
	`, zoneID.String(), scope.BusinessID.String())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ports.ErrNotFound
	}

	return tx.Commit(ctx)
}

func isZoneNameTaken(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "delivery_zones_business_name_unique"
}
