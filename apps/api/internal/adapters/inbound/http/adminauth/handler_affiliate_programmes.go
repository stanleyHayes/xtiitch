package adminauthhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type affiliateProgrammeRequest struct {
	OwnerType                         string `json:"owner_type"`
	BusinessID                        string `json:"business_id"`
	Name                              string `json:"name"`
	Description                       string `json:"description"`
	Status                            string `json:"status"`
	DefaultPurchaseCommissionBPS      int    `json:"default_purchase_commission_bps"`
	DefaultFirstPaidPlanCommissionBPS int    `json:"default_first_paid_plan_commission_bps"`
	CookieWindowDays                  int    `json:"cookie_window_days"`
	HoldDays                          int    `json:"hold_days"`
	PayoutMode                        string `json:"payout_mode"`
	MinimumPayoutMinor                int64  `json:"minimum_payout_minor"`
	AllowedTargetScope                string `json:"allowed_target_scope"`
}

type affiliateProgrammeResponse struct {
	AffiliateProgrammeID              string `json:"affiliate_programme_id"`
	OwnerType                         string `json:"owner_type"`
	BusinessID                        string `json:"business_id,omitempty"`
	BusinessName                      string `json:"business_name,omitempty"`
	IsDefault                         bool   `json:"is_default"`
	Name                              string `json:"name"`
	Description                       string `json:"description"`
	Status                            string `json:"status"`
	DefaultPurchaseCommissionBPS      int    `json:"default_purchase_commission_bps"`
	DefaultFirstPaidPlanCommissionBPS int    `json:"default_first_paid_plan_commission_bps"`
	CookieWindowDays                  int    `json:"cookie_window_days"`
	HoldDays                          int    `json:"hold_days"`
	PayoutMode                        string `json:"payout_mode"`
	MinimumPayoutMinor                int64  `json:"minimum_payout_minor"`
	AllowedTargetScope                string `json:"allowed_target_scope"`
	AffiliateCount                    int64  `json:"affiliate_count"`
	CreatedAt                         string `json:"created_at"`
	UpdatedAt                         string `json:"updated_at"`
}

func (handler Handler) affiliateProgrammes(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	records, err := handler.service.ListAffiliateProgrammes(
		r.Context(),
		adminauthapp.ListAffiliateProgrammesCommand{ActorRole: principal.Role},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	out := make([]affiliateProgrammeResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAffiliateProgrammeResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]affiliateProgrammeResponse{"programmes": out})
}

func (handler Handler) createAffiliateProgramme(w http.ResponseWriter, r *http.Request) {
	principal, request, ok := handler.decodeAffiliateProgrammeRequest(w, r)
	if !ok {
		return
	}
	record, err := handler.service.CreateAffiliateProgramme(r.Context(), adminauthapp.CreateAffiliateProgrammeCommand{
		ActorUserID: principal.AdminUserID, ActorRole: principal.Role,
		OwnerType: request.OwnerType, BusinessID: optionalID(request.BusinessID),
		Name: request.Name, Description: request.Description, Status: request.Status,
		DefaultPurchaseCommissionBPS:      request.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: request.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  request.CookieWindowDays, HoldDays: request.HoldDays,
		PayoutMode: request.PayoutMode, MinimumPayoutMinor: request.MinimumPayoutMinor,
		AllowedTargetScope: request.AllowedTargetScope,
		UserAgent:          r.UserAgent(), IPAddress: requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusCreated, newAffiliateProgrammeResponse(record))
}

func (handler Handler) updateAffiliateProgramme(w http.ResponseWriter, r *http.Request) {
	principal, request, ok := handler.decodeAffiliateProgrammeRequest(w, r)
	if !ok {
		return
	}
	record, err := handler.service.UpdateAffiliateProgramme(r.Context(), adminauthapp.UpdateAffiliateProgrammeCommand{
		ActorUserID: principal.AdminUserID, ActorRole: principal.Role,
		AffiliateProgrammeID: common.ID(chi.URLParam(r, "id")),
		Name:                 request.Name, Description: request.Description, Status: request.Status,
		DefaultPurchaseCommissionBPS:      request.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: request.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  request.CookieWindowDays, HoldDays: request.HoldDays,
		PayoutMode: request.PayoutMode, MinimumPayoutMinor: request.MinimumPayoutMinor,
		AllowedTargetScope: request.AllowedTargetScope,
		UserAgent:          r.UserAgent(), IPAddress: requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, newAffiliateProgrammeResponse(record))
}

func (handler Handler) decodeAffiliateProgrammeRequest(
	w http.ResponseWriter,
	r *http.Request,
) (Principal, affiliateProgrammeRequest, bool) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return Principal{}, affiliateProgrammeRequest{}, false
	}
	var request affiliateProgrammeRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return Principal{}, affiliateProgrammeRequest{}, false
	}
	return principal, request, true
}

func newAffiliateProgrammeResponse(record ports.AdminAffiliateProgrammeRecord) affiliateProgrammeResponse {
	response := affiliateProgrammeResponse{
		AffiliateProgrammeID: record.AffiliateProgrammeID.String(),
		OwnerType:            record.OwnerType, BusinessName: record.BusinessName,
		IsDefault: record.IsDefault, Name: record.Name, Description: record.Description,
		Status: record.Status, DefaultPurchaseCommissionBPS: record.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: record.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  record.CookieWindowDays, HoldDays: record.HoldDays,
		PayoutMode: record.PayoutMode, MinimumPayoutMinor: record.MinimumPayoutMinor,
		AllowedTargetScope: record.AllowedTargetScope, AffiliateCount: record.AffiliateCount,
		CreatedAt: record.CreatedAt.Format(time.RFC3339), UpdatedAt: record.UpdatedAt.Format(time.RFC3339),
	}
	if record.BusinessID != nil {
		response.BusinessID = record.BusinessID.String()
	}
	return response
}

func optionalID(value string) *common.ID {
	if value == "" {
		return nil
	}
	id := common.ID(value)
	return &id
}
