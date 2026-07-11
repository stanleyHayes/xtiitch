package adminauthhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type subscriptionDiscountCodeUpsertRequest struct {
	Code                string     `json:"code"`
	DiscountType        string     `json:"discount_type"`
	DiscountValue       int        `json:"discount_value"`
	EligiblePlans       []string   `json:"eligible_plans"`
	EligibleCadences    []string   `json:"eligible_cadences"`
	FirstPurchaseOnly   bool       `json:"first_purchase_only"`
	MaxRedemptionsTotal *int       `json:"max_redemptions_total"`
	MaxPerAccount       int        `json:"max_per_account"`
	ValidFrom           *time.Time `json:"valid_from"`
	ValidUntil          *time.Time `json:"valid_until"`
	Active              bool       `json:"active"`
	OwnerName           string     `json:"owner_name"`
	BatchLabel          string     `json:"batch_label"`
	Stackable           bool       `json:"stackable"`
}

type subscriptionDiscountCodeArchiveRequest struct {
	Reason string `json:"reason"`
}

type subscriptionDiscountCodeResponse struct {
	DiscountCodeID      string                                   `json:"discount_code_id"`
	Code                string                                   `json:"code"`
	DiscountType        string                                   `json:"discount_type"`
	DiscountValue       int                                      `json:"discount_value"`
	EligiblePlans       []string                                 `json:"eligible_plans"`
	EligibleCadences    []string                                 `json:"eligible_cadences"`
	FirstPurchaseOnly   bool                                     `json:"first_purchase_only"`
	MaxRedemptionsTotal *int                                     `json:"max_redemptions_total,omitempty"`
	MaxPerAccount       int                                      `json:"max_per_account"`
	ValidFrom           string                                   `json:"valid_from,omitempty"`
	ValidUntil          string                                   `json:"valid_until,omitempty"`
	Active              bool                                     `json:"active"`
	OwnerName           string                                   `json:"owner_name"`
	BatchLabel          string                                   `json:"batch_label"`
	Stackable           bool                                     `json:"stackable"`
	ArchivedAt          string                                   `json:"archived_at,omitempty"`
	RedemptionCount     int                                      `json:"redemption_count"`
	AppliedCount        int                                      `json:"applied_count"`
	DiscountMinor       int64                                    `json:"discount_minor"`
	RecentRedemptions   []subscriptionDiscountRedemptionResponse `json:"recent_redemptions"`
	CreatedAt           string                                   `json:"created_at"`
	UpdatedAt           string                                   `json:"updated_at"`
}

type subscriptionDiscountRedemptionResponse struct {
	RedemptionID  string `json:"redemption_id"`
	BusinessID    string `json:"business_id"`
	BusinessName  string `json:"business_name"`
	PlanCode      string `json:"plan_code"`
	Cadence       string `json:"cadence"`
	AccountKey    string `json:"account_key"`
	Status        string `json:"status"`
	DiscountMinor int64  `json:"discount_minor"`
	CreatedAt     string `json:"created_at"`
	AppliedAt     string `json:"applied_at,omitempty"`
}

func (handler Handler) subscriptionDiscountCodes(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListSubscriptionDiscountCodes(r.Context(), adminauthapp.ListSubscriptionDiscountCodesCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	out := make([]subscriptionDiscountCodeResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newSubscriptionDiscountCodeResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]subscriptionDiscountCodeResponse{"discount_codes": out})
}

func (handler Handler) createSubscriptionDiscountCode(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionDiscountCodeUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}
	record, err := handler.service.CreateSubscriptionDiscountCode(r.Context(), adminauthapp.CreateSubscriptionDiscountCodeCommand{
		ActorUserID:         principal.AdminUserID,
		ActorRole:           principal.Role,
		Code:                request.Code,
		DiscountType:        request.DiscountType,
		DiscountValue:       request.DiscountValue,
		EligiblePlans:       request.EligiblePlans,
		EligibleCadences:    request.EligibleCadences,
		FirstPurchaseOnly:   request.FirstPurchaseOnly,
		MaxRedemptionsTotal: request.MaxRedemptionsTotal,
		MaxPerAccount:       request.MaxPerAccount,
		ValidFrom:           request.ValidFrom,
		ValidUntil:          request.ValidUntil,
		Active:              request.Active,
		OwnerName:           request.OwnerName,
		BatchLabel:          request.BatchLabel,
		Stackable:           request.Stackable,
		UserAgent:           r.UserAgent(),
		IPAddress:           requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newSubscriptionDiscountCodeResponse(record))
}

