package catalogueapp

import (
	"context"
	"encoding/json"
	"strings"
	"unicode/utf8"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type FeedbackCommand struct {
	Scope        *common.TenantScope
	BusinessID   *common.ID
	StoreHandle  string
	ReporterType string
	Surface      string
	Kind         string
	Priority     string
	Subject      string
	Message      string
	PageURL      string
	UserAgent    string
	Contact      string
	Context      json.RawMessage
	Stack        string
}

func normalizeFeedbackChoice(value string, allowed map[string]struct{}, fallback string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if _, ok := allowed[normalized]; ok {
		return normalized
	}
	return fallback
}

func trimFeedback(value string, maxRunes int) string {
	value = strings.TrimSpace(value)
	if maxRunes <= 0 || utf8.RuneCountInString(value) <= maxRunes {
		return value
	}
	runes := []rune(value)
	return string(runes[:maxRunes])
}

func cleanFeedbackContext(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || !json.Valid(raw) {
		return json.RawMessage(`{}`)
	}
	if len(raw) > 16*1024 {
		return json.RawMessage(`{"truncated":true}`)
	}
	return raw
}

var feedbackReporterTypes = map[string]struct{}{
	"business":  {},
	"customer":  {},
	"anonymous": {},
	"system":    {},
}

var feedbackSurfaces = map[string]struct{}{
	"business":   {},
	"storefront": {},
	"marketing":  {},
	"admin":      {},
}

var feedbackKinds = map[string]struct{}{
	"feedback": {},
	"crash":    {},
}

var feedbackPriorities = map[string]struct{}{
	"normal": {},
	"urgent": {},
}

func (s Service) SubmitFeedback(ctx context.Context, cmd FeedbackCommand) (common.ID, error) {
	reporterType := normalizeFeedbackChoice(cmd.ReporterType, feedbackReporterTypes, "anonymous")
	surface := normalizeFeedbackChoice(cmd.Surface, feedbackSurfaces, "storefront")
	kind := normalizeFeedbackChoice(cmd.Kind, feedbackKinds, "feedback")
	priority := normalizeFeedbackChoice(cmd.Priority, feedbackPriorities, "normal")
	if kind == "crash" {
		priority = "urgent"
		if reporterType == "anonymous" {
			reporterType = "system"
		}
	}

	subject := trimFeedback(cmd.Subject, 140)
	message := trimFeedback(cmd.Message, 3000)
	stack := trimFeedback(cmd.Stack, 8000)
	if subject == "" && message == "" && stack == "" {
		return "", ErrInvalidInput
	}

	var businessID *common.ID
	if cmd.Scope != nil && !cmd.Scope.BusinessID.IsZero() {
		id := cmd.Scope.BusinessID
		businessID = &id
		reporterType = "business"
		surface = "business"
	} else if cmd.BusinessID != nil && !cmd.BusinessID.IsZero() {
		id := *cmd.BusinessID
		businessID = &id
	} else if handle := strings.TrimSpace(cmd.StoreHandle); handle != "" {
		store, err := s.storefront.ResolveStore(ctx, handle)
		if err == nil && !store.BusinessID.IsZero() {
			id := store.BusinessID
			businessID = &id
		}
	}

	id := s.ids.NewID()
	err := s.catalogue.CreateFeedbackReport(ctx, ports.FeedbackReportInput{
		ReportID:     id,
		BusinessID:   businessID,
		ReporterType: reporterType,
		Surface:      surface,
		Kind:         kind,
		Priority:     priority,
		Subject:      subject,
		Message:      message,
		PageURL:      trimFeedback(cmd.PageURL, 1200),
		UserAgent:    trimFeedback(cmd.UserAgent, 800),
		Contact:      trimFeedback(cmd.Contact, 240),
		Context:      cleanFeedbackContext(cmd.Context),
		Stack:        stack,
	})
	return id, err
}
