package authhttp

import (
	"net/http"
	"time"

	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
)

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
