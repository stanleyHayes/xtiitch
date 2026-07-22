package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	authItBizA      = "12121212-1111-1111-1111-111111111111"
	authItBizB      = "12121212-2222-2222-2222-222222222222"
	authItOwnerA    = "13131313-1111-1111-1111-111111111111"
	authItOwnerB    = "13131313-2222-2222-2222-222222222222"
	authItStaffA    = "14141414-1111-1111-1111-111111111111"
	authItSessionA  = "15151515-1111-1111-1111-111111111111"
	authItOwnerMail = "owner.integration@example.com"
)

//nolint:gosec // test fixtures use hardcoded placeholder hashes
func TestBusinessIdentityRepositoryTenantScopedUsersAndLogin(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	cleanupAuthFixtures(t, pool)
	defer cleanupAuthFixtures(t, pool)

	ctx := context.Background()
	repo := NewBusinessIdentityRepository(pool)

	if _, err := repo.CreateBusinessWithOwner(ctx, ports.CreateBusinessWithOwnerInput{
		BusinessID:       common.ID(authItBizA),
		BusinessName:     "Auth IT A",
		BusinessHandle:   "auth-it-a",
		OwnerUserID:      common.ID(authItOwnerA),
		OwnerDisplayName: "Owner A",
		OwnerEmail:       authItOwnerMail,
		OwnerPassword:    "hash-owner-a", //nolint:gosec // test fixture password hash
		// Staff seats ladder by plan (§13.4: Free = owner only) — this test
		// exercises tenant scoping with a staff member, so it needs a plan
		// that allows one.
		PlanCode: "growth",
	}); err != nil {
		t.Fatalf("create business A: %v", err)
	}
	// A paid signup target is visible to billing as pending, but Free remains the
	// effective business/subscription plan until a verified payment applies it.
	var businessPlanCode, subscriptionPlanCode, pendingPlanCode, subscriptionStatus string
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(ctx, `
			select business_plan.code, subscription_plan.code,
				coalesce(pending_plan.code, ''), s.status
			from businesses b
			join plans business_plan on business_plan.plan_id = b.plan_id
			join business_subscriptions s on s.business_id = b.business_id
			join plans subscription_plan on subscription_plan.plan_id = s.plan_id
			left join plans pending_plan on pending_plan.plan_id = s.pending_plan_id
			where b.business_id = $1
		`, authItBizA).Scan(
			&businessPlanCode, &subscriptionPlanCode, &pendingPlanCode, &subscriptionStatus,
		); err != nil {
			t.Fatalf("read pending paid signup: %v", err)
		}
	})
	if businessPlanCode != "free" || subscriptionPlanCode != "free" ||
		pendingPlanCode != "growth" || subscriptionStatus != "trialing" {
		t.Fatalf("paid signup must remain effectively Free pending payment, got business=%q subscription=%q pending=%q status=%q",
			businessPlanCode, subscriptionPlanCode, pendingPlanCode, subscriptionStatus)
	}
	// This tenant-scoping test needs a paid staff-seat allowance. Simulate the
	// verified callback applying Growth before creating the staff fixture.
	var growthPlanID string
	if err := pool.QueryRow(ctx, `select plan_id::text from plans where code = 'growth'`).Scan(&growthPlanID); err != nil {
		t.Fatalf("resolve Growth plan: %v", err)
	}
	if err := repo.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
		BusinessID: common.ID(authItBizA), NewPlanID: common.ID(growthPlanID),
	}); err != nil {
		t.Fatalf("activate Growth test fixture: %v", err)
	}
	if _, err := repo.CreateBusinessWithOwner(ctx, ports.CreateBusinessWithOwnerInput{
		BusinessID:       common.ID(authItBizB),
		BusinessName:     "Auth IT B",
		BusinessHandle:   "auth-it-b",
		OwnerUserID:      common.ID(authItOwnerB),
		OwnerDisplayName: "Owner B",
		OwnerEmail:       authItOwnerMail,
		OwnerPassword:    "hash-owner-b", //nolint:gosec // test fixture password hash
	}); err != nil {
		t.Fatalf("create business B: %v", err)
	}

	created, err := repo.CreateBusinessUser(ctx, authScope(authItBizA), ports.CreateBusinessUserInput{
		UserID:       common.ID(authItStaffA),
		BusinessID:   common.ID(authItBizA),
		Email:        "staff.integration@example.com",
		DisplayName:  "Staff A",
		PasswordHash: "hash-staff-a",
		Role:         business.UserRoleStaff,
	})
	if err != nil {
		t.Fatalf("create staff user: %v", err)
	}
	if created.BusinessID != common.ID(authItBizA) || created.Role != business.UserRoleStaff {
		t.Fatalf("unexpected created user: %+v", created)
	}

	usersA, err := repo.ListBusinessUsers(ctx, authScope(authItBizA))
	if err != nil {
		t.Fatalf("list users A: %v", err)
	}
	if len(usersA) != 2 {
		t.Fatalf("expected owner and staff for A, got %+v", usersA)
	}
	usersB, err := repo.ListBusinessUsers(ctx, authScope(authItBizB))
	if err != nil {
		t.Fatalf("list users B: %v", err)
	}
	if len(usersB) != 1 || usersB[0].UserID != common.ID(authItOwnerB) {
		t.Fatalf("tenant B must only see its owner, got %+v", usersB)
	}

	credsA, err := repo.FindBusinessUserByHandleAndEmail(ctx, "auth-it-a", authItOwnerMail)
	if err != nil {
		t.Fatalf("login lookup A: %v", err)
	}
	if credsA.BusinessID != common.ID(authItBizA) ||
		credsA.UserID != common.ID(authItOwnerA) ||
		credsA.PasswordHash != "hash-owner-a" {
		t.Fatalf("login lookup must resolve handle A, got %+v", credsA)
	}
	credsB, err := repo.FindBusinessUserByHandleAndEmail(ctx, "auth-it-b", authItOwnerMail)
	if err != nil {
		t.Fatalf("login lookup B: %v", err)
	}
	if credsB.BusinessID != common.ID(authItBizB) ||
		credsB.UserID != common.ID(authItOwnerB) ||
		credsB.PasswordHash != "hash-owner-b" {
		t.Fatalf("login lookup must resolve handle B, got %+v", credsB)
	}

	if count := businessUserCountWithoutTenant(t, pool, authItStaffA); count != 0 {
		t.Fatalf("business_users query without tenant scope must fail closed, got %d", count)
	}
	if count := businessUserCountWithTenant(t, pool, authItBizA, authItStaffA); count != 1 {
		t.Fatalf("business A should see staff user, got %d", count)
	}
	if count := businessUserCountWithTenant(t, pool, authItBizB, authItStaffA); count != 0 {
		t.Fatalf("business B must not see A staff user, got %d", count)
	}
}

