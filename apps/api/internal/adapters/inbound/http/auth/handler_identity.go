package authhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (handler Handler) me(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	writeJSON(w, http.StatusOK, meResponse{
		BusinessID: principal.BusinessID.String(),
		UserID:     principal.UserID.String(),
		Role:       string(principal.Role),
	})
}

func newBusinessUserResponse(user ports.BusinessUserRecord) businessUserResponse {
	return businessUserResponse{
		UserID:      user.UserID.String(),
		BusinessID:  user.BusinessID.String(),
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Phone:       user.Phone,
		Role:        string(user.Role),
		IsActive:    user.IsActive,
		CreatedAt:   user.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   user.UpdatedAt.Format(time.RFC3339),
	}
}

func (handler Handler) listBusinessUsers(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	users, err := handler.service.ListBusinessUsers(r.Context(), authapp.ListBusinessUsersCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]businessUserResponse, 0, len(users))
	for _, user := range users {
		out = append(out, newBusinessUserResponse(user))
	}
	writeJSON(w, http.StatusOK, map[string][]businessUserResponse{"users": out})
}

func (handler Handler) createBusinessUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request createBusinessUserRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.CreateBusinessUser(r.Context(), authapp.CreateBusinessUserCommand{
		Scope:       principal.TenantScope(),
		ActorRole:   principal.Role,
		DisplayName: request.DisplayName,
		Phone:       request.Phone,
		Email:       request.Email,
		Password:    request.Password,
		Role:        business.UserRole(request.Role),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newBusinessUserResponse(user))
}

func (handler Handler) updateBusinessUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateBusinessUserRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.UpdateBusinessUser(r.Context(), authapp.UpdateBusinessUserCommand{
		Scope:       principal.TenantScope(),
		ActorRole:   principal.Role,
		UserID:      common.ID(chi.URLParam(r, "id")),
		DisplayName: request.DisplayName,
		Phone:       request.Phone,
		Role:        business.UserRole(request.Role),
		IsActive:    request.IsActive,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newBusinessUserResponse(user))
}

func (handler Handler) resetBusinessUserPassword(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request resetBusinessUserPasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	err := handler.service.ResetBusinessUserPassword(r.Context(), authapp.ResetBusinessUserPasswordCommand{
		Scope:       principal.TenantScope(),
		ActorRole:   principal.Role,
		UserID:      common.ID(chi.URLParam(r, "id")),
		NewPassword: request.Password,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) transferBusinessOwner(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request transferBusinessOwnerRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.TransferBusinessOwner(r.Context(), authapp.TransferBusinessOwnerCommand{
		Scope:          principal.TenantScope(),
		ActorUserID:    principal.UserID,
		ActorRole:      principal.Role,
		NewOwnerUserID: common.ID(request.NewOwnerUserID),
		Confirmation:   request.Confirmation,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, transferBusinessOwnerResponse{
		PreviousOwner: newBusinessUserResponse(result.PreviousOwner),
		NewOwner:      newBusinessUserResponse(result.NewOwner),
	})
}

func (handler Handler) submitIdentityVerification(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request identityVerificationRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.SubmitIdentityVerification(r.Context(), authapp.SubmitIdentityVerificationCommand{
		Scope:      principal.TenantScope(),
		ActorRole:  principal.Role,
		CardNumber: request.CardNumber,
		IDPhotoURL: request.IDPhotoURL,
	}); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "pending"})
}
