package cataloguehttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	catalogueapp "github.com/xcreativs/xtiitch/apps/api/internal/application/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type businessAffiliateProgrammeBody struct {
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

type businessAffiliateProgrammeResponse struct {
	AffiliateProgrammeID              string `json:"affiliate_programme_id"`
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
	AffiliateCount                    int64  `json:"affiliate_count"`
	CreatedAt                         string `json:"created_at"`
	UpdatedAt                         string `json:"updated_at"`
}

type businessAffiliateBody struct {
	AffiliateProgrammeID       string  `json:"affiliate_programme_id"`
	Code                       string  `json:"code"`
	DisplayName                string  `json:"display_name"`
	ContactName                string  `json:"contact_name"`
	Email                      string  `json:"email"`
	Phone                      string  `json:"phone"`
	PurchaseCommissionBPS      int     `json:"purchase_commission_bps"`
	FirstPaidPlanCommissionBPS int     `json:"first_paid_plan_commission_bps"`
	CookieWindowDays           int     `json:"cookie_window_days"`
	Status                     string  `json:"status"`
	TargetScope                string  `json:"target_scope"`
	TargetRefID                *string `json:"target_ref_id"`
}

type businessAffiliateResponse struct {
	AffiliateID                string  `json:"affiliate_id"`
	AffiliateProgrammeID       string  `json:"affiliate_programme_id"`
	ProgrammeName              string  `json:"programme_name"`
	Code                       string  `json:"code"`
	DisplayName                string  `json:"display_name"`
	ContactName                string  `json:"contact_name"`
	Email                      string  `json:"email"`
	Phone                      string  `json:"phone"`
	PurchaseCommissionBPS      int     `json:"purchase_commission_bps"`
	FirstPaidPlanCommissionBPS int     `json:"first_paid_plan_commission_bps"`
	CookieWindowDays           int     `json:"cookie_window_days"`
	Status                     string  `json:"status"`
	TargetScope                string  `json:"target_scope"`
	TargetRefID                *string `json:"target_ref_id"`
	CreatedAt                  string  `json:"created_at"`
	UpdatedAt                  string  `json:"updated_at"`
}

type businessAffiliateAttributionResponse struct {
	AffiliateID     string `json:"affiliate_id"`
	Code            string `json:"code"`
	DisplayName     string `json:"display_name"`
	ClickCount      int64  `json:"click_count"`
	SignupCount     int64  `json:"signup_count"`
	ConversionCount int64  `json:"conversion_count"`
	GrossMinor      int64  `json:"gross_minor"`
	CommissionMinor int64  `json:"commission_minor"`
	LastActivityAt  string `json:"last_activity_at,omitempty"`
}

func (handler Handler) listAffiliateProgrammes(w http.ResponseWriter, r *http.Request) {
	principal, ok := businessAffiliatePrincipal(w, r)
	if !ok {
		return
	}
	records, err := handler.service.ListBusinessAffiliateProgrammes(
		r.Context(),
		principal.TenantScope(),
		principal.Role,
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]businessAffiliateProgrammeResponse, 0, len(records))
	for _, record := range records {
		out = append(out, toBusinessAffiliateProgrammeResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{"programmes": out})
}

func (handler Handler) createAffiliateProgramme(w http.ResponseWriter, r *http.Request) {
	principal, body, ok := decodeBusinessAffiliateProgramme(w, r)
	if !ok {
		return
	}
	record, err := handler.service.CreateBusinessAffiliateProgramme(
		r.Context(),
		body.toCommand(principal, ""),
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toBusinessAffiliateProgrammeResponse(record))
}

func (handler Handler) updateAffiliateProgramme(w http.ResponseWriter, r *http.Request) {
	principal, body, ok := decodeBusinessAffiliateProgramme(w, r)
	if !ok {
		return
	}
	record, err := handler.service.UpdateBusinessAffiliateProgramme(
		r.Context(),
		body.toCommand(principal, common.ID(chi.URLParam(r, "id"))),
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toBusinessAffiliateProgrammeResponse(record))
}

func (handler Handler) listBusinessAffiliates(w http.ResponseWriter, r *http.Request) {
	principal, ok := businessAffiliatePrincipal(w, r)
	if !ok {
		return
	}
	records, err := handler.service.ListBusinessAffiliates(
		r.Context(),
		principal.TenantScope(),
		principal.Role,
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]businessAffiliateResponse, 0, len(records))
	for _, record := range records {
		out = append(out, toBusinessAffiliateResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{"affiliates": out})
}

func (handler Handler) createBusinessAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, body, ok := decodeBusinessAffiliate(w, r)
	if !ok {
		return
	}
	record, err := handler.service.CreateBusinessAffiliate(
		r.Context(),
		body.toCommand(principal, ""),
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toBusinessAffiliateResponse(record))
}

func (handler Handler) updateBusinessAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, body, ok := decodeBusinessAffiliate(w, r)
	if !ok {
		return
	}
	record, err := handler.service.UpdateBusinessAffiliate(
		r.Context(),
		body.toCommand(principal, common.ID(chi.URLParam(r, "id"))),
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toBusinessAffiliateResponse(record))
}

func (handler Handler) pauseBusinessAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, ok := businessAffiliatePrincipal(w, r)
	if !ok {
		return
	}
	record, err := handler.service.PauseBusinessAffiliate(
		r.Context(),
		principal.TenantScope(),
		principal.UserID,
		principal.Role,
		common.ID(chi.URLParam(r, "id")),
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toBusinessAffiliateResponse(record))
}

