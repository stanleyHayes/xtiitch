package authhttp

import (
	"net/http"
	"time"

	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
)

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
	// PlanCode is the target plan being activated/upgraded to; when set and it
	// differs from the current plan the subscription is switched onto it first.
	PlanCode string `json:"plan_code"`
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
	// Activated is true when the plan went live immediately with no Paystack
	// checkout (a free_period/full discount, or a period already paid). The
	// dashboard then shows success instead of redirecting to a payment page.
	Activated bool `json:"activated"`
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
		PlanCode:       request.PlanCode,
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
		Activated:    result.Activated,
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
