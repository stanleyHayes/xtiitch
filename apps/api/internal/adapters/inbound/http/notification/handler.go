package notificationhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service interface {
	ListMessages(ctx context.Context, scope common.TenantScope) ([]ports.MessageSummary, error)
	UnreadOwnerAlerts(ctx context.Context, scope common.TenantScope, userID common.ID) (int, error)
	MarkRead(ctx context.Context, scope common.TenantScope, userID common.ID) error
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
		protected.Get("/notifications", handler.list)
		// Opening the messages view clears this operator's badge.
		protected.Post("/notifications/read", handler.markRead)
	})
}

func (handler Handler) list(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	messages, err := handler.service.ListMessages(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	out := make([]map[string]any, 0, len(messages))
	for _, m := range messages {
		out = append(out, map[string]any{
			"message_id": m.MessageID.String(),
			"channel":    m.Channel,
			"kind":       m.Kind,
			"recipient":  m.Recipient,
			"status":     m.Status,
			"attempts":   m.Attempts,
			"created_at": m.CreatedAt.Format(time.RFC3339),
		})
	}
	// Unread is best-effort: a failure here must not blank the log the owner
	// came to read.
	unread, err := handler.service.UnreadOwnerAlerts(r.Context(), principal.TenantScope(), principal.UserID)
	if err != nil {
		unread = 0
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"notifications": out,
		"unread":        unread,
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

// markRead clears this operator's new-order badge. Separate from the list so
// the badge can be read without clearing it — the dashboard clears it only when
// the owner actually opens the messages view.
func (handler Handler) markRead(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	if err := handler.service.MarkRead(r.Context(), principal.TenantScope(), principal.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
