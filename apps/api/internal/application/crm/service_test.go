package crmapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// --- colocated fakes (house style: plain structs, no mock library) ---

type fakeCRMRepo struct {
	list       ports.CRMCustomerList
	profile    ports.CRMCustomerProfile
	note       ports.CRMCustomerNote
	insights   ports.CRMInsights
	err        error
	lastQuery  ports.CRMCustomerQuery
	lastCustID common.ID
	lastNote   string
	lastTags   []string
	calls      []string
}

func (f *fakeCRMRepo) ListCustomers(_ context.Context, _ common.TenantScope, query ports.CRMCustomerQuery) (ports.CRMCustomerList, error) {
	f.calls = append(f.calls, "list")
	f.lastQuery = query
	return f.list, f.err
}

func (f *fakeCRMRepo) GetCustomerProfile(_ context.Context, _ common.TenantScope, customerID common.ID) (ports.CRMCustomerProfile, error) {
	f.calls = append(f.calls, "profile")
	f.lastCustID = customerID
	return f.profile, f.err
}

func (f *fakeCRMRepo) UpsertNote(_ context.Context, _ common.TenantScope, customerID common.ID, note string) (ports.CRMCustomerNote, error) {
	f.calls = append(f.calls, "upsert_note")
	f.lastCustID = customerID
	f.lastNote = note
	return f.note, f.err
}

func (f *fakeCRMRepo) ReplaceTags(_ context.Context, _ common.TenantScope, customerID common.ID, tags []string) error {
	f.calls = append(f.calls, "replace_tags")
	f.lastCustID = customerID
	f.lastTags = tags
	return f.err
}

func (f *fakeCRMRepo) Insights(_ context.Context, _ common.TenantScope, _ time.Time) (ports.CRMInsights, error) {
	f.calls = append(f.calls, "insights")
	return f.insights, f.err
}

func (f *fakeCRMRepo) called(name string) bool {
	for _, call := range f.calls {
		if call == name {
			return true
		}
	}
	return false
}

type fakeSettings struct {
	profile ports.StoreProfile
	err     error
}

func (f fakeSettings) Get(_ context.Context, _ common.TenantScope) (ports.StoreSettings, error) {
	return ports.StoreSettings{}, nil
}

func (f fakeSettings) Update(_ context.Context, _ common.TenantScope, _ ports.StoreSettings) error {
	return nil
}

func (f fakeSettings) GetProfile(_ context.Context, _ common.TenantScope) (ports.StoreProfile, error) {
	return f.profile, f.err
}

type fakeClock struct{ now time.Time }

func (f fakeClock) Now() time.Time { return f.now }

// --- helpers ---

var (
	testScope      = common.TenantScope{BusinessID: "aaaaaaaa-0000-0000-0000-0000000000a1"}
	testCustomerID = common.ID("aaaaaaaa-0000-0000-0000-0000000000c1")
	testNow        = time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)
)

func serviceWith(t *testing.T, level int, repo *fakeCRMRepo) Service {
	t.Helper()
	return NewService(Dependencies{
		CRM: repo,
		Settings: fakeSettings{profile: ports.StoreProfile{
			Name:              "IT Store",
			Entitlements:      map[string]bool{},
			EntitlementLimits: map[string]int{business.LimitCRMLevel: level},
		}},
		Writers: reportsapp.NewDefaultRegistry(),
		Clock:   fakeClock{now: testNow},
	})
}

func ownerCmd() CustomerCommand {
	return CustomerCommand{Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID}
}

func twoCustomerList() ports.CRMCustomerList {
	last := testNow.AddDate(0, 0, -3)
	return ports.CRMCustomerList{
		Total: 2,
		Customers: []ports.CRMCustomerRow{
			{
				CustomerID: testCustomerID, DisplayName: "Ama", Phone: "0244000001",
				WhatsAppNumber: "0244000001", Source: "online", LastOrderAt: &last,
				OrdersCount: 3, TotalSpendMinor: 75000, Tags: []string{"VIP"},
			},
			{
				CustomerID: "aaaaaaaa-0000-0000-0000-0000000000c2", DisplayName: "Kofi",
				Phone: "0244000002", Source: "walk_in",
				OrdersCount: 1, TotalSpendMinor: 20000, Tags: []string{"bride"},
			},
		},
	}
}

// --- list ---

