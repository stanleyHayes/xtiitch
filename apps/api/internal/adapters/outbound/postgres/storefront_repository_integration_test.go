package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	sfDirActiveBiz    = "12121212-aaaa-4aaa-8aaa-000000000001"
	sfDirSuspendedBiz = "12121212-aaaa-4aaa-8aaa-000000000002"
	sfDirDesign       = "12121212-aaaa-4aaa-8aaa-000000000003"
)

func seedStorefrontDirectoryFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupStorefrontDirectoryFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values
				($1, $3, 'IT Fresh Discovery', 'it-fresh-discovery', 'pending', 'active'),
				($2, $3, 'IT Suspended Discovery', 'it-suspended-discovery', 'pending', 'suspended')
		`, sfDirActiveBiz, sfDirSuspendedBiz, planID)
		mustExec(t, tx, `
			insert into store_settings (business_id, brand_color)
			values
				($1, '#123456'),
				($2, '#654321')
		`, sfDirActiveBiz, sfDirSuspendedBiz)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status, images)
			values ($1, $2, 'IT Directory Piece', 'it-directory-piece', 'active', $3)
		`, sfDirDesign, sfDirActiveBiz, []string{"https://example.test/directory-piece.webp"})
	})
}

func cleanupStorefrontDirectoryFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{sfDirActiveBiz, sfDirSuspendedBiz})
	})
}

func TestListPublicShopsIncludesFreshActiveStores(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedStorefrontDirectoryFixtures(t, pool)
	defer cleanupStorefrontDirectoryFixtures(t, pool)

	shops, err := NewStorefrontRepository(pool).ListPublicShops(context.Background())
	if err != nil {
		t.Fatalf("list public shops: %v", err)
	}

	var freshFound, suspendedFound bool
	for _, shop := range shops {
		switch shop.Handle {
		case "it-fresh-discovery":
			freshFound = true
			if shop.DesignCount != 1 {
				t.Fatalf("fresh shop design count = %d, want 1", shop.DesignCount)
			}
			if len(shop.Designs) != 1 || shop.Designs[0].Handle != "it-directory-piece" {
				t.Fatalf("fresh shop samples = %#v, want directory piece", shop.Designs)
			}
		case "it-suspended-discovery":
			suspendedFound = true
		}
	}

	if !freshFound {
		t.Fatal("fresh active store was not listed in public discovery")
	}
	if suspendedFound {
		t.Fatal("suspended store was listed in public discovery")
	}
}
