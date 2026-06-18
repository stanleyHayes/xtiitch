package growthhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	growthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/growth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

const maxBodyBytes = 1 << 20

type Service interface {
	RecordAffiliateClick(ctx context.Context, command growthapp.RecordAffiliateClickCommand) (ports.AffiliateClickRecord, error)
	ListSponsoredPlacements(ctx context.Context, command growthapp.ListSponsoredPlacementsCommand) ([]ports.SponsoredPlacementRecord, error)
	RecordSponsoredAdEvent(ctx context.Context, command growthapp.RecordSponsoredAdEventCommand) (ports.SponsoredAdEventRecord, error)
	ResolveReferralCode(ctx context.Context, command growthapp.ResolveReferralCodeCommand) (ports.ReferralCodeRecord, error)
}

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/public/affiliates/{code}/clicks", handler.recordAffiliateClick)
	router.Get("/public/sponsored", handler.sponsoredPlacements)
	router.Post("/public/sponsored/{id}/events", handler.recordSponsoredEvent)
	router.Get("/public/referrals/{code}", handler.referralCode)
}

type affiliateClickRequest struct {
	VisitorID   string `json:"visitor_id"`
	LandingURL  string `json:"landing_url"`
	ReferrerURL string `json:"referrer_url"`
}

type sponsoredEventRequest struct {
	EventType   string `json:"event_type"`
	VisitorID   string `json:"visitor_id"`
	PageURL     string `json:"page_url"`
	ReferrerURL string `json:"referrer_url"`
}

type sponsoredPlacementResponse struct {
	CampaignID     string `json:"campaign_id"`
	BusinessID     string `json:"business_id"`
	BusinessName   string `json:"business_name"`
	BusinessHandle string `json:"business_handle"`
	PlacementType  string `json:"placement_type"`
	TargetLabel    string `json:"target_label"`
	Headline       string `json:"headline"`
	Description    string `json:"description"`
	StoreHandle    string `json:"store_handle"`
	DesignHandle   string `json:"design_handle"`
	ImageURL       string `json:"image_url"`
	StartsAt       string `json:"starts_at"`
	EndsAt         string `json:"ends_at"`
}

type referralCodeResponse struct {
	ReferralCodeID       string  `json:"referral_code_id"`
	ReferralProgrammeID  string  `json:"referral_programme_id"`
	BusinessID           *string `json:"business_id"`
	OwnerType            string  `json:"owner_type"`
	Code                 string  `json:"code"`
	Title                string  `json:"title"`
	Audience             string  `json:"audience"`
	ReferrerRewardKind   string  `json:"referrer_reward_kind"`
	RefereeRewardKind    string  `json:"referee_reward_kind"`
	RewardType           string  `json:"reward_type"`
	RewardValue          int64   `json:"reward_value"`
	MaxRewardMinor       *int64  `json:"max_reward_minor"`
	QualifyingOrderMinor int64   `json:"qualifying_order_min_minor"`
	RewardHoldDays       int     `json:"reward_hold_days"`
	StartsAt             *string `json:"starts_at"`
	EndsAt               *string `json:"ends_at"`
	Status               string  `json:"status"`
}

func (handler Handler) recordAffiliateClick(w http.ResponseWriter, r *http.Request) {
	var request affiliateClickRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.RecordAffiliateClick(r.Context(), growthapp.RecordAffiliateClickCommand{
		Code:        chi.URLParam(r, "code"),
		VisitorID:   request.VisitorID,
		LandingURL:  request.LandingURL,
		ReferrerURL: request.ReferrerURL,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := growthError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"click_id":     record.ClickID.String(),
		"affiliate_id": record.AffiliateID.String(),
		"code":         record.Code,
		"clicked_at":   record.ClickedAt.Format(time.RFC3339),
	})
}

