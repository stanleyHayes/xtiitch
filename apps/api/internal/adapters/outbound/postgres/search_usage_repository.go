package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// SearchUsageRepository meters AI search for the freemium paywall. Both the
// usage counter and the customer entitlement lookup are platform-global, so they
// run under the RLS bypass (ai_search_usage has no tenant column; customers is a
// global identity table).
type SearchUsageRepository struct {
	pool *pgxpool.Pool
}

func NewSearchUsageRepository(pool *pgxpool.Pool) SearchUsageRepository {
	return SearchUsageRepository{pool: pool}
}

func (repo SearchUsageRepository) IncrementUsage(ctx context.Context, subjectKind, subjectID string, periodMonth time.Time) (int, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return 0, err
	}

	var count int
	if err := tx.QueryRow(ctx, `
		insert into ai_search_usage (subject_kind, subject_id, period_month, search_count, updated_at)
		values ($1, $2, $3, 1, now())
		on conflict (subject_kind, subject_id, period_month) do update
		set search_count = ai_search_usage.search_count + 1,
			updated_at = now()
		returning search_count
	`, subjectKind, subjectID, periodMonth).Scan(&count); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return count, nil
}

func (repo SearchUsageRepository) CustomerIsPro(ctx context.Context, customerID common.ID) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return false, err
	}

	var pro bool
	if err := tx.QueryRow(ctx, `
		select coalesce(ai_search_pro, false) from customers where customer_id = $1
	`, customerID.String()).Scan(&pro); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return pro, nil
}
