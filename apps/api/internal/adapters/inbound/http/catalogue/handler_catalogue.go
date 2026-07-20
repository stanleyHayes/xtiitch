package cataloguehttp

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	catalogueapp "github.com/xcreativs/xtiitch/apps/api/internal/application/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// --- store settings ---

func (handler Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	profile, err := handler.service.GetStoreProfile(r.Context(), scope)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	entitlements := profile.Entitlements
	if entitlements == nil {
		entitlements = map[string]bool{}
	}
	limits := profile.EntitlementLimits
	if limits == nil {
		limits = map[string]int{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"name":                profile.Name,
		"handle":              profile.Handle,
		"verification_status": profile.VerificationStatus,
		"payout_ready":        profile.PayoutReady,
		"settlement_bank":     profile.SettlementBank,
		"settlement_account":  profile.SettlementAccount,
		// §2.1: the MoMo-registered wallet name, for the payout-details summary.
		"settlement_account_name": profile.SettlementAccountName,
		"plan":                    profile.PlanCode,
		"entitlements":            entitlements,
		// §11.1: the numeric entitlements (analytics/CRM levels, lookback, export
		// schedule); -1 means unlimited/full, absent keys are disabled rows.
		"entitlement_limits": limits,
		// null means unlimited in all three, matching the plans columns.
		"design_limit":    profile.DesignLimit,
		"image_limit":     profile.ImageLimit,
		"variation_limit": profile.VariationLimit,
	})
}

func (handler Handler) getSettings(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	settings, err := handler.service.GetSettings(r.Context(), scope)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toSettingsBody(settings))
}

