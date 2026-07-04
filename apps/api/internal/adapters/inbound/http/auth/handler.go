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
	CheckHandleAvailability(ctx context.Context, raw string) (authapp.HandleAvailability, error)
	ListPublicPlans(ctx context.Context) ([]ports.PublicPlanRecord, error)
	SubscriptionVATPolicy() (rateBps int, inclusive bool)
	InitializeSubscriptionAuthorization(ctx context.Context, command authapp.InitializeSubscriptionAuthorizationCommand) (authapp.SubscriptionAuthorizationLink, error)
	VerifySubscriptionAuthorization(ctx context.Context, command authapp.VerifySubscriptionAuthorizationCommand) (authapp.SubscriptionAuthorizationResult, error)
	ChangeSubscriptionPlan(ctx context.Context, command authapp.ChangeSubscriptionPlanCommand) (authapp.ChangeSubscriptionPlanResult, error)
	SubmitIdentityVerification(ctx context.Context, command authapp.SubmitIdentityVerificationCommand) error
	LoginBusiness(ctx context.Context, command authapp.LoginBusinessCommand) (authapp.AuthResult, error)
	RefreshSession(ctx context.Context, command authapp.RefreshSessionCommand) (authapp.AuthResult, error)
	Logout(ctx context.Context, command authapp.LogoutCommand) error
	ListBusinessUsers(ctx context.Context, command authapp.ListBusinessUsersCommand) ([]ports.BusinessUserRecord, error)
	CreateBusinessUser(ctx context.Context, command authapp.CreateBusinessUserCommand) (ports.BusinessUserRecord, error)
	UpdateBusinessUser(ctx context.Context, command authapp.UpdateBusinessUserCommand) (ports.BusinessUserRecord, error)
	ResetBusinessUserPassword(ctx context.Context, command authapp.ResetBusinessUserPasswordCommand) error
	ChangeOwnPassword(ctx context.Context, command authapp.ChangeOwnPasswordCommand) error
	RequestPasswordReset(ctx context.Context, email string) error
	ConfirmPasswordReset(ctx context.Context, email string, code string, newPassword string) error
	TransferBusinessOwner(ctx context.Context, command authapp.TransferBusinessOwnerCommand) (ports.TransferBusinessOwnerResult, error)
	GetMFAStatus(ctx context.Context, scope common.TenantScope, userID common.ID) (authapp.MFAStatus, error)
	StartMFAEnrollment(ctx context.Context, scope common.TenantScope, userID common.ID) (authapp.MFAEnrollmentSetup, error)
	ActivateMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) ([]string, error)
	DisableMFA(ctx context.Context, scope common.TenantScope, userID common.ID, code string) error
	VerifyMFALogin(ctx context.Context, command authapp.VerifyMFALoginCommand) (authapp.AuthResult, error)
	RequestSignInOTP(ctx context.Context, handle string, whatsAppNumber string) error
	RequestRegistrationOTP(ctx context.Context, whatsAppNumber string) error
	VerifySignInOTP(ctx context.Context, command authapp.VerifySignInOTPCommand) (authapp.AuthResult, error)
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
	// WhatsApp one-time-code sign-in (an alternative first factor to the password)
	// and registration number verification. Public, like login + mfa/verify.
	router.Post("/auth/business/otp/request", handler.requestSignInOTP)
	router.Post("/auth/business/otp/verify", handler.verifySignInOTP)
	router.Post("/auth/business/register/otp/request", handler.requestRegistrationOTP)
	// Public plan catalogue powering the signup plan picker.
	router.Get("/plans", handler.listPlans)
	// Real-time store-handle availability for the signup form (Instagram-style).
	router.Get("/auth/business/handle-availability", handler.checkHandleAvailability)

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/auth/business/me", handler.me)
		protected.Post("/auth/business/subscription/authorization-link", handler.initializeSubscriptionAuthorization)
		protected.Post("/auth/business/subscription/authorization-verifications", handler.verifySubscriptionAuthorization)
		protected.Post("/auth/business/subscription/change-plan", handler.changeSubscriptionPlan)
		protected.Post("/auth/business/identity-verification", handler.submitIdentityVerification)
		protected.Get("/auth/business/users", handler.listBusinessUsers)
		protected.Post("/auth/business/users", handler.createBusinessUser)
		protected.Patch("/auth/business/users/{id}", handler.updateBusinessUser)
		protected.Post("/auth/business/users/{id}/password", handler.resetBusinessUserPassword)
		// Self-service: the signed-in user changes their own password by
		// confirming the current one. Distinct from the admin reset above.
		protected.Post("/auth/business/password", handler.changeOwnPassword)
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
	// Optional WhatsApp identity: when a number is supplied, the code proving it
	// must accompany the request.
	WhatsAppNumber string `json:"whatsapp_number"`
	WhatsAppCode   string `json:"whatsapp_code"`
}

