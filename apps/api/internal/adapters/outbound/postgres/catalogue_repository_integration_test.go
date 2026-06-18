package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	clPlan     = "11111111-7777-7777-7777-000000000001"
	clBiz      = "11111111-7777-7777-7777-000000000002"
	clActive   = "11111111-7777-7777-7777-000000000003"
	clRetired  = "11111111-7777-7777-7777-000000000004"
	clOverflow = "11111111-7777-7777-7777-000000000005"
)

func clScope() common.TenantScope {
	return common.TenantScope{BusinessID: common.ID(clBiz)}
}

func seedCatalogueLimitFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupCatalogueLimitFixtures(t, pool)

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into plans (plan_id, code, name, monthly_fee_minor, commission_bps, design_limit, is_active)
			values ($1, 'it-design-cap', 'IT Design Cap', 0, 300, 1, true)
		`, clPlan)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Design Cap', 'it-design-cap', 'verified')
		`, clBiz, clPlan)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values
				($1, $3, 'Active cap design', 'active-cap-design', 'active'),
				($2, $3, 'Retired cap design', 'retired-cap-design', 'retired')
		`, clActive, clRetired, clBiz)
	})
}

func cleanupCatalogueLimitFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, clBiz)
		mustExec(t, tx, `delete from plans where plan_id = $1`, clPlan)
	})
}

func TestCreateDesignRejectsCurrentPlanDesignLimit(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCatalogueLimitFixtures(t, pool)
	defer cleanupCatalogueLimitFixtures(t, pool)

	repo := NewCatalogueRepository(pool)
	err := repo.CreateDesign(context.Background(), clScope(), ports.DesignInput{
		DesignID:   common.ID(clOverflow),
		BusinessID: common.ID(clBiz),
		Title:      "Overflow design",
		Handle:     "overflow-design",
	})
	if !errors.Is(err, ports.ErrPlanLimitExceeded) {
		t.Fatalf("expected plan limit error, got %v", err)
	}

	if err := repo.SetDesignStatus(context.Background(), clScope(), common.ID(clActive), catalogue.StatusRetired); err != nil {
		t.Fatalf("retire existing design: %v", err)
	}
	if err := repo.CreateDesign(context.Background(), clScope(), ports.DesignInput{
		DesignID:   common.ID(clOverflow),
		BusinessID: common.ID(clBiz),
		Title:      "Overflow design",
		Handle:     "overflow-design",
	}); err != nil {
		t.Fatalf("create after retiring active design: %v", err)
	}
}

func TestRestoreDesignRejectsCurrentPlanDesignLimit(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCatalogueLimitFixtures(t, pool)
	defer cleanupCatalogueLimitFixtures(t, pool)

	repo := NewCatalogueRepository(pool)
	err := repo.SetDesignStatus(context.Background(), clScope(), common.ID(clRetired), catalogue.StatusActive)
	if !errors.Is(err, ports.ErrPlanLimitExceeded) {
		t.Fatalf("expected plan limit error, got %v", err)
	}

	if err := repo.SetDesignStatus(context.Background(), clScope(), common.ID(clActive), catalogue.StatusRetired); err != nil {
		t.Fatalf("retire existing design: %v", err)
	}
	if err := repo.SetDesignStatus(context.Background(), clScope(), common.ID(clRetired), catalogue.StatusActive); err != nil {
		t.Fatalf("restore after freeing active slot: %v", err)
	}
}
