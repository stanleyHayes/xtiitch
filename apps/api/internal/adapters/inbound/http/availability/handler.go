package availabilityhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	availabilityapp "github.com/xcreativs/xtiitch/apps/api/internal/application/availability"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	maxBodyBytes    = 1 << 20
	maxRangeDays    = 28
	defaultRangeDay = 14
)

type Service interface {
	DefineAvailability(ctx context.Context, command availabilityapp.DefineAvailabilityCommand) error
	ListWindows(ctx context.Context, scope common.TenantScope) ([]booking.Window, error)
	ListStoreAvailability(ctx context.Context, handle string, from, to time.Time) ([]booking.Slot, error)
	MarkDayUnavailable(ctx context.Context, command availabilityapp.MarkDayCommand) error
	ClearUnavailableDay(ctx context.Context, command availabilityapp.MarkDayCommand) error
	ListBlackouts(ctx context.Context, scope common.TenantScope, from, to time.Time) ([]time.Time, error)
}

type Handler struct {
	service       Service
	authenticator authhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Get("/public/stores/{handle}/availability", handler.publicAvailability)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Post("/availability/windows", handler.defineWindows)
		protected.Get("/availability", handler.listWindows)
		protected.Get("/availability/blackouts", handler.listBlackouts)
		protected.Post("/availability/blackouts", handler.markDayUnavailable)
		protected.Delete("/availability/blackouts/{date}", handler.clearUnavailableDay)
	})
}

func (handler Handler) publicAvailability(w http.ResponseWriter, r *http.Request) {
	from := parseTimeOr(r.URL.Query().Get("from"), time.Now().UTC())
	to := parseTimeOr(r.URL.Query().Get("to"), from.AddDate(0, 0, defaultRangeDay))
	if max := from.AddDate(0, 0, maxRangeDays); to.After(max) {
		to = max
	}
	if !to.After(from) {
		writeError(w, http.StatusBadRequest, "invalid_range")
		return
	}

	slots, err := handler.service.ListStoreAvailability(r.Context(), chi.URLParam(r, "handle"), from, to)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	out := make([]map[string]any, 0, len(slots))
	for _, slot := range slots {
		out = append(out, map[string]any{
			"slot_start": slot.Start.Format(time.RFC3339),
			"slot_end":   slot.End.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"slots": out})
}

type windowBody struct {
	Weekday      int    `json:"weekday"`
	StartMinute  int    `json:"start_minute"`
	EndMinute    int    `json:"end_minute"`
	SlotMinutes  int    `json:"slot_minutes"`
	Recurrence   string `json:"recurrence"`
	DayOfMonth   int    `json:"day_of_month"`
	SpecificDate string `json:"specific_date"` // "YYYY-MM-DD"; required for recurrence "date"
}

const dateLayout = "2006-01-02"

type defineWindowsBody struct {
	Windows []windowBody `json:"windows"`
}

func (handler Handler) defineWindows(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body defineWindowsBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	windows := make([]availabilityapp.WindowInput, 0, len(body.Windows))
	for _, win := range body.Windows {
		var specificDate time.Time
		if win.SpecificDate != "" {
			parsed, err := time.Parse(dateLayout, win.SpecificDate)
			if err != nil {
				writeError(w, http.StatusBadRequest, "invalid_request")
				return
			}
			specificDate = parsed
		}
		windows = append(windows, availabilityapp.WindowInput{
			Weekday:      win.Weekday,
			StartMinute:  win.StartMinute,
			EndMinute:    win.EndMinute,
			SlotMinutes:  win.SlotMinutes,
			Recurrence:   win.Recurrence,
			DayOfMonth:   win.DayOfMonth,
			SpecificDate: specificDate,
		})
	}
	if err := handler.service.DefineAvailability(r.Context(), availabilityapp.DefineAvailabilityCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		Windows:   windows,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"windows": len(windows)})
}

func (handler Handler) listWindows(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	windows, err := handler.service.ListWindows(r.Context(), principal.TenantScope())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(windows))
	for _, win := range windows {
		entry := map[string]any{
			"weekday":      win.Weekday,
			"start_minute": win.StartMinute,
			"end_minute":   win.EndMinute,
			"slot_minutes": win.SlotMinutes,
			"recurrence":   win.Recurrence,
			"day_of_month": win.DayOfMonth,
		}
		if !win.SpecificDate.IsZero() {
			entry["specific_date"] = win.SpecificDate.Format(dateLayout)
		}
		out = append(out, entry)
	}
	writeJSON(w, http.StatusOK, map[string]any{"windows": out})
}

type blackoutBody struct {
	Date string `json:"date"` // "YYYY-MM-DD"
}

func (handler Handler) markDayUnavailable(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body blackoutBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	date, err := time.Parse(dateLayout, body.Date)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.MarkDayUnavailable(r.Context(), availabilityapp.MarkDayCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		Date:      date,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"date": date.Format(dateLayout)})
}

func (handler Handler) clearUnavailableDay(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	date, err := time.Parse(dateLayout, chi.URLParam(r, "date"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.ClearUnavailableDay(r.Context(), availabilityapp.MarkDayCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		Date:      date,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"date": date.Format(dateLayout)})
}

func (handler Handler) listBlackouts(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	from := parseTimeOr(r.URL.Query().Get("from"), time.Now().UTC())
	to := parseTimeOr(r.URL.Query().Get("to"), from.AddDate(0, 0, defaultRangeDay))
	if max := from.AddDate(0, 0, maxRangeDays); to.After(max) {
		to = max
	}
	dates, err := handler.service.ListBlackouts(r.Context(), principal.TenantScope(), from, to)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]string, 0, len(dates))
	for _, date := range dates {
		out = append(out, date.UTC().Format(dateLayout))
	}
	writeJSON(w, http.StatusOK, map[string]any{"dates": out})
}

func parseTimeOr(value string, fallback time.Time) time.Time {
	if value == "" {
		return fallback
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.UTC()
	}
	return fallback
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, authdomain.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, availabilityapp.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "invalid_input")
	case errors.Is(err, availabilityapp.ErrStoreNotFound):
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
