package adminauthhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type affiliateUpsertRequest struct {
	EntityType       string `json:"entity_type"`
	Code             string `json:"code"`
	DisplayName      string `json:"display_name"`
	ContactName      string `json:"contact_name"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	WebsiteURL       string `json:"website_url"`
	CommissionModel  string `json:"commission_model"`
	CommissionRate   int64  `json:"commission_rate"`
	CookieWindowDays int    `json:"cookie_window_days"`
	PayoutMode       string `json:"payout_mode"`
	PayoutReference  string `json:"payout_reference"`
	Status           string `json:"status"`
	Notes            string `json:"notes"`
}

type affiliateArchiveRequest struct {
	Reason string `json:"reason"`
}

type affiliateConversionStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type affiliatePayoutRequest struct {
	PayoutReference string `json:"payout_reference"`
	Notes           string `json:"notes"`
}

type affiliateResponse struct {
	AffiliateID      string `json:"affiliate_id"`
	EntityType       string `json:"entity_type"`
	Code             string `json:"code"`
	DisplayName      string `json:"display_name"`
	ContactName      string `json:"contact_name"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	WebsiteURL       string `json:"website_url"`
	CommissionModel  string `json:"commission_model"`
	CommissionRate   int64  `json:"commission_rate"`
	CookieWindowDays int    `json:"cookie_window_days"`
	PayoutMode       string `json:"payout_mode"`
	PayoutReference  string `json:"payout_reference"`
	Status           string `json:"status"`
	Notes            string `json:"notes"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

type affiliateAttributionResponse struct {
	AffiliateID             string                        `json:"affiliate_id"`
	Code                    string                        `json:"code"`
	DisplayName             string                        `json:"display_name"`
	ClickCount              int64                         `json:"click_count"`
	ConversionCount         int64                         `json:"conversion_count"`
	PendingConversionCount  int64                         `json:"pending_conversion_count"`
	ApprovedConversionCount int64                         `json:"approved_conversion_count"`
	SettledConversionCount  int64                         `json:"settled_conversion_count"`
	ReversedConversionCount int64                         `json:"reversed_conversion_count"`
	GrossMinor              int64                         `json:"gross_minor"`
	CommissionMinor         int64                         `json:"commission_minor"`
	RecentConversions       []affiliateConversionResponse `json:"recent_conversions"`
	RecentPayouts           []affiliatePayoutResponse     `json:"recent_payouts"`
	LastActivityAt          string                        `json:"last_activity_at,omitempty"`
}

type affiliateConversionResponse struct {
	ConversionID     string `json:"conversion_id"`
	AffiliateID      string `json:"affiliate_id"`
	BusinessID       string `json:"business_id"`
	BusinessName     string `json:"business_name"`
	OrderID          string `json:"order_id"`
	GrossMinor       int64  `json:"gross_minor"`
	CommissionMinor  int64  `json:"commission_minor"`
	Status           string `json:"status"`
	AttributionModel string `json:"attribution_model"`
	HoldUntil        string `json:"hold_until,omitempty"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

type affiliatePayoutResponse struct {
	PayoutBatchID   string `json:"payout_batch_id"`
	AffiliateID     string `json:"affiliate_id"`
	DisplayName     string `json:"display_name"`
	PayoutMode      string `json:"payout_mode"`
	PayoutReference string `json:"payout_reference"`
	ConversionCount int    `json:"conversion_count"`
	GrossMinor      int64  `json:"gross_minor"`
	CommissionMinor int64  `json:"commission_minor"`
	Status          string `json:"status"`
	Notes           string `json:"notes"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

func (handler Handler) affiliates(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListAffiliates(r.Context(), adminauthapp.ListAffiliatesCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]affiliateResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAffiliateResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]affiliateResponse{"affiliates": out})
}

func (handler Handler) affiliateAttribution(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListAffiliateAttribution(r.Context(), adminauthapp.ListAffiliateAttributionCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]affiliateAttributionResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAffiliateAttributionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]affiliateAttributionResponse{"attribution": out})
}

func (handler Handler) updateAffiliateConversionStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateConversionStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateAffiliateConversionStatus(
		r.Context(),
		adminauthapp.UpdateAffiliateConversionStatusCommand{
			ActorUserID:  principal.AdminUserID,
			ActorRole:    principal.Role,
			ConversionID: common.ID(chi.URLParam(r, "id")),
			Status:       request.Status,
			Reason:       request.Reason,
			UserAgent:    r.UserAgent(),
			IPAddress:    requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAffiliateConversionResponse(record))
}

func (handler Handler) createAffiliatePayout(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliatePayoutRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateAffiliatePayout(
		r.Context(),
		adminauthapp.CreateAffiliatePayoutCommand{
			ActorUserID:     principal.AdminUserID,
			ActorRole:       principal.Role,
			AffiliateID:     common.ID(chi.URLParam(r, "id")),
			PayoutReference: request.PayoutReference,
			Notes:           request.Notes,
			UserAgent:       r.UserAgent(),
			IPAddress:       requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAffiliatePayoutResponse(record))
}

func (handler Handler) createAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateAffiliate(r.Context(), adminauthapp.CreateAffiliateCommand{
		ActorUserID:      principal.AdminUserID,
		ActorRole:        principal.Role,
		EntityType:       request.EntityType,
		Code:             request.Code,
		DisplayName:      request.DisplayName,
		ContactName:      request.ContactName,
		Email:            request.Email,
		Phone:            request.Phone,
		WebsiteURL:       request.WebsiteURL,
		CommissionModel:  request.CommissionModel,
		CommissionRate:   request.CommissionRate,
		CookieWindowDays: request.CookieWindowDays,
		PayoutMode:       request.PayoutMode,
		PayoutReference:  request.PayoutReference,
		Status:           request.Status,
		Notes:            request.Notes,
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAffiliateResponse(record))
}

func (handler Handler) updateAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateAffiliate(r.Context(), adminauthapp.UpdateAffiliateCommand{
		ActorUserID:      principal.AdminUserID,
		ActorRole:        principal.Role,
		AffiliateID:      common.ID(chi.URLParam(r, "id")),
		EntityType:       request.EntityType,
		Code:             request.Code,
		DisplayName:      request.DisplayName,
		ContactName:      request.ContactName,
		Email:            request.Email,
		Phone:            request.Phone,
		WebsiteURL:       request.WebsiteURL,
		CommissionModel:  request.CommissionModel,
		CommissionRate:   request.CommissionRate,
		CookieWindowDays: request.CookieWindowDays,
		PayoutMode:       request.PayoutMode,
		PayoutReference:  request.PayoutReference,
		Status:           request.Status,
		Notes:            request.Notes,
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAffiliateResponse(record))
}

func (handler Handler) archiveAffiliate(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request affiliateArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchiveAffiliate(r.Context(), adminauthapp.ArchiveAffiliateCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		AffiliateID: common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAffiliateResponse(record))
}

func newAffiliateResponse(record ports.AdminAffiliateRecord) affiliateResponse {
	return affiliateResponse{
		AffiliateID:      record.AffiliateID.String(),
		EntityType:       record.EntityType,
		Code:             record.Code,
		DisplayName:      record.DisplayName,
		ContactName:      record.ContactName,
		Email:            record.Email,
		Phone:            record.Phone,
		WebsiteURL:       record.WebsiteURL,
		CommissionModel:  record.CommissionModel,
		CommissionRate:   record.CommissionRate,
		CookieWindowDays: record.CookieWindowDays,
		PayoutMode:       record.PayoutMode,
		PayoutReference:  record.PayoutReference,
		Status:           record.Status,
		Notes:            record.Notes,
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAffiliateAttributionResponse(record ports.AdminAffiliateAttributionRecord) affiliateAttributionResponse {
	response := affiliateAttributionResponse{
		AffiliateID:             record.AffiliateID.String(),
		Code:                    record.Code,
		DisplayName:             record.DisplayName,
		ClickCount:              record.ClickCount,
		ConversionCount:         record.ConversionCount,
		PendingConversionCount:  record.PendingConversionCount,
		ApprovedConversionCount: record.ApprovedConversionCount,
		SettledConversionCount:  record.SettledConversionCount,
		ReversedConversionCount: record.ReversedConversionCount,
		GrossMinor:              record.GrossMinor,
		CommissionMinor:         record.CommissionMinor,
		RecentConversions:       make([]affiliateConversionResponse, 0, len(record.RecentConversions)),
		RecentPayouts:           make([]affiliatePayoutResponse, 0, len(record.RecentPayouts)),
	}
	if record.LastActivityAt != nil {
		response.LastActivityAt = record.LastActivityAt.Format(time.RFC3339)
	}
	for _, conversion := range record.RecentConversions {
		response.RecentConversions = append(response.RecentConversions, newAffiliateConversionResponse(conversion))
	}
	for _, payout := range record.RecentPayouts {
		response.RecentPayouts = append(response.RecentPayouts, newAffiliatePayoutResponse(payout))
	}
	return response
}

func newAffiliateConversionResponse(record ports.AdminAffiliateConversionRecord) affiliateConversionResponse {
	response := affiliateConversionResponse{
		ConversionID:     record.ConversionID.String(),
		AffiliateID:      record.AffiliateID.String(),
		BusinessID:       record.BusinessID.String(),
		BusinessName:     record.BusinessName,
		OrderID:          record.OrderID.String(),
		GrossMinor:       record.GrossMinor,
		CommissionMinor:  record.CommissionMinor,
		Status:           record.Status,
		AttributionModel: record.AttributionModel,
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        record.UpdatedAt.Format(time.RFC3339),
	}
	if record.HoldUntil != nil {
		response.HoldUntil = record.HoldUntil.Format(time.RFC3339)
	}
	return response
}

func newAffiliatePayoutResponse(record ports.AdminAffiliatePayoutRecord) affiliatePayoutResponse {
	return affiliatePayoutResponse{
		PayoutBatchID:   record.PayoutBatchID.String(),
		AffiliateID:     record.AffiliateID.String(),
		DisplayName:     record.DisplayName,
		PayoutMode:      record.PayoutMode,
		PayoutReference: record.PayoutReference,
		ConversionCount: record.ConversionCount,
		GrossMinor:      record.GrossMinor,
		CommissionMinor: record.CommissionMinor,
		Status:          record.Status,
		Notes:           record.Notes,
		CreatedAt:       record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       record.UpdatedAt.Format(time.RFC3339),
	}
}
