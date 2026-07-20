package internalhttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

type fakeAdminSweeps struct {
	recurringCmd  adminauthapp.RunSubscriptionRecurringSweepCommand
	reminderCmd   adminauthapp.RunSubscriptionReminderSweepCommand
	settlementCmd adminauthapp.RunSettlementSyncCommand
	err           error
}

func (fake *fakeAdminSweeps) RunSubscriptionRecurringSweep(
	_ context.Context,
	cmd adminauthapp.RunSubscriptionRecurringSweepCommand,
) (ports.AdminSubscriptionRecurringSweepRecord, error) {
	fake.recurringCmd = cmd
	return ports.AdminSubscriptionRecurringSweepRecord{ChargesPaid: 2}, fake.err
}

func (fake *fakeAdminSweeps) RunSubscriptionReminderSweep(
	_ context.Context,
	cmd adminauthapp.RunSubscriptionReminderSweepCommand,
) (ports.AdminSubscriptionReminderSweepRecord, error) {
	fake.reminderCmd = cmd
	return ports.AdminSubscriptionReminderSweepRecord{RemindersEnqueued: 3, EmailsSent: 3}, fake.err
}

func (fake *fakeAdminSweeps) RunSettlementSync(
	_ context.Context,
	cmd adminauthapp.RunSettlementSyncCommand,
) (ports.AdminSettlementSyncRecord, error) {
	fake.settlementCmd = cmd
	return ports.AdminSettlementSyncRecord{Synced: 4, Upserted: 9}, fake.err
}

type fakeReportsSweeps struct {
	ran bool
	err error
}

func (fake *fakeReportsSweeps) RunDueSchedules(
	_ context.Context,
	cmd reportsapp.RunSchedulesCommand,
) (reportsapp.RunSchedulesResult, error) {
	fake.ran = true
	if cmd.ActorRole != admindomain.RoleOwner {
		return reportsapp.RunSchedulesResult{}, errors.New("expected the owner role")
	}
	return reportsapp.RunSchedulesResult{}, fake.err
}

func newTestRouter(token string, admin *fakeAdminSweeps, reports *fakeReportsSweeps) *chi.Mux {
	router := chi.NewRouter()
	router.Route("/v1", func(v1 chi.Router) {
		NewHandler(token, admin, reports).Register(v1)
	})
	return router
}

func post(router http.Handler, path string, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, path, nil)
	if token != "" {
		request.Header.Set("X-Internal-Token", token)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

// The worker triggers each sweep through its internal endpoint; every call
// must arrive at the SAME service method the admin endpoint calls, acting as
// the locked system actor (never a human admin).
func TestInternalEndpointsCallThroughAsSystemActor(t *testing.T) {
	t.Parallel()

	admin := &fakeAdminSweeps{}
	reports := &fakeReportsSweeps{}
	router := newTestRouter("secret-token", admin, reports)

	cases := []struct {
		path  string
		check func() bool
	}{
		{"/v1/internal/sweeps/recurring-charges", func() bool {
			return admin.recurringCmd.ActorUserID == adminauthapp.SystemActorUserID &&
				admin.recurringCmd.ActorRole == admindomain.RoleOwner
		}},
		{"/v1/internal/sweeps/renewal-reminders", func() bool {
			return admin.reminderCmd.ActorUserID == adminauthapp.SystemActorUserID &&
				admin.reminderCmd.ActorRole == admindomain.RoleOwner
		}},
		{"/v1/internal/settlements/sync", func() bool {
			return admin.settlementCmd.ActorUserID == adminauthapp.SystemActorUserID &&
				admin.settlementCmd.ActorRole == admindomain.RoleOwner
		}},
		{"/v1/internal/reports/run-scheduled", func() bool { return reports.ran }},
	}
	for _, tc := range cases {
		response := post(router, tc.path, "secret-token")
		if response.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d (%s)", tc.path, response.Code, response.Body.String())
		}
		if !tc.check() {
			t.Fatalf("%s: service not called with the system actor", tc.path)
		}
	}
}

// The token middleware is the ONLY guard: a missing or wrong token is a 401,
// and with no token configured the endpoints do not exist at all (404).
func TestInternalEndpointsTokenMatrix(t *testing.T) {
	t.Parallel()

	admin := &fakeAdminSweeps{}
	reports := &fakeReportsSweeps{}
	router := newTestRouter("secret-token", admin, reports)
	paths := []string{
		"/v1/internal/sweeps/recurring-charges",
		"/v1/internal/sweeps/renewal-reminders",
		"/v1/internal/reports/run-scheduled",
		"/v1/internal/settlements/sync",
	}
	for _, path := range paths {
		if response := post(router, path, ""); response.Code != http.StatusUnauthorized {
			t.Fatalf("%s: missing token must be 401, got %d", path, response.Code)
		}
		if response := post(router, path, "wrong-token"); response.Code != http.StatusUnauthorized {
			t.Fatalf("%s: wrong token must be 401, got %d", path, response.Code)
		}
	}
	if admin.recurringCmd.ActorUserID != "" || reports.ran {
		t.Fatal("no service method may run without a valid token")
	}

	disabled := newTestRouter("", admin, reports)
	for _, path := range paths {
		if response := post(disabled, path, "anything"); response.Code != http.StatusNotFound {
			t.Fatalf("%s: empty configured token must disable the endpoint (404), got %d", path, response.Code)
		}
	}
}

func TestInternalEndpointsMapServiceErrors(t *testing.T) {
	t.Parallel()

	admin := &fakeAdminSweeps{err: errors.New("boom")}
	reports := &fakeReportsSweeps{}
	router := newTestRouter("secret-token", admin, reports)

	response := post(router, "/v1/internal/sweeps/recurring-charges", "secret-token")
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on a service error, got %d", response.Code)
	}

	admin.err = authdomain.ErrForbidden
	response = post(router, "/v1/internal/sweeps/recurring-charges", "secret-token")
	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403 on a forbidden service error, got %d", response.Code)
	}
}
