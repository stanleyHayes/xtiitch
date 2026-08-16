package growthhttp

import (
	"errors"
	"net/http"
	"time"

	growthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/growth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type affiliateApplicationRequest struct {
	ApplicantType     string   `json:"applicant_type"`
	DisplayName       string   `json:"display_name"`
	ContactName       string   `json:"contact_name"`
	Email             string   `json:"email"`
	Phone             string   `json:"phone"`
	WebsiteURL        string   `json:"website_url"`
	RequestedCode     string   `json:"requested_code"`
	AudienceSummary   string   `json:"audience_summary"`
	PromotionChannels []string `json:"promotion_channels"`
	Consent           bool     `json:"consent"`
}

type affiliateApplicationResponse struct {
	ApplicationID string `json:"application_id"`
	DisplayName   string `json:"display_name"`
	RequestedCode string `json:"requested_code"`
	Status        string `json:"status"`
	CreatedAt     string `json:"created_at"`
}

func (handler Handler) checkAffiliateCodeAvailability(w http.ResponseWriter, r *http.Request) {
	result, err := handler.service.CheckAffiliateCodeAvailability(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"code": result.Code, "available": result.Available, "reason": result.Reason,
	})
}

func (handler Handler) submitAffiliateApplication(w http.ResponseWriter, r *http.Request) {
	var request affiliateApplicationRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.SubmitAffiliateApplication(
		r.Context(),
		growthapp.SubmitAffiliateApplicationCommand{
			ApplicantType:     request.ApplicantType,
			DisplayName:       request.DisplayName,
			ContactName:       request.ContactName,
			Email:             request.Email,
			Phone:             request.Phone,
			WebsiteURL:        request.WebsiteURL,
			RequestedCode:     request.RequestedCode,
			AudienceSummary:   request.AudienceSummary,
			PromotionChannels: request.PromotionChannels,
			Consent:           request.Consent,
			UserAgent:         r.UserAgent(),
			IPAddress:         requestIP(r),
		},
	)
	if err != nil {
		status, code := affiliateApplicationError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAffiliateApplicationResponse(record))
}

func affiliateApplicationError(err error) (int, string) {
	switch {
	case errors.Is(err, growthapp.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_application"
	case errors.Is(err, growthapp.ErrAffiliateCodeTaken):
		return http.StatusConflict, "affiliate_code_taken"
	case errors.Is(err, growthapp.ErrAffiliateEmailTaken):
		return http.StatusConflict, "affiliate_email_taken"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func newAffiliateApplicationResponse(record ports.AffiliateApplicationRecord) affiliateApplicationResponse {
	return affiliateApplicationResponse{
		ApplicationID: record.ApplicationID.String(),
		DisplayName:   record.DisplayName,
		RequestedCode: record.RequestedCode,
		Status:        record.Status,
		CreatedAt:     record.CreatedAt.Format(time.RFC3339),
	}
}
