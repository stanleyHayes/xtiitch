package measurementhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	measurementapp "github.com/xcreativs/xtiitch/apps/api/internal/application/measurement"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const maxBodyBytes = 1 << 20

type Service interface {
	ListFields(ctx context.Context, scope common.TenantScope) ([]ports.BusinessMeasurementField, error)
	CreateField(ctx context.Context, command measurementapp.CreateFieldCommand) (ports.BusinessMeasurementField, error)
	UpdateField(ctx context.Context, command measurementapp.UpdateFieldCommand) (ports.BusinessMeasurementField, error)
	DeleteField(ctx context.Context, command measurementapp.DeleteFieldCommand) error
	RecordOrderMeasurements(ctx context.Context, command measurementapp.RecordOrderMeasurementsCommand) (ports.OrderMeasurement, error)
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
		protected.Get("/measurement-fields", handler.listFields)
		protected.Post("/measurement-fields", handler.createField)
		protected.Patch("/measurement-fields/{id}", handler.updateField)
		protected.Delete("/measurement-fields/{id}", handler.deleteField)
		protected.Post("/orders/{id}/measurements", handler.recordOrderMeasurements)
	})
}

func (handler Handler) listFields(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	fields, err := handler.service.ListFields(r.Context(), principal.TenantScope())
	if err != nil {
		writeMeasurementError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(fields))
	for _, field := range fields {
		out = append(out, toFieldResponse(field))
	}
	writeJSON(w, http.StatusOK, map[string]any{"fields": out})
}

type createFieldBody struct {
	Label    string `json:"label"`
	Unit     string `json:"unit"`
	Sequence int    `json:"sequence"`
}

func (handler Handler) createField(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body createFieldBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	field, err := handler.service.CreateField(r.Context(), measurementapp.CreateFieldCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		Label:     body.Label,
		Unit:      body.Unit,
		Sequence:  body.Sequence,
	})
	if err != nil {
		writeMeasurementError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toFieldResponse(field))
}

type updateFieldBody struct {
	Label    *string `json:"label"`
	Unit     *string `json:"unit"`
	Sequence *int    `json:"sequence"`
}

func (handler Handler) updateField(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body updateFieldBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	field, err := handler.service.UpdateField(r.Context(), measurementapp.UpdateFieldCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		FieldID:   common.ID(chi.URLParam(r, "id")),
		Label:     body.Label,
		Unit:      body.Unit,
		Sequence:  body.Sequence,
	})
	if err != nil {
		writeMeasurementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toFieldResponse(field))
}

func (handler Handler) deleteField(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	if err := handler.service.DeleteField(r.Context(), measurementapp.DeleteFieldCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		FieldID:   common.ID(chi.URLParam(r, "id")),
	}); err != nil {
		writeMeasurementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

type recordMeasurementsBody struct {
	Source string            `json:"source"`
	Values map[string]string `json:"values"`
}

func (handler Handler) recordOrderMeasurements(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var body recordMeasurementsBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	measurement, err := handler.service.RecordOrderMeasurements(r.Context(), measurementapp.RecordOrderMeasurementsCommand{
		Scope:   principal.TenantScope(),
		OrderID: common.ID(chi.URLParam(r, "id")),
		Source:  body.Source,
		Values:  body.Values,
	})
	if err != nil {
		writeMeasurementError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toMeasurementResponse(measurement))
}

func toFieldResponse(field ports.BusinessMeasurementField) map[string]any {
	return map[string]any{
		"field_id":   field.FieldID.String(),
		"label":      field.Label,
		"unit":       field.Unit,
		"sequence":   field.Sequence,
		"created_at": field.CreatedAt,
		"updated_at": field.UpdatedAt,
	}
}

func toMeasurementResponse(measurement ports.OrderMeasurement) map[string]any {
	return map[string]any{
		"measurement_id": measurement.MeasurementID.String(),
		"order_id":       measurement.OrderID.String(),
		"customer_id":    measurement.CustomerID.String(),
		"source":         measurement.Source,
		"values":         measurement.Values,
		"created_at":     measurement.CreatedAt,
		"updated_at":     measurement.UpdatedAt,
	}
}

func writeMeasurementError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, measurementapp.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "invalid_input")
	case errors.Is(err, measurementapp.ErrInvalidMeasurementSource):
		writeError(w, http.StatusBadRequest, "invalid_measurement_source")
	case errors.Is(err, authdomain.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, ports.ErrUnknownMeasurementField):
		writeError(w, http.StatusBadRequest, "unknown_measurement_field")
	case errors.Is(err, ports.ErrMeasurementSequenceTaken):
		writeError(w, http.StatusConflict, "measurement_sequence_taken")
	case errors.Is(err, ports.ErrInvalidOrderState):
		writeError(w, http.StatusConflict, "invalid_order_state")
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
