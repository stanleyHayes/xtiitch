// Package reportshttp exposes the §14.3/§14.4 business-facing report exports
// (/v1/reports/*), the scheduled-report config, and the internal sweep the
// platform runs to email due scheduled reports.
package reportshttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/adminauth"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	analyticsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/analytics"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const maxBodyBytes = 1 << 20

type Service interface {
	ExportFinancial(ctx context.Context, cmd reportsapp.ExportCommand) (reportsapp.ExportedFile, error)
	ExportSales(ctx context.Context, cmd reportsapp.ExportCommand) (reportsapp.ExportedFile, error)
	ExportFull(ctx context.Context, cmd reportsapp.ExportCommand) (reportsapp.ExportedFile, error)
	GetSchedule(ctx context.Context, scope common.TenantScope, role business.UserRole) (ports.ReportSchedule, error)
	PutSchedule(ctx context.Context, cmd reportsapp.PutScheduleCommand) (ports.ReportSchedule, error)
	RunDueSchedules(ctx context.Context, cmd reportsapp.RunSchedulesCommand) (reportsapp.RunSchedulesResult, error)
}

type Handler struct {
	service            Service
	authenticator      authhttp.Authenticator
	adminAuthenticator adminauthhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator, adminAuthenticator adminauthhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator, adminAuthenticator: adminAuthenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/reports/financial", handler.exportFinancial)
		protected.Get("/reports/sales", handler.exportSales)
		protected.Get("/reports/full", handler.exportFull)
		protected.Get("/reports/schedule", handler.getSchedule)
		protected.Put("/reports/schedule", handler.putSchedule)
	})
	// The platform sweep lives behind ADMIN auth (§14.1 scheduled reports);
	// the worker triggers it on a timer via /v1/internal/reports/run-scheduled
	// (same service method, system actor).
	router.Group(func(admin chi.Router) {
		admin.Use(handler.adminAuthenticator.Middleware)
		admin.Post("/admin/reports/run-scheduled", handler.runScheduled)
	})
}

func (handler Handler) exportCommand(r *http.Request) (reportsapp.ExportCommand, bool) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		return reportsapp.ExportCommand{}, false
	}
	query := r.URL.Query()
	return reportsapp.ExportCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		Format:    query.Get("format"),
		From:      query.Get("from"),
		To:        query.Get("to"),
	}, true
}

func (handler Handler) writeExport(w http.ResponseWriter, r *http.Request, export func(reportsapp.ExportCommand) (reportsapp.ExportedFile, error)) {
	cmd, ok := handler.exportCommand(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	file, err := export(cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	w.Header().Set("Content-Type", file.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", file.Filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(file.Content)
}

func (handler Handler) exportFinancial(w http.ResponseWriter, r *http.Request) {
	handler.writeExport(w, r, func(cmd reportsapp.ExportCommand) (reportsapp.ExportedFile, error) {
		return handler.service.ExportFinancial(r.Context(), cmd)
	})
}

func (handler Handler) exportSales(w http.ResponseWriter, r *http.Request) {
	handler.writeExport(w, r, func(cmd reportsapp.ExportCommand) (reportsapp.ExportedFile, error) {
		return handler.service.ExportSales(r.Context(), cmd)
	})
}

func (handler Handler) exportFull(w http.ResponseWriter, r *http.Request) {
	handler.writeExport(w, r, func(cmd reportsapp.ExportCommand) (reportsapp.ExportedFile, error) {
		return handler.service.ExportFull(r.Context(), cmd)
	})
}

// --- scheduled reports config (§14.1) ---

func scheduleResponse(schedule ports.ReportSchedule) map[string]any {
	var lastSentAt any
	if schedule.LastSentAt != nil {
		lastSentAt = schedule.LastSentAt.Format(time.RFC3339)
	}
	return map[string]any{
		"report":       schedule.ReportKind,
		"format":       schedule.Format,
		"cadence":      schedule.Cadence,
		"email":        schedule.Email,
		"enabled":      schedule.Enabled,
		"last_sent_at": lastSentAt,
	}
}

func (handler Handler) getSchedule(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	schedule, err := handler.service.GetSchedule(r.Context(), principal.TenantScope(), principal.Role)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"schedule": scheduleResponse(schedule)})
}

type putScheduleBody struct {
	ReportKind string `json:"report"`
	Format     string `json:"format"`
	Cadence    string `json:"cadence"`
	Email      string `json:"email"`
	Enabled    bool   `json:"enabled"`
}

func (handler Handler) putSchedule(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body putScheduleBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	schedule, err := handler.service.PutSchedule(r.Context(), reportsapp.PutScheduleCommand{
		Scope:      principal.TenantScope(),
		ActorRole:  principal.Role,
		ReportKind: body.ReportKind,
		Format:     body.Format,
		Cadence:    body.Cadence,
		Email:      body.Email,
		Enabled:    body.Enabled,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"schedule": scheduleResponse(schedule)})
}

// runScheduled is the internal sweep (admin auth): generate every due
// scheduled report and deliver it. See reportsapp.RunDueSchedules for why
// delivery is API-side email rather than the notification outbox.
func (handler Handler) runScheduled(w http.ResponseWriter, r *http.Request) {
	principal, ok := adminauthhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.RunDueSchedules(r.Context(), reportsapp.RunSchedulesCommand{
		ActorRole: principal.Role,
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

// writeServiceError maps the reports error vocabulary to stable codes.
func writeServiceError(w http.ResponseWriter, err error) {
	var notEntitled analyticsapp.NotEntitledError
	switch {
	case errors.As(err, &notEntitled):
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error":                "analytics_not_entitled",
			"feature":              notEntitled.Feature,
			"analytics_level":      notEntitled.CurrentLevel,
			"analytics_level_name": business.CapabilityLevel(notEntitled.CurrentLevel),
			"required_level":       notEntitled.RequiredLevel,
			"required_level_name":  business.CapabilityLevel(notEntitled.RequiredLevel),
		})
	case errors.Is(err, reportsapp.ErrExportNotEntitled):
		writeError(w, http.StatusForbidden, "export_not_entitled")
	case errors.Is(err, reportsapp.ErrScheduledReportsNotEntitled):
		writeError(w, http.StatusForbidden, "scheduled_reports_not_entitled")
	case errors.Is(err, authdomain.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, reportsapp.ErrUnknownFormat):
		writeError(w, http.StatusBadRequest, "invalid_format")
	case errors.Is(err, reportsapp.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "invalid_input")
	case errors.Is(err, ports.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found")
	default:
		writeError(w, http.StatusInternalServerError, "internal_error")
	}
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	var trailing struct{}
	if err := decoder.Decode(&trailing); err != io.EOF {
		return errors.New("request body must contain a single JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
