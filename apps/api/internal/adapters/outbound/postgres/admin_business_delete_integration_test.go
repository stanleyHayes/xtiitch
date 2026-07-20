package postgres

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itDeleteBiz        = "12121212-2222-2222-2222-222222222201"
	itDeletePlanProbe  = "select plan_id from plans where code = 'starter' limit 1"
	itDeleteCustomer   = "12121212-2222-2222-2222-222222222202"
	itDeleteDesign     = "12121212-2222-2222-2222-222222222203"
	itDeleteOrder      = "12121212-2222-2222-2222-222222222204"
	itDeletePayment    = "12121212-2222-2222-2222-222222222205"
	itDeleteCollection = "12121212-2222-2222-2222-222222222206"
	itDeleteSizeBand   = "12121212-2222-2222-2222-222222222207"
	itDeleteStage      = "12121212-2222-2222-2222-222222222208"
	itDeleteBooking    = "12121212-2222-2222-2222-222222222209"
	itDeleteTaking     = "12121212-2222-2222-2222-222222222210"
	itDeletePromotion  = "12121212-2222-2222-2222-222222222211"
	itDeleteProgramme  = "12121212-2222-2222-2222-222222222212"
	itDeleteRefCode    = "12121212-2222-2222-2222-222222222213"
	itDeleteReferral   = "12121212-2222-2222-2222-222222222214"
	itDeleteAuditEvent = "12121212-2222-2222-2222-222222222215"
	itDeleteAdminUser  = "12121212-2222-2222-2222-222222222216"
)

// itDeleteTenantTables is the representative set of child tables the fixture
// seeds — one per branch of the delete order (§11.2). After the delete every
// one of them must hold no row for the business.
var itDeleteTenantTables = []string{
	"business_users", "store_settings", "delivery_zones", "collections",
	"size_bands", "designs", "design_variations", "design_prices",
	"design_waitlist_entries", "stage_templates", "orders", "stage_events",
	"order_measurements", "bookings", "handovers", "payments", "manual_takings",
	"paystack_settlements", "promotions", "promotion_redemptions",
	"business_subscriptions", "business_subscription_events",
	"business_subscription_invoices", "business_identity_documents",
	"customer_businesses", "business_addons", "outbound_messages",
	"referral_codes", "referrals", "referral_rewards",
}