type signInOTPRequest struct {
	BusinessHandle string `json:"business_handle"`
	WhatsAppNumber string `json:"whatsapp_number"`
}

type verifySignInOTPRequest struct {
	BusinessHandle string `json:"business_handle"`
	WhatsAppNumber string `json:"whatsapp_number"`
	Code           string `json:"code"`
}

type registrationOTPRequest struct {
	WhatsAppNumber string `json:"whatsapp_number"`
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

type changeOwnPasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
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
		WhatsAppNumber:   request.WhatsAppNumber,
		WhatsAppCode:     request.WhatsAppCode,
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
	// Pricing Book cadence figures (minor units): the first paid subscription
	// bills the *first* figure, every renewal bills the *renewal* figure.
	QuarterlyFirstMinor   int `json:"quarterly_first_minor"`
	QuarterlyRenewalMinor int `json:"quarterly_renewal_minor"`
	YearlyFirstMinor      int `json:"yearly_first_minor"`
	YearlyRenewalMinor    int `json:"yearly_renewal_minor"`
	// VAT applied to subscription charges (Pricing Book tax decision flag). The
	// same policy applies to every plan and cadence: vat_rate_bps 0 means no VAT;
	// vat_inclusive=false means VAT is added on top of the figures above at
	// checkout, true means the figures already include it.
	VATRateBps   int  `json:"vat_rate_bps"`
	VATInclusive bool `json:"vat_inclusive"`
}

func (handler Handler) listPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := handler.service.ListPublicPlans(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	vatRateBps, vatInclusive := handler.service.SubscriptionVATPolicy()
	response := make([]publicPlanResponse, 0, len(plans))
	for _, plan := range plans {
		response = append(response, publicPlanResponse{
			Code:                  plan.Code,
			Name:                  plan.Name,
			MonthlyFeeMinor:       plan.MonthlyFeeMinor,
			YearlyFeeMinor:        plan.YearlyFeeMinor,
			CommissionBps:         plan.CommissionBps,
			DesignLimit:           plan.DesignLimit,
			QuarterlyFirstMinor:   plan.QuarterlyFirstMinor,
			QuarterlyRenewalMinor: plan.QuarterlyRenewalMinor,
			YearlyFirstMinor:      plan.YearlyFirstMinor,
			YearlyRenewalMinor:    plan.YearlyRenewalMinor,
			VATRateBps:            vatRateBps,
			VATInclusive:          vatInclusive,
		})
	}
	writeJSON(w, http.StatusOK, response)
}

func (handler Handler) checkHandleAvailability(w http.ResponseWriter, r *http.Request) {
	result, err := handler.service.CheckHandleAvailability(r.Context(), r.URL.Query().Get("handle"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"handle":    result.Handle,
		"available": result.Available,
		"reason":    result.Reason,
	})
}

