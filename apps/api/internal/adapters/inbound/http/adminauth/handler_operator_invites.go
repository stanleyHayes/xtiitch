package adminauthhttp

import (
	"net/http"

	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
)

// Operator invites. One authenticated endpoint to send an invite, and two
// public ones for the person accepting it — they have no account yet, so the
// token in the link is the authorisation. That is why it is single-use and
// expires in 48 hours.

type inviteOperatorRequest struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	// Optional. Given a number, the link is texted as well as emailed.
	Phone string `json:"phone"`
	Role  string `json:"role"`
}

type operatorInviteLookupResponse struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

type acceptOperatorInviteRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (handler Handler) inviteOperator(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request inviteOperatorRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	user, err := handler.service.InviteOperator(r.Context(), adminauthapp.InviteOperatorCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Email:       request.Email,
		DisplayName: request.DisplayName,
		Phone:       request.Phone,
		Role:        admindomain.Role(request.Role),
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusCreated, newAdminUserResponse(user))
}

// lookupOperatorInvite lets the accept page greet the person and show which
// account the link is for, before they type a password.
//
// Public by necessity. It reveals only what the bearer of the token already
// knows — their own name, email and role — and an unknown, expired or spent
// token is answered identically, so it cannot be used to probe for accounts.
func (handler Handler) lookupOperatorInvite(w http.ResponseWriter, r *http.Request) {
	record, err := handler.service.LookupOperatorInvite(r.Context(), r.URL.Query().Get("token"))
	if err != nil {
		writeError(w, http.StatusNotFound, "invite_not_found")
		return
	}
	writeJSON(w, http.StatusOK, operatorInviteLookupResponse{
		Email:       record.Email,
		DisplayName: record.DisplayName,
		Role:        string(record.Role),
	})
}

// acceptOperatorInvite sets the password and activates the operator.
//
// It deliberately does NOT sign them in. The next thing they do is sign in with
// the password they just chose, which proves it works while the invite is still
// fresh in mind — better than discovering a typo on their next visit.
func (handler Handler) acceptOperatorInvite(w http.ResponseWriter, r *http.Request) {
	var request acceptOperatorInviteRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	user, err := handler.service.AcceptOperatorInvite(r.Context(), request.Token, request.Password)
	if err != nil {
		// One code for every failure — expired, spent, unknown, or too short a
		// password would each let someone probe the token space otherwise.
		writeError(w, http.StatusBadRequest, "invite_invalid")
		return
	}
	writeJSON(w, http.StatusOK, newAdminUserResponse(user))
}
