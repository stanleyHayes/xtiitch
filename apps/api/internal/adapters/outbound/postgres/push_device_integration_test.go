package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// Real-Postgres coverage for push device registration and the per-device
// fan-out a new order produces. Run as xtiitch_app so the row-level-security
// policies are actually in force; skipped without XTIITCH_TEST_DATABASE_URL.

// Fixture tokens. Not credentials — they address nothing and Expo would refuse
// them; gosec matches on the word "Token" alone.
const (
	itPushTokenA = "ExponentPushToken[integration-device-aaaa]" //nolint:gosec // test fixture, not a credential
	itPushTokenB = "ExponentPushToken[integration-device-bbbb]" //nolint:gosec // test fixture, not a credential
)

// seedPushOperators gives itBizA and itBizB an owner each, since the confirm
// fixtures create businesses but no staff.
func seedPushOperators(t *testing.T, pool *pgxpool.Pool) (userA, userB string) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from push_device_tokens where token = any($1)`,
			[]string{itPushTokenA, itPushTokenB})
		if err := tx.QueryRow(context.Background(), `
			insert into business_users (business_id, email, display_name, password_hash, role, phone)
			values ($1, 'push-owner-a@xtiitch.test', 'Push Owner A', 'hash', 'owner', '0241234567')
			on conflict (business_id, lower(email)) do update set display_name = excluded.display_name
			returning business_user_id::text
		`, itBizA).Scan(&userA); err != nil {
			t.Fatalf("seed operator A: %v", err)
		}
		if err := tx.QueryRow(context.Background(), `
			insert into business_users (business_id, email, display_name, password_hash, role, phone)
			values ($1, 'push-owner-b@xtiitch.test', 'Push Owner B', 'hash', 'owner', '0247654321')
			on conflict (business_id, lower(email)) do update set display_name = excluded.display_name
			returning business_user_id::text
		`, itBizB).Scan(&userB); err != nil {
			t.Fatalf("seed operator B: %v", err)
		}
	})
	return userA, userB
}

func cleanupPushDevices(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from push_device_tokens where token = any($1)`,
			[]string{itPushTokenA, itPushTokenB})
		mustExec(t, tx, `delete from business_users where email like 'push-owner-%@xtiitch.test'`)
	})
}

func pushTokenOwner(t *testing.T, pool *pgxpool.Pool, token string) (businessID, userID string, found bool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		err := tx.QueryRow(context.Background(), `
			select business_id::text, business_user_id::text
			from push_device_tokens where token = $1
		`, token).Scan(&businessID, &userID)
		if err == nil {
			found = true
			return
		}
		if err != pgx.ErrNoRows {
			t.Fatalf("read push token: %v", err)
		}
	})
	return
}

