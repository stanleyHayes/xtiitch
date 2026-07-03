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

	clSeqBiz         = "11111111-7777-7777-7777-000000000101"
	clSeqCollection1 = "11111111-7777-7777-7777-000000000102"
	clSeqCollection2 = "11111111-7777-7777-7777-000000000103"
	clSeqCollection3 = "11111111-7777-7777-7777-000000000104"
	clSeqSizeBand1   = "11111111-7777-7777-7777-000000000105"
	clSeqSizeBand2   = "11111111-7777-7777-7777-000000000106"
	clSeqSizeBand3   = "11111111-7777-7777-7777-000000000107"
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

func clSeqScope() common.TenantScope {
	return common.TenantScope{BusinessID: common.ID(clSeqBiz)}
}

func seedCatalogueSequenceFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupCatalogueSequenceFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Sequence Guard', 'it-sequence-guard', 'verified')
		`, clSeqBiz, planID)
	})
}

func cleanupCatalogueSequenceFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, clSeqBiz)
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

func TestCollectionSequenceConflictIsRejected(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCatalogueSequenceFixtures(t, pool)
	defer cleanupCatalogueSequenceFixtures(t, pool)

	repo := NewCatalogueRepository(pool)
	ctx := context.Background()
	scope := clSeqScope()
	if err := repo.CreateCollection(ctx, scope, ports.CollectionInput{
		CollectionID: common.ID(clSeqCollection1),
		BusinessID:   common.ID(clSeqBiz),
		Name:         "First",
		Theme:        "Occasion",
		Handle:       "first-sequence",
		Sequence:     1,
	}); err != nil {
		t.Fatalf("create first collection: %v", err)
	}
	if err := repo.CreateCollection(ctx, scope, ports.CollectionInput{
		CollectionID: common.ID(clSeqCollection2),
		BusinessID:   common.ID(clSeqBiz),
		Name:         "Second",
		Theme:        "Everyday",
		Handle:       "second-sequence",
		Sequence:     2,
	}); err != nil {
		t.Fatalf("create second collection: %v", err)
	}
	if err := repo.CreateCollection(ctx, scope, ports.CollectionInput{
		CollectionID: common.ID(clSeqCollection3),
		BusinessID:   common.ID(clSeqBiz),
		Name:         "Duplicate",
		Theme:        "Event",
		Handle:       "duplicate-sequence",
		Sequence:     2,
	}); !errors.Is(err, ports.ErrSequenceTaken) {
		t.Fatalf("expected duplicate collection sequence to be rejected, got %v", err)
	}
	if err := repo.UpdateCollection(ctx, scope, ports.CollectionUpdateInput{
		CollectionID: common.ID(clSeqCollection2),
		BusinessID:   common.ID(clSeqBiz),
		Name:         "Second moved",
		Theme:        "Everyday",
		Sequence:     1,
	}); !errors.Is(err, ports.ErrSequenceTaken) {
		t.Fatalf("expected duplicate collection sequence on update to be rejected, got %v", err)
	}
}

func TestSizeBandSequenceConflictIsRejected(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCatalogueSequenceFixtures(t, pool)
	defer cleanupCatalogueSequenceFixtures(t, pool)

	repo := NewCatalogueRepository(pool)
	ctx := context.Background()
	scope := clSeqScope()
	if err := repo.CreateSizeBand(ctx, scope, ports.SizeBandInput{
		SizeBandID: common.ID(clSeqSizeBand1),
		BusinessID: common.ID(clSeqBiz),
		Label:      "Regular",
		Sequence:   1,
	}); err != nil {
		t.Fatalf("create first size band: %v", err)
	}
	if err := repo.CreateSizeBand(ctx, scope, ports.SizeBandInput{
		SizeBandID: common.ID(clSeqSizeBand2),
		BusinessID: common.ID(clSeqBiz),
		Label:      "Tall",
		Sequence:   2,
	}); err != nil {
		t.Fatalf("create second size band: %v", err)
	}
	if err := repo.CreateSizeBand(ctx, scope, ports.SizeBandInput{
		SizeBandID: common.ID(clSeqSizeBand3),
		BusinessID: common.ID(clSeqBiz),
		Label:      "Duplicate",
		Sequence:   2,
	}); !errors.Is(err, ports.ErrSequenceTaken) {
		t.Fatalf("expected duplicate size-band sequence to be rejected, got %v", err)
	}
	if err := repo.UpdateSizeBand(ctx, scope, ports.SizeBandUpdateInput{
		SizeBandID: common.ID(clSeqSizeBand2),
		BusinessID: common.ID(clSeqBiz),
		Label:      "Tall moved",
		Sequence:   1,
	}); !errors.Is(err, ports.ErrSequenceTaken) {
		t.Fatalf("expected duplicate size-band sequence on update to be rejected, got %v", err)
	}
}
