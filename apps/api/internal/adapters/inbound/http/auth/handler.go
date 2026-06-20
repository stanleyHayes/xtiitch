package authhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service interface {
	RegisterBusiness(ctx context.Context, command authapp.RegisterBusinessCommand) (authapp.AuthResult, error)
	ListPublicPlans(ctx context.Context) ([]ports.PublicPlanRecord, error)
	InitializeSubscriptionAuthorization(ctx context.Context, command authapp.InitializeSubscriptionAuthorizationCommand) (authapp.SubscriptionAuthorizationLink, error)
	VerifySubscriptionAuthorization(ctx context.Context, command authapp.VerifySubscriptionAuthorizationCommand) (authapp.SubscriptionAuthorizationResult, error)
	LoginBusiness(ctx context.Context, command authapp.LoginBusinessCommand) (authapp.AuthResult, error)
	RefreshSession(ctx context.Context, command authapp.RefreshSessionCommand) (authapp.AuthResult, error)
	Logout(ctx context.Context, command authapp.LogoutCommand) error
	ListBusinessUsers(ctx context.Context, command authapp.ListBusinessUsersCommand) ([]ports.BusinessUserRecord, error)
	CreateBusinessUser(ctx context.Context, command authapp.CreateBusinessUserCommand) (ports.BusinessUserRecord, error)
	UpdateBusinessUser(ctx context.Context, command authapp.UpdateBusinessUserCommand) (ports.BusinessUserRecord, error)
	ResetBusinessUserPassword(ctx context.Context, command authapp.ResetBusinessUserPasswordCommand) error
	RequestPasswordReset(ctx context.Context, email string) error
	ConfirmPasswordReset(ctx context.Context, email string, code string, newPassword string) error
	TransferBusinessOwner(ctx context.Context, command authapp.TransferBusinessOwnerCommand) (ports.TransferBusinessOwnerResult, error)
	GetMFAStatus(ctx context.Context, scope common.TenantScope, userID common.ID) (authapp.MFAStatus, error)
	StartMFAEnrollment(ctx context.Context, scope common.TenantScope, userID common.ID) (authapp.MFAEnrollmentSetup, error)
	ActivateMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) ([]string, error)
	DisableMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) error
	VerifyMFALogin(ctx context.Context, command authapp.VerifyMFALoginCommand) (authapp.AuthResult, error)
}

type Handler struct {
	service       Service
	authenticator Authenticator
}

func NewHandler(service Service, authenticator Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/auth/business/register", handler.registerBusiness)
	router.Post("/auth/business/login", handler.loginBusiness)
	// Self-service password reset for locked-out logins: request a code, then
	// redeem it. Both are public (the caller has no session).
	router.Post("/auth/business/password-reset/request", handler.requestPasswordReset)
	router.Post("/auth/business/password-reset/confirm", handler.confirmPasswordReset)
	router.Post("/auth/business/refresh", handler.refreshSession)
	router.Post("/auth/business/logout", handler.logout)
	// Completing a login challenge needs only the short-lived challenge token, so
	// it sits outside the bearer-protected group.
	router.Post("/auth/business/mfa/verify", handler.verifyMFALogin)
	// Public plan catalogue powering the signup plan picker.
	router.Get("/plans", handler.listPlans)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/auth/business/me", handler.me)
		protected.Post("/auth/business/subscription/authorization-link", handler.initializeSubscriptionAuthorization)
		protected.Post("/auth/business/subscription/authorization-verifications", handler.verifySubscriptionAuthorization)
		protected.Get("/auth/business/users", handler.listBusinessUsers)
		protected.Post("/auth/business/users", handler.createBusinessUser)
		protected.Patch("/auth/business/users/{id}", handler.updateBusinessUser)
		protected.Post("/auth/business/users/{id}/password", handler.resetBusinessUserPassword)
		protected.Post("/auth/business/owner-transfer", handler.transferBusinessOwner)
		protected.Get("/auth/business/mfa", handler.mfaStatus)
		protected.Post("/auth/business/mfa/setup", handler.startMFAEnrollment)
		protected.Post("/auth/business/mfa/activate", handler.activateMFA)
		protected.Post("/auth/business/mfa/disable", handler.disableMFA)
	})
}