func (handler Handler) updateSettings(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body settingsBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.UpdateSettings(r.Context(), catalogueapp.UpdateSettingsCommand{
		Scope:     scope,
		ActorRole: role,
		Settings: ports.StoreSettings{
			BespokeEnabled:       body.BespokeEnabled,
			MeasurementsEnabled:  body.MeasurementsEnabled,
			CustomisationEnabled: body.CustomisationEnabled,
			CollectionsEnabled:   body.CollectionsEnabled,
			DeliveryEnabled:      body.DeliveryEnabled,
			DispatchEnabled:      body.DispatchEnabled,
			BrandColor:           body.BrandColor,
			LogoURL:              body.LogoURL,
			BannerURL:            body.BannerURL,
			LayoutVariant:        body.LayoutVariant,
			FeePassXtiitchFee:    body.FeePassXtiitchFee,
			FeePassTax:           body.FeePassTax,
			FeePassPaystackFee:   body.FeePassPaystackFee,
		},
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

// --- design waitlist ---

type joinWaitlistBody struct {
	CustomerName    string `json:"customer_name"`
	CustomerContact string `json:"customer_contact"`
	Note            string `json:"note"`
}

func (handler Handler) joinWaitlist(w http.ResponseWriter, r *http.Request) {
	var body joinWaitlistBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.JoinDesignWaitlist(r.Context(), catalogueapp.JoinDesignWaitlistCommand{
		StoreHandle:     chi.URLParam(r, "handle"),
		DesignHandle:    chi.URLParam(r, "design_handle"),
		CustomerName:    body.CustomerName,
		CustomerContact: body.CustomerContact,
		Note:            body.Note,
	}); err != nil {
		writeWaitlistError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "joined"})
}

type waitlistEntryBody struct {
	EntryID         string `json:"entry_id"`
	DesignID        string `json:"design_id"`
	DesignTitle     string `json:"design_title"`
	DesignHandle    string `json:"design_handle"`
	CustomerName    string `json:"customer_name"`
	CustomerContact string `json:"customer_contact"`
	Note            string `json:"note"`
	Status          string `json:"status"`
	CreatedAt       string `json:"created_at"`
}

func (handler Handler) listWaitlist(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	entries, err := handler.service.ListWaitlistEntries(r.Context(), scope)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	out := make([]waitlistEntryBody, 0, len(entries))
	for _, entry := range entries {
		out = append(out, waitlistEntryBody{
			EntryID:         entry.EntryID.String(),
			DesignID:        entry.DesignID.String(),
			DesignTitle:     entry.DesignTitle,
			DesignHandle:    entry.DesignHandle,
			CustomerName:    entry.CustomerName,
			CustomerContact: entry.CustomerContact,
			Note:            entry.Note,
			Status:          entry.Status,
			CreatedAt:       entry.CreatedAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": out})
}

type updateWaitlistStatusBody struct {
	Status string `json:"status"`
}

func (handler Handler) updateWaitlistStatus(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body updateWaitlistStatusBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.UpdateWaitlistStatus(r.Context(), catalogueapp.UpdateWaitlistStatusCommand{
		Scope:     scope,
		ActorRole: role,
		EntryID:   common.ID(chi.URLParam(r, "id")),
		Status:    body.Status,
	}); err != nil {
		writeWaitlistError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func writeWaitlistError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, catalogueapp.ErrStoreNotFound),
		errors.Is(err, catalogueapp.ErrDesignUnavailable):
		writeError(w, http.StatusNotFound, "not_found")
	case errors.Is(err, catalogueapp.ErrWaitlistUnavailable):
		writeError(w, http.StatusConflict, "waitlist_unavailable")
	default:
		writeServiceError(w, err)
	}
}

// --- promotions ---

type promotionBody struct {
	Code                  string  `json:"code"`
	Title                 string  `json:"title"`
	Description           string  `json:"description"`
	DiscountType          string  `json:"discount_type"`
	DiscountValue         int64   `json:"discount_value"`
	MaxDiscountMinor      *int64  `json:"max_discount_minor"`
	MinSpendMinor         int64   `json:"min_spend_minor"`
	UsageLimitGlobal      *int    `json:"usage_limit_global"`
	UsageLimitPerCustomer *int    `json:"usage_limit_per_customer"`
	Scope                 string  `json:"scope"`
	TargetCollectionID    *string `json:"target_collection_id"`
	TargetDesignID        *string `json:"target_design_id"`
	Status                string  `json:"status"`
	StartsAt              string  `json:"starts_at"`
	EndsAt                string  `json:"ends_at"`
}

func (handler Handler) listPromotions(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	promotions, err := handler.service.ListBusinessPromotions(r.Context(), scope)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]promotionResponse, 0, len(promotions))
	for _, promotion := range promotions {
		out = append(out, toPromotionResponse(promotion))
	}
	writeJSON(w, http.StatusOK, map[string]any{"promotions": out})
}

func (handler Handler) createPromotion(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body promotionBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	record, err := handler.service.CreateBusinessPromotion(r.Context(), body.toCommand(scope, role, ""))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toPromotionResponse(record))
}

func (handler Handler) updatePromotion(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body promotionBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	record, err := handler.service.UpdateBusinessPromotion(
		r.Context(),
		body.toCommand(scope, role, common.ID(chi.URLParam(r, "id"))),
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toPromotionResponse(record))
}

func (handler Handler) archivePromotion(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	record, err := handler.service.ArchiveBusinessPromotion(
		r.Context(),
		catalogueapp.BusinessPromotionActionCommand{
			Scope:       scope,
			ActorRole:   role,
			PromotionID: common.ID(chi.URLParam(r, "id")),
		},
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toPromotionResponse(record))
}

func (body promotionBody) toCommand(
	scope common.TenantScope,
	role business.UserRole,
	promotionID common.ID,
) catalogueapp.BusinessPromotionCommand {
	cmd := catalogueapp.BusinessPromotionCommand{
		Scope:                 scope,
		ActorRole:             role,
		PromotionID:           promotionID,
		Code:                  body.Code,
		Title:                 body.Title,
		Description:           body.Description,
		DiscountType:          body.DiscountType,
		DiscountValue:         body.DiscountValue,
		MaxDiscountMinor:      body.MaxDiscountMinor,
		MinSpendMinor:         body.MinSpendMinor,
		UsageLimitGlobal:      body.UsageLimitGlobal,
		UsageLimitPerCustomer: body.UsageLimitPerCustomer,
		ScopeName:             body.Scope,
		Status:                body.Status,
	}
	if body.TargetCollectionID != nil && *body.TargetCollectionID != "" {
		id := common.ID(*body.TargetCollectionID)
		cmd.TargetCollectionID = &id
	}
	if body.TargetDesignID != nil && *body.TargetDesignID != "" {
		id := common.ID(*body.TargetDesignID)
		cmd.TargetDesignID = &id
	}
	cmd.StartsAt = parseOptionalTime(body.StartsAt)
	cmd.EndsAt = parseOptionalTime(body.EndsAt)
	return cmd
}
