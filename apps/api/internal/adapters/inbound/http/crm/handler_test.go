package crmhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	crmapp "github.com/xcreativs/xtiitch/apps/api/internal/application/crm"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

// --- fakes ---

type fakeVerifier struct {
	principal authhttp.Principal
	err       error
}

func (f fakeVerifier) VerifyAccessToken(_ context.Context, _ string) (ports.VerifiedAccessToken, error) {
	if f.err != nil {
		return ports.VerifiedAccessToken{}, f.err
	}
	return ports.VerifiedAccessToken{
		Subject:    f.principal.UserID,
		BusinessID: f.principal.BusinessID,
		Role:       f.principal.Role,
	}, nil
}

func (f fakeVerifier) VerifyMFAChallengeToken(_ context.Context, _ string) (ports.VerifiedAccessToken, error) {
	return ports.VerifiedAccessToken{}, errors.New("not supported")
}

type fakeService struct {
	listResult crmapp.ListResult
	profile    crmapp.ProfileResult
	note       ports.CRMCustomerNote
	tags       []string
	insights   ports.CRMInsights
	export     reportsapp.ExportedFile
	err        error
	calls      []string
	lastNote   string
	lastTags   []string
}

func (f *fakeService) ListCustomers(_ context.Context, _ crmapp.ListCommand) (crmapp.ListResult, error) {
	f.calls = append(f.calls, "list")
	return f.listResult, f.err
}

func (f *fakeService) GetCustomer(_ context.Context, _ crmapp.CustomerCommand) (crmapp.ProfileResult, error) {
	f.calls = append(f.calls, "profile")
	return f.profile, f.err
}

func (f *fakeService) PutNote(_ context.Context, cmd crmapp.NoteCommand) (ports.CRMCustomerNote, error) {
	f.calls = append(f.calls, "note")
	f.lastNote = cmd.Note
	return f.note, f.err
}

func (f *fakeService) PutTags(_ context.Context, cmd crmapp.TagsCommand) ([]string, error) {
	f.calls = append(f.calls, "tags")
	f.lastTags = cmd.Tags
	return f.tags, f.err
}

func (f *fakeService) Insights(_ context.Context, _ crmapp.CustomerCommand) (ports.CRMInsights, error) {
	f.calls = append(f.calls, "insights")
	return f.insights, f.err
}

func (f *fakeService) ExportCustomers(_ context.Context, _ crmapp.ExportCommand) (reportsapp.ExportedFile, error) {
	f.calls = append(f.calls, "export")
	return f.export, f.err
}

// --- harness ---

var testPrincipal = authhttp.Principal{
	BusinessID: "bbbbbbbb-0000-0000-0000-0000000000a1",
	UserID:     "bbbbbbbb-0000-0000-0000-0000000000u1",
	Role:       business.UserRoleOwner,
}

func testRouter(service *fakeService) chi.Router {
	router := chi.NewRouter()
	NewHandler(service, authhttp.NewAuthenticator(fakeVerifier{principal: testPrincipal})).Register(router)
	return router
}

func authedRequest(t *testing.T, method, target string, body string) *http.Request {
	t.Helper()
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, reader)
	req.Header.Set("Authorization", "Bearer test-token")
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

func decodeBody(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode %q: %v", recorder.Body.String(), err)
	}
	return payload
}

// --- route table (incl. the §15.3 no-create-endpoint assertion) ---

func TestRegisterExposesExactlyTheCRMRoutes(t *testing.T) {
	router := testRouter(&fakeService{})
	type route struct{ method, pattern string }
	got := map[route]bool{}
	if err := chi.Walk(router, func(method, pattern string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		got[route{method, pattern}] = true
		return nil
	}); err != nil {
		t.Fatalf("walk: %v", err)
	}
	want := []route{
		{http.MethodGet, "/crm/customers"},
		{http.MethodGet, "/crm/customers/insights"},
		{http.MethodGet, "/crm/customers/export"},
		{http.MethodGet, "/crm/customers/{customerID}"},
		{http.MethodPut, "/crm/customers/{customerID}/notes"},
		{http.MethodPut, "/crm/customers/{customerID}/tags"},
	}
	if len(got) != len(want) {
		t.Fatalf("route table: %v", got)
	}
	for _, expected := range want {
		if !got[expected] {
			t.Fatalf("missing %s %s in %v", expected.method, expected.pattern, got)
		}
	}
	// §15.3 auto-populated: customers arrive via the order flow ONLY. There
	// must be no create/update-customer route anywhere under /crm.
	for r := range got {
		if r.method == http.MethodPost || r.method == http.MethodDelete || r.method == http.MethodPatch {
			t.Fatalf("§15.3 forbids a manual customer write route, found %s %s", r.method, r.pattern)
		}
	}
}

func TestUnauthenticatedRequestsAreRefused(t *testing.T) {
	recorder := httptest.NewRecorder()
	testRouter(&fakeService{}).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/crm/customers", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("no token: %d", recorder.Code)
	}
}

// --- list ---

func TestListCustomersFreeShapeOmitsMoneyFigures(t *testing.T) {
	last := time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)
	service := &fakeService{listResult: crmapp.ListResult{
		Level: crmapp.LevelBasic, Total: 1, Limit: 50,
		Customers: []ports.CRMCustomerRow{{
			CustomerID: "cccccccc-0000-0000-0000-0000000000c1", DisplayName: "Ama",
			Phone: "0244000001", Source: "online", LastOrderAt: &last,
		}},
	}}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers?limit=10&offset=5", ""))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status: %d %s", recorder.Code, recorder.Body.String())
	}
	payload := decodeBody(t, recorder)
	customers := payload["customers"].([]any)
	row := customers[0].(map[string]any)
	if row["name"] != "Ama" || row["source"] != "online" {
		t.Fatalf("row: %v", row)
	}
	// Free rows expose the gated fields as explicit nulls (upgrade signal),
	// never fake zeros.
	if row["orders_count"] != nil || row["total_spend_minor"] != nil {
		t.Fatalf("free row: %v", row)
	}
	if _, present := row["tags"]; present {
		t.Fatalf("tags key must be absent below Growth: %v", row)
	}
	if payload["total"].(float64) != 1 {
		t.Fatalf("payload: %v", payload)
	}
}

