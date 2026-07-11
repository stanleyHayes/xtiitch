package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	sfDirReadyBiz     = "12121212-aaaa-4aaa-8aaa-000000000001"
	sfDirSuspendedBiz = "12121212-aaaa-4aaa-8aaa-000000000002"
	sfDirDesign       = "12121212-aaaa-4aaa-8aaa-000000000003"
	sfDirUnreadyBiz   = "12121212-aaaa-4aaa-8aaa-000000000004"
)

func seedStorefrontDirectoryFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupStorefrontDirectoryFixtures(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		// Ready: active WITH a provisioned subaccount → listed (P0.5 gate).
		// Unready: active but NO subaccount → NOT listed. Suspended: excluded
		// regardless of subaccount.
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status, settlement_provider_subaccount)
			values
				($1, $4, 'IT Ready Discovery', 'it-ready-discovery', 'verified', 'active', 'ACCT_ready'),
				($2, $4, 'IT Suspended Discovery', 'it-suspended-discovery', 'verified', 'suspended', 'ACCT_suspended'),
				($3, $4, 'IT Unready Discovery', 'it-unready-discovery', 'pending', 'active', '')
		`, sfDirReadyBiz, sfDirSuspendedBiz, sfDirUnreadyBiz, planID)
		mustExec(t, tx, `
			insert into store_settings (business_id, brand_color)
			values
				($1, '#123456'),
				($2, '#654321'),
				($3, '#abcdef')
		`, sfDirReadyBiz, sfDirSuspendedBiz, sfDirUnreadyBiz)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status, images)
			values ($1, $2, 'IT Directory Piece', 'it-directory-piece', 'active', $3)
		`, sfDirDesign, sfDirReadyBiz, []string{"https://example.test/directory-piece.webp"})
	})
}

func cleanupStorefrontDirectoryFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{sfDirReadyBiz, sfDirSuspendedBiz, sfDirUnreadyBiz})
	})
}

func TestListPublicShopsListsPaymentReadyStoresOnly(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedStorefrontDirectoryFixtures(t, pool)
	defer cleanupStorefrontDirectoryFixtures(t, pool)

	shops, err := NewStorefrontRepository(pool).ListPublicShops(context.Background())
	if err != nil {
		t.Fatalf("list public shops: %v", err)
	}

	var readyFound, suspendedFound, unreadyFound bool
	for _, shop := range shops {
		switch shop.Handle {
		case "it-ready-discovery":
			readyFound = true
			if shop.DesignCount != 1 {
				t.Fatalf("ready shop design count = %d, want 1", shop.DesignCount)
			}
			if len(shop.Designs) != 1 || shop.Designs[0].Handle != "it-directory-piece" {
				t.Fatalf("ready shop samples = %#v, want directory piece", shop.Designs)
			}
		case "it-suspended-discovery":
			suspendedFound = true
		case "it-unready-discovery":
			unreadyFound = true
		}
	}

	if !readyFound {
		t.Fatal("payment-ready active store was not listed in the marketplace")
	}
	if suspendedFound {
		t.Fatal("suspended store was listed in the marketplace")
	}
	if unreadyFound {
		t.Fatal("active store without a payout subaccount must not be listed (P0.5 gate)")
	}
}