type subscriptionAuthorizationLinkRequest struct {
	CallbackURL string `json:"callback_url"`
	// BillingCadence is the owner's chosen cadence: 'quarterly' or 'yearly'.
	BillingCadence string `json:"billing_cadence"`
	// Code is an optional subscription discount code applied at checkout.
	Code string `json:"code"`
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
		Scope:          principal.TenantScope(),
		CallbackURL:    request.CallbackURL,
		BillingCadence: request.BillingCadence,
		Code:           request.Code,
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

type changeSubscriptionPlanRequest struct {
	PlanCode string `json:"plan_code"`
}

type changeSubscriptionPlanResponse struct {
	PlanCode string `json:"plan_code"`
	// Immediate is true for an applied upgrade, false for a downgrade scheduled at
	// the next renewal.
	Immediate bool `json:"immediate"`
	// ProratedChargeMinor is what was charged now for the remainder of the current
	// period (upgrade); 0 for a downgrade or a zero-difference upgrade.
	ProratedChargeMinor int64 `json:"prorated_charge_minor"`
	// EffectiveAt is when the new plan takes effect (now for an upgrade, the period
	// end for a scheduled downgrade), RFC3339.
	EffectiveAt string `json:"effective_at"`
}

func (handler Handler) changeSubscriptionPlan(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request changeSubscriptionPlanRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.ChangeSubscriptionPlan(r.Context(), authapp.ChangeSubscriptionPlanCommand{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		PlanCode:  request.PlanCode,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, changeSubscriptionPlanResponse{
		PlanCode:            result.PlanCode,
		Immediate:           result.Immediate,
		ProratedChargeMinor: result.ProratedChargeMinor,
		EffectiveAt:         result.EffectiveAt.Format(time.RFC3339),
	})
}

type identityVerificationRequest struct {
	CardNumber string `json:"card_number"`
	IDPhotoURL string `json:"id_photo_url"`
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

// requestSignInOTP sends a WhatsApp sign-in code. Always 202 (opaque about
// whether the handle+number is registered) unless the number is malformed or
// the feature is unavailable.
func (handler Handler) requestSignInOTP(w http.ResponseWriter, r *http.Request) {
	var request signInOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RequestSignInOTP(r.Context(), request.BusinessHandle, request.WhatsAppNumber); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// requestRegistrationOTP sends a verification code to a number a signup form
// collected (before the account exists).
func (handler Handler) requestRegistrationOTP(w http.ResponseWriter, r *http.Request) {
	var request registrationOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RequestRegistrationOTP(r.Context(), request.WhatsAppNumber); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// verifySignInOTP verifies a WhatsApp code and issues a session, or returns an
// MFA challenge when the account has a second factor enabled.
func (handler Handler) verifySignInOTP(w http.ResponseWriter, r *http.Request) {
	var request verifySignInOTPRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.VerifySignInOTP(r.Context(), authapp.VerifySignInOTPCommand{
		BusinessHandle: request.BusinessHandle,
		WhatsAppNumber: request.WhatsAppNumber,
		Code:           request.Code,
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

func (handler Handler) changeOwnPassword(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request changeOwnPasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	err := handler.service.ChangeOwnPassword(r.Context(), authapp.ChangeOwnPasswordCommand{
		Scope:           principal.TenantScope(),
		UserID:          principal.UserID,
		CurrentPassword: request.CurrentPassword,
		NewPassword:     request.NewPassword,
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
	case errors.Is(err, authapp.ErrWhatsAppOTPUnavailable):
		return http.StatusServiceUnavailable, "whatsapp_unavailable"
	case errors.Is(err, authapp.ErrInvalidPhone):
		return http.StatusBadRequest, "invalid_phone"
	case errors.Is(err, authapp.ErrInvalidCode):
		return http.StatusUnauthorized, "invalid_code"
	case errors.Is(err, authapp.ErrCodeExpired):
		return http.StatusUnauthorized, "code_expired"
	case errors.Is(err, authapp.ErrTooManyAttempts):
		return http.StatusTooManyRequests, "too_many_attempts"
	case errors.Is(err, authapp.ErrDiscountCodeInvalid):
		return http.StatusBadRequest, "invalid_discount_code"
	case errors.Is(err, authapp.ErrDiscountCodeExpired):
		return http.StatusBadRequest, "discount_code_expired"
	case errors.Is(err, authapp.ErrDiscountCodeIneligible):
		return http.StatusBadRequest, "discount_code_ineligible"
	case errors.Is(err, authapp.ErrDiscountCodeExhausted):
		return http.StatusConflict, "discount_code_exhausted"
	case errors.Is(err, authapp.ErrPlanChangeSamePlan):
		return http.StatusConflict, "plan_change_same_plan"
	case errors.Is(err, authapp.ErrPlanChangeBillingInactive):
		return http.StatusConflict, "billing_not_active"
	case errors.Is(err, authapp.ErrPlanChangeChargeFailed):
		return http.StatusPaymentRequired, "upgrade_charge_failed"
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
