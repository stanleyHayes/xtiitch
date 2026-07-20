package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Integration coverage for the §15 CRM repository against a real, migrated,
// RLS-enforcing database (xtiitch_app role), opt-in via
// XTIITCH_TEST_DATABASE_URL like the other integration suites. The seed
// deliberately NEVER inserts customer_businesses rows: the CRM derives the
// relationship set from orders ∪ order_measurements (§15.3 auto-populated),
// which is exactly what these tests prove.

const (
	itCRMBizA   = "77777777-0000-0000-0000-0000000000a1"
	itCRMBizB   = "77777777-0000-0000-0000-0000000000b1"
	itCRMCust1  = "77777777-0000-0000-0000-0000000000c1" // returning in A (2 orders)
	itCRMCust2  = "77777777-0000-0000-0000-0000000000c2" // new in A (first order 3d ago)
	itCRMCust3  = "77777777-0000-0000-0000-0000000000c3" // lapsed in A (100d)
	itCRMCust4  = "77777777-0000-0000-0000-0000000000c4" // belongs to B only
	itCRMCust5  = "77777777-0000-0000-0000-0000000000c5" // erased; order in A
	itCRMCust6  = "77777777-0000-0000-0000-0000000000c6" // orders in BOTH A and B
	itCRMDesign = "77777777-0000-0000-0000-0000000000d1"
	itCRMOrder1 = "77777777-0000-0000-0000-0000000000e1" // cust1, 40d, walk_in, 20000
	itCRMOrder2 = "77777777-0000-0000-0000-0000000000e2" // cust1, 5d, online, 30000
	itCRMOrder3 = "77777777-0000-0000-0000-0000000000e3" // cust2, 3d, online, 15000
	itCRMOrder4 = "77777777-0000-0000-0000-0000000000e4" // cust3, 100d, walk_in, 50000
	itCRMOrder5 = "77777777-0000-0000-0000-0000000000e5" // cust4, 2d, in B, 80000
	itCRMOrder6 = "77777777-0000-0000-0000-0000000000e6" // cust5 (erased), 2d, in A
	itCRMOrder7 = "77777777-0000-0000-0000-0000000000e7" // cust1 DRAFT (must vanish)
	itCRMOrder8 = "77777777-0000-0000-0000-0000000000e8" // cust6, 6d, in A
	itCRMOrder9 = "77777777-0000-0000-0000-0000000000e9" // cust6, 4d, in B
	itCRMMeas   = "77777777-0000-0000-0000-0000000000f1"
)

var itCRMNow = time.Now()

func seedCRMFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		for _, biz := range []string{itCRMBizA, itCRMBizB} {
			mustExec(t, tx, `delete from businesses where business_id = $1`, biz)
		}
		mustExec(t, tx, `delete from customers where customer_id in ($1,$2,$3,$4,$5,$6)`,
			itCRMCust1, itCRMCust2, itCRMCust3, itCRMCust4, itCRMCust5, itCRMCust6)

		var planID string
		if err := tx.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
			t.Fatalf("probe plan: %v", err)
		}
		for _, biz := range []string{itCRMBizA, itCRMBizB} {
			mustExec(t, tx, `
				insert into businesses (business_id, plan_id, name, handle, verification_status)
				values ($1, $2, 'IT CRM', $3, 'verified')
			`, biz, planID, "it-crm-"+biz[len(biz)-2:])
			mustExec(t, tx, `
				insert into designs (design_id, business_id, title, handle, status)
				values (gen_random_uuid(), $1, 'IT CRM Design', $2, 'active')
			`, biz, "it-crm-design-"+biz[len(biz)-2:])
		}
		mustExec(t, tx, `
			insert into customers (customer_id, display_name, phone, whatsapp_number, email)
			values
				($1, 'IT Returning', '0245000001', '0245000001', 'returning@example.com'),
				($2, 'IT New', '0245000002', null, null),
				($3, 'IT Lapsed', '0245000003', null, null),
				($4, 'IT Other Store', '0245000004', null, null),
				($5, 'IT Erased', '0245000005', null, null),
				($6, 'IT Shared', '0245000006', null, null)
		`, itCRMCust1, itCRMCust2, itCRMCust3, itCRMCust4, itCRMCust5, itCRMCust6)

		var designA, designB string
		if err := tx.QueryRow(context.Background(),
			`select design_id::text from designs where business_id = $1`, itCRMBizA).Scan(&designA); err != nil {
			t.Fatalf("design A: %v", err)
		}
		if err := tx.QueryRow(context.Background(),
			`select design_id::text from designs where business_id = $1`, itCRMBizB).Scan(&designB); err != nil {
			t.Fatalf("design B: %v", err)
		}
		// Orders. cust1's o7 draft must vanish from every figure (abandoned
		// checkout, not an order — the §14 rule). cust6's A order is 45d old:
		// neither "new" (>30d), "returning" (one order) nor "lapsed" (<90d).
		mustExec(t, tx, `
			insert into orders (order_id, business_id, customer_id, design_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status, created_at)
			values
				($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'walk_in', 20000, 20000, 'confirmed', $5),
				($6, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 30000, 30000, 'confirmed', $7),
				($8, $2, $9, $4, 'standard', 'band', 'ready_made', 'online', 15000, 15000, 'confirmed', $10),
				($11, $2, $12, $4, 'standard', 'band', 'ready_made', 'walk_in', 50000, 50000, 'confirmed', $13),
				($14, $15, $16, $17, 'standard', 'band', 'ready_made', 'online', 80000, 80000, 'confirmed', $18),
				($19, $2, $20, $4, 'standard', 'band', 'ready_made', 'online', 9000, 9000, 'confirmed', $18),
				($21, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 99999, 0, 'draft', $18),
				($22, $2, $23, $4, 'standard', 'band', 'ready_made', 'online', 6000, 6000, 'confirmed', $24),
				($25, $15, $23, $17, 'standard', 'band', 'ready_made', 'online', 4000, 4000, 'confirmed', $26)
		`,
			itCRMOrder1, itCRMBizA, itCRMCust1, designA, itCRMNow.AddDate(0, 0, -40),
			itCRMOrder2, itCRMNow.AddDate(0, 0, -5),
			itCRMOrder3, itCRMCust2, itCRMNow.AddDate(0, 0, -3),
			itCRMOrder4, itCRMCust3, itCRMNow.AddDate(0, 0, -100),
			itCRMOrder5, itCRMBizB, itCRMCust4, designB, itCRMNow.AddDate(0, 0, -2),
			itCRMOrder6, itCRMCust5,
			itCRMOrder7,
			itCRMOrder8, itCRMCust6, itCRMNow.AddDate(0, 0, -45),
			itCRMOrder9, itCRMNow.AddDate(0, 0, -4))

		// Saved measurements on cust1's newest order (§15.1 profile rung).
		mustExec(t, tx, `
			insert into order_measurements (measurement_id, business_id, order_id, customer_id, source, values)
			values ($1, $2, $3, $4, 'shop', '{"field-chest": "98"}'::jsonb)
		`, itCRMMeas, itCRMBizA, itCRMOrder2, itCRMCust1)

		// Annotations: A's note/tags on cust1 and cust6; B's tag on cust4 —
		// B must NEVER see A's annotations, even for the shared cust6.
		mustExec(t, tx, `
			insert into business_customer_notes (business_id, customer_id, note)
			values ($1, $2, 'prefers loose fit'), ($1, $3, 'A-only note')
		`, itCRMBizA, itCRMCust1, itCRMCust6)
		mustExec(t, tx, `
			insert into business_customer_tags (business_id, customer_id, tag)
			values ($1, $2, 'VIP'), ($1, $2, 'bride'), ($1, $3, 'A-only-tag'), ($4, $5, 'B-tag')
		`, itCRMBizA, itCRMCust1, itCRMCust6, itCRMBizB, itCRMCust4)

		// cust5 is erased (000043): out of every CRM surface despite the order.
		mustExec(t, tx, `
			update customers set display_name = 'Erased customer', phone = null, erased_at = now()
			where customer_id = $1
		`, itCRMCust5)
	})
}

func crmScopeA() common.TenantScope { return common.TenantScope{BusinessID: itCRMBizA} }
func crmScopeB() common.TenantScope { return common.TenantScope{BusinessID: itCRMBizB} }

func crmIDs(rows []ports.CRMCustomerRow) []string {
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.CustomerID.String())
	}
	return ids
}