func (handler Handler) sponsoredPlacements(w http.ResponseWriter, r *http.Request) {
	records, err := handler.service.ListSponsoredPlacements(r.Context(), growthapp.ListSponsoredPlacementsCommand{
		Limit: parseLimit(r.URL.Query().Get("limit")),
	})
	if err != nil {
		status, code := growthError(err)
		writeError(w, status, code)
		return
	}

	out := make([]sponsoredPlacementResponse, 0, len(records))
	for _, record := range records {
		out = append(out, sponsoredPlacementResponse{
			CampaignID:     record.CampaignID.String(),
			BusinessID:     record.BusinessID.String(),
			BusinessName:   record.BusinessName,
			BusinessHandle: record.BusinessHandle,
			PlacementType:  record.PlacementType,
			TargetLabel:    record.TargetLabel,
			Headline:       record.Headline,
			Description:    record.Description,
			StoreHandle:    record.StoreHandle,
			DesignHandle:   record.DesignHandle,
			ImageURL:       record.ImageURL,
			StartsAt:       record.StartsAt.Format(time.RFC3339),
			EndsAt:         record.EndsAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, map[string][]sponsoredPlacementResponse{"placements": out})
}

func (handler Handler) recordSponsoredEvent(w http.ResponseWriter, r *http.Request) {
	var request sponsoredEventRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.RecordSponsoredAdEvent(r.Context(), growthapp.RecordSponsoredAdEventCommand{
		CampaignID:  chi.URLParam(r, "id"),
		EventType:   request.EventType,
		VisitorID:   request.VisitorID,
		PageURL:     request.PageURL,
		ReferrerURL: request.ReferrerURL,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := growthError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"event_id":    record.EventID.String(),
		"campaign_id": record.CampaignID.String(),
		"event_type":  record.EventType,
		"occurred_at": record.OccurredAt.Format(time.RFC3339),
		"deduped":     record.Deduped,
	})
}

func (handler Handler) referralCode(w http.ResponseWriter, r *http.Request) {
	record, err := handler.service.ResolveReferralCode(r.Context(), growthapp.ResolveReferralCodeCommand{
		Code: chi.URLParam(r, "code"),
	})
	if err != nil {
		status, code := growthError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, toReferralCodeResponse(record))
}

func toReferralCodeResponse(record ports.ReferralCodeRecord) referralCodeResponse {
	response := referralCodeResponse{
		ReferralCodeID:       record.ReferralCodeID.String(),
		ReferralProgrammeID:  record.ReferralProgrammeID.String(),
		OwnerType:            record.OwnerType,
		Code:                 record.Code,
		Title:                record.Title,
		Audience:             record.Audience,
		ReferrerRewardKind:   record.ReferrerRewardKind,
		RefereeRewardKind:    record.RefereeRewardKind,
		RewardType:           record.RewardType,
		RewardValue:          record.RewardValue,
		MaxRewardMinor:       record.MaxRewardMinor,
		QualifyingOrderMinor: record.QualifyingOrderMinor,
		RewardHoldDays:       record.RewardHoldDays,
		Status:               record.Status,
	}
	if record.BusinessID != nil {
		value := record.BusinessID.String()
		response.BusinessID = &value
	}
	if record.StartsAt != nil {
		value := record.StartsAt.Format(time.RFC3339)
		response.StartsAt = &value
	}
	if record.EndsAt != nil {
		value := record.EndsAt.Format(time.RFC3339)
		response.EndsAt = &value
	}
	return response
}

func growthError(err error) (int, string) {
	switch {
	case errors.Is(err, growthapp.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_click"
	case errors.Is(err, growthapp.ErrAffiliateNotFound):
		return http.StatusNotFound, "affiliate_not_found"
	case errors.Is(err, growthapp.ErrSponsoredAdNotFound):
		return http.StatusNotFound, "sponsored_ad_not_found"
	case errors.Is(err, growthapp.ErrReferralNotFound):
		return http.StatusNotFound, "referral_not_found"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func parseLimit(value string) int {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	var limit int
	for _, char := range trimmed {
		if char < '0' || char > '9' {
			return 0
		}
		limit = limit*10 + int(char-'0')
		if limit > 100 {
			return 100
		}
	}
	return limit
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	var trailing struct{}
	if err := decoder.Decode(&trailing); err != io.EOF {
		return errors.New("request body must contain a single JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func requestIP(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		return strings.TrimSpace(strings.Split(forwardedFor, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