func TestDeleteAdminBusinessRemovesTenantData(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeleteFixture(t, pool)
	defer cleanupDeleteFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	record, err := repo.DeleteAdminBusiness(ctx, ports.DeleteAdminBusinessInput{
		BusinessID:       common.ID(itDeleteBiz),
		ConfirmationName: "IT Delete Shop",
	})
	if err != nil {
		t.Fatalf("delete admin business: %v", err)
	}
	if record.BusinessID != common.ID(itDeleteBiz) ||
		record.Name != "IT Delete Shop" ||
		record.Handle != "it-delete-shop" ||
		record.TotalRowsDeleted == 0 {
		t.Fatalf("unexpected delete record: %+v", record)
	}

	// Every seeded tenant table is empty for the business. Reads run inside the
	// bypass: the businesses RLS policy would otherwise mask rows and report a
	// hollow 0 either way.
	inBypass(t, pool, func(tx pgx.Tx) {
		for _, table := range itDeleteTenantTables {
			var count int
			err := tx.QueryRow(ctx,
				fmt.Sprintf("select count(*) from %s where business_id = $1", table),
				itDeleteBiz,
			).Scan(&count)
			if err != nil {
				t.Fatalf("count %s: %v", table, err)
			}
			if count != 0 {
				t.Fatalf("expected %s to be empty after the delete, found %d row(s)", table, count)
			}
		}

		// The tenant root row itself is gone.
		var bizCount int
		if err := tx.QueryRow(ctx, `select count(*) from businesses where business_id = $1`, itDeleteBiz).Scan(&bizCount); err != nil {
			t.Fatalf("count businesses: %v", err)
		}
		if bizCount != 0 {
			t.Fatal("the business row itself must be deleted")
		}

		// Customers are GLOBAL: the identity survives even though the store is gone.
		var customerCount int
		if err := tx.QueryRow(ctx, `select count(*) from customers where customer_id = $1`, itDeleteCustomer).Scan(&customerCount); err != nil {
			t.Fatalf("count customers: %v", err)
		}
		if customerCount != 1 {
			t.Fatal("the global customer identity must survive a business delete")
		}
	})

	// The platform audit trail keeps its rows: the pre-delete admin action that
	// targeted this business is retained (no FK to businesses).
	var auditCount int
	if err := pool.QueryRow(ctx, `select count(*) from admin_audit_events where audit_event_id = $1`, itDeleteAuditEvent).Scan(&auditCount); err != nil {
		t.Fatalf("count audit events: %v", err)
	}
	if auditCount != 1 {
		t.Fatal("admin audit events are platform records and must be retained")
	}

	// A second delete reports not-found (idempotent-safe retry).
	_, err = repo.DeleteAdminBusiness(ctx, ports.DeleteAdminBusinessInput{
		BusinessID:       common.ID(itDeleteBiz),
		ConfirmationName: "IT Delete Shop",
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected not found deleting twice, got %v", err)
	}
}

func TestDeleteAdminBusinessConfirmationGuard(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedDeleteFixture(t, pool)
	defer cleanupDeleteFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	// A wrong confirmation refuses BEFORE anything is deleted.
	_, err := repo.DeleteAdminBusiness(ctx, ports.DeleteAdminBusinessInput{
		BusinessID:       common.ID(itDeleteBiz),
		ConfirmationName: "Some Other Shop",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid input on a confirmation mismatch, got %v", err)
	}
	inBypass(t, pool, func(tx pgx.Tx) {
		var bizCount int
		if err := tx.QueryRow(ctx, `select count(*) from businesses where business_id = $1`, itDeleteBiz).Scan(&bizCount); err != nil {
			t.Fatalf("count businesses: %v", err)
		}
		if bizCount != 1 {
			t.Fatal("a refused confirmation must leave the business untouched")
		}
	})

	// Unknown id reports not-found regardless of the confirmation.
	_, err = repo.DeleteAdminBusiness(ctx, ports.DeleteAdminBusinessInput{
		BusinessID:       common.ID("12121212-2222-2222-2222-222222229999"),
		ConfirmationName: "IT Delete Shop",
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected not found for an unknown business, got %v", err)
	}

	// The comparison is trimmed and case-insensitive — the operator confirms with
	// the name as displayed, not with byte-exact casing.
	record, err := repo.DeleteAdminBusiness(ctx, ports.DeleteAdminBusinessInput{
		BusinessID:       common.ID(itDeleteBiz),
		ConfirmationName: "  it DELETE shop  ",
	})
	if err != nil {
		t.Fatalf("expected a case-insensitive trimmed confirmation to pass, got %v", err)
	}
	if record.BusinessID != common.ID(itDeleteBiz) {
		t.Fatalf("unexpected delete record: %+v", record)
	}
}

//nolint:funlen // fixture: one insert per seeded child table, in FK order
func seedDeleteFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupDeleteFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itDeletePlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe starter plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values ($1, $2, 'IT Delete Shop', 'it-delete-shop', 'verified', 'active')
		`, itDeleteBiz, planID)
		mustExec(t, tx, `
			insert into business_users (business_id, email, display_name, password_hash, role)
			values ($1, 'it-delete-owner@xtiitch.test', 'IT Owner', 'hash', 'owner')
		`, itDeleteBiz)
		mustExec(t, tx, `insert into store_settings (business_id) values ($1)`, itDeleteBiz)
		mustExec(t, tx, `
			insert into delivery_zones (zone_id, business_id, name, fee_minor)
			values ($1, $2, 'Accra', 1500)
		`, "12121212-2222-2222-2222-222222222217", itDeleteBiz)
		mustExec(t, tx, `
			insert into collections (collection_id, business_id, name, handle)
			values ($1, $2, 'IT Collection', 'it-collection')
		`, itDeleteCollection, itDeleteBiz)
		mustExec(t, tx, `
			insert into size_bands (size_band_id, business_id, label)
			values ($1, $2, 'M')
		`, itDeleteSizeBand, itDeleteBiz)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, collection_id, title, handle, status)
			values ($1, $2, $3, 'Delete Design', 'delete-design', 'active')
		`, itDeleteDesign, itDeleteBiz, itDeleteCollection)
		mustExec(t, tx, `
			insert into design_variations (variation_id, design_id, business_id, name, is_default)
			values ($1, $2, $3, 'Wine', true)
		`, "12121212-2222-2222-2222-222222222218", itDeleteDesign, itDeleteBiz)
		mustExec(t, tx, `
			insert into design_prices (design_id, size_band_id, business_id, price_minor)
			values ($1, $2, $3, 25000)
		`, itDeleteDesign, itDeleteSizeBand, itDeleteBiz)
		mustExec(t, tx, `
			insert into design_waitlist_entries (business_id, design_id, customer_name, customer_contact)
			values ($1, $2, 'IT Waiter', '0500000000')
		`, itDeleteBiz, itDeleteDesign)
		mustExec(t, tx, `
			insert into stage_templates (stage_id, business_id, name, colour, flow, sequence)
			values ($1, $2, 'Sewing', 'yellow', 'ready_made', 1)
		`, itDeleteStage, itDeleteBiz)
		mustExec(t, tx, `
			insert into customers (customer_id, display_name)
			values ($1, 'IT Delete Customer')
		`, itDeleteCustomer)
		mustExec(t, tx, `
			insert into customer_businesses (business_id, customer_id)
			values ($1, $2)
		`, itDeleteBiz, itDeleteCustomer)
		mustExec(t, tx, `
			insert into orders (
				order_id, business_id, customer_id, design_id,
				order_type, size_mode, flow, channel, agreed_total_minor, status
			)
			values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 25000, 'confirmed')
		`, itDeleteOrder, itDeleteBiz, itDeleteCustomer, itDeleteDesign)
		mustExec(t, tx, `
			insert into stage_events (event_id, business_id, order_id, stage_id)
			values ($1, $2, $3, $4)
		`, "12121212-2222-2222-2222-222222222219", itDeleteBiz, itDeleteOrder, itDeleteStage)
		mustExec(t, tx, `
			insert into order_measurements (measurement_id, business_id, order_id, customer_id, source)
			values ($1, $2, $3, $4, 'shop')
		`, "12121212-2222-2222-2222-222222222220", itDeleteBiz, itDeleteOrder, itDeleteCustomer)
		// Handover rows ride a NO ACTION composite FK on (order_id, business_id);
		// seeding one here keeps the fulfilled-order delete path honest.
		mustExec(t, tx, `
			insert into handovers (handover_id, business_id, order_id, method)
			values ($1, $2, $3, 'pickup')
		`, "12121212-2222-2222-2222-222222222221", itDeleteBiz, itDeleteOrder)
		mustExec(t, tx, `
			insert into bookings (booking_id, business_id, customer_id, order_id, slot_start, slot_end)
			values ($1, $2, $3, $4, now(), now() + interval '1 hour')
		`, itDeleteBooking, itDeleteBiz, itDeleteCustomer, itDeleteOrder)
		mustExec(t, tx, `
			insert into payments (payment_id, business_id, order_id, purpose, amount_minor, method, provider_reference, status)
			values ($1, $2, $3, 'standard_full', 25000, 'momo', 'it_delete_payment_ref', 'succeeded')
		`, itDeletePayment, itDeleteBiz, itDeleteOrder)
		mustExec(t, tx, `
			insert into manual_takings (taking_id, business_id, amount_minor, method)
			values ($1, $2, 8000, 'cash')
		`, itDeleteTaking, itDeleteBiz)
		mustExec(t, tx, `
			insert into paystack_settlements (business_id, provider_reference, amount_minor, status)
			values ($1, 'it_delete_settlement_ref', 23000, 'settled')
		`, itDeleteBiz)
		mustExec(t, tx, `
			insert into promotions (promotion_id, business_id, code, title, discount_type, discount_value, status)
			values ($1, $2, 'ITDEL10', 'IT Delete Promo', 'fixed', 1000, 'active')
		`, itDeletePromotion, itDeleteBiz)
		mustExec(t, tx, `
			insert into promotion_redemptions (promotion_redemption_id, promotion_id, business_id, order_id, discount_minor)
			values ($1, $2, $3, $4, 1000)
		`, "12121212-2222-2222-2222-222222222221", itDeletePromotion, itDeleteBiz, itDeleteOrder)
		mustExec(t, tx, `
			insert into business_subscriptions (subscription_id, business_id, plan_id, status)
			values ($1, $2, $3, 'active')
		`, "12121212-2222-2222-2222-222222222222", itDeleteBiz, planID)
		mustExec(t, tx, `
			insert into business_subscription_events (business_id, subscription_id, event_type, summary)
			values ($1, $2, 'activated', 'Subscription activated.')
		`, itDeleteBiz, "12121212-2222-2222-2222-222222222222")
		mustExec(t, tx, `
			insert into business_subscription_invoices (
				subscription_id, business_id, plan_id, invoice_ref, billing_mode,
				amount_minor, period_start, period_end, due_at
			)
			values ($1, $2, $3, 'IT-DEL-INV-1', 'manual', 14700, now(), now() + interval '90 days', now())
		`, "12121212-2222-2222-2222-222222222222", itDeleteBiz, planID)
		mustExec(t, tx, `
			insert into business_identity_documents (business_id, card_number, id_photo_url, full_legal_name)
			values ($1, 'GHA-000-1', 'https://cdn.example.com/card.jpg', 'It Deleter')
		`, itDeleteBiz)
		mustExec(t, tx, `
			insert into business_addons (business_id, addon) values ($1, 'ai_assistant')
		`, itDeleteBiz)
		mustExec(t, tx, `
			insert into outbound_messages (message_id, business_id, channel, kind, dedup_key)
			values ($1, $2, 'whatsapp', 'receipt', 'it-delete-dedup')
		`, "12121212-2222-2222-2222-222222222223", itDeleteBiz)
		mustExec(t, tx, `
			insert into referral_programmes (
				referral_programme_id, title, code_prefix, audience,
				referrer_reward_kind, referee_reward_kind, reward_type, reward_value,
				qualifying_order_min_minor, reward_hold_days, status
			)
			values ($1, 'IT Delete Referral', 'ITDELREF', 'customers', 'voucher', 'voucher', 'fixed', 500, 1000, 0, 'active')
		`, itDeleteProgramme)
		mustExec(t, tx, `
			insert into referral_codes (referral_code_id, referral_programme_id, business_id, owner_type, owner_business_id, code, status)
			values ($1, $2, $3, 'business', $3, 'ITDELREFAMA', 'active')
		`, itDeleteRefCode, itDeleteProgramme, itDeleteBiz)
		mustExec(t, tx, `
			insert into referrals (
				referral_id, referral_programme_id, referral_code_id, business_id,
				order_id, referee_customer_id, gross_minor, status, qualified_at
			)
			values ($1, $2, $3, $4, $5, $6, 25000, 'qualified', now())
		`, itDeleteReferral, itDeleteProgramme, itDeleteRefCode, itDeleteBiz, itDeleteOrder, itDeleteCustomer)
		mustExec(t, tx, `
			insert into referral_rewards (
				referral_reward_id, referral_id, business_id, beneficiary_type,
				beneficiary_customer_id, reward_kind, status, issued_at
			)
			values ($1, $2, $3, 'referee', $4, 'voucher', 'issued', now())
		`, "12121212-2222-2222-2222-222222222224", itDeleteReferral, itDeleteBiz, itDeleteCustomer)
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-delete-admin@xtiitch.test', 'IT Delete Admin', 'hash', 'operator', true)
		`, itDeleteAdminUser)
		mustExec(t, tx, `
			insert into admin_audit_events (
				audit_event_id, actor_admin_user_id, actor_email, actor_role,
				action, target_type, target_id, target_label, summary, severity
			)
			values ($1, $2, 'it-delete-admin@xtiitch.test', 'operator',
				'Suspended business', 'business', $3, 'IT Delete Shop', 'Operator suspended tenant activity.', 'critical')
		`, itDeleteAuditEvent, itDeleteAdminUser, itDeleteBiz)
	})
}

func cleanupDeleteFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		// The business delete cascades to every tenant table, so removing the root
		// (and the platform-owned rows) is enough whether or not the test ran.
		mustExec(t, tx, `delete from businesses where business_id = $1`, itDeleteBiz)
		mustExec(t, tx, `delete from referral_programmes where referral_programme_id = $1`, itDeleteProgramme)
		mustExec(t, tx, `delete from customers where customer_id = $1`, itDeleteCustomer)
		mustExec(t, tx, `delete from admin_audit_events where audit_event_id = $1`, itDeleteAuditEvent)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itDeleteAdminUser)
	})
}