func (handler Handler) updateSubscriptionDiscountCode(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionDiscountCodeUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}
	record, err := handler.service.UpdateSubscriptionDiscountCode(r.Context(), adminauthapp.UpdateSubscriptionDiscountCodeCommand{
		ActorUserID:         principal.AdminUserID,
		ActorRole:           principal.Role,
		DiscountCodeID:      common.ID(chi.URLParam(r, "id")),
		Code:                request.Code,
		DiscountType:        request.DiscountType,
		DiscountValue:       request.DiscountValue,
		EligiblePlans:       request.EligiblePlans,
		EligibleCadences:    request.EligibleCadences,
		FirstPurchaseOnly:   request.FirstPurchaseOnly,
		MaxRedemptionsTotal: request.MaxRedemptionsTotal,
		MaxPerAccount:       request.MaxPerAccount,
		ValidFrom:           request.ValidFrom,
		ValidUntil:          request.ValidUntil,
		Active:              request.Active,
		OwnerName:           request.OwnerName,
		BatchLabel:          request.BatchLabel,
		Stackable:           request.Stackable,
		UserAgent:           r.UserAgent(),
		IPAddress:           requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionDiscountCodeResponse(record))
}

func (handler Handler) archiveSubscriptionDiscountCode(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionDiscountCodeArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}
	record, err := handler.service.ArchiveSubscriptionDiscountCode(r.Context(), adminauthapp.ArchiveSubscriptionDiscountCodeCommand{
		ActorUserID:    principal.AdminUserID,
		ActorRole:      principal.Role,
		DiscountCodeID: common.ID(chi.URLParam(r, "id")),
		Reason:         request.Reason,
		UserAgent:      r.UserAgent(),
		IPAddress:      requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionDiscountCodeResponse(record))
}

func newSubscriptionDiscountCodeResponse(
	record ports.AdminSubscriptionDiscountCodeRecord,
) subscriptionDiscountCodeResponse {
	redemptions := make([]subscriptionDiscountRedemptionResponse, 0, len(record.RecentRedemptions))
	for _, redemption := range record.RecentRedemptions {
		redemptions = append(redemptions, subscriptionDiscountRedemptionResponse{
			RedemptionID:  redemption.RedemptionID.String(),
			BusinessID:    redemption.BusinessID.String(),
			BusinessName:  redemption.BusinessName,
			PlanCode:      redemption.PlanCode,
			Cadence:       redemption.Cadence,
			AccountKey:    redemption.AccountKey,
			Status:        redemption.Status,
			DiscountMinor: redemption.DiscountMinor,
			CreatedAt:     redemption.CreatedAt.Format(time.RFC3339),
			AppliedAt:     optionalTimeString(redemption.AppliedAt),
		})
	}
	return subscriptionDiscountCodeResponse{
		DiscountCodeID:      record.DiscountCodeID.String(),
		Code:                record.Code,
		DiscountType:        record.DiscountType,
		DiscountValue:       record.DiscountValue,
		EligiblePlans:       record.EligiblePlans,
		EligibleCadences:    record.EligibleCadences,
		FirstPurchaseOnly:   record.FirstPurchaseOnly,
		MaxRedemptionsTotal: record.MaxRedemptionsTotal,
		MaxPerAccount:       record.MaxPerAccount,
		ValidFrom:           optionalTimeString(record.ValidFrom),
		ValidUntil:          optionalTimeString(record.ValidUntil),
		Active:              record.Active,
		OwnerName:           record.OwnerName,
		BatchLabel:          record.BatchLabel,
		Stackable:           record.Stackable,
		ArchivedAt:          optionalTimeString(record.ArchivedAt),
		RedemptionCount:     record.RedemptionCount,
		AppliedCount:        record.AppliedCount,
		DiscountMinor:       record.DiscountMinor,
		RecentRedemptions:   redemptions,
		CreatedAt:           record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           record.UpdatedAt.Format(time.RFC3339),
	}
}