func TestListCustomersRejectsBadPaging(t *testing.T) {
	service := &fakeService{}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers?limit=abc", ""))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("bad limit: %d", recorder.Code)
	}
}

func TestListCustomersEntitlementRefusalShape(t *testing.T) {
	service := &fakeService{err: crmapp.NotEntitledError{Feature: "search", RequiredLevel: 1, CurrentLevel: 0}}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers?q=ama", ""))
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status: %d", recorder.Code)
	}
	payload := decodeBody(t, recorder)
	if payload["error"] != "crm_not_entitled" || payload["feature"] != "search" ||
		payload["crm_level_name"] != "basic" || payload["required_level_name"] != "standard" {
		t.Fatalf("403 payload: %v", payload)
	}
}

// --- static sub-resources must not collide with the {customerID} wildcard ---

func TestInsightsAndExportRoutesDoNotHitTheProfile(t *testing.T) {
	service := &fakeService{insights: ports.CRMInsights{NewCustomers30d: 2, ReturningCustomers: 5}}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers/insights", ""))
	if recorder.Code != http.StatusOK || len(service.calls) != 1 || service.calls[0] != "insights" {
		t.Fatalf("insights: %d calls=%v", recorder.Code, service.calls)
	}
	payload := decodeBody(t, recorder)
	if payload["new_customers_30d"].(float64) != 2 || payload["returning_customers"].(float64) != 5 {
		t.Fatalf("insights payload: %v", payload)
	}

	service = &fakeService{export: reportsapp.ExportedFile{
		Content: []byte("name,phone\nAma,0244\n"), ContentType: "text/csv; charset=utf-8",
		Filename: "xtiitch-customers-2026-07-19.csv",
	}}
	recorder = httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers/export?format=csv", ""))
	if recorder.Code != http.StatusOK || service.calls[0] != "export" {
		t.Fatalf("export: %d calls=%v", recorder.Code, service.calls)
	}
	if got := recorder.Header().Get("Content-Disposition"); got != `attachment; filename="xtiitch-customers-2026-07-19.csv"` {
		t.Fatalf("content-disposition: %q", got)
	}
	if !strings.Contains(recorder.Body.String(), "Ama") {
		t.Fatalf("export body: %q", recorder.Body.String())
	}
}

// --- profile / notes / tags ---

func TestGetCustomerNotFound(t *testing.T) {
	service := &fakeService{err: ports.ErrNotFound}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers/cccccccc-0000-0000-0000-0000000000c9", ""))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status: %d", recorder.Code)
	}
	if decodeBody(t, recorder)["error"] != "not_found" {
		t.Fatalf("payload: %v", decodeBody(t, recorder))
	}
}

func TestPutNoteRoundTrip(t *testing.T) {
	service := &fakeService{note: ports.CRMCustomerNote{Note: "prefers loose fit", UpdatedAt: time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)}}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodPut,
		"/crm/customers/cccccccc-0000-0000-0000-0000000000c1/notes", `{"note":"prefers loose fit"}`))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status: %d %s", recorder.Code, recorder.Body.String())
	}
	if service.lastNote != "prefers loose fit" {
		t.Fatalf("note forwarded: %q", service.lastNote)
	}
	payload := decodeBody(t, recorder)
	if payload["note"] != "prefers loose fit" || payload["updated_at"] == nil {
		t.Fatalf("payload: %v", payload)
	}
}

func TestPutTagsReplace(t *testing.T) {
	service := &fakeService{tags: []string{"VIP", "bride"}}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodPut,
		"/crm/customers/cccccccc-0000-0000-0000-0000000000c1/tags", `{"tags":["VIP","bride"]}`))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status: %d %s", recorder.Code, recorder.Body.String())
	}
	if len(service.lastTags) != 2 || service.lastTags[0] != "VIP" {
		t.Fatalf("tags forwarded: %v", service.lastTags)
	}
}

func TestWriteEndpointsRejectUnknownFields(t *testing.T) {
	service := &fakeService{}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodPut,
		"/crm/customers/cccccccc-0000-0000-0000-0000000000c1/notes", `{"note":"x","hack":true}`))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unknown field: %d", recorder.Code)
	}
}

func TestForbiddenRoleMapsTo403(t *testing.T) {
	service := &fakeService{err: authdomain.ErrForbidden}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers", ""))
	if recorder.Code != http.StatusForbidden || decodeBody(t, recorder)["error"] != "forbidden" {
		t.Fatalf("forbidden: %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestExportNotEntitledMapsTo403(t *testing.T) {
	service := &fakeService{err: reportsapp.ErrExportNotEntitled}
	recorder := httptest.NewRecorder()
	testRouter(service).ServeHTTP(recorder, authedRequest(t, http.MethodGet, "/crm/customers/export?format=pdf", ""))
	if recorder.Code != http.StatusForbidden || decodeBody(t, recorder)["error"] != "export_not_entitled" {
		t.Fatalf("export gate: %d %s", recorder.Code, recorder.Body.String())
	}
}
