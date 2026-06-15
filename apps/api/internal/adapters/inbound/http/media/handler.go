package mediahttp

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service interface {
	SignDesignUpload(ctx context.Context, scope common.TenantScope) (ports.SignedUpload, error)
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
		protected.Post("/media/design-upload-signature", handler.signDesignUpload)
	})
}

type signatureResponse struct {
	Signature string `json:"signature"`
	Timestamp int64  `json:"timestamp"`
	CloudName string `json:"cloud_name"`
	APIKey    string `json:"api_key"`
	Folder    string `json:"folder"`
}

func (handler Handler) signDesignUpload(w http.ResponseWriter, r *http.Request) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	signed, err := handler.service.SignDesignUpload(r.Context(), principal.TenantScope())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	writeJSON(w, http.StatusOK, signatureResponse{
		Signature: signed.Signature,
		Timestamp: signed.Timestamp,
		CloudName: signed.CloudName,
		APIKey:    signed.APIKey,
		Folder:    signed.Folder,
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
