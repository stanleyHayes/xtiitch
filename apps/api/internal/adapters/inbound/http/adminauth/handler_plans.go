package adminauthhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (handler Handler) plans(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListPlans(r.Context(), adminauthapp.ListPlansCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]planResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newPlanResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]planResponse{"plans": out})
}

func (handler Handler) createPlan(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request planCreateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreatePlan(r.Context(), adminauthapp.CreatePlanCommand{
		ActorUserID:        principal.AdminUserID,
		ActorRole:          principal.Role,
		Code:               request.Code,
		Name:               request.Name,
		MonthlyFeeMinor:    request.MonthlyFeeMinor,
		YearlyFeeMinor:     request.YearlyFeeMinor,
		PlanCadencePricing: planCadence(request.planCadenceRequest),
		CommissionBPS:      request.CommissionBPS,
		DesignLimit:        request.DesignLimit,
		Features:           request.Features,
		UserAgent:          r.UserAgent(),
		IPAddress:          requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newPlanResponse(record))
}

func (handler Handler) updatePlan(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request planUpdateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdatePlan(r.Context(), adminauthapp.UpdatePlanCommand{
		ActorUserID:        principal.AdminUserID,
		ActorRole:          principal.Role,
		PlanID:             common.ID(chi.URLParam(r, "id")),
		Name:               request.Name,
		MonthlyFeeMinor:    request.MonthlyFeeMinor,
		YearlyFeeMinor:     request.YearlyFeeMinor,
		PlanCadencePricing: planCadence(request.planCadenceRequest),
		CommissionBPS:      request.CommissionBPS,
		DesignLimit:        request.DesignLimit,
		Features:           request.Features,
		IsActive:           request.IsActive,
		UserAgent:          r.UserAgent(),
		IPAddress:          requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlanResponse(record))
}

func (handler Handler) archivePlan(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request planArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchivePlan(r.Context(), adminauthapp.ArchivePlanCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		PlanID:      common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPlanResponse(record))
}

func (handler Handler) planEntitlements(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListPlanEntitlements(r.Context(), adminauthapp.ListPlanEntitlementsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, map[string][]planEntitlementFeatureResponse{
		"features": newPlanEntitlementFeatureResponses(records),
	})
}

func (handler Handler) updatePlanEntitlements(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request planEntitlementUpdateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	values := make([]ports.AdminPlanEntitlementValueInput, 0, len(request.Values))
	for _, value := range request.Values {
		values = append(values, ports.AdminPlanEntitlementValueInput{
			PlanID:     common.ID(value.PlanID),
			FeatureKey: value.FeatureKey,
			Enabled:    value.Enabled,
			LimitValue: value.LimitValue,
		})
	}
	records, err := handler.service.UpdatePlanEntitlements(r.Context(), adminauthapp.UpdatePlanEntitlementsCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Values:      values,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, map[string][]planEntitlementFeatureResponse{
		"features": newPlanEntitlementFeatureResponses(records),
	})
}

// planCadence maps the wire cadence figures onto the shared pricing struct. These
// are the amounts actually charged at checkout and renewal.
func planCadence(request planCadenceRequest) ports.PlanCadencePricing {
	return ports.PlanCadencePricing{
		QuarterlyFirstMinor:   request.QuarterlyFirstMinor,
		QuarterlyRenewalMinor: request.QuarterlyRenewalMinor,
		YearlyFirstMinor:      request.YearlyFirstMinor,
		YearlyRenewalMinor:    request.YearlyRenewalMinor,
	}
}

func newPlanResponse(record ports.AdminPlanRecord) planResponse {
	return planResponse{
		PlanID:          record.PlanID.String(),
		Code:            record.Code,
		Name:            record.Name,
		MonthlyFeeMinor: record.MonthlyFeeMinor,
		YearlyFeeMinor:  record.YearlyFeeMinor,
		planCadenceRequest: planCadenceRequest{
			QuarterlyFirstMinor:   record.QuarterlyFirstMinor,
			QuarterlyRenewalMinor: record.QuarterlyRenewalMinor,
			YearlyFirstMinor:      record.YearlyFirstMinor,
			YearlyRenewalMinor:    record.YearlyRenewalMinor,
		},
		CommissionBPS:           record.CommissionBPS,
		DesignLimit:             record.DesignLimit,
		Features:                sanitizedPlanFeatures(record.Features),
		IsActive:                record.IsActive,
		BusinessCount:           record.BusinessCount,
		ActiveSubscriptionCount: record.ActiveSubscriptionCount,
		EstimatedMRRMinor:       record.EstimatedMRRMinor,
		CreatedAt:               record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:               record.UpdatedAt.Format(time.RFC3339),
	}
}

func newPlanEntitlementFeatureResponses(
	records []ports.AdminPlanEntitlementFeatureRecord,
) []planEntitlementFeatureResponse {
	out := make([]planEntitlementFeatureResponse, 0, len(records))
	for _, record := range records {
		values := make([]planEntitlementValueResponse, 0, len(record.Values))
		for _, value := range record.Values {
			values = append(values, planEntitlementValueResponse{
				PlanID:     value.PlanID.String(),
				PlanCode:   value.PlanCode,
				Enabled:    value.Enabled,
				LimitValue: value.LimitValue,
				UpdatedAt:  value.UpdatedAt.Format(time.RFC3339),
			})
		}
		out = append(out, planEntitlementFeatureResponse{
			FeatureKey:  record.FeatureKey,
			Label:       record.Label,
			Description: record.Description,
			Category:    record.Category,
			ValueType:   record.ValueType,
			Unit:        record.Unit,
			SortOrder:   record.SortOrder,
			IsActive:    record.IsActive,
			Values:      values,
			CreatedAt:   record.CreatedAt.Format(time.RFC3339),
			UpdatedAt:   record.UpdatedAt.Format(time.RFC3339),
		})
	}
	return out
}

// sanitizedPlanFeatures returns a non-nil, catalogue-only benefit map so the JSON
// response always carries an object (never null) of recognised feature keys.
func sanitizedPlanFeatures(features map[string]bool) map[string]bool {
	return business.SanitizeFeatures(features)
}
