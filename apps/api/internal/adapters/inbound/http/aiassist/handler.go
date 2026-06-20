package aiassisthttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	aiassistapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aiassist"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// maxAssistTextLen caps the draft length the assistant will accept; longer text
// is rejected with 400 before the request reaches the model.
const maxAssistTextLen = 4000

const maxBodyBytes = 1 << 20

// Service is the business-authed ✨ writing assistant. Mirrors the application
// service so the handler depends on a narrow interface, not the concrete type.
type Service interface {
	Assist(ctx context.Context, scope common.TenantScope, input ports.AssistInput) (string, error)
	AddonStatus(ctx context.Context, scope common.TenantScope) (aiassistapp.AddonStatusView, error)
	InitializeCheckout(ctx context.Context, scope common.TenantScope, callbackURL string) (aiassistapp.CheckoutLink, error)
	VerifyCheckout(ctx context.Context, scope common.TenantScope, reference string) (aiassistapp.CheckoutResult, error)
}

type Handler struct {
	service       Service
	authenticator authhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

// Register mounts the assistant under the business-auth middleware, so the final
// path is POST /v1/ai/assist and the tenant is derived from the access token.
func (handler Handler) Register(router chi.Router) {
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Post("/ai/assist", handler.assist)
		// AI Assistant add-on billing (paid separately from the plan).
		protected.Get("/addons/ai_assistant", handler.addonStatus)
		protected.Post("/addons/ai_assistant/checkout", handler.addonCheckout)
		protected.Post("/addons/ai_assistant/verify", handler.addonVerify)
	})
}

type assistRequest struct {
	Text        string `json:"text"`
	Instruction string `json:"instruction"`
	Field       string `json:"field"`
}

func (handler Handler) assist(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request assistRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	text := strings.TrimSpace(request.Text)
	if text == "" {
		writeError(w, http.StatusBadRequest, "empty_text")
		return
	}
	if len(text) > maxAssistTextLen {
		writeError(w, http.StatusBadRequest, "text_too_long")
		return
	}

	result, err := handler.service.Assist(r.Context(), principal.TenantScope(), ports.AssistInput{
		Text:        text,
		Instruction: request.Instruction,
		Field:       request.Field,
	})
	if err != nil {
		switch {
		case errors.Is(err, business.ErrAddonInactive):
			// 402: the AI Assistant add-on is not active for this business. The body
			// carries a stable code so the UI can show the enable-add-on prompt.
			writeJSON(w, http.StatusPaymentRequired, map[string]string{
				"error": "ai_assistant add-on is not active",
				"code":  "addon_inactive",
			})
		case errors.Is(err, aiassistapp.ErrEmptyText):
			writeError(w, http.StatusBadRequest, "empty_text")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"result": result})
}

// addonStatus returns the business's AI Assistant add-on status + the price to
// enable/renew it, so the dashboard can show the right call to action.
func (handler Handler) addonStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	status, err := handler.service.AddonStatus(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	var nextCharge any
	if status.NextChargeAt != nil {
		nextCharge = status.NextChargeAt.UTC().Format(time.RFC3339)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"addon":          status.Addon,
		"active":         status.Active,
		"billing_status": status.BillingStatus,
		"price_minor":    status.PriceMinor,
		"currency":       status.Currency,
		"next_charge_at": nextCharge,
	})
}

type addonCheckoutRequest struct {
	CallbackURL string `json:"callback_url"`
}

// addonCheckout starts a Paystack authorization for the AI Assistant add-on and
// returns the redirect link the browser should follow.
func (handler Handler) addonCheckout(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request addonCheckoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	link, err := handler.service.InitializeCheckout(r.Context(), principal.TenantScope(), request.CallbackURL)
	if err != nil {
		if errors.Is(err, aiassistapp.ErrBillingUnavailable) {
			writeError(w, http.StatusServiceUnavailable, "billing_unavailable")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"redirect_url": link.RedirectURL,
		"reference":    link.Reference,
	})
}

type addonVerifyRequest struct {
	Reference string `json:"reference"`
}

// addonVerify confirms a completed Paystack checkout, charges the first month,
// and activates the add-on on success.
func (handler Handler) addonVerify(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request addonVerifyRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.VerifyCheckout(r.Context(), principal.TenantScope(), request.Reference)
	if err != nil {
		switch {
		case errors.Is(err, aiassistapp.ErrCheckoutNotConfirmed):
			writeError(w, http.StatusBadRequest, "checkout_not_confirmed")
		case errors.Is(err, aiassistapp.ErrBillingUnavailable):
			writeError(w, http.StatusServiceUnavailable, "billing_unavailable")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"active":         result.Active,
		"billing_status": result.BillingStatus,
	})
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
