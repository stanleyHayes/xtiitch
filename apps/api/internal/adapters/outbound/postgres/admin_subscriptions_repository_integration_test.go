package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itAdminSubBiz              = "66666666-6666-6666-6666-666666666661"
	itAdminSubAdmin            = "77777777-7777-7777-7777-777777777771"
	itAdminSubQuarterlyInvoice = "66666666-6666-6666-6666-6666666666a1"
)

func TestUpdateAdminSubscriptionStoresProviderReferences(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminSubscriptionFixture(t, pool)
	defer cleanupAdminSubscriptionFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	record, err := repo.UpdateAdminSubscription(ctx, ports.UpdateAdminSubscriptionInput{
		BusinessID:              common.ID(itAdminSubBiz),
		Status:                  "active",
		BillingMode:             "recurring",
		ProviderCustomerRef:     "CUS_IT_RECUR",
		ProviderSubscriptionRef: "SUB_IT_RECUR",
		ActorAdminUser:          common.ID(itAdminSubAdmin),
		Reason:                  "Attach Paystack recurring authorization.",
	})
	if err != nil {
		t.Fatalf("update recurring subscription refs: %v", err)
	}
	if record.Provider != "paystack" ||
		record.ProviderCustomerRef != "CUS_IT_RECUR" ||
		record.ProviderSubscriptionRef != "SUB_IT_RECUR" {
		t.Fatalf("expected Paystack refs on subscription response, got %+v", record)
	}

	record, err = repo.UpdateAdminSubscription(ctx, ports.UpdateAdminSubscriptionInput{
		BusinessID:     common.ID(itAdminSubBiz),
		Status:         "active",
		BillingMode:    "manual",
		ActorAdminUser: common.ID(itAdminSubAdmin),
		Reason:         "Return to manual billing.",
	})
	if err != nil {
		t.Fatalf("clear recurring subscription refs: %v", err)
	}
	if record.Provider != "manual" ||
		record.ProviderCustomerRef != "" ||
		record.ProviderSubscriptionRef != "" {
		t.Fatalf("manual billing should clear Paystack refs, got %+v", record)
	}
}

func TestIssueAdminSubscriptionInvoiceAdvancesPeriodByCadenceMonths(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminSubscriptionFixture(t, pool)
	defer cleanupAdminSubscriptionFixture(t, pool)

	repo := NewAdminAuthRepository(pool)
	ctx := context.Background()

	// The recurring sweep passes the cadence renewal figure and cadence length;
	// the invoice must bill that exact amount and advance the period by that
	// many months (here a quarterly renewal: 29700 GHS minor, 3 months).
	record, err := repo.IssueAdminSubscriptionInvoice(ctx, ports.IssueAdminSubscriptionInvoiceInput{
		InvoiceID:      common.ID(itAdminSubQuarterlyInvoice),
		BusinessID:     common.ID(itAdminSubBiz),
		InvoiceRef:     "XTSUB-ITQUARTER",
		DueAt:          time.Now().Add(72 * time.Hour),
		ActorAdminUser: common.ID(itAdminSubAdmin),
		Reason:         "Integration quarterly renewal.",
		AmountMinor:    29700,
		PeriodMonths:   3,
	})
	if err != nil {
		t.Fatalf("issue quarterly invoice: %v", err)
	}

	var invoice ports.AdminSubscriptionInvoiceRecord
	for _, candidate := range record.Invoices {
		if candidate.InvoiceRef == "XTSUB-ITQUARTER" {
			invoice = candidate
			break
		}
	}
	if invoice.AmountMinor != 29700 {
		t.Fatalf("expected invoice to bill the renewal figure 29700, got %d", invoice.AmountMinor)
	}

	// Verify the three-month advance in the database so Postgres month
	// arithmetic (which clamps month-ends) is the arbiter rather than Go's
	// AddDate (which overflows past a month boundary).
	var threeMonths bool
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(context.Background(), `
			select period_end = period_start + interval '3 months'
			from business_subscription_invoices
			where invoice_id = $1
		`, itAdminSubQuarterlyInvoice).Scan(&threeMonths); err != nil {
			t.Fatalf("read invoice period: %v", err)
		}
	})
	if !threeMonths {
		t.Fatalf("expected quarterly invoice period to span three months, got start=%s end=%s",
			invoice.PeriodStart, invoice.PeriodEnd)
	}
}

func seedAdminSubscriptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminSubscriptionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'starter' limit 1`).Scan(&planID); err != nil {
		t.Fatalf("probe standard plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into admin_users (admin_user_id, email, display_name, password_hash, role, is_active)
			values ($1, 'it-subscriptions@xtiitch.test', 'IT Subscriptions', 'hash', 'operator', true)
		`, itAdminSubAdmin)
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Subscription Admin Shop', 'it-sub-admin-shop', 'verified')
		`, itAdminSubBiz, planID)
	})
}

func cleanupAdminSubscriptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAdminSubBiz)
		mustExec(t, tx, `delete from admin_users where admin_user_id = $1`, itAdminSubAdmin)
	})
}
