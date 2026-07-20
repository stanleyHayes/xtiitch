// Package internalhttp exposes the /v1/internal/* trigger endpoints the worker
// calls on a timer (§13.3 sweeps, §14.1 scheduled reports, §3.3 settlement
// sync). The worker cannot hold admin credentials, so these endpoints are
// guarded by a shared internal token (X-Internal-Token header against
// XTIITCH_INTERNAL_TOKEN) instead of the admin JWT — and each one calls the
// SAME service method the admin console endpoint calls, acting as the locked
// system actor (adminauth.SystemActorUserID, migration 000112) so the audit
// trail attributes scheduler runs to the system, never to a human admin.
//
// With no token configured the endpoints do not exist at all (the handler
// registers no routes, so the router answers 404) — production must set
// XTIITCH_INTERNAL_TOKEN or the scheduled sweeps stay disabled.
//
// (The directory is "internalsweeps" rather than "internal" because a path
// segment literally named internal would trip Go's internal-package import
// rule for the bootstrap package.)
package internalhttp

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

// AdminSweepService is the adminauth service surface the internal triggers
// call — the same methods the admin endpoints call.
type AdminSweepService interface {
	RunSubscriptionRecurringSweep(
		ctx context.Context,
		command adminauthapp.RunSubscriptionRecurringSweepCommand,
	) (ports.AdminSubscriptionRecurringSweepRecord, error)
	RunSubscriptionReminderSweep(
		ctx context.Context,
		command adminauthapp.RunSubscriptionReminderSweepCommand,
	) (ports.AdminSubscriptionReminderSweepRecord, error)
	RunSettlementSync(
		ctx context.Context,
		command adminauthapp.RunSettlementSyncCommand,
	) (ports.AdminSettlementSyncRecord, error)
}

// ReportsSweepService is the reports service surface the internal trigger
// calls — the same method the admin endpoint calls.
type ReportsSweepService interface {
	RunDueSchedules(ctx context.Context, cmd reportsapp.RunSchedulesCommand) (reportsapp.RunSchedulesResult, error)
}

type Handler struct {
	token   string
	admin   AdminSweepService
	reports ReportsSweepService
}

// NewHandler builds the internal trigger handler. An empty token DISABLES the
// endpoints: Register then registers nothing and every /v1/internal/* path is
// a 404, so a deploy without the token cannot be poked into running sweeps.
func NewHandler(token string, admin AdminSweepService, reports ReportsSweepService) Handler {
	return Handler{token: strings.TrimSpace(token), admin: admin, reports: reports}
}

func (handler Handler) Register(router chi.Router) {
	if handler.token == "" {
		return
	}
	router.Group(func(internal chi.Router) {
		internal.Use(handler.requireInternalToken)
		internal.Post("/internal/sweeps/recurring-charges", handler.recurringCharges)
		internal.Post("/internal/sweeps/renewal-reminders", handler.renewalReminders)
		internal.Post("/internal/reports/run-scheduled", handler.runScheduledReports)
		internal.Post("/internal/settlements/sync", handler.settlementSync)
	})
}

// requireInternalToken compares the X-Internal-Token header against the
// configured token in constant time — this header is the ONLY credential these
// endpoints accept.
func (handler Handler) requireInternalToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		provided := strings.TrimSpace(r.Header.Get("X-Internal-Token"))
		if provided == "" ||
			subtle.ConstantTimeCompare([]byte(provided), []byte(handler.token)) != 1 {
			writeError(w, http.StatusUnauthorized, "invalid_token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (handler Handler) recurringCharges(w http.ResponseWriter, r *http.Request) {
	record, err := handler.admin.RunSubscriptionRecurringSweep(r.Context(), adminauthapp.RunSubscriptionRecurringSweepCommand{
		ActorUserID: adminauthapp.SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
		Reason:      "Scheduled worker recurring charge sweep.",
		UserAgent:   r.UserAgent(),
		IPAddress:   remoteIP(r),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"due_subscriptions":              record.DueSubscriptions,
		"charges_attempted":              record.ChargesAttempted,
		"charges_paid":                   record.ChargesPaid,
		"charges_pending":                record.ChargesPending,
		"charges_failed":                 record.ChargesFailed,
		"charges_skipped":                record.ChargesSkipped,
		"subscriptions_awaiting_cadence": record.SubscriptionsAwaitingCadence,
		"reminders_enqueued":             record.RemindersEnqueued,
		"ran_at":                         record.RanAt,
	})
}

func (handler Handler) renewalReminders(w http.ResponseWriter, r *http.Request) {
	record, err := handler.admin.RunSubscriptionReminderSweep(r.Context(), adminauthapp.RunSubscriptionReminderSweepCommand{
		ActorUserID: adminauthapp.SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
		Reason:      "Scheduled worker renewal reminder sweep.",
		UserAgent:   r.UserAgent(),
		IPAddress:   remoteIP(r),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"subscriptions_evaluated": record.SubscriptionsEvaluated,
		"reminders_enqueued":      record.RemindersEnqueued,
		"emails_sent":             record.EmailsSent,
		"emails_failed":           record.EmailsFailed,
		"ran_at":                  record.RanAt,
	})
}

func (handler Handler) runScheduledReports(w http.ResponseWriter, r *http.Request) {
	result, err := handler.reports.RunDueSchedules(r.Context(), reportsapp.RunSchedulesCommand{
		ActorRole: admindomain.RoleOwner,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, map[string]any{
			"business_id": item.BusinessID.String(),
			"report":      item.ReportKind,
			"format":      item.Format,
			"generated":   item.Generated,
			"delivered":   item.Delivered,
			"detail":      item.Detail,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"count": len(items), "results": items})
}

func (handler Handler) settlementSync(w http.ResponseWriter, r *http.Request) {
	record, err := handler.admin.RunSettlementSync(r.Context(), adminauthapp.RunSettlementSyncCommand{
		ActorUserID: adminauthapp.SystemActorUserID,
		ActorRole:   admindomain.RoleOwner,
		UserAgent:   r.UserAgent(),
		IPAddress:   remoteIP(r),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"synced":   record.Synced,
		"skipped":  record.Skipped,
		"failed":   record.Failed,
		"upserted": record.Upserted,
	})
}

// remoteIP is the client address for the audit trail; the trusted-proxy
// middleware has already rewritten RemoteAddr when the API sits behind one.
func remoteIP(r *http.Request) string {
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx > 0 {
		host = host[:idx]
	}
	return strings.TrimSpace(host)
}

// writeServiceError maps the service error vocabulary to stable codes. These
// endpoints are machine-called, so the body stays a bare error code.
func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, authdomain.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "invalid_input")
	case errors.Is(err, authdomain.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	default:
		writeError(w, http.StatusInternalServerError, "internal_error")
	}
}
