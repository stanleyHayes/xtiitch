package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

// tenantDeleteOrder is every table holding tenant-owned rows for a business,
// ordered deepest-first so the NO ACTION / RESTRICT cross-references between
// tenant tables pass without relying on ON DELETE CASCADE (the cascades exist —
// enumerated from information_schema for §11.2 — so most statements are no-ops;
// the explicit order keeps the delete correct even if a cascade is ever lost):
//
//   - payments, handovers, order_measurements, bookings reference orders
//     (NO ACTION); stage_events references orders; affiliate/referral ledgers
//     reference orders composite keys — all before orders.
//   - orders references designs, size_bands, stage_templates (NO ACTION) and
//     delivery_zones — before those.
//   - design_* tables reference designs/size_bands — before designs/size_bands.
//   - subscription events/invoices/reminders/discount-redemptions reference
//     business_subscriptions — before business_subscriptions.
//   - referral_rewards before referrals; referrals before referral_codes
//     (RESTRICT); promotion_redemptions/referral_rewards before promotions.
//   - auth_sessions and business_user_mfa reference business_users — before
//     business_users.
//   - ad_campaign_payments/ad_events reference ad_campaigns — before ad_campaigns.
//
// NEVER in this list: customers (GLOBAL identities shared across stores — only
// the customer_businesses link rows are tenant-owned), plans, affiliates,
// referral_programmes, subscription_discount_codes, marketplace_charges (all
// platform-owned), admin_audit_events (platform audit trail; has no FK to
// businesses), admin_money_replay_requests (platform money-ops record; its
// payment_id goes SET NULL), and whatsapp_sessions (business_id goes SET NULL).
var tenantDeleteOrder = []struct {
	table  string
	column string
}{
	{"payments", "business_id"},
	// handovers sits behind a NO ACTION composite FK on (order_id, business_id) —
	// it must go before orders or any fulfilled order blocks the delete.
	{"handovers", "business_id"},
	{"order_measurements", "business_id"},
	{"bookings", "business_id"},
	{"stage_events", "business_id"},
	{"affiliate_attribution_reservations", "business_id"},
	{"affiliate_conversions", "business_id"},
	{"referral_rewards", "business_id"},
	{"referrals", "business_id"},
	{"promotion_redemptions", "business_id"},
	{"ad_campaign_payments", "advertiser_business_id"},
	{"ad_events", "advertiser_business_id"},
	{"orders", "business_id"},
	{"design_embeddings", "business_id"},
	{"design_prices", "business_id"},
	{"design_size_band_overrides", "business_id"},
	{"design_variations", "business_id"},
	{"design_waitlist_entries", "business_id"},
	{"designs", "business_id"},
	{"collections", "business_id"},
	{"size_bands", "business_id"},
	{"stage_templates", "business_id"},
	{"business_subscription_events", "business_id"},
	{"subscription_discount_redemptions", "business_id"},
	{"subscription_reminders", "business_id"},
	{"business_subscription_invoices", "business_id"},
	{"business_subscriptions", "business_id"},
	{"referral_codes", "business_id"},
	{"promotions", "business_id"},
	{"auth_sessions", "business_id"},
	{"business_user_mfa", "business_id"},
	{"business_users", "business_id"},
	{"ad_campaigns", "advertiser_business_id"},
	{"admin_risk_review_states", "business_id"},
	{"admin_settlement_review_holds", "business_id"},
	{"admin_support_ticket_states", "business_id"},
	{"availability_blackouts", "business_id"},
	{"availability_windows", "business_id"},
	{"business_addons", "business_id"},
	{"business_identity_documents", "business_id"},
	{"customer_businesses", "business_id"},
	{"delivery_zones", "business_id"},
	{"manual_takings", "business_id"},
	{"marketplace_charge_members", "business_id"},
	{"measurement_fields", "business_id"},
	{"outbound_messages", "business_id"},
	{"paystack_settlements", "business_id"},
	{"store_settings", "business_id"},
}

//nolint:funlen // the ordered delete list IS the feature; splitting it adds indirection
func (repo AdminAuthRepository) DeleteAdminBusiness(
	ctx context.Context,
	input ports.DeleteAdminBusinessInput,
) (ports.AdminBusinessDeleteRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminBusinessDeleteRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	// Cross-tenant: the delete spans every tenant table at once, and the tenant
	// root row itself is behind the businesses RLS policy.
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminBusinessDeleteRecord{}, err
	}

	// Lock the root row and capture the identity the audit trail needs after the
	// row is gone. FOR UPDATE serialises concurrent deletes/status changes.
	record := ports.AdminBusinessDeleteRecord{BusinessID: input.BusinessID}
	if err := tx.QueryRow(ctx, `
		select name, handle
		from businesses
		where business_id = $1
		for update
	`, input.BusinessID.String()).Scan(&record.Name, &record.Handle); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminBusinessDeleteRecord{}, ErrNotFound
		}
		return ports.AdminBusinessDeleteRecord{}, err
	}

	// Typed-confirmation guard (same pattern as customer erasure): the operator
	// must confirm with the business's exact current name, checked against the
	// locked row so a rename mid-request cannot smuggle a mismatch through.
	if !strings.EqualFold(strings.TrimSpace(input.ConfirmationName), record.Name) {
		return ports.AdminBusinessDeleteRecord{}, authdomain.ErrInvalidInput
	}

	for _, target := range tenantDeleteOrder {
		tag, err := tx.Exec(ctx,
			"delete from "+target.table+" where "+target.column+" = $1",
			input.BusinessID.String(),
		)
		if err != nil {
			return ports.AdminBusinessDeleteRecord{}, fmt.Errorf("delete %s: %w", target.table, err)
		}
		record.TotalRowsDeleted += int(tag.RowsAffected())
	}

	if _, err := tx.Exec(ctx, `
		delete from businesses where business_id = $1
	`, input.BusinessID.String()); err != nil {
		return ports.AdminBusinessDeleteRecord{}, err
	}
	record.TotalRowsDeleted++

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminBusinessDeleteRecord{}, err
	}

	return record, nil
}
