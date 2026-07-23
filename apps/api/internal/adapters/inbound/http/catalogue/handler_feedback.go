package cataloguehttp

import (
	"encoding/json"
	"net/http"

	catalogueapp "github.com/xcreativs/xtiitch/apps/api/internal/application/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type feedbackBody struct {
	ReporterType string          `json:"reporter_type"`
	Surface      string          `json:"surface"`
	Kind         string          `json:"kind"`
	Priority     string          `json:"priority"`
	Subject      string          `json:"subject"`
	Message      string          `json:"message"`
	PageURL      string          `json:"page_url"`
	UserAgent    string          `json:"user_agent"`
	Contact      string          `json:"contact"`
	StoreHandle  string          `json:"store_handle"`
	Context      json.RawMessage `json:"context"`
	Stack        string          `json:"stack"`
}

func (body feedbackBody) toCommand(scope *common.TenantScope, fallbackUserAgent string) catalogueapp.FeedbackCommand {
	userAgent := body.UserAgent
	if userAgent == "" {
		userAgent = fallbackUserAgent
	}
	return catalogueapp.FeedbackCommand{
		Scope:        scope,
		StoreHandle:  body.StoreHandle,
		ReporterType: body.ReporterType,
		Surface:      body.Surface,
		Kind:         body.Kind,
		Priority:     body.Priority,
		Subject:      body.Subject,
		Message:      body.Message,
		PageURL:      body.PageURL,
		UserAgent:    userAgent,
		Contact:      body.Contact,
		Context:      body.Context,
		Stack:        body.Stack,
	}
}

func (handler Handler) publicFeedback(w http.ResponseWriter, r *http.Request) {
	var body feedbackBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	id, err := handler.service.SubmitFeedback(r.Context(), body.toCommand(nil, r.UserAgent()))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"feedback_report_id": id.String()})
}

func (handler Handler) businessFeedback(w http.ResponseWriter, r *http.Request) {
	scope, _, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body feedbackBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	id, err := handler.service.SubmitFeedback(r.Context(), body.toCommand(&scope, r.UserAgent()))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"feedback_report_id": id.String()})
}
