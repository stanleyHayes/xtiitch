package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itAdminSubBiz   = "66666666-6666-6666-6666-666666666661"
	itAdminSubAdmin = "77777777-7777-7777-7777-777777777771"
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

func seedAdminSubscriptionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAdminSubscriptionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), `select plan_id from plans where code = 'standard' limit 1`).Scan(&planID); err != nil {
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