func TestRegisterPushDeviceIsIdempotentAndTenantScoped(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)
	userA, _ := seedPushOperators(t, pool)
	defer cleanupPushDevices(t, pool)

	ctx := context.Background()
	repo := NewNotificationRepository(pool)
	scopeA := common.TenantScope{BusinessID: common.ID(itBizA)}
	now := time.Now().UTC()

	first, err := repo.RegisterPushDevice(ctx, scopeA, ports.RegisterPushDeviceInput{
		UserID: common.ID(userA), Token: itPushTokenA, Platform: "ios",
		DeviceName: "Ama's iPhone", Now: now,
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if first.Token != itPushTokenA || first.Platform != "ios" {
		t.Fatalf("unexpected device: %+v", first)
	}

	// The app re-registers on every launch; that must update, not duplicate.
	second, err := repo.RegisterPushDevice(ctx, scopeA, ports.RegisterPushDeviceInput{
		UserID: common.ID(userA), Token: itPushTokenA, Platform: "ios",
		DeviceName: "Ama's iPhone 15", Now: now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("re-register: %v", err)
	}
	if second.TokenID != first.TokenID {
		t.Fatalf("re-registering must keep one row, got %s then %s", first.TokenID, second.TokenID)
	}
	if second.DeviceName != "Ama's iPhone 15" {
		t.Fatalf("re-registering must refresh the label, got %q", second.DeviceName)
	}

	devices, err := repo.ListPushDevices(ctx, scopeA, common.ID(userA))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(devices) != 1 {
		t.Fatalf("expected exactly one device, got %d", len(devices))
	}

	// Another business must not see it, even knowing the token.
	otherDevices, err := repo.ListPushDevices(ctx,
		common.TenantScope{BusinessID: common.ID(itBizB)}, common.ID(userA))
	if err != nil {
		t.Fatalf("cross-tenant list: %v", err)
	}
	if len(otherDevices) != 0 {
		t.Fatalf("row-level security must hide another business's devices, got %d", len(otherDevices))
	}
}

// A phone that changes hands presents a token another business already holds.
// The new registration has to take it over, or the previous business keeps
// pushing order alerts — which name the customer and the amount — to a device
// that is no longer theirs.
func TestRegisterPushDeviceReclaimsATokenFromAnotherBusiness(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)
	userA, userB := seedPushOperators(t, pool)
	defer cleanupPushDevices(t, pool)

	ctx := context.Background()
	repo := NewNotificationRepository(pool)
	now := time.Now().UTC()

	if _, err := repo.RegisterPushDevice(ctx,
		common.TenantScope{BusinessID: common.ID(itBizA)},
		ports.RegisterPushDeviceInput{UserID: common.ID(userA), Token: itPushTokenA, Now: now},
	); err != nil {
		t.Fatalf("register on A: %v", err)
	}

	if _, err := repo.RegisterPushDevice(ctx,
		common.TenantScope{BusinessID: common.ID(itBizB)},
		ports.RegisterPushDeviceInput{UserID: common.ID(userB), Token: itPushTokenA, Now: now},
	); err != nil {
		t.Fatalf("re-register on B: %v", err)
	}

	businessID, userID, found := pushTokenOwner(t, pool, itPushTokenA)
	if !found {
		t.Fatal("the token must still exist after moving business")
	}
	if businessID != itBizB || userID != userB {
		t.Fatalf("the device must move to the new business, got business=%s user=%s", businessID, userID)
	}

	// Exactly one row: the old claim is gone, not merely shadowed.
	if n := countBypass(t, pool,
		`select count(*) from push_device_tokens where token = $1`, itPushTokenA); n != 1 {
		t.Fatalf("expected one row for the token, got %d", n)
	}
}

func TestUnregisterPushDeviceIsScopedAndForgiving(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)
	userA, _ := seedPushOperators(t, pool)
	defer cleanupPushDevices(t, pool)

	ctx := context.Background()
	repo := NewNotificationRepository(pool)
	scopeA := common.TenantScope{BusinessID: common.ID(itBizA)}

	if _, err := repo.RegisterPushDevice(ctx, scopeA, ports.RegisterPushDeviceInput{
		UserID: common.ID(userA), Token: itPushTokenA, Now: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("register: %v", err)
	}

	// Another business cannot unregister a device it does not own.
	if err := repo.UnregisterPushDevice(ctx,
		common.TenantScope{BusinessID: common.ID(itBizB)}, itPushTokenA); err != nil {
		t.Fatalf("cross-tenant unregister: %v", err)
	}
	if _, _, found := pushTokenOwner(t, pool, itPushTokenA); !found {
		t.Fatal("another business must not be able to unregister this device")
	}

	if err := repo.UnregisterPushDevice(ctx, scopeA, itPushTokenA); err != nil {
		t.Fatalf("unregister: %v", err)
	}
	if _, _, found := pushTokenOwner(t, pool, itPushTokenA); found {
		t.Fatal("unregistering must remove the device")
	}

	// Signing out twice is not an error.
	if err := repo.UnregisterPushDevice(ctx, scopeA, itPushTokenA); err != nil {
		t.Fatalf("second unregister must succeed: %v", err)
	}
}

// The whole point: a paid order reaches every device the business registered,
// once each, and a redelivered webhook adds nothing.
func TestConfirmOrderEnqueuesOnePushPerDevice(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedConfirmFixtures(t, pool)
	defer cleanupConfirmFixtures(t, pool)
	userA, _ := seedPushOperators(t, pool)
	defer cleanupPushDevices(t, pool)
	giveCustomerPhone(t, pool, "0241234567")

	ctx := context.Background()
	repo := NewNotificationRepository(pool)
	scopeA := common.TenantScope{BusinessID: common.ID(itBizA)}
	now := time.Now().UTC()

	for _, token := range []string{itPushTokenA, itPushTokenB} {
		if _, err := repo.RegisterPushDevice(ctx, scopeA, ports.RegisterPushDeviceInput{
			UserID: common.ID(userA), Token: token, Platform: "android", Now: now,
		}); err != nil {
			t.Fatalf("register %s: %v", token, err)
		}
	}

	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "push_succ_1", EventType: "charge.success",
		ProviderReference: itRefOK, Succeeded: true,
	}); err != nil {
		t.Fatalf("confirm: %v", err)
	}

	for _, token := range []string{itPushTokenA, itPushTokenB} {
		dedup := notification.DedupKey(
			notification.KindNewOrderOwnerPush,
			notification.OwnerPushReference(itOrderOK, token),
		)
		found, recipient, kind, status, channel := outboundRow(t, pool, itBizA, dedup)
		if !found {
			t.Fatalf("device %s must be sent the new order", token)
		}
		if recipient != token || channel != "push" || kind != "new_order_owner_push" || status != "pending" {
			t.Fatalf("unexpected push row: recipient=%q channel=%q kind=%q status=%q",
				recipient, channel, kind, status)
		}
	}

	// The SMS alert still goes out under its own kind, so the dashboard badge
	// and the owner email — both of which read new_order_owner — count one
	// order, not one per device.
	smsDedup := notification.DedupKey(notification.KindNewOrderOwner, itOrderOK)
	if n := outboundCount(t, pool, itBizA, smsDedup); n != 1 {
		t.Fatalf("expected exactly one owner SMS alert, got %d", n)
	}

	// A redelivered webhook is routine; it must not push again.
	if _, err := NewPaymentRepository(pool).ConfirmFromProvider(ctx, ports.ConfirmPaymentInput{
		EventSignature: "push_succ_2", EventType: "charge.success",
		ProviderReference: itRefOK, Succeeded: true,
	}); err != nil {
		t.Fatalf("redeliver: %v", err)
	}
	total := countBypass(t, pool,
		`select count(*) from outbound_messages where business_id = $1 and kind = $2`,
		itBizA, string(notification.KindNewOrderOwnerPush))
	if total != 2 {
		t.Fatalf("expected two push messages after redelivery, got %d", total)
	}
}
