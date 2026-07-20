// Package crmhttp exposes the §15 Customer CRM endpoints: tenant-scoped,
// owner-auth, entitlement-gated customer list/profile/notes/tags/insights and
// the customer-list export under /v1/crm/*. There is deliberately NO
// create-customer route (§15.3 auto-populated from the order flow).
package crmhttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	crmapp "github.com/xcreativs/xtiitch/apps/api/internal/application/crm"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const maxBodyBytes = 1 << 20

type Service interface {
	ListCustomers(ctx context.Context, cmd crmapp.ListCommand) (crmapp.ListResult, error)
	GetCustomer(ctx context.Context, cmd crmapp.CustomerCommand) (crmapp.ProfileResult, error)
	PutNote(ctx context.Context, cmd crmapp.NoteCommand) (ports.CRMCustomerNote, error)
	PutTags(ctx context.Context, cmd crmapp.TagsCommand) ([]string, error)
	Insights(ctx context.Context, cmd crmapp.CustomerCommand) (ports.CRMInsights, error)
	ExportCustomers(ctx context.Context, cmd crmapp.ExportCommand) (reportsapp.ExportedFile, error)
}

type Handler struct {
	service       Service
	authenticator authhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/crm/customers", handler.listCustomers)
		// The two static sub-resources are registered before the {customerID}
		// wildcard so chi never routes "insights"/"export" to the profile.
		protected.Get("/crm/customers/insights", handler.insights)
		protected.Get("/crm/customers/export", handler.exportCustomers)
		protected.Get("/crm/customers/{customerID}", handler.getCustomer)
		protected.Put("/crm/customers/{customerID}/notes", handler.putNote)
		protected.Put("/crm/customers/{customerID}/tags", handler.putTags)
	})
}

func (handler Handler) principal(w http.ResponseWriter, r *http.Request) (authhttp.Principal, bool) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return authhttp.Principal{}, false
	}
	return principal, true
}

