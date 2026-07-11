package adminauthhttp

import (
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type queueMoneyReplayRequest struct {
	ProviderReference string `json:"provider_reference"`
	Reason            string `json:"reason"`
}

type reverseMoneyPaymentRequest struct {
	ProviderReference string `json:"provider_reference"`
	Reason            string `json:"reason"`
}

type settlementReviewHoldRequest struct {
	Hold   bool   `json:"hold"`
	Reason string `json:"reason"`
}

type riskReviewStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type moneyRailsResponse struct {
	WebhookEvents []moneyWebhookEventResponse `json:"webhook_events"`
	PayoutReviews []moneyPayoutReviewResponse `json:"payout_reviews"`
	UpdatedAt     string                      `json:"updated_at"`
}

type moneyWebhookEventResponse struct {
	ID                string `json:"id"`
	ProviderReference string `json:"provider_reference"`
	Business          string `json:"business"`
	Status            string `json:"status"`
	Purpose           string `json:"purpose"`
	AmountMinor       int64  `json:"amount_minor"`
	Attempts          int    `json:"attempts"`
	ReceivedAt        string `json:"received_at"`
	Note              string `json:"note"`
}

type moneyPayoutReviewResponse struct {
	ID              string `json:"id"`
	Business        string `json:"business"`
	SubaccountRef   string `json:"subaccount_ref"`
	Status          string `json:"status"`
	SettlementMinor int64  `json:"settlement_minor"`
	CommissionMinor int64  `json:"commission_minor"`
	NextAction      string `json:"next_action"`
	HoldActive      bool   `json:"hold_active"`
	HoldReason      string `json:"hold_reason"`
	HoldUpdatedAt   string `json:"hold_updated_at,omitempty"`
}

type moneyReplayRequestResponse struct {
	ReplayRequestID   string `json:"replay_request_id"`
	ProviderReference string `json:"provider_reference"`
	PaymentID         string `json:"payment_id,omitempty"`
	Business          string `json:"business"`
	Reason            string `json:"reason"`
	Status            string `json:"status"`
	CreatedAt         string `json:"created_at"`
}

type moneyReversalResponse struct {
	PaymentID                string `json:"payment_id"`
	ProviderReference        string `json:"provider_reference"`
	BusinessID               string `json:"business_id"`
	Business                 string `json:"business"`
	OrderID                  string `json:"order_id,omitempty"`
	PaymentReversed          bool   `json:"payment_reversed"`
	PromotionRedemptionCount int    `json:"promotion_redemption_count"`
	AffiliateConversionCount int    `json:"affiliate_conversion_count"`
	ReferralCount            int    `json:"referral_count"`
	ReferralRewardCount      int    `json:"referral_reward_count"`
	GeneratedPromotionCount  int    `json:"generated_promotion_count"`
	Reason                   string `json:"reason"`
	ReversedAt               string `json:"reversed_at"`
}

type riskReviewResponse struct {
	ReviewKey  string `json:"review_key"`
	BusinessID string `json:"business_id"`
	Title      string `json:"title"`
	Business   string `json:"business"`
	Level      string `json:"level"`
	Reason     string `json:"reason"`
	Owner      string `json:"owner"`
	Status     string `json:"status"`
	UpdatedAt  string `json:"updated_at"`
}

func (handler Handler) moneyRails(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	moneyRails, err := handler.service.GetMoneyRails(r.Context(), adminauthapp.GetMoneyRailsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newMoneyRailsResponse(moneyRails))
}

func (handler Handler) queueMoneyReplay(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request queueMoneyReplayRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.QueueMoneyReplay(r.Context(), adminauthapp.QueueMoneyReplayCommand{
		ActorUserID:       principal.AdminUserID,
		ActorRole:         principal.Role,
		ProviderReference: request.ProviderReference,
		Reason:            request.Reason,
		UserAgent:         r.UserAgent(),
		IPAddress:         requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newMoneyReplayRequestResponse(record))
}

func (handler Handler) reverseMoneyPayment(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request reverseMoneyPaymentRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ReverseMoneyPayment(r.Context(), adminauthapp.ReverseMoneyPaymentCommand{
		ActorUserID:       principal.AdminUserID,
		ActorRole:         principal.Role,
		ProviderReference: request.ProviderReference,
		Reason:            request.Reason,
		UserAgent:         r.UserAgent(),
		IPAddress:         requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newMoneyReversalResponse(record))
}

func (handler Handler) setSettlementReviewHold(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request settlementReviewHoldRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.SetSettlementReviewHold(
		r.Context(),
		adminauthapp.SetSettlementReviewHoldCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			BusinessID:  common.ID(chi.URLParam(r, "id")),
			Hold:        request.Hold,
			Reason:      request.Reason,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newMoneyPayoutReviewResponse(record))
}

func (handler Handler) riskReviews(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListRiskReviews(r.Context(), adminauthapp.ListRiskReviewsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]riskReviewResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newRiskReviewResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]riskReviewResponse{"reviews": out})
}

func (handler Handler) updateRiskReviewStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request riskReviewStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	reviewKey, err := url.PathUnescape(chi.URLParam(r, "key"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input")
		return
	}

	record, err := handler.service.SetRiskReviewStatus(
		r.Context(),
		adminauthapp.SetRiskReviewStatusCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			ReviewKey:   reviewKey,
			Status:      request.Status,
			Reason:      request.Reason,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newRiskReviewResponse(record))
}

func newMoneyRailsResponse(record ports.AdminMoneyRailsRecord) moneyRailsResponse {
	webhookEvents := make([]moneyWebhookEventResponse, 0, len(record.WebhookEvents))
	for _, event := range record.WebhookEvents {
		webhookEvents = append(webhookEvents, moneyWebhookEventResponse{
			ID:                event.ID,
			ProviderReference: event.ProviderReference,
			Business:          event.BusinessName,
			Status:            event.Status,
			Purpose:           event.Purpose,
			AmountMinor:       event.AmountMinor,
			Attempts:          event.Attempts,
			ReceivedAt:        event.ReceivedAt.Format(time.RFC3339),
			Note:              event.Note,
		})
	}

	payoutReviews := make([]moneyPayoutReviewResponse, 0, len(record.PayoutReviews))
	for _, review := range record.PayoutReviews {
		payoutReviews = append(payoutReviews, newMoneyPayoutReviewResponse(review))
	}

	return moneyRailsResponse{
		WebhookEvents: webhookEvents,
		PayoutReviews: payoutReviews,
		UpdatedAt:     record.UpdatedAt.Format(time.RFC3339),
	}
}

func newMoneyPayoutReviewResponse(record ports.AdminMoneyPayoutReviewRecord) moneyPayoutReviewResponse {
	holdUpdatedAt := ""
	if record.HoldUpdatedAt != nil {
		holdUpdatedAt = record.HoldUpdatedAt.Format(time.RFC3339)
	}

	return moneyPayoutReviewResponse{
		ID:              record.ID,
		Business:        record.BusinessName,
		SubaccountRef:   record.SubaccountRef,
		Status:          record.Status,
		SettlementMinor: record.SettlementMinor,
		CommissionMinor: record.CommissionMinor,
		NextAction:      record.NextAction,
		HoldActive:      record.HoldActive,
		HoldReason:      record.HoldReason,
		HoldUpdatedAt:   holdUpdatedAt,
	}
}

func newMoneyReplayRequestResponse(record ports.AdminMoneyReplayRequestRecord) moneyReplayRequestResponse {
	return moneyReplayRequestResponse{
		ReplayRequestID:   record.ReplayRequestID.String(),
		ProviderReference: record.ProviderReference,
		PaymentID:         record.PaymentID.String(),
		Business:          record.BusinessName,
		Reason:            record.Reason,
		Status:            record.Status,
		CreatedAt:         record.CreatedAt.Format(time.RFC3339),
	}
}

func newMoneyReversalResponse(record ports.AdminMoneyReversalRecord) moneyReversalResponse {
	response := moneyReversalResponse{
		PaymentID:                record.PaymentID.String(),
		ProviderReference:        record.ProviderReference,
		BusinessID:               record.BusinessID.String(),
		Business:                 record.BusinessName,
		PaymentReversed:          record.PaymentReversed,
		PromotionRedemptionCount: record.PromotionRedemptionCount,
		AffiliateConversionCount: record.AffiliateConversionCount,
		ReferralCount:            record.ReferralCount,
		ReferralRewardCount:      record.ReferralRewardCount,
		GeneratedPromotionCount:  record.GeneratedPromotionCount,
		Reason:                   record.Reason,
		ReversedAt:               record.ReversedAt.Format(time.RFC3339),
	}
	if record.OrderID != nil {
		response.OrderID = record.OrderID.String()
	}
	return response
}

func newRiskReviewResponse(record ports.AdminRiskReviewRecord) riskReviewResponse {
	return riskReviewResponse{
		ReviewKey:  record.ReviewKey,
		BusinessID: record.BusinessID.String(),
		Title:      record.Title,
		Business:   record.BusinessName,
		Level:      record.Level,
		Reason:     record.Reason,
		Owner:      record.Owner,
		Status:     record.Status,
		UpdatedAt:  record.UpdatedAt.Format(time.RFC3339),
	}
}