func (handler Handler) businessAffiliateAttribution(w http.ResponseWriter, r *http.Request) {
	principal, ok := businessAffiliatePrincipal(w, r)
	if !ok {
		return
	}
	records, err := handler.service.ListBusinessAffiliateAttribution(
		r.Context(),
		principal.TenantScope(),
		principal.Role,
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]businessAffiliateAttributionResponse, 0, len(records))
	for _, record := range records {
		response := businessAffiliateAttributionResponse{
			AffiliateID: record.AffiliateID.String(), Code: record.Code,
			DisplayName: record.DisplayName, ClickCount: record.ClickCount,
			SignupCount: record.SignupCount, ConversionCount: record.ConversionCount,
			GrossMinor: record.GrossMinor, CommissionMinor: record.CommissionMinor,
		}
		if record.LastActivityAt != nil {
			response.LastActivityAt = record.LastActivityAt.Format(time.RFC3339)
		}
		out = append(out, response)
	}
	writeJSON(w, http.StatusOK, map[string]any{"attribution": out})
}

func decodeBusinessAffiliateProgramme(
	w http.ResponseWriter,
	r *http.Request,
) (authhttp.Principal, businessAffiliateProgrammeBody, bool) {
	principal, ok := businessAffiliatePrincipal(w, r)
	if !ok {
		return authhttp.Principal{}, businessAffiliateProgrammeBody{}, false
	}
	var body businessAffiliateProgrammeBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return authhttp.Principal{}, businessAffiliateProgrammeBody{}, false
	}
	return principal, body, true
}

func decodeBusinessAffiliate(
	w http.ResponseWriter,
	r *http.Request,
) (authhttp.Principal, businessAffiliateBody, bool) {
	principal, ok := businessAffiliatePrincipal(w, r)
	if !ok {
		return authhttp.Principal{}, businessAffiliateBody{}, false
	}
	var body businessAffiliateBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return authhttp.Principal{}, businessAffiliateBody{}, false
	}
	return principal, body, true
}

func businessAffiliatePrincipal(w http.ResponseWriter, r *http.Request) (authhttp.Principal, bool) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
	}
	return principal, ok
}

func (body businessAffiliateProgrammeBody) toCommand(
	principal authhttp.Principal,
	programmeID common.ID,
) catalogueapp.BusinessAffiliateProgrammeCommand {
	return catalogueapp.BusinessAffiliateProgrammeCommand{
		Scope: principal.TenantScope(), ActorUserID: principal.UserID,
		ActorRole: principal.Role, AffiliateProgrammeID: programmeID,
		Name: body.Name, Description: body.Description, Status: body.Status,
		DefaultPurchaseCommissionBPS:      body.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: body.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  body.CookieWindowDays, HoldDays: body.HoldDays,
		PayoutMode: body.PayoutMode, MinimumPayoutMinor: body.MinimumPayoutMinor,
		AllowedTargetScope: body.AllowedTargetScope,
	}
}

func (body businessAffiliateBody) toCommand(
	principal authhttp.Principal,
	affiliateID common.ID,
) catalogueapp.BusinessAffiliateCommand {
	command := catalogueapp.BusinessAffiliateCommand{
		Scope: principal.TenantScope(), ActorUserID: principal.UserID,
		ActorRole: principal.Role, AffiliateID: affiliateID,
		AffiliateProgrammeID: common.ID(body.AffiliateProgrammeID),
		Code:                 body.Code, DisplayName: body.DisplayName,
		ContactName: body.ContactName, Email: body.Email, Phone: body.Phone,
		PurchaseCommissionBPS:      body.PurchaseCommissionBPS,
		FirstPaidPlanCommissionBPS: body.FirstPaidPlanCommissionBPS,
		CookieWindowDays:           body.CookieWindowDays, Status: body.Status,
		TargetScope: body.TargetScope,
	}
	if body.TargetRefID != nil && *body.TargetRefID != "" {
		value := common.ID(*body.TargetRefID)
		command.TargetRefID = &value
	}
	return command
}

func toBusinessAffiliateProgrammeResponse(
	record ports.BusinessAffiliateProgrammeRecord,
) businessAffiliateProgrammeResponse {
	return businessAffiliateProgrammeResponse{
		AffiliateProgrammeID: record.AffiliateProgrammeID.String(),
		BusinessID:           record.BusinessID.String(), Name: record.Name,
		Description: record.Description, Status: record.Status,
		DefaultPurchaseCommissionBPS:      record.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: record.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  record.CookieWindowDays, HoldDays: record.HoldDays,
		PayoutMode: record.PayoutMode, MinimumPayoutMinor: record.MinimumPayoutMinor,
		AllowedTargetScope: record.AllowedTargetScope,
		AffiliateCount:     record.AffiliateCount,
		CreatedAt:          record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          record.UpdatedAt.Format(time.RFC3339),
	}
}

func toBusinessAffiliateResponse(record ports.BusinessAffiliateRecord) businessAffiliateResponse {
	response := businessAffiliateResponse{
		AffiliateID:          record.AffiliateID.String(),
		AffiliateProgrammeID: record.AffiliateProgrammeID.String(),
		ProgrammeName:        record.ProgrammeName, Code: record.Code,
		DisplayName: record.DisplayName, ContactName: record.ContactName,
		Email: record.Email, Phone: record.Phone,
		PurchaseCommissionBPS:      record.PurchaseCommissionBPS,
		FirstPaidPlanCommissionBPS: record.FirstPaidPlanCommissionBPS,
		CookieWindowDays:           record.CookieWindowDays, Status: record.Status,
		TargetScope: record.TargetScope,
		CreatedAt:   record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   record.UpdatedAt.Format(time.RFC3339),
	}
	if record.TargetRefID != nil {
		value := record.TargetRefID.String()
		response.TargetRefID = &value
	}
	return response
}
