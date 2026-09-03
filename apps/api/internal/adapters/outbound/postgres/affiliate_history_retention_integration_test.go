package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestAffiliateHistoryForeignKeysPreventCascadingDeletion(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()

	tables := []string{
		"affiliate_clicks",
		"affiliate_conversions",
		"affiliate_attribution_reservations",
		"affiliate_payout_batches",
		"affiliate_signups",
		"affiliate_plan_attribution_reservations",
		"affiliate_risk_events",
		"affiliate_portal_audit_events",
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		for _, table := range tables {
			var deleteRule string
			err := tx.QueryRow(context.Background(), `
				select rc.delete_rule
				from information_schema.referential_constraints rc
				join information_schema.table_constraints tc
					on tc.constraint_schema = rc.constraint_schema
					and tc.constraint_name = rc.constraint_name
				where tc.table_schema = 'public'
					and tc.table_name = $1
					and tc.constraint_name = $1 || '_affiliate_id_fkey'
			`, table).Scan(&deleteRule)
			if err != nil {
				t.Fatalf("read %s Affiliate foreign key: %v", table, err)
			}
			if deleteRule != "RESTRICT" {
				t.Fatalf("%s deletes Affiliate history with rule %s", table, deleteRule)
			}
		}
	})
}
