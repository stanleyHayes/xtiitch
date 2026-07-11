package adminauthhttp

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type promotionUpsertRequest struct {
	BusinessID            string     `json:"business_id"`
	TargetCollectionID    string     `json:"target_collection_id"`
	TargetDesignID        string     `json:"target_design_id"`
	Code                  string     `json:"code"`
	Title                 string     `json:"title"`
	Description           string     `json:"description"`
	DiscountType          string     `json:"discount_type"`
	DiscountValue         int64      `json:"discount_value"`
	MaxDiscountMinor      *int64     `json:"max_discount_minor"`
	MinSpendMinor         int64      `json:"min_spend_minor"`
	UsageLimitGlobal      *int       `json:"usage_limit_global"`
	UsageLimitPerCustomer *int       `json:"usage_limit_per_customer"`
	FundingSource         string     `json:"funding_source"`
	Scope                 string     `json:"scope"`
	Status                string     `json:"status"`
	StartsAt              *time.Time `json:"starts_at"`
	EndsAt                *time.Time `json:"ends_at"`
}

type promotionArchiveRequest struct {
	Reason string `json:"reason"`
}

type adCampaignUpsertRequest struct {
	BusinessID    string     `json:"business_id"`
	PlacementType string     `json:"placement_type"`
	TargetRefID   string     `json:"target_ref_id"`
	Headline      string     `json:"headline"`
	Description   string     `json:"description"`
	Status        string     `json:"status"`
	PricingModel  string     `json:"pricing_model"`
	BudgetMinor   int64      `json:"budget_minor"`
	DailyCapMinor *int64     `json:"daily_cap_minor"`
	StartsAt      *time.Time `json:"starts_at"`
	EndsAt        *time.Time `json:"ends_at"`
	ReviewNote    string     `json:"review_note"`
}

type adCampaignArchiveRequest struct {
	Reason string `json:"reason"`
}

type adCampaignPaymentRequest struct {
	CustomerEmail string `json:"customer_email"`
}

type promotionResponse struct {
	PromotionID           string                        `json:"promotion_id"`
	BusinessID            string                        `json:"business_id,omitempty"`
	BusinessName          string                        `json:"business_name"`
	BusinessHandle        string                        `json:"business_handle"`
	Code                  string                        `json:"code"`
	Title                 string                        `json:"title"`
	Description           string                        `json:"description"`
	DiscountType          string                        `json:"discount_type"`
	DiscountValue         int64                         `json:"discount_value"`
	MaxDiscountMinor      *int64                        `json:"max_discount_minor,omitempty"`
	MinSpendMinor         int64                         `json:"min_spend_minor"`
	UsageLimitGlobal      *int                          `json:"usage_limit_global,omitempty"`
	UsageLimitPerCustomer *int                          `json:"usage_limit_per_customer,omitempty"`
	FundingSource         string                        `json:"funding_source"`
	Scope                 string                        `json:"scope"`
	TargetCollectionID    string                        `json:"target_collection_id,omitempty"`
	TargetDesignID        string                        `json:"target_design_id,omitempty"`
	Status                string                        `json:"status"`
	StartsAt              string                        `json:"starts_at,omitempty"`
	EndsAt                string                        `json:"ends_at,omitempty"`
	RedemptionCount       int                           `json:"redemption_count"`
	DiscountRedeemedMinor int64                         `json:"discount_redeemed_minor"`
	RecentRedemptions     []promotionRedemptionResponse `json:"recent_redemptions"`
	CreatedAt             string                        `json:"created_at"`
	UpdatedAt             string                        `json:"updated_at"`
}

type promotionRedemptionResponse struct {
	PromotionRedemptionID string `json:"promotion_redemption_id"`
	PromotionID           string `json:"promotion_id"`
	BusinessID            string `json:"business_id"`
	OrderID               string `json:"order_id,omitempty"`
	CustomerID            string `json:"customer_id,omitempty"`
	CustomerName          string `json:"customer_name"`
	DiscountMinor         int64  `json:"discount_minor"`
	Status                string `json:"status"`
	RedeemedAt            string `json:"redeemed_at,omitempty"`
	CreatedAt             string `json:"created_at"`
	UpdatedAt             string `json:"updated_at"`
}