// listCustomers serves GET /v1/crm/customers (§15.1, all plans). Query params:
// q (Starter+), tag / segment=new|returning|lapsed / min_spend_minor /
// last_order_before / last_order_after (Growth+), limit / offset (paging).
func (handler Handler) listCustomers(w http.ResponseWriter, r *http.Request) {
	principal, ok := handler.principal(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	cmd := crmapp.ListCommand{
		Scope:           principal.TenantScope(),
		ActorRole:       principal.Role,
		Q:               query.Get("q"),
		Tag:             query.Get("tag"),
		Segment:         query.Get("segment"),
		LastOrderBefore: query.Get("last_order_before"),
		LastOrderAfter:  query.Get("last_order_after"),
	}
	if raw := query.Get("min_spend_minor"); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_input")
			return
		}
		cmd.MinSpendMinor = &value
	}
	limit, err := parseNonNegativeInt(query.Get("limit"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input")
		return
	}
	offset, err := parseNonNegativeInt(query.Get("offset"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input")
		return
	}
	cmd.Limit = limit
	cmd.Offset = offset

	result, err := handler.service.ListCustomers(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	customers := make([]map[string]any, 0, len(result.Customers))
	for _, customer := range result.Customers {
		customers = append(customers, customerRowResponse(customer, result.Level))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"crm_level": result.Level,
		"total":     result.Total,
		"limit":     result.Limit,
		"offset":    result.Offset,
		"customers": customers,
	})
}

// customerRowResponse renders one §15.1 list row. Spend/counts and tags are
// already blanked by the service below their ladder rungs; the nulls here make
// the gating VISIBLE to the dashboard ("upgrade to see") instead of faking a
// 0-spend customer — that is why Free rows omit rather than zero them.
func customerRowResponse(customer ports.CRMCustomerRow, level int) map[string]any {
	row := map[string]any{
		"customer_id": customer.CustomerID.String(),
		"name":        customer.DisplayName,
		"phone":       customer.Phone,
		"whatsapp":    customer.WhatsAppNumber,
		// Source is the first order's channel with this store ("online" /
		// "walk_in"); orders carry no other origin/store-source field.
		"source":        customer.Source,
		"last_order_at": optionalTimestamp(customer.LastOrderAt),
	}
	if level >= crmapp.LevelStandard {
		row["orders_count"] = customer.OrdersCount
		row["total_spend_minor"] = customer.TotalSpendMinor
	} else {
		row["orders_count"] = nil
		row["total_spend_minor"] = nil
	}
	if level >= crmapp.LevelFull {
		row["tags"] = customer.Tags
	}
	return row
}

// getCustomer serves GET /v1/crm/customers/{id} (§15.1, all plans): contact
// details (call/WhatsApp buttons), full order history with THIS store, saved
// measurements, plus the ladder-gated spend/counts (Starter+), note (Starter+)
// and tags (Growth+). Cross-tenant reads 404 (§6).
func (handler Handler) getCustomer(w http.ResponseWriter, r *http.Request) {
	principal, ok := handler.principal(w, r)
	if !ok {
		return
	}
	result, err := handler.service.GetCustomer(r.Context(), crmapp.CustomerCommand{
		Scope:      principal.TenantScope(),
		ActorRole:  principal.Role,
		CustomerID: common.ID(chi.URLParam(r, "customerID")),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	profile := result.Profile
	orders := make([]map[string]any, 0, len(profile.Orders))
	for _, order := range profile.Orders {
		var agreedTotal any
		if order.AgreedTotalMinor != nil {
			agreedTotal = *order.AgreedTotalMinor
		}
		orders = append(orders, map[string]any{
			"order_id":           order.OrderID.String(),
			"status":             order.Status,
			"agreed_total_minor": agreedTotal,
			"settled_minor":      order.SettledMinor,
			"created_at":         order.CreatedAt.Format(time.RFC3339),
		})
	}
	measurements := make([]map[string]any, 0, len(profile.Measurements))
	for _, measurement := range profile.Measurements {
		measurements = append(measurements, map[string]any{
			"measurement_id": measurement.MeasurementID.String(),
			"order_id":       measurement.OrderID.String(),
			"source":         measurement.Source,
			"values":         measurement.Values,
			"created_at":     measurement.CreatedAt.Format(time.RFC3339),
		})
	}
	response := map[string]any{
		"crm_level":      result.Level,
		"customer_id":    profile.CustomerID.String(),
		"name":           profile.DisplayName,
		"phone":          profile.Phone,
		"whatsapp":       profile.WhatsAppNumber,
		"email":          profile.Email,
		"source":         profile.Source,
		"first_order_at": optionalTimestamp(profile.FirstOrderAt),
		"last_order_at":  optionalTimestamp(profile.LastOrderAt),
		"orders":         orders,
		"measurements":   measurements,
	}
	if result.Level >= crmapp.LevelStandard {
		response["orders_count"] = profile.OrdersCount
		response["total_spend_minor"] = profile.TotalSpendMinor
		response["note"] = profile.Note
		response["note_updated_at"] = optionalTimestamp(profile.NoteUpdatedAt)
	} else {
		response["orders_count"] = nil
		response["total_spend_minor"] = nil
	}
	if result.Level >= crmapp.LevelFull {
		response["tags"] = profile.Tags
	}
	writeJSON(w, http.StatusOK, response)
}

type putNoteBody struct {
	Note string `json:"note"`
}

// putNote serves PUT /v1/crm/customers/{id}/notes (§15.1 Starter+): upserts
// the owner's single free-text note on the customer.
func (handler Handler) putNote(w http.ResponseWriter, r *http.Request) {
	principal, ok := handler.principal(w, r)
	if !ok {
		return
	}
	var body putNoteBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	note, err := handler.service.PutNote(r.Context(), crmapp.NoteCommand{
		Scope:      principal.TenantScope(),
		ActorRole:  principal.Role,
		CustomerID: common.ID(chi.URLParam(r, "customerID")),
		Note:       body.Note,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"customer_id": chi.URLParam(r, "customerID"),
		"note":        note.Note,
		"updated_at":  note.UpdatedAt.Format(time.RFC3339),
	})
}

type putTagsBody struct {
	Tags []string `json:"tags"`
}

// putTags serves PUT /v1/crm/customers/{id}/tags (§15.1 Growth+): the body IS
// the customer's new tag set (replace semantics).
func (handler Handler) putTags(w http.ResponseWriter, r *http.Request) {
	principal, ok := handler.principal(w, r)
	if !ok {
		return
	}
	var body putTagsBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	tags, err := handler.service.PutTags(r.Context(), crmapp.TagsCommand{
		Scope:      principal.TenantScope(),
		ActorRole:  principal.Role,
		CustomerID: common.ID(chi.URLParam(r, "customerID")),
		Tags:       body.Tags,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"customer_id": chi.URLParam(r, "customerID"),
		"tags":        tags,
	})
}

// insights serves GET /v1/crm/customers/insights (§15.1 Growth+): the
// new-vs-returning counts and the lapsed (90+ days) customer list.
func (handler Handler) insights(w http.ResponseWriter, r *http.Request) {
	principal, ok := handler.principal(w, r)
	if !ok {
		return
	}
	result, err := handler.service.Insights(r.Context(), crmapp.CustomerCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	lapsed := make([]map[string]any, 0, len(result.LapsedCustomers))
	for _, customer := range result.LapsedCustomers {
		lapsed = append(lapsed, map[string]any{
			"customer_id":   customer.CustomerID.String(),
			"name":          customer.DisplayName,
			"phone":         customer.Phone,
			"last_order_at": customer.LastOrderAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"new_customers_30d":   result.NewCustomers30d,
		"returning_customers": result.ReturningCustomers,
		"lapsed_customers":    lapsed,
	})
}

// exportCustomers serves GET /v1/crm/customers/export?format=csv|pdf|docx|xlsx
// (§15.1: CSV Growth, any format Studio — the export_* matrix booleans).
func (handler Handler) exportCustomers(w http.ResponseWriter, r *http.Request) {
	principal, ok := handler.principal(w, r)
	if !ok {
		return
	}
	file, err := handler.service.ExportCustomers(r.Context(), crmapp.ExportCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		Format:    r.URL.Query().Get("format"),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	w.Header().Set("Content-Type", file.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", file.Filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(file.Content)
}

func optionalTimestamp(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.Format(time.RFC3339)
}

func parseNonNegativeInt(raw string) (int, error) {
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return 0, crmapp.ErrInvalidInput
	}
	return value, nil
}

// writeServiceError maps the CRM error vocabulary to stable codes. The
// entitlement refusal carries the plan's current crm_level so the dashboard
// can render a targeted upgrade prompt (§15.1 ladders by level).
func writeServiceError(w http.ResponseWriter, err error) {
	var notEntitled crmapp.NotEntitledError
	switch {
	case errors.As(err, &notEntitled):
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error":               "crm_not_entitled",
			"feature":             notEntitled.Feature,
			"crm_level":           notEntitled.CurrentLevel,
			"crm_level_name":      business.CapabilityLevel(notEntitled.CurrentLevel),
			"required_level":      notEntitled.RequiredLevel,
			"required_level_name": business.CapabilityLevel(notEntitled.RequiredLevel),
		})
	case errors.Is(err, reportsapp.ErrExportNotEntitled):
		writeError(w, http.StatusForbidden, "export_not_entitled")
	case errors.Is(err, authdomain.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, reportsapp.ErrUnknownFormat):
		writeError(w, http.StatusBadRequest, "invalid_format")
	case errors.Is(err, crmapp.ErrInvalidInput):
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