type registerBusinessRequest struct {
	BusinessName     string `json:"business_name"`
	BusinessHandle   string `json:"business_handle"`
	OwnerDisplayName string `json:"owner_display_name"`
	OwnerEmail       string `json:"owner_email"`
	OwnerPassword    string `json:"owner_password"`
	PlanCode         string `json:"plan_code"`
}

type loginBusinessRequest struct {
	BusinessHandle string `json:"business_handle"`
	OwnerEmail     string `json:"owner_email"`
	OwnerPassword  string `json:"owner_password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type createBusinessUserRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

type updateBusinessUserRequest struct {
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
}

type resetBusinessUserPasswordRequest struct {
	Password string `json:"password"`
}

type transferBusinessOwnerRequest struct {
	NewOwnerUserID string `json:"new_owner_user_id"`
	Confirmation   string `json:"confirmation"`
}

type meResponse struct {
	BusinessID string `json:"business_id"`
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
}

type businessUserResponse struct {
	UserID      string `json:"business_user_id"`
	BusinessID  string `json:"business_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	IsActive    bool   `json:"is_active"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type transferBusinessOwnerResponse struct {
	PreviousOwner businessUserResponse `json:"previous_owner"`
	NewOwner      businessUserResponse `json:"new_owner"`
}

type authResponse struct {
	BusinessID       string `json:"business_id"`
	BusinessUserID   string `json:"business_user_id"`
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	AccessExpiresAt  string `json:"access_expires_at"`
	RefreshExpiresAt string `json:"refresh_expires_at"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func (handler Handler) registerBusiness(w http.ResponseWriter, r *http.Request) {
	var request registerBusinessRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.RegisterBusiness(r.Context(), authapp.RegisterBusinessCommand{
		BusinessName:     request.BusinessName,
		BusinessHandle:   request.BusinessHandle,
		OwnerDisplayName: request.OwnerDisplayName,
		OwnerEmail:       request.OwnerEmail,
		OwnerPassword:    request.OwnerPassword,
		PlanCode:         request.PlanCode,
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAuthResponse(result))
}

type requestPasswordResetRequest struct {
	Email string `json:"email"`
}

func (handler Handler) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var request requestPasswordResetRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	// Always 204, whether or not the email maps to an account, so the response
	// never reveals which addresses are registered.
	if err := handler.service.RequestPasswordReset(r.Context(), request.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type confirmPasswordResetRequest struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

func (handler Handler) confirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	var request confirmPasswordResetRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.ConfirmPasswordReset(r.Context(), request.Email, request.Code, request.NewPassword); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type publicPlanResponse struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	MonthlyFeeMinor int    `json:"monthly_fee_minor"`
	YearlyFeeMinor  int    `json:"yearly_fee_minor"`
	CommissionBps   int    `json:"commission_bps"`
	DesignLimit     *int   `json:"design_limit,omitempty"`
}

func (handler Handler) listPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := handler.service.ListPublicPlans(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	response := make([]publicPlanResponse, 0, len(plans))
	for _, plan := range plans {
		response = append(response, publicPlanResponse{
			Code:            plan.Code,
			Name:            plan.Name,
			MonthlyFeeMinor: plan.MonthlyFeeMinor,
			YearlyFeeMinor:  plan.YearlyFeeMinor,
			CommissionBps:   plan.CommissionBps,
			DesignLimit:     plan.DesignLimit,
		})
	}
	writeJSON(w, http.StatusOK, response)
}

type subscriptionAuthorizationLinkRequest struct {
	CallbackURL string `json:"callback_url"`
}

type subscriptionAuthorizationLinkResponse struct {
	BusinessID   string `json:"business_id"`
	BusinessName string `json:"business_name"`
	OwnerEmail   string `json:"owner_email"`
	RedirectURL  string `json:"redirect_url"`
	AccessCode   string `json:"access_code"`
	Reference    string `json:"reference"`
}

func (handler Handler) initializeSubscriptionAuthorization(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request subscriptionAuthorizationLinkRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.InitializeSubscriptionAuthorization(r.Context(), authapp.InitializeSubscriptionAuthorizationCommand{
		Scope:       principal.TenantScope(),
		CallbackURL: request.CallbackURL,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, subscriptionAuthorizationLinkResponse{
		BusinessID:   result.BusinessID.String(),
		BusinessName: result.BusinessName,
		OwnerEmail:   result.OwnerEmail,
		RedirectURL:  result.RedirectURL,
		AccessCode:   result.AccessCode,
		Reference:    result.Reference,
	})
}

type subscriptionAuthorizationVerifyRequest struct {
	Reference string `json:"reference"`
}

type subscriptionAuthorizationVerifyResponse struct {
	SubscriptionID          string `json:"subscription_id"`
	BusinessID              string `json:"business_id"`
	Status                  string `json:"status"`
	BillingMode             string `json:"billing_mode"`
	ProviderCustomerRef     string `json:"provider_customer_ref"`
	ProviderSubscriptionRef string `json:"provider_subscription_ref"`
}

func (handler Handler) verifySubscriptionAuthorization(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request subscriptionAuthorizationVerifyRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.VerifySubscriptionAuthorization(r.Context(), authapp.VerifySubscriptionAuthorizationCommand{
		Scope:     principal.TenantScope(),
		Reference: request.Reference,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, subscriptionAuthorizationVerifyResponse{
		SubscriptionID:          result.SubscriptionID.String(),
		BusinessID:              result.BusinessID.String(),
		Status:                  result.Status,
		BillingMode:             result.BillingMode,
		ProviderCustomerRef:     result.ProviderCustomerRef,
		ProviderSubscriptionRef: result.ProviderSubscriptionRef,
	})
}

func (handler Handler) loginBusiness(w http.ResponseWriter, r *http.Request) {
	var request loginBusinessRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.LoginBusiness(r.Context(), authapp.LoginBusinessCommand{
		BusinessHandle: request.BusinessHandle,
		OwnerEmail:     request.OwnerEmail,
		OwnerPassword:  request.OwnerPassword,
		UserAgent:      r.UserAgent(),
		IPAddress:      requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	if result.MFARequired {
		writeJSON(w, http.StatusOK, mfaChallengeResponse{
			MFARequired:       true,
			MFAChallengeToken: result.MFAChallengeToken,
		})
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

func (handler Handler) refreshSession(w http.ResponseWriter, r *http.Request) {
	var request refreshRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.RefreshSession(r.Context(), authapp.RefreshSessionCommand{
		RefreshToken: request.RefreshToken,
		UserAgent:    r.UserAgent(),
		IPAddress:    requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

func (handler Handler) logout(w http.ResponseWriter, r *http.Request) {
	var request logoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.Logout(r.Context(), authapp.LogoutCommand{RefreshToken: request.RefreshToken}); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

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

type mfaChallengeResponse struct {
	MFARequired       bool   `json:"mfa_required"`
	MFAChallengeToken string `json:"mfa_challenge_token"`
}

type mfaStatusResponse struct {
	Enabled         bool `json:"enabled"`
	Enrolled        bool `json:"enrolled"`
	BackupCodesLeft int  `json:"backup_codes_left"`
}

type mfaSetupResponse struct {
	Secret          string `json:"secret"`
	ProvisioningURI string `json:"provisioning_uri"`
}

type mfaCodeRequest struct {
	Code string `json:"code"`
}

type mfaActivateResponse struct {
	Enabled     bool     `json:"enabled"`
	BackupCodes []string `json:"backup_codes"`
}

type verifyMFALoginRequest struct {
	MFAChallengeToken string `json:"mfa_challenge_token"`
	Code              string `json:"code"`
}

func (handler Handler) mfaStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	status, err := handler.service.GetMFAStatus(r.Context(), principal.TenantScope(), principal.UserID)
	if err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	writeJSON(w, http.StatusOK, mfaStatusResponse{
		Enabled:         status.Enabled,
		Enrolled:        status.Enrolled,
		BackupCodesLeft: status.BackupCodesLeft,
	})
}

func (handler Handler) startMFAEnrollment(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	setup, err := handler.service.StartMFAEnrollment(r.Context(), principal.TenantScope(), principal.UserID)
	if err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	writeJSON(w, http.StatusOK, mfaSetupResponse{
		Secret:          setup.Secret,
		ProvisioningURI: setup.ProvisioningURI,
	})
}

func (handler Handler) activateMFA(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request mfaCodeRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	backupCodes, err := handler.service.ActivateMFA(r.Context(), principal.TenantScope(), principal.UserID, request.Code)
	if err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	writeJSON(w, http.StatusOK, mfaActivateResponse{Enabled: true, BackupCodes: backupCodes})
}

func (handler Handler) disableMFA(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request mfaCodeRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	if err := handler.service.DisableMFA(r.Context(), principal.TenantScope(), principal.UserID, request.Code); err != nil {
		s, code := authError(err)
		writeError(w, s, code)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) verifyMFALogin(w http.ResponseWriter, r *http.Request) {
	var request verifyMFALoginRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.VerifyMFALogin(r.Context(), authapp.VerifyMFALoginCommand{
		ChallengeToken: request.MFAChallengeToken,
		Code:           request.Code,
		UserAgent:      r.UserAgent(),
		IPAddress:      requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAuthResponse(result))
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
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

func newAuthResponse(result authapp.AuthResult) authResponse {
	return authResponse{
		BusinessID:       result.BusinessID.String(),
		BusinessUserID:   result.BusinessUserID.String(),
		AccessToken:      result.AccessToken,
		RefreshToken:     result.RefreshToken,
		AccessExpiresAt:  result.AccessExpiresAt.Format(time.RFC3339),
		RefreshExpiresAt: result.RefreshExpiresAt.Format(time.RFC3339),
	}
}

func newBusinessUserResponse(user ports.BusinessUserRecord) businessUserResponse {
	return businessUserResponse{
		UserID:      user.UserID.String(),
		BusinessID:  user.BusinessID.String(),
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Role:        string(user.Role),
		IsActive:    user.IsActive,
		CreatedAt:   user.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   user.UpdatedAt.Format(time.RFC3339),
	}
}

func authError(err error) (int, string) {
	switch {
	case errors.Is(err, authdomain.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_input"
	case errors.Is(err, authdomain.ErrResetCodeInvalid):
		return http.StatusBadRequest, "invalid_reset_code"
	case errors.Is(err, authdomain.ErrInvalidCredentials):
		return http.StatusUnauthorized, "invalid_credentials"
	case errors.Is(err, authdomain.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	case errors.Is(err, authdomain.ErrInvalidMFACode):
		return http.StatusUnauthorized, "invalid_mfa_code"
	case errors.Is(err, authdomain.ErrMFAAlreadyEnabled):
		return http.StatusConflict, "mfa_already_enabled"
	case errors.Is(err, authdomain.ErrMFANotEnrolled):
		return http.StatusConflict, "mfa_not_enrolled"
	case errors.Is(err, authdomain.ErrMFANotEnabled):
		return http.StatusConflict, "mfa_not_enabled"
	case errors.Is(err, business.ErrHandleTaken):
		return http.StatusConflict, "handle_taken"
	case errors.Is(err, business.ErrUserEmailTaken):
		return http.StatusConflict, "user_email_taken"
	case errors.Is(err, ports.ErrNotFound):
		return http.StatusNotFound, "not_found"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, errorResponse{Error: code})
}

func requestIP(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}