type adCampaignResponse struct {
	CampaignID      string                      `json:"campaign_id"`
	BusinessID      string                      `json:"business_id"`
	BusinessName    string                      `json:"business_name"`
	BusinessHandle  string                      `json:"business_handle"`
	PlacementType   string                      `json:"placement_type"`
	TargetRefID     string                      `json:"target_ref_id"`
	TargetLabel     string                      `json:"target_label"`
	Headline        string                      `json:"headline"`
	Description     string                      `json:"description"`
	Status          string                      `json:"status"`
	PricingModel    string                      `json:"pricing_model"`
	BudgetMinor     int64                       `json:"budget_minor"`
	SpendMinor      int64                       `json:"spend_minor"`
	DailyCapMinor   *int64                      `json:"daily_cap_minor,omitempty"`
	StartsAt        string                      `json:"starts_at"`
	EndsAt          string                      `json:"ends_at"`
	ImpressionCount int                         `json:"impression_count"`
	ClickCount      int                         `json:"click_count"`
	ClickRateBPS    int                         `json:"click_rate_bps"`
	ReviewNote      string                      `json:"review_note"`
	Payments        []adCampaignPaymentResponse `json:"payments"`
	CreatedAt       string                      `json:"created_at"`
	UpdatedAt       string                      `json:"updated_at"`
}

type adCampaignPaymentResponse struct {
	PaymentID         string `json:"payment_id"`
	CampaignID        string `json:"campaign_id"`
	BusinessID        string `json:"business_id"`
	Provider          string `json:"provider"`
	ProviderReference string `json:"provider_reference"`
	PaymentURL        string `json:"payment_url"`
	AmountMinor       int64  `json:"amount_minor"`
	Currency          string `json:"currency"`
	Status            string `json:"status"`
	PaidAt            string `json:"paid_at,omitempty"`
	FailedAt          string `json:"failed_at,omitempty"`
	FailureReason     string `json:"failure_reason"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at"`
}

type adCampaignPaymentCollectResponse struct {
	Payment          adCampaignPaymentResponse `json:"payment"`
	Created          bool                      `json:"created"`
	AuthorizationURL string                    `json:"authorization_url"`
}

func (handler Handler) promotions(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListPromotions(r.Context(), adminauthapp.ListPromotionsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]promotionResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newPromotionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]promotionResponse{"promotions": out})
}

func (handler Handler) createPromotion(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request promotionUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreatePromotion(r.Context(), adminauthapp.CreatePromotionCommand{
		ActorUserID:           principal.AdminUserID,
		ActorRole:             principal.Role,
		BusinessID:            promotionBusinessID(request.BusinessID),
		Code:                  request.Code,
		Title:                 request.Title,
		Description:           request.Description,
		DiscountType:          request.DiscountType,
		DiscountValue:         request.DiscountValue,
		MaxDiscountMinor:      request.MaxDiscountMinor,
		MinSpendMinor:         request.MinSpendMinor,
		UsageLimitGlobal:      request.UsageLimitGlobal,
		UsageLimitPerCustomer: request.UsageLimitPerCustomer,
		FundingSource:         request.FundingSource,
		Scope:                 request.Scope,
		TargetCollectionID:    optionalCommonID(request.TargetCollectionID),
		TargetDesignID:        optionalCommonID(request.TargetDesignID),
		Status:                request.Status,
		StartsAt:              request.StartsAt,
		EndsAt:                request.EndsAt,
		UserAgent:             r.UserAgent(),
		IPAddress:             requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newPromotionResponse(record))
}

func (handler Handler) updatePromotion(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request promotionUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdatePromotion(r.Context(), adminauthapp.UpdatePromotionCommand{
		ActorUserID:           principal.AdminUserID,
		ActorRole:             principal.Role,
		PromotionID:           common.ID(chi.URLParam(r, "id")),
		BusinessID:            promotionBusinessID(request.BusinessID),
		Code:                  request.Code,
		Title:                 request.Title,
		Description:           request.Description,
		DiscountType:          request.DiscountType,
		DiscountValue:         request.DiscountValue,
		MaxDiscountMinor:      request.MaxDiscountMinor,
		MinSpendMinor:         request.MinSpendMinor,
		UsageLimitGlobal:      request.UsageLimitGlobal,
		UsageLimitPerCustomer: request.UsageLimitPerCustomer,
		FundingSource:         request.FundingSource,
		Scope:                 request.Scope,
		TargetCollectionID:    optionalCommonID(request.TargetCollectionID),
		TargetDesignID:        optionalCommonID(request.TargetDesignID),
		Status:                request.Status,
		StartsAt:              request.StartsAt,
		EndsAt:                request.EndsAt,
		UserAgent:             r.UserAgent(),
		IPAddress:             requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPromotionResponse(record))
}

func (handler Handler) archivePromotion(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request promotionArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchivePromotion(r.Context(), adminauthapp.ArchivePromotionCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		PromotionID: common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newPromotionResponse(record))
}

func (handler Handler) adCampaigns(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListAdCampaigns(r.Context(), adminauthapp.ListAdCampaignsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]adCampaignResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newAdCampaignResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]adCampaignResponse{"campaigns": out})
}

