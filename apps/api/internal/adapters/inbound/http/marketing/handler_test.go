package marketinghttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	adminauthhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/adminauth"
	marketingapp "github.com/xcreativs/xtiitch/apps/api/internal/application/marketingwaitlist"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

type stubService struct{ called bool }

func (s *stubService) Submit(context.Context, marketingapp.SubmitCommand) (ports.WaitlistLeadRecord, error) {
	return ports.WaitlistLeadRecord{}, nil
}

func (s *stubService) ListLeads(context.Context, int) ([]ports.WaitlistLeadRecord, error) {
	s.called = true
	return []ports.WaitlistLeadRecord{{Name: "Ama", Email: "ama@example.com", Phone: "+233555000000"}}, nil
}

// roleCatalogue answers from the static role model, which is enough to prove the
// boundary is enforced at all.
type roleCatalogue struct{}

func (roleCatalogue) HasPermission(_ context.Context, role admindomain.Role, permission admindomain.Permission) error {
	for _, candidate := range role.Permissions() {
		if candidate == permission {
			return nil
		}
	}
	return authdomain.ErrForbidden
}

// A marketing lead carries a person's name, phone, email and free-text message.
// Holding a valid admin token is not authority to read it: support staff are
// scoped to support and audit, and the console already tells them so.
func TestLeadsRequiresManageGrowth(t *testing.T) {
	for _, tc := range []struct {
		name       string
		role       admindomain.Role
		wantStatus int
		wantServed bool
	}{
		{"support cannot read leads", admindomain.RoleSupport, http.StatusForbidden, false},
		{"operator can read leads", admindomain.RoleOperator, http.StatusOK, true},
		{"owner can read leads", admindomain.RoleOwner, http.StatusOK, true},
		{"unknown role cannot read leads", admindomain.Role("intern"), http.StatusForbidden, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := &stubService{}
			handler := NewHandler(service, nil, roleCatalogue{})

			request := httptest.NewRequest(http.MethodGet, "/admin/waitlist", nil)
			request = request.WithContext(adminauthhttp.ContextWithPrincipal(
				request.Context(),
				adminauthhttp.Principal{Role: tc.role},
			))
			recorder := httptest.NewRecorder()
			handler.leads(recorder, request)

			if recorder.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, tc.wantStatus)
			}
			if service.called != tc.wantServed {
				t.Fatalf("ListLeads called = %v, want %v", service.called, tc.wantServed)
			}
			if !tc.wantServed && recorder.Body.Len() > 0 {
				var body map[string]any
				_ = json.Unmarshal(recorder.Body.Bytes(), &body)
				if _, leaked := body["leads"]; leaked {
					t.Fatal("refused response still carried leads")
				}
			}
		})
	}
}

// Without a principal the request is refused rather than served, so a route
// mounted without the authentication middleware cannot silently expose leads.
func TestLeadsWithoutPrincipalIsRefused(t *testing.T) {
	service := &stubService{}
	handler := NewHandler(service, nil, roleCatalogue{})

	recorder := httptest.NewRecorder()
	handler.leads(recorder, httptest.NewRequest(http.MethodGet, "/admin/waitlist", nil))

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
	if service.called {
		t.Fatal("leads were listed for a request with no principal")
	}
}
