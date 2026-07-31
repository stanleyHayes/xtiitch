package adminauthhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (handler Handler) affiliateApplications(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	records, err := handler.service.ListAffiliateApplications(
		r.Context(),
		adminauthapp.ListAffiliateApplicationsCommand{ActorRole: principal.Role},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]affiliateApplicationResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAffiliateApplicationResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]affiliateApplicationResponse{
		"applications": out,
	})
}

func (handler Handler) decideAffiliateApplication(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request affiliateApplicationDecisionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.DecideAffiliateApplication(
		r.Context(),
		adminauthapp.DecideAffiliateApplicationCommand{
			ActorUserID:                principal.AdminUserID,
			ActorRole:                  principal.Role,
			ApplicationID:              common.ID(chi.URLParam(r, "id")),
			Decision:                   request.Decision,
			ReviewNote:                 request.ReviewNote,
			PurchaseCommissionBPS:      request.PurchaseCommissionBPS,
			FirstPaidPlanCommissionBPS: request.FirstPaidPlanCommissionBPS,
			CookieWindowDays:           request.CookieWindowDays,
			PayoutMode:                 request.PayoutMode,
			UserAgent:                  r.UserAgent(),
			IPAddress:                  requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, newAffiliateApplicationResponse(record))
}

func newAffiliateApplicationResponse(
	record ports.AdminAffiliateApplicationRecord,
) affiliateApplicationResponse {
	response := affiliateApplicationResponse{
		ApplicationID:     record.ApplicationID.String(),
		ApplicantType:     record.ApplicantType,
		DisplayName:       record.DisplayName,
		ContactName:       record.ContactName,
		Email:             record.Email,
		Phone:             record.Phone,
		WebsiteURL:        record.WebsiteURL,
		RequestedCode:     record.RequestedCode,
		AudienceSummary:   record.AudienceSummary,
		PromotionChannels: record.PromotionChannels,
		Status:            record.Status,
		ReviewNote:        record.ReviewNote,
		CreatedAt:         record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         record.UpdatedAt.Format(time.RFC3339),
	}
	if record.AffiliateID != nil {
		response.AffiliateID = record.AffiliateID.String()
	}
	if record.ReviewedAt != nil {
		response.ReviewedAt = record.ReviewedAt.Format(time.RFC3339)
	}
	return response
}
