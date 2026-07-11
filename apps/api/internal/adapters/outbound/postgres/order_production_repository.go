package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ListStageTemplates returns the business's production stages, ordered by flow
// then sequence, so the dashboard can render one column per stage.
func (repo OrderRepository) ListStageTemplates(ctx context.Context, scope common.TenantScope) ([]ports.StageTemplate, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select name, colour, flow, sequence
		from stage_templates
		where business_id = $1
		order by flow, sequence
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stages []ports.StageTemplate
	for rows.Next() {
		var s ports.StageTemplate
		if err := rows.Scan(&s.Name, &s.Colour, &s.Flow, &s.Sequence); err != nil {
			return nil, err
		}
		stages = append(stages, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return stages, nil
}