func TestCRMRepositoryListCustomersTenantScoped(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCRMFixtures(t, pool)
	repo := NewCRMRepository(pool)

	list, err := repo.ListCustomers(context.Background(), crmScopeA(), ports.CRMCustomerQuery{Now: itCRMNow, Limit: 50})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	// Newest-active first: cust2 (3d), cust4? no — cust4 is B's. A has
	// cust2 (3d), cust1 (5d), cust6 (6d), cust3 (100d). Erased cust5 and
	// B-only cust4 never appear (§6 tenant scoping + erasure).
	want := []string{itCRMCust2, itCRMCust1, itCRMCust6, itCRMCust3}
	got := crmIDs(list.Customers)
	if list.Total != len(want) || len(got) != len(want) {
		t.Fatalf("list: total=%d ids=%v", list.Total, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("order: %v want %v", got, want)
		}
	}

	returning := list.Customers[1]
	if returning.OrdersCount != 2 || returning.TotalSpendMinor != 50000 {
		t.Fatalf("draft order must not count; count+spend: %+v", returning)
	}
	if returning.Source != "walk_in" {
		t.Fatalf("source is the FIRST order's channel: %+v", returning)
	}
	if returning.LastOrderAt == nil || !returning.LastOrderAt.Equal(itCRMNow.AddDate(0, 0, -5).Truncate(time.Microsecond)) {
		t.Fatalf("last order: %+v", returning.LastOrderAt)
	}
	if len(returning.Tags) != 2 || returning.Tags[0] != "VIP" || returning.Tags[1] != "bride" {
		t.Fatalf("tags sorted: %+v", returning.Tags)
	}

	// Store B sees ONLY its own customers (cust4 + shared cust6) and never
	// A's annotations on the shared customer.
	listB, err := repo.ListCustomers(context.Background(), crmScopeB(), ports.CRMCustomerQuery{Now: itCRMNow, Limit: 50})
	if err != nil {
		t.Fatalf("list B: %v", err)
	}
	gotB := crmIDs(listB.Customers)
	if len(gotB) != 2 || gotB[0] != itCRMCust4 || gotB[1] != itCRMCust6 {
		t.Fatalf("B list: %v", gotB)
	}
	if listB.Customers[1].Tags != nil {
		t.Fatalf("A's tags must never leak into B: %+v", listB.Customers[1])
	}
	if listB.Customers[0].Tags[0] != "B-tag" {
		t.Fatalf("B sees its own tag: %+v", listB.Customers[0])
	}
}

func TestCRMRepositoryListCustomersFilters(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCRMFixtures(t, pool)
	repo := NewCRMRepository(pool)
	scope := crmScopeA()

	assertIDs := func(name string, query ports.CRMCustomerQuery, want ...string) {
		t.Helper()
		query.Now = itCRMNow
		query.Limit = 50
		list, err := repo.ListCustomers(context.Background(), scope, query)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		got := crmIDs(list.Customers)
		if len(got) != len(want) {
			t.Fatalf("%s: %v want %v", name, got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("%s: %v want %v", name, got, want)
			}
		}
	}

	assertIDs("search by name", ports.CRMCustomerQuery{Q: "returning"}, itCRMCust1)
	assertIDs("search by phone", ports.CRMCustomerQuery{Q: "0245000003"}, itCRMCust3)
	assertIDs("tag filter", ports.CRMCustomerQuery{Tag: "VIP"}, itCRMCust1)
	assertIDs("segment new", ports.CRMCustomerQuery{Segment: ports.CRMSegmentNew}, itCRMCust2)
	assertIDs("segment returning", ports.CRMCustomerQuery{Segment: ports.CRMSegmentReturning}, itCRMCust1)
	assertIDs("segment lapsed", ports.CRMCustomerQuery{Segment: ports.CRMSegmentLapsed}, itCRMCust3)
	assertIDs("min spend", ports.CRMCustomerQuery{MinSpendMinor: ptrITInt64(40000)}, itCRMCust1, itCRMCust3)
	tenDaysAgo := itCRMNow.AddDate(0, 0, -10)
	assertIDs("last order before", ports.CRMCustomerQuery{LastOrderBefore: &tenDaysAgo}, itCRMCust6, itCRMCust3)
	assertIDs("last order after", ports.CRMCustomerQuery{LastOrderAfter: &tenDaysAgo}, itCRMCust2, itCRMCust1)

	// Paging: total is page-independent; limit 0 (export path) returns all.
	page, err := repo.ListCustomers(context.Background(), scope, ports.CRMCustomerQuery{Now: itCRMNow, Limit: 2, Offset: 2})
	if err != nil {
		t.Fatalf("page: %v", err)
	}
	if page.Total != 4 || len(page.Customers) != 2 || page.Customers[0].CustomerID.String() != itCRMCust6 {
		t.Fatalf("page: total=%d %+v", page.Total, crmIDs(page.Customers))
	}
	all, err := repo.ListCustomers(context.Background(), scope, ports.CRMCustomerQuery{Now: itCRMNow})
	if err != nil {
		t.Fatalf("unpaged: %v", err)
	}
	if len(all.Customers) != 4 {
		t.Fatalf("limit 0 = whole list: %v", crmIDs(all.Customers))
	}
}