func (handler Handler) createAdCampaign(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateAdCampaign(r.Context(), adminauthapp.CreateAdCampaignCommand{
		ActorUserID:   principal.AdminUserID,
		ActorRole:     principal.Role,
		BusinessID:    common.ID(strings.TrimSpace(request.BusinessID)),
		PlacementType: request.PlacementType,
		TargetRefID:   request.TargetRefID,
		Headline:      request.Headline,
		Description:   request.Description,
		Status:        request.Status,
		PricingModel:  request.PricingModel,
		BudgetMinor:   request.BudgetMinor,
		DailyCapMinor: request.DailyCapMinor,
		StartsAt:      request.StartsAt,
		EndsAt:        request.EndsAt,
		ReviewNote:    request.ReviewNote,
		UserAgent:     r.UserAgent(),
		IPAddress:     requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newAdCampaignResponse(record))
}

func (handler Handler) updateAdCampaign(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateAdCampaign(r.Context(), adminauthapp.UpdateAdCampaignCommand{
		ActorUserID:   principal.AdminUserID,
		ActorRole:     principal.Role,
		CampaignID:    common.ID(chi.URLParam(r, "id")),
		BusinessID:    common.ID(strings.TrimSpace(request.BusinessID)),
		PlacementType: request.PlacementType,
		TargetRefID:   request.TargetRefID,
		Headline:      request.Headline,
		Description:   request.Description,
		Status:        request.Status,
		PricingModel:  request.PricingModel,
		BudgetMinor:   request.BudgetMinor,
		DailyCapMinor: request.DailyCapMinor,
		StartsAt:      request.StartsAt,
		EndsAt:        request.EndsAt,
		ReviewNote:    request.ReviewNote,
		UserAgent:     r.UserAgent(),
		IPAddress:     requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdCampaignResponse(record))
}

func (handler Handler) archiveAdCampaign(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchiveAdCampaign(r.Context(), adminauthapp.ArchiveAdCampaignCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		CampaignID:  common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newAdCampaignResponse(record))
}

func (handler Handler) collectAdCampaignPayment(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request adCampaignPaymentRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	result, err := handler.service.CollectAdCampaignPayment(r.Context(), adminauthapp.CollectAdCampaignPaymentCommand{
		ActorUserID:   principal.AdminUserID,
		ActorRole:     principal.Role,
		CampaignID:    common.ID(chi.URLParam(r, "id")),
		CustomerEmail: request.CustomerEmail,
		UserAgent:     r.UserAgent(),
		IPAddress:     requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, adCampaignPaymentCollectResponse{
		Payment:          newAdCampaignPaymentResponse(result.Payment),
		Created:          result.Created,
		AuthorizationURL: result.AuthorizationURL,
	})
}

func newPromotionResponse(record ports.AdminPromotionRecord) promotionResponse {
	businessID := ""
	if record.BusinessID != nil {
		businessID = record.BusinessID.String()
	}
	redemptions := make([]promotionRedemptionResponse, 0, len(record.RecentRedemptions))
	for _, redemption := range record.RecentRedemptions {
		orderID := ""
		if redemption.OrderID != nil {
			orderID = redemption.OrderID.String()
		}
		customerID := ""
		if redemption.CustomerID != nil {
			customerID = redemption.CustomerID.String()
		}
		redemptions = append(redemptions, promotionRedemptionResponse{
			PromotionRedemptionID: redemption.PromotionRedemptionID.String(),
			PromotionID:           redemption.PromotionID.String(),
			BusinessID:            redemption.BusinessID.String(),
			OrderID:               orderID,
			CustomerID:            customerID,
			CustomerName:          redemption.CustomerName,
			DiscountMinor:         redemption.DiscountMinor,
			Status:                redemption.Status,
			RedeemedAt:            optionalTimeString(redemption.RedeemedAt),
			CreatedAt:             redemption.CreatedAt.Format(time.RFC3339),
			UpdatedAt:             redemption.UpdatedAt.Format(time.RFC3339),
		})
	}
	return promotionResponse{
		PromotionID:           record.PromotionID.String(),
		BusinessID:            businessID,
		BusinessName:          record.BusinessName,
		BusinessHandle:        record.BusinessHandle,
		Code:                  record.Code,
		Title:                 record.Title,
		Description:           record.Description,
		DiscountType:          record.DiscountType,
		DiscountValue:         record.DiscountValue,
		MaxDiscountMinor:      record.MaxDiscountMinor,
		MinSpendMinor:         record.MinSpendMinor,
		UsageLimitGlobal:      record.UsageLimitGlobal,
		UsageLimitPerCustomer: record.UsageLimitPerCustomer,
		FundingSource:         record.FundingSource,
		Scope:                 record.Scope,
		TargetCollectionID:    optionalIDString(record.TargetCollectionID),
		TargetDesignID:        optionalIDString(record.TargetDesignID),
		Status:                record.Status,
		StartsAt:              optionalTimeString(record.StartsAt),
		EndsAt:                optionalTimeString(record.EndsAt),
		RedemptionCount:       record.RedemptionCount,
		DiscountRedeemedMinor: record.DiscountRedeemedMinor,
		RecentRedemptions:     redemptions,
		CreatedAt:             record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:             record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAdCampaignResponse(record ports.AdminAdCampaignRecord) adCampaignResponse {
	payments := make([]adCampaignPaymentResponse, 0, len(record.RecentPayments))
	for _, payment := range record.RecentPayments {
		payments = append(payments, newAdCampaignPaymentResponse(payment))
	}
	return adCampaignResponse{
		CampaignID:      record.CampaignID.String(),
		BusinessID:      record.BusinessID.String(),
		BusinessName:    record.BusinessName,
		BusinessHandle:  record.BusinessHandle,
		PlacementType:   record.PlacementType,
		TargetRefID:     record.TargetRefID,
		TargetLabel:     record.TargetLabel,
		Headline:        record.Headline,
		Description:     record.Description,
		Status:          record.Status,
		PricingModel:    record.PricingModel,
		BudgetMinor:     record.BudgetMinor,
		SpendMinor:      record.SpendMinor,
		DailyCapMinor:   record.DailyCapMinor,
		StartsAt:        record.StartsAt.Format(time.RFC3339),
		EndsAt:          record.EndsAt.Format(time.RFC3339),
		ImpressionCount: record.ImpressionCount,
		ClickCount:      record.ClickCount,
		ClickRateBPS:    record.ClickRateBPS,
		ReviewNote:      record.ReviewNote,
		Payments:        payments,
		CreatedAt:       record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       record.UpdatedAt.Format(time.RFC3339),
	}
}

func newAdCampaignPaymentResponse(record ports.AdminAdCampaignPaymentRecord) adCampaignPaymentResponse {
	return adCampaignPaymentResponse{
		PaymentID:         record.PaymentID.String(),
		CampaignID:        record.CampaignID.String(),
		BusinessID:        record.BusinessID.String(),
		Provider:          record.Provider,
		ProviderReference: record.ProviderReference,
		PaymentURL:        record.PaymentURL,
		AmountMinor:       record.AmountMinor,
		Currency:          record.Currency,
		Status:            record.Status,
		PaidAt:            optionalTimeString(record.PaidAt),
		FailedAt:          optionalTimeString(record.FailedAt),
		FailureReason:     record.FailureReason,
		CreatedAt:         record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         record.UpdatedAt.Format(time.RFC3339),
	}
}
