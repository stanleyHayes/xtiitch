package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itActivityBiz       = "56565656-2222-2222-2222-222222222201"
	itActivityBizEmpty  = "56565656-2222-2222-2222-222222222202"
	itActivityCustomer  = "56565656-2222-2222-2222-222222222203"
	itActivityDesign    = "56565656-2222-2222-2222-222222222204"
	itActivityAdminUser = "56565656-2222-2222-2222-222222222205"
	itActivityStage     = "56565656-2222-2222-2222-222222222206"
)

// §11.3: the unified feed mixes every event source, newest first.
func TestListAdminBusinessActivityAssemblesFeed(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedActivityFixture(t, pool)
	defer cleanupActivityFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	records, err := repo.ListAdminBusinessActivity(ctx, ports.ListAdminBusinessActivityInput{
		BusinessID: common.ID(itActivityBiz),
		Limit:      50,
	})
	if err != nil {
		t.Fatalf("list business activity: %v", err)
	}

	wantTypes := []string{
		"manual_taking_recorded", // 10 minutes ago
		"admin_action",           // 20
		"payout_recorded",        // 30
		"invoice_paid",           // 45 (billing, raw event_type)
		"order_stage_entered",    // 1 hour
		"payment_confirmed",      // 90 minutes
		"order_created",          // 2 hours
		"order_created",          // 3 hours
		"verification_submitted", // 4 hours ago
	}
	if len(records) != len(wantTypes) {
		t.Fatalf("expected %d feed rows, got %d: %+v", len(wantTypes), len(records), records)
	}
	for i, want := range wantTypes {
		if records[i].EventType != want {
			t.Fatalf("row %d: expected event_type %q, got %q (full feed: %+v)", i, want, records[i].EventType, records)
		}
	}
	// Newest-first, strictly.
	for i := 1; i < len(records); i++ {
		if records[i-1].OccurredAt.Before(records[i].OccurredAt) {
			t.Fatalf("feed is not newest-first at row %d: %+v", i, records)
		}
	}

	byType := map[string]ports.AdminBusinessActivityRecord{}
	for _, record := range records {
		if _, seen := byType[record.EventType]; !seen {
			byType[record.EventType] = record
		}
	}
	if got := byType["payment_confirmed"]; got.AmountMinor == nil || *got.AmountMinor != 12000 || got.Actor != "customer" {
		t.Fatalf("unexpected payment row: %+v", got)
	}
	if got := byType["invoice_paid"]; got.AmountMinor != nil || got.Actor != "system" || got.Category != "billing" {
		t.Fatalf("unexpected billing row: %+v", got)
	}
	if got := byType["payout_recorded"]; got.AmountMinor == nil || *got.AmountMinor != 9000 || got.Actor != "system" {
		t.Fatalf("unexpected payout row: %+v", got)
	}
	if got := byType["admin_action"]; got.Actor != "admin" || got.Category != "admin" {
		t.Fatalf("unexpected admin row: %+v", got)
	}
	if got := byType["verification_submitted"]; got.Actor != "owner" {
		t.Fatalf("unexpected verification row: %+v", got)
	}
	if got := byType["manual_taking_recorded"]; got.AmountMinor == nil || *got.AmountMinor != 5000 {
		t.Fatalf("unexpected taking row: %+v", got)
	}
}

func TestListAdminBusinessActivityFiltersAndPages(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedActivityFixture(t, pool)
	defer cleanupActivityFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	// The orders arm: both placements plus the stage entry; nothing else.
	orders, err := repo.ListAdminBusinessActivity(ctx, ports.ListAdminBusinessActivityInput{
		BusinessID: common.ID(itActivityBiz),
		Category:   "orders",
		Limit:      50,
	})
	if err != nil {
		t.Fatalf("filter orders: %v", err)
	}
	if len(orders) != 3 {
		t.Fatalf("expected 3 order rows, got %d: %+v", len(orders), orders)
	}
	for _, record := range orders {
		if record.Category != "orders" {
			t.Fatalf("a filtered feed must only carry its category, got %+v", record)
		}
	}

	// The payments arm: the confirmed charge only — the failed one is excluded.
	payments, err := repo.ListAdminBusinessActivity(ctx, ports.ListAdminBusinessActivityInput{
		BusinessID: common.ID(itActivityBiz),
		Category:   "payments",
		Limit:      50,
	})
	if err != nil {
		t.Fatalf("filter payments: %v", err)
	}
	if len(payments) != 1 || payments[0].EventType != "payment_confirmed" {
		t.Fatalf("expected only the confirmed payment, got %+v", payments)
	}

	// Paging: three pages of 4/4/1, disjoint, reassembling the whole feed.
	seen := map[string]int{}
	total := 0
	for offset := 0; offset < 9; offset += 4 {
		page, err := repo.ListAdminBusinessActivity(ctx, ports.ListAdminBusinessActivityInput{
			BusinessID: common.ID(itActivityBiz),
			Limit:      4,
			Offset:     offset,
		})
		if err != nil {
			t.Fatalf("page at offset %d: %v", offset, err)
		}
		for _, record := range page {
			seen[record.EventType+record.RefID]++
			total++
		}
	}
	if total != 9 {
		t.Fatalf("expected 9 rows across pages, got %d", total)
	}
	for key, count := range seen {
		if count != 1 {
			t.Fatalf("row %s appeared %d times across pages", key, count)
		}
	}
}