func TestListCustomersFreeBlanksSpendCountsAndTags(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	result, err := serviceWith(t, LevelBasic, repo).ListCustomers(context.Background(), ListCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner,
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if result.Total != 2 || len(result.Customers) != 2 {
		t.Fatalf("customers: %+v", result)
	}
	for _, row := range result.Customers {
		if row.OrdersCount != 0 || row.TotalSpendMinor != 0 || row.Tags != nil {
			t.Fatalf("free row must blank spend/counts/tags (§15.1 Starter+ rungs): %+v", row)
		}
		if row.DisplayName == "" || row.Phone == "" || row.Source == "" {
			t.Fatalf("free row keeps the address-book fields: %+v", row)
		}
	}
	// Default paging applied.
	if repo.lastQuery.Limit != defaultListLimit || repo.lastQuery.Offset != 0 {
		t.Fatalf("default paging: %+v", repo.lastQuery)
	}
	if repo.lastQuery.Now.IsZero() {
		t.Fatalf("segment reference instant must come from the clock")
	}
}

func TestListCustomersStandardKeepsSpendCountsStripsTags(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	result, err := serviceWith(t, LevelStandard, repo).ListCustomers(context.Background(), ListCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner,
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if result.Customers[0].OrdersCount != 3 || result.Customers[0].TotalSpendMinor != 75000 {
		t.Fatalf("standard keeps spend/counts: %+v", result.Customers[0])
	}
	if result.Customers[0].Tags != nil {
		t.Fatalf("tags ladder to Growth: %+v", result.Customers[0])
	}
}

func TestListCustomersFullKeepsTags(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	result, err := serviceWith(t, LevelFull, repo).ListCustomers(context.Background(), ListCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, Tag: "VIP", Segment: ports.CRMSegmentReturning,
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(result.Customers[0].Tags) != 1 || result.Customers[0].Tags[0] != "VIP" {
		t.Fatalf("full keeps tags: %+v", result.Customers[0])
	}
	if repo.lastQuery.Tag != "VIP" || repo.lastQuery.Segment != ports.CRMSegmentReturning {
		t.Fatalf("filters reach the repo: %+v", repo.lastQuery)
	}
}

func TestListCustomersSearchRequiresStandard(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	_, err := serviceWith(t, LevelBasic, repo).ListCustomers(context.Background(), ListCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, Q: "ama",
	})
	var notEntitled NotEntitledError
	if !errors.As(err, &notEntitled) || !errors.Is(err, ErrCRMNotEntitled) {
		t.Fatalf("free search must be a crm_not_entitled refusal: %v", err)
	}
	if notEntitled.Feature != "search" || notEntitled.RequiredLevel != LevelStandard {
		t.Fatalf("payload levels: %+v", notEntitled)
	}
	if repo.called("list") {
		t.Fatalf("a refused query must never reach the repository")
	}
}

func TestListCustomersSearchStandardPasses(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	if _, err := serviceWith(t, LevelStandard, repo).ListCustomers(context.Background(), ListCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, Q: "  ama ",
	}); err != nil {
		t.Fatalf("search: %v", err)
	}
	if repo.lastQuery.Q != "ama" {
		t.Fatalf("trimmed q reaches the repo: %q", repo.lastQuery.Q)
	}
}

func TestListCustomersFiltersRequireFull(t *testing.T) {
	cases := map[string]ListCommand{
		"tag":     {Tag: "VIP"},
		"segment": {Segment: "new"},
		"spend":   {MinSpendMinor: ptrInt64(1000)},
		"before":  {LastOrderBefore: "2026-07-01"},
		"after":   {LastOrderAfter: "2026-07-01"},
	}
	for name, cmd := range cases {
		repo := &fakeCRMRepo{list: twoCustomerList()}
		cmd.Scope = testScope
		cmd.ActorRole = business.UserRoleOwner
		_, err := serviceWith(t, LevelStandard, repo).ListCustomers(context.Background(), cmd)
		var notEntitled NotEntitledError
		if !errors.As(err, &notEntitled) || notEntitled.Feature != "filters" {
			t.Fatalf("%s: standard filter must be refused at full: %v", name, err)
		}
		if repo.called("list") {
			t.Fatalf("%s: refused filter reached the repository", name)
		}
	}
}

func TestListCustomersFilterValidation(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	service := serviceWith(t, LevelFull, repo)
	base := ListCommand{Scope: testScope, ActorRole: business.UserRoleOwner}

	bad := base
	bad.Segment = "ancient"
	if _, err := service.ListCustomers(context.Background(), bad); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("unknown segment: %v", err)
	}
	bad = base
	bad.MinSpendMinor = ptrInt64(-5)
	if _, err := service.ListCustomers(context.Background(), bad); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("negative min spend: %v", err)
	}
	bad = base
	bad.LastOrderBefore = "19/07/2026"
	if _, err := service.ListCustomers(context.Background(), bad); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad date: %v", err)
	}
	bad = base
	bad.Limit = 5000
	if _, err := service.ListCustomers(context.Background(), bad); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("limit above the cap: %v", err)
	}
	bad = base
	bad.Offset = -1
	if _, err := service.ListCustomers(context.Background(), bad); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("negative offset: %v", err)
	}
	if repo.called("list") {
		t.Fatalf("invalid queries must never reach the repository")
	}

	good := base
	good.Segment = "LAPSED"
	good.LastOrderAfter = "2026-07-01"
	good.LastOrderBefore = "2026-07-19"
	good.Limit = 25
	good.Offset = 50
	if _, err := service.ListCustomers(context.Background(), good); err != nil {
		t.Fatalf("valid filters: %v", err)
	}
	if repo.lastQuery.Segment != ports.CRMSegmentLapsed {
		t.Fatalf("segment lower-cased: %q", repo.lastQuery.Segment)
	}
	if repo.lastQuery.LastOrderAfter == nil || repo.lastQuery.LastOrderBefore == nil {
		t.Fatalf("dates parsed: %+v", repo.lastQuery)
	}
	// A date-only BEFORE bound is inclusive of that day (half-open +1d), the
	// analytics custom-range convention.
	if got := *repo.lastQuery.LastOrderBefore; got.Day() != 20 {
		t.Fatalf("date-only before bound: %v", got)
	}
}

