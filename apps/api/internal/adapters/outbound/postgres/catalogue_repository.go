package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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