func TestListAdminBusinessActivityEmptyAndUnknownBusiness(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedActivityFixture(t, pool)
	defer cleanupActivityFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	records, err := repo.ListAdminBusinessActivity(ctx, ports.ListAdminBusinessActivityInput{
		BusinessID: common.ID(itActivityBizEmpty),
		Limit:      50,
	})
	if err != nil {
		t.Fatalf("an empty business must still return a feed, got %v", err)
	}
	if len(records) != 0 {
		t.Fatalf("expected an empty feed, got %+v", records)
	}

	_, err = repo.ListAdminBusinessActivity(ctx, ports.ListAdminBusinessActivityInput{
		BusinessID: common.ID("56565656-2222-2222-2222-222222229999"),
		Limit:      50,
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected not found for an unknown business, got %v", err)
	}
}

//nolint:funlen // fixture: one event per feed arm with explicit, ordered timestamps
func seedActivityFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupActivityFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe starter plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values
				($1, $3, 'IT Activity Shop', 'it-activity-shop', 'verified', 'active'),
				($2, $3, 'IT Quiet Shop', 'it-quiet-shop', 'verified', 'active')
		`, itActivityBiz, itActivityBizEmpty, planID)
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-activity-admin@xtiitch.test', 'IT Activity Admin', 'hash', 'operator', true)
		`, itActivityAdminUser)
		mustExec(t, tx, `
			insert into customers (customer_id, display_name)
			values ($1, 'IT Activity Customer')
		`, itActivityCustomer)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'Activity Design', 'activity-design', 'active')
		`, itActivityDesign, itActivityBiz)
		mustExec(t, tx, `
			insert into stage_templates (stage_id, business_id, name, colour, flow, sequence)
			values ($1, $2, 'Sewing', 'yellow', 'ready_made', 1)
		`, itActivityStage, itActivityBiz)
		// 4 hours ago: identity documents submitted.
		mustExec(t, tx, `
			insert into business_identity_documents (business_id, card_number, id_photo_url, full_legal_name, submitted_at)
			values ($1, 'GHA-000-2', 'https://cdn.example.com/card.jpg', 'Ama Mensah', now() - interval '4 hours')
		`, itActivityBiz)
		// 3 and 2 hours ago: two orders.
		mustExec(t, tx, `
			insert into orders (
				order_id, business_id, customer_id, design_id,
				order_type, size_mode, flow, channel, agreed_total_minor, status, created_at
			)
			values
				($1, $3, $4, $5, 'standard', 'band', 'ready_made', 'online', 12000, 'confirmed', now() - interval '3 hours'),
				($2, $3, $4, $5, 'custom', 'self_measure', 'bespoke', 'walk_in', 30000, 'draft', now() - interval '2 hours')
		`, "56565656-2222-2222-2222-222222222210", "56565656-2222-2222-2222-222222222211",
			itActivityBiz, itActivityCustomer, itActivityDesign)
		// 1 hour ago: the first order moved to Sewing.
		mustExec(t, tx, `
			insert into stage_events (event_id, business_id, order_id, stage_id, entered_at)
			values ($1, $2, $3, $4, now() - interval '1 hour')
		`, "56565656-2222-2222-2222-222222222212", itActivityBiz, "56565656-2222-2222-2222-222222222210", itActivityStage)
		// 90 minutes ago: a charge confirmed; 80 minutes ago a failed one (excluded).
		mustExec(t, tx, `
			insert into payments (
				payment_id, business_id, order_id, purpose, amount_minor, method,
				provider_reference, status, created_at, updated_at
			)
			values
				($1, $3, $4, 'standard_full', 12000, 'card', 'it_activity_pay_ok', 'succeeded',
					now() - interval '95 minutes', now() - interval '90 minutes'),
				($2, $3, $4, 'standard_full', 12000, 'card', 'it_activity_pay_fail', 'failed',
					now() - interval '85 minutes', now() - interval '80 minutes')
		`, "56565656-2222-2222-2222-222222222213", "56565656-2222-2222-2222-222222222214",
			itActivityBiz, "56565656-2222-2222-2222-222222222210")
		// 45 minutes ago: a billing event.
		mustExec(t, tx, `
			insert into business_subscription_events (business_id, event_type, summary, created_at)
			values ($1, 'invoice_paid', 'Subscription invoice paid.', now() - interval '45 minutes')
		`, itActivityBiz)
		// 30 minutes ago: a payout settled.
		mustExec(t, tx, `
			insert into paystack_settlements (business_id, provider_reference, subaccount_code, amount_minor, status, settled_at)
			values ($1, 'it_activity_settle', 'SUB_it', 9000, 'settled', now() - interval '30 minutes')
		`, itActivityBiz)
		// 20 minutes ago: an admin suspended the store.
		mustExec(t, tx, `
			insert into admin_audit_events (
				audit_event_id, actor_admin_user_id, actor_email, actor_role,
				action, target_type, target_id, target_label, summary, severity, created_at
			)
			values ($1, $2, 'it-activity-admin@xtiitch.test', 'operator',
				'Suspended business', 'business', $3, 'IT Activity Shop',
				'Operator suspended tenant activity.', 'critical', now() - interval '20 minutes')
		`, "56565656-2222-2222-2222-222222222215", itActivityAdminUser, itActivityBiz)
		// 10 minutes ago: a manual taking.
		mustExec(t, tx, `
			insert into manual_takings (taking_id, business_id, amount_minor, method, what_for, taken_at)
			values ($1, $2, 5000, 'cash', 'deposit', now() - interval '10 minutes')
		`, "56565656-2222-2222-2222-222222222216", itActivityBiz)
	})
}

func cleanupActivityFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`,
			[]string{itActivityBiz, itActivityBizEmpty})
		mustExec(t, tx, `delete from customers where customer_id = $1`, itActivityCustomer)
		mustExec(t, tx, `delete from admin_audit_events where audit_event_id = $1`,
			"56565656-2222-2222-2222-222222222215")
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itActivityAdminUser)
	})
}