func TestCRMRepositoryProfileAndAnnotations(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCRMFixtures(t, pool)
	repo := NewCRMRepository(pool)

	profile, err := repo.GetCustomerProfile(context.Background(), crmScopeA(), itCRMCust1)
	if err != nil {
		t.Fatalf("profile: %v", err)
	}
	if profile.DisplayName != "IT Returning" || profile.Phone != "0245000001" ||
		profile.WhatsAppNumber != "0245000001" || profile.Email != "returning@example.com" {
		t.Fatalf("contact details: %+v", profile)
	}
	if profile.OrdersCount != 2 || profile.TotalSpendMinor != 50000 || len(profile.Orders) != 2 {
		t.Fatalf("history: %+v", profile)
	}
	if profile.Orders[0].OrderID.String() != itCRMOrder2 || profile.Orders[0].Status != "confirmed" {
		t.Fatalf("newest-first history: %+v", profile.Orders)
	}
	if len(profile.Measurements) != 1 || profile.Measurements[0].Values["field-chest"] != "98" {
		t.Fatalf("saved measurements: %+v", profile.Measurements)
	}
	if profile.Note != "prefers loose fit" || profile.NoteUpdatedAt == nil {
		t.Fatalf("note: %+v", profile)
	}
	if len(profile.Tags) != 2 {
		t.Fatalf("tags: %+v", profile.Tags)
	}

	// Cross-tenant reads 404 (§6): B's customer, and the erased customer,
	// are both invisible to A.
	if _, err := repo.GetCustomerProfile(context.Background(), crmScopeA(), itCRMCust4); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("cross-tenant profile: %v", err)
	}
	if _, err := repo.GetCustomerProfile(context.Background(), crmScopeA(), itCRMCust5); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("erased profile: %v", err)
	}
	// The shared customer reads per-tenant: B sees its own single order and
	// NONE of A's note/tags.
	shared, err := repo.GetCustomerProfile(context.Background(), crmScopeB(), itCRMCust6)
	if err != nil {
		t.Fatalf("shared profile: %v", err)
	}
	if shared.OrdersCount != 1 || shared.Note != "" || len(shared.Tags) != 0 {
		t.Fatalf("tenant-owned annotations stay tenant-owned: %+v", shared)
	}

	// Notes upsert: insert then replace, then read back through the profile.
	if _, err := repo.UpsertNote(context.Background(), crmScopeA(), itCRMCust2, "always late to collect"); err != nil {
		t.Fatalf("note insert: %v", err)
	}
	updated, err := repo.UpsertNote(context.Background(), crmScopeA(), itCRMCust2, "pays cash")
	if err != nil {
		t.Fatalf("note update: %v", err)
	}
	if updated.Note != "pays cash" {
		t.Fatalf("upsert rotates the text: %+v", updated)
	}
	cust2, err := repo.GetCustomerProfile(context.Background(), crmScopeA(), itCRMCust2)
	if err != nil || cust2.Note != "pays cash" {
		t.Fatalf("note persisted: %+v %v", cust2, err)
	}
	// A store cannot annotate a stranger's customer (§6).
	if _, err := repo.UpsertNote(context.Background(), crmScopeA(), itCRMCust4, "nope"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("cross-tenant note: %v", err)
	}

	// Tags replace wholesale.
	if err := repo.ReplaceTags(context.Background(), crmScopeA(), itCRMCust2, []string{"VIP", "wholesale"}); err != nil {
		t.Fatalf("tags insert: %v", err)
	}
	if err := repo.ReplaceTags(context.Background(), crmScopeA(), itCRMCust2, []string{"bride"}); err != nil {
		t.Fatalf("tags replace: %v", err)
	}
	cust2, _ = repo.GetCustomerProfile(context.Background(), crmScopeA(), itCRMCust2)
	if len(cust2.Tags) != 1 || cust2.Tags[0] != "bride" {
		t.Fatalf("replace semantics: %+v", cust2.Tags)
	}
	if err := repo.ReplaceTags(context.Background(), crmScopeA(), itCRMCust2, nil); err != nil {
		t.Fatalf("tags clear: %v", err)
	}
	cust2, _ = repo.GetCustomerProfile(context.Background(), crmScopeA(), itCRMCust2)
	if len(cust2.Tags) != 0 {
		t.Fatalf("cleared: %+v", cust2.Tags)
	}
	if err := repo.ReplaceTags(context.Background(), crmScopeA(), itCRMCust4, []string{"nope"}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("cross-tenant tags: %v", err)
	}
}

func TestCRMRepositoryInsights(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedCRMFixtures(t, pool)
	repo := NewCRMRepository(pool)

	insights, err := repo.Insights(context.Background(), crmScopeA(), itCRMNow)
	if err != nil {
		t.Fatalf("insights: %v", err)
	}
	// new: cust2 (first order 3d ago). Erased cust5's 2d-old order must NOT
	// count. returning: cust1 (2 orders). lapsed: cust3 (100d).
	if insights.NewCustomers30d != 1 || insights.ReturningCustomers != 1 {
		t.Fatalf("counts: %+v", insights)
	}
	if len(insights.LapsedCustomers) != 1 {
		t.Fatalf("lapsed: %+v", insights.LapsedCustomers)
	}
	lapsed := insights.LapsedCustomers[0]
	if lapsed.CustomerID.String() != itCRMCust3 || lapsed.Phone != "0245000003" {
		t.Fatalf("lapsed row: %+v", lapsed)
	}
}

func ptrITInt64(value int64) *int64 { return &value }
