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
	InitializeSubscriptionAuthorization(
		ctx context.Context,
		command authapp.InitializeSubscriptionAuthorizationCommand,
	) (authapp.SubscriptionAuthorizationLink, error)
	VerifySubscriptionAuthorization(
		ctx context.Context,
		command authapp.VerifySubscriptionAuthorizationCommand,
	) (authapp.SubscriptionAuthorizationResult, error)
	ChangeSubscriptionPlan(ctx context.Context, command authapp.ChangeSubscriptionPlanCommand) (authapp.ChangeSubscriptionPlanResult, error)
	GetSubscriptionActivation(ctx context.Context, scope common.TenantScope) (authapp.SubscriptionActivation, error)
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
		protected.Get("/auth/business/subscription/activation", handler.subscriptionActivation)
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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func authError(err error) (int, string) {
	switch {
	case errors.Is(err, authdomain.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_input"
	case errors.Is(err, authdomain.ErrResetCodeInvalid):
		return http.StatusBadRequest, "invalid_reset_code"
	case errors.Is(err, authdomain.ErrAccountLocked):
		return http.StatusTooManyRequests, "account_locked"
	case errors.Is(err, authdomain.ErrInvalidCredentials):
		return http.StatusUnauthorized, "invalid_credentials"
	case errors.Is(err, authdomain.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	// The plan's staff-account cap. 409 + plan_limit_exceeded matches how the
	// catalogue reports its design/image/variation caps, so the dashboard can
	// prompt an upgrade rather than show a generic failure.
	case errors.Is(err, ports.ErrPlanLimitExceeded):
		return http.StatusConflict, "plan_limit_exceeded"
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
	case errors.Is(err, authapp.ErrOTPResendTooSoon):
		return http.StatusTooManyRequests, "resend_too_soon"
	case errors.Is(err, authapp.ErrOTPDeliveryFailed):
		return http.StatusBadGateway, "delivery_failed"
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