func TestListCustomersRoleRules(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	service := serviceWith(t, LevelAdvanced, repo)
	if _, err := service.ListCustomers(context.Background(), ListCommand{
		Scope: testScope, ActorRole: business.UserRoleStaff,
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("staff must be refused: %v", err)
	}
	if _, err := service.ListCustomers(context.Background(), ListCommand{
		Scope: common.TenantScope{}, ActorRole: business.UserRoleOwner,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty tenant: %v", err)
	}
	if _, err := service.ListCustomers(context.Background(), ListCommand{
		Scope: testScope, ActorRole: business.UserRoleAdmin,
	}); err != nil {
		t.Fatalf("admin role may read: %v", err)
	}
}

// --- profile ---

func TestGetCustomerLadderBlanking(t *testing.T) {
	profile := ports.CRMCustomerProfile{
		CustomerID: testCustomerID, DisplayName: "Ama", Phone: "0244000001",
		OrdersCount: 2, TotalSpendMinor: 40000, Note: "prefers loose fit", Tags: []string{"VIP"},
		Orders:       []ports.CRMOrderSummary{{OrderID: "o1", Status: "confirmed"}},
		Measurements: []ports.CRMMeasurement{{MeasurementID: "m1", Source: "shop"}},
	}

	free := &fakeCRMRepo{profile: profile}
	result, err := serviceWith(t, LevelBasic, free).GetCustomer(context.Background(), ownerCmd())
	if err != nil {
		t.Fatalf("profile: %v", err)
	}
	if result.Profile.OrdersCount != 0 || result.Profile.TotalSpendMinor != 0 ||
		result.Profile.Note != "" || result.Profile.Tags != nil {
		t.Fatalf("free profile blanks the Starter+/Growth+ fields: %+v", result.Profile)
	}
	// §15.1: full order history + saved measurements are on EVERY plan.
	if len(result.Profile.Orders) != 1 || len(result.Profile.Measurements) != 1 {
		t.Fatalf("free keeps history + measurements: %+v", result.Profile)
	}

	standard := &fakeCRMRepo{profile: profile}
	result, err = serviceWith(t, LevelStandard, standard).GetCustomer(context.Background(), ownerCmd())
	if err != nil {
		t.Fatalf("profile: %v", err)
	}
	if result.Profile.TotalSpendMinor != 40000 || result.Profile.Note != "prefers loose fit" {
		t.Fatalf("standard keeps spend + notes: %+v", result.Profile)
	}
	if result.Profile.Tags != nil {
		t.Fatalf("tags still Growth+: %+v", result.Profile)
	}
}

func TestGetCustomerNotFoundPropagates(t *testing.T) {
	repo := &fakeCRMRepo{err: ports.ErrNotFound}
	// Cross-tenant reads fail closed as 404 from the repository (§6).
	if _, err := serviceWith(t, LevelAdvanced, repo).GetCustomer(context.Background(), ownerCmd()); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("not found: %v", err)
	}
	cmd := ownerCmd()
	cmd.CustomerID = ""
	if _, err := serviceWith(t, LevelAdvanced, repo).GetCustomer(context.Background(), cmd); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty id: %v", err)
	}
}

