package aiassisthttp

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	adminauthhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/adminauth"
	aiassistapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aiassist"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// AdminService flips a tenant's paid add-on on or off by business id and runs the
// add-on renewal sweep. Mirrors the application service so the admin handler
// depends on a narrow interface.
type AdminService interface {
	SetAddon(ctx context.Context, businessID common.ID, addon string, active bool) error
	RunRenewalSweep(ctx context.Context, limit int) (aiassistapp.RenewalSweepResult, error)
}

// AdminHandler exposes the manual add-on flip used to enable/disable add-ons for
// a tenant before the billing flow exists. It sits behind the admin auth
// middleware (same as the rest of /v1/admin) and is gated on the
// review_businesses permission, matching how admin already mutates a business by
// id (suspend/verify).
type AdminHandler struct {
	service       AdminService
	authenticator adminauthhttp.Authenticator
}

func NewAdminHandler(service AdminService, authenticator adminauthhttp.Authenticator) AdminHandler {
	return AdminHandler{service: service, authenticator: authenticator}
}

func (handler AdminHandler) Register(router chi.Router) {
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Post("/admin/businesses/{business_id}/addons", handler.setAddon)
		// Renewal sweep — charges every paid add-on whose monthly renewal is due.
		// Called on a schedule (same scheduler as the subscription recurring sweep).
		protected.Post("/admin/addons/recurring-charges", handler.runRenewalSweep)
	})
}

type adminSetAddonRequest struct {
	Addon  string `json:"addon"`
	Active bool   `json:"active"`
}

func (handler AdminHandler) setAddon(w http.ResponseWriter, r *http.Request) {
	principal, ok := adminauthhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	if !roleCan(principal.Role, admindomain.PermissionReviewBusinesses) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	var request adminSetAddonRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	businessID := common.ID(chi.URLParam(r, "business_id"))
	if err := handler.service.SetAddon(r.Context(), businessID, request.Addon, request.Active); err != nil {
		switch {
		case errors.Is(err, aiassistapp.ErrInvalidAddon):
			writeError(w, http.StatusBadRequest, "invalid_addon")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"business_id": businessID.String(),
		"addon":       request.Addon,
		"active":      request.Active,
	})
}

// runRenewalSweep charges every paid add-on whose monthly renewal is due. Gated
// on review_businesses (the scheduler's admin token holds it), matching the
// subscription recurring sweep.
func (handler AdminHandler) runRenewalSweep(w http.ResponseWriter, r *http.Request) {
	principal, ok := adminauthhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	if !roleCan(principal.Role, admindomain.PermissionReviewBusinesses) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	result, err := handler.service.RunRenewalSweep(r.Context(), 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"attempted": result.Attempted,
		"charged":   result.Charged,
		"failed":    result.Failed,
	})
}

// roleCan reports whether an admin role holds a permission using the static role
// catalogue. Add-on flips are not yet role-overridable, so the domain default
// (owner + operator can review/mutate businesses; support cannot) is authoritative.
func roleCan(role admindomain.Role, permission admindomain.Permission) bool {
	for _, candidate := range role.Permissions() {
		if candidate == permission {
			return true
		}
	}
	return false
}
