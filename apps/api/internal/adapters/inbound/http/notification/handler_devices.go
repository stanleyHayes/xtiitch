package notificationhttp

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	notifyapp "github.com/xcreativs/xtiitch/apps/api/internal/application/notification"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// Push device registration for the mobile app.
//
// The token is submitted in the body rather than the path or a query string on
// purpose: request URLs end up in access logs and proxy traces, and a push
// token is a capability — anyone holding it can send that device a
// notification through Expo.

type registerDeviceRequest struct {
	Token string `json:"token"`
	// Optional, and only ever used to label the device in a settings list.
	Platform   string `json:"platform"`
	DeviceName string `json:"device_name"`
}

type unregisterDeviceRequest struct {
	Token string `json:"token"`
}

func (handler Handler) registerDevice(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var body registerDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	device, err := handler.service.RegisterDevice(
		r.Context(),
		principal.TenantScope(),
		principal.UserID,
		body.Token,
		body.Platform,
		body.DeviceName,
	)
	switch {
	case errors.Is(err, notifyapp.ErrInvalidPushToken):
		writeError(w, http.StatusBadRequest, "invalid_push_token")
		return
	case errors.Is(err, notifyapp.ErrInvalidPushPlatform):
		writeError(w, http.StatusBadRequest, "invalid_push_platform")
		return
	case err != nil:
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"device": deviceJSON(device)})
}

// unregisterDevice is a POST rather than a DELETE so the token travels in a
// body. A DELETE carrying a body is legal but unevenly supported by clients and
// proxies, and this endpoint is called at sign-out — the moment least able to
// tolerate a request that quietly does not arrive.
func (handler Handler) unregisterDevice(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var body unregisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	// Unregistering an unknown token succeeds. Signing out twice, or on a device
	// whose registration already moved elsewhere, is not a failure, and
	// answering differently would report whether a given token is on file.
	if err := handler.service.UnregisterDevice(r.Context(), principal.TenantScope(), body.Token); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) listDevices(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	devices, err := handler.service.ListDevices(r.Context(), principal.TenantScope(), principal.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	out := make([]map[string]any, 0, len(devices))
	for _, device := range devices {
		out = append(out, deviceJSON(device))
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": out})
}

func deviceJSON(device ports.PushDeviceRecord) map[string]any {
	return map[string]any{
		"token_id": device.TokenID.String(),
		// Echoed so the app can tell which entry in the list is the phone in the
		// user's hand without having to store an id alongside the token.
		"token":        device.Token,
		"platform":     device.Platform,
		"device_name":  device.DeviceName,
		"last_seen_at": device.LastSeenAt.Format(time.RFC3339),
		"created_at":   device.CreatedAt.Format(time.RFC3339),
	}
}