// --- notes ---

func TestPutNoteLadderAndValidation(t *testing.T) {
	repo := &fakeCRMRepo{note: ports.CRMCustomerNote{Note: "prefers loose fit", UpdatedAt: testNow}}
	if _, err := serviceWith(t, LevelBasic, repo).PutNote(context.Background(), NoteCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID, Note: "hi",
	}); !errors.Is(err, ErrCRMNotEntitled) {
		t.Fatalf("notes are Starter+: %v", err)
	}
	if repo.called("upsert_note") {
		t.Fatalf("refused write reached the repository")
	}

	saved, err := serviceWith(t, LevelStandard, repo).PutNote(context.Background(), NoteCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID, Note: "  prefers loose fit  ",
	})
	if err != nil {
		t.Fatalf("put note: %v", err)
	}
	if repo.lastNote != "prefers loose fit" || saved.Note != "prefers loose fit" {
		t.Fatalf("note trimmed + echoed: %q %+v", repo.lastNote, saved)
	}

	for _, bad := range []string{"", "   "} {
		if _, err := serviceWith(t, LevelStandard, repo).PutNote(context.Background(), NoteCommand{
			Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID, Note: bad,
		}); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("empty note: %v", err)
		}
	}

	// A customer with no relationship to THIS store 404s (§6) — the repo
	// refuses, the service propagates.
	stranger := &fakeCRMRepo{err: ports.ErrNotFound}
	if _, err := serviceWith(t, LevelStandard, stranger).PutNote(context.Background(), NoteCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID, Note: "hi",
	}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("cross-tenant note: %v", err)
	}
}

// --- tags ---

func TestPutTagsLadderReplaceAndNormalize(t *testing.T) {
	repo := &fakeCRMRepo{}
	if _, err := serviceWith(t, LevelStandard, repo).PutTags(context.Background(), TagsCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID, Tags: []string{"VIP"},
	}); !errors.Is(err, ErrCRMNotEntitled) {
		t.Fatalf("tags are Growth+: %v", err)
	}
	if repo.called("replace_tags") {
		t.Fatalf("refused write reached the repository")
	}

	tags, err := serviceWith(t, LevelFull, repo).PutTags(context.Background(), TagsCommand{
		Scope:      testScope,
		ActorRole:  business.UserRoleOwner,
		CustomerID: testCustomerID,
		Tags:       []string{" VIP ", "wholesale", "VIP", "bride"},
	})
	if err != nil {
		t.Fatalf("put tags: %v", err)
	}
	want := []string{"VIP", "wholesale", "bride"}
	if len(tags) != len(want) {
		t.Fatalf("trim + dedupe preserving order/case: %v", tags)
	}
	for i := range want {
		if tags[i] != want[i] {
			t.Fatalf("tags: %v want %v", tags, want)
		}
	}
	if len(repo.lastTags) != 3 {
		t.Fatalf("normalized set reaches the repo: %v", repo.lastTags)
	}

	if _, err := serviceWith(t, LevelFull, repo).PutTags(context.Background(), TagsCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID, Tags: []string{"  "},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty tag: %v", err)
	}
	tooMany := make([]string, maxTags+1)
	for i := range tooMany {
		tooMany[i] = "t"
	}
	if _, err := serviceWith(t, LevelFull, repo).PutTags(context.Background(), TagsCommand{
		Scope: testScope, ActorRole: business.UserRoleOwner, CustomerID: testCustomerID, Tags: tooMany,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("tag count bound: %v", err)
	}
}

// --- insights ---

func TestInsightsLadder(t *testing.T) {
	repo := &fakeCRMRepo{insights: ports.CRMInsights{NewCustomers30d: 1, ReturningCustomers: 2}}
	if _, err := serviceWith(t, LevelStandard, repo).Insights(context.Background(), ownerCmd()); !errors.Is(err, ErrCRMNotEntitled) {
		t.Fatalf("insights are Growth+: %v", err)
	}
	if repo.called("insights") {
		t.Fatalf("refused read reached the repository")
	}
	result, err := serviceWith(t, LevelFull, repo).Insights(context.Background(), ownerCmd())
	if err != nil {
		t.Fatalf("insights: %v", err)
	}
	if result.NewCustomers30d != 1 || result.ReturningCustomers != 2 {
		t.Fatalf("insights: %+v", result)
	}
}

func ptrInt64(value int64) *int64 { return &value }