//nolint:gosec // test fixtures use hardcoded placeholder hashes
func TestAuthSessionRepositoryBypassLookupAndTenantScopedRevoke(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	cleanupAuthFixtures(t, pool)
	defer cleanupAuthFixtures(t, pool)

	ctx := context.Background()
	identity := NewBusinessIdentityRepository(pool)
	if _, err := identity.CreateBusinessWithOwner(ctx, ports.CreateBusinessWithOwnerInput{
		BusinessID:       common.ID(authItBizA),
		BusinessName:     "Auth IT A",
		BusinessHandle:   "auth-it-a",
		OwnerUserID:      common.ID(authItOwnerA),
		OwnerDisplayName: "Owner A",
		OwnerEmail:       authItOwnerMail,
		OwnerPassword:    "hash-owner-a", //nolint:gosec // test fixture password hash
	}); err != nil {
		t.Fatalf("create business A: %v", err)
	}
	if _, err := identity.CreateBusinessWithOwner(ctx, ports.CreateBusinessWithOwnerInput{
		BusinessID:       common.ID(authItBizB),
		BusinessName:     "Auth IT B",
		BusinessHandle:   "auth-it-b",
		OwnerUserID:      common.ID(authItOwnerB),
		OwnerDisplayName: "Owner B",
		OwnerEmail:       "owner-b.integration@example.com",
		OwnerPassword:    "hash-owner-b", //nolint:gosec // test fixture password hash
	}); err != nil {
		t.Fatalf("create business B: %v", err)
	}

	sessions := NewAuthSessionRepository(pool)
	if err := sessions.Create(ctx, ports.CreateAuthSessionInput{
		SessionID:        common.ID(authItSessionA),
		BusinessID:       common.ID(authItBizA),
		BusinessUserID:   common.ID(authItOwnerA),
		RefreshTokenHash: "auth-it-refresh-a", //nolint:gosec // test fixture token hash
		UserAgent:        "integration",
		IPAddress:        "127.0.0.1",
		ExpiresAt:        time.Now().Add(time.Hour),
	}); err != nil {
		t.Fatalf("create auth session: %v", err)
	}

	if count := authSessionCountWithoutTenant(t, pool, authItSessionA); count != 0 {
		t.Fatalf("auth_sessions query without tenant scope must fail closed, got %d", count)
	}

	found, err := sessions.FindByRefreshTokenHash(ctx, "auth-it-refresh-a")
	if err != nil {
		t.Fatalf("find by refresh hash: %v", err)
	}
	if found.BusinessID != common.ID(authItBizA) ||
		found.BusinessUserID != common.ID(authItOwnerA) ||
		found.Role != business.UserRoleOwner ||
		found.Revoked {
		t.Fatalf("unexpected session lookup: %+v", found)
	}

	if err := sessions.Revoke(ctx, common.ID(authItBizB), common.ID(authItSessionA)); err != nil {
		t.Fatalf("cross-tenant revoke should be a no-op, got %v", err)
	}
	stillActive, err := sessions.FindByRefreshTokenHash(ctx, "auth-it-refresh-a")
	if err != nil {
		t.Fatalf("find after cross-tenant revoke: %v", err)
	}
	if stillActive.Revoked {
		t.Fatalf("business B must not revoke business A session: %+v", stillActive)
	}

	if err := sessions.Revoke(ctx, common.ID(authItBizA), common.ID(authItSessionA)); err != nil {
		t.Fatalf("tenant revoke: %v", err)
	}
	revoked, err := sessions.FindByRefreshTokenHash(ctx, "auth-it-refresh-a")
	if err != nil {
		t.Fatalf("find after revoke: %v", err)
	}
	if !revoked.Revoked {
		t.Fatalf("expected revoked session, got %+v", revoked)
	}

	_, err = sessions.FindByRefreshTokenHash(ctx, "missing-refresh")
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("missing refresh token should return not found, got %v", err)
	}
}

func cleanupAuthFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = any($1)`, []string{authItBizA, authItBizB})
	})
}

func authScope(businessID string) common.TenantScope {
	return common.TenantScope{BusinessID: common.ID(businessID)}
}

func businessUserCountWithoutTenant(t *testing.T, pool *pgxpool.Pool, userID string) int {
	t.Helper()
	return countDirect(t, pool, `select count(*) from business_users where business_user_id = $1`, userID)
}

func businessUserCountWithTenant(t *testing.T, pool *pgxpool.Pool, businessID string, userID string) int {
	t.Helper()
	return countWithTenant(t, pool, businessID, `select count(*) from business_users where business_user_id = $1`, userID)
}

func authSessionCountWithoutTenant(t *testing.T, pool *pgxpool.Pool, sessionID string) int {
	t.Helper()
	return countDirect(t, pool, `select count(*) from auth_sessions where session_id = $1`, sessionID)
}

func countDirect(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int {
	t.Helper()
	var count int
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(&count); err != nil {
		t.Fatalf("count direct: %v", err)
	}
	return count
}

func countWithTenant(t *testing.T, pool *pgxpool.Pool, businessID string, sql string, args ...any) int {
	t.Helper()
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin scoped count: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, businessID); err != nil {
		t.Fatalf("set tenant: %v", err)
	}
	var count int
	if err := tx.QueryRow(ctx, sql, args...).Scan(&count); err != nil {
		t.Fatalf("count scoped: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit scoped count: %v", err)
	}
	return count
}
