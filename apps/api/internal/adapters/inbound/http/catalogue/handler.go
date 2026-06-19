package cataloguehttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	catalogueapp "github.com/xcreativs/xtiitch/apps/api/internal/application/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const maxBodyBytes = 1 << 20

type Handler struct {
	service       catalogueapp.Service
	authenticator authhttp.Authenticator
}

func NewHandler(service catalogueapp.Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	// Public storefront — no account required.
	router.Get("/public/shops", handler.publicShops)
	router.Get("/public/stores/{handle}", handler.publicStore)
	router.Get("/public/stores/{handle}/search", handler.publicSearch)
	router.Get("/public/designs/{handle}", handler.publicDesign)
	router.Get("/public/collections/{handle}", handler.publicCollection)

	// Dashboard — owner-scoped catalogue management.
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)

		protected.Get("/businesses/me", handler.getProfile)
		protected.Get("/store-settings", handler.getSettings)
		protected.Patch("/store-settings", handler.updateSettings)

		protected.Post("/collections", handler.createCollection)
		protected.Get("/collections", handler.listCollections)
		protected.Post("/collections/{id}/retire", handler.collectionAction(catalogueapp.Service.RetireCollection))
		protected.Post("/collections/{id}/restore", handler.collectionAction(catalogueapp.Service.RestoreCollection))
		protected.Delete("/collections/{id}", handler.collectionAction(catalogueapp.Service.DeleteCollection))

		protected.Post("/designs", handler.createDesign)
		protected.Get("/designs", handler.listDesigns)
		protected.Get("/designs/{id}", handler.getDesign)
		protected.Patch("/designs/{id}", handler.updateDesign)
		protected.Post("/designs/{id}/retire", handler.designAction(catalogueapp.Service.RetireDesign))
		protected.Post("/designs/{id}/restore", handler.designAction(catalogueapp.Service.RestoreDesign))
		protected.Delete("/designs/{id}", handler.designAction(catalogueapp.Service.DeleteDesign))
		protected.Put("/designs/{id}/prices/{bandId}", handler.setPrice)
		protected.Get("/designs/{id}/prices", handler.listPrices)

		protected.Post("/size-bands", handler.createSizeBand)
		protected.Get("/size-bands", handler.listSizeBands)

		protected.Get("/promotions", handler.listPromotions)
		protected.Post("/promotions", handler.createPromotion)
		protected.Patch("/promotions/{id}", handler.updatePromotion)
		protected.Post("/promotions/{id}/archive", handler.archivePromotion)
	})
}

// --- store settings ---

type settingsBody struct {
	BespokeEnabled       bool   `json:"bespoke_enabled"`
	MeasurementsEnabled  bool   `json:"measurements_enabled"`
	CustomisationEnabled bool   `json:"customisation_enabled"`
	CollectionsEnabled   bool   `json:"collections_enabled"`
	DeliveryEnabled      bool   `json:"delivery_enabled"`
	DispatchEnabled      bool   `json:"dispatch_enabled"`
	BrandColor           string `json:"brand_color"`
}

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
	writeJSON(w, http.StatusOK, map[string]string{
		"name":                profile.Name,
		"handle":              profile.Handle,
		"verification_status": profile.VerificationStatus,
		"plan":                profile.PlanCode,
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
		},
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

// --- collections ---

type createCollectionBody struct {
	Name     string `json:"name"`
	Theme    string `json:"theme"`
	Sequence int    `json:"sequence"`
}

func (handler Handler) createCollection(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body createCollectionBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	id, err := handler.service.CreateCollection(r.Context(), catalogueapp.CreateCollectionCommand{
		Scope:     scope,
		ActorRole: role,
		Name:      body.Name,
		Theme:     body.Theme,
		Sequence:  body.Sequence,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"collection_id": id.String()})
}

func (handler Handler) listCollections(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	collections, err := handler.service.ListCollections(r.Context(), scope)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	out := make([]collectionResponse, 0, len(collections))
	for _, c := range collections {
		out = append(out, toCollectionResponse(c))
	}
	writeJSON(w, http.StatusOK, map[string]any{"collections": out})
}

func (handler Handler) collectionAction(action func(catalogueapp.Service, context.Context, catalogueapp.CollectionStatusCommand) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, role, ok := tenantPrincipal(w, r)
		if !ok {
			return
		}
		if err := action(handler.service, r.Context(), catalogueapp.CollectionStatusCommand{
			Scope:        scope,
			ActorRole:    role,
			CollectionID: common.ID(chi.URLParam(r, "id")),
		}); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// --- designs ---

type designBody struct {
	CollectionID         *string  `json:"collection_id"`
	Title                string   `json:"title"`
	Description          string   `json:"description"`
	Images               []string `json:"images"`
	CustomisationAllowed bool     `json:"customisation_allowed"`
	DepositOverrideMinor *int64   `json:"deposit_override_minor"`
	Sequence             int      `json:"sequence"`
}

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

func (body designBody) toCommand(scope common.TenantScope, role business.UserRole, designID common.ID) catalogueapp.DesignCommand {
	cmd := catalogueapp.DesignCommand{
		Scope:                scope,
		ActorRole:            role,
		DesignID:             designID,
		Title:                body.Title,
		Description:          body.Description,
		Images:               body.Images,
		CustomisationAllowed: body.CustomisationAllowed,
		DepositOverrideMinor: body.DepositOverrideMinor,
		Sequence:             body.Sequence,
	}
	if body.CollectionID != nil && *body.CollectionID != "" {
		id := common.ID(*body.CollectionID)
		cmd.CollectionID = &id
	}
	return cmd
}

func (handler Handler) createDesign(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body designBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	id, err := handler.service.CreateDesign(r.Context(), body.toCommand(scope, role, ""))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"design_id": id.String()})
}

func (handler Handler) updateDesign(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body designBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.UpdateDesign(r.Context(), body.toCommand(scope, role, common.ID(chi.URLParam(r, "id")))); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) listDesigns(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	designs, err := handler.service.ListDesigns(r.Context(), scope)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	out := make([]designResponse, 0, len(designs))
	for _, d := range designs {
		out = append(out, toDesignResponse(d, nil))
	}
	writeJSON(w, http.StatusOK, map[string]any{"designs": out})
}

func (handler Handler) getDesign(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	design, err := handler.service.GetDesign(r.Context(), scope, common.ID(chi.URLParam(r, "id")))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	prices, err := handler.service.ListDesignPrices(r.Context(), scope, design.ID)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toDesignResponse(design, prices))
}

func (handler Handler) designAction(action func(catalogueapp.Service, context.Context, catalogueapp.DesignStatusCommand) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, role, ok := tenantPrincipal(w, r)
		if !ok {
			return
		}
		if err := action(handler.service, r.Context(), catalogueapp.DesignStatusCommand{
			Scope:     scope,
			ActorRole: role,
			DesignID:  common.ID(chi.URLParam(r, "id")),
		}); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// --- size bands & prices ---

func (handler Handler) createSizeBand(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body struct {
		Label    string `json:"label"`
		Sequence int    `json:"sequence"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	id, err := handler.service.CreateSizeBand(r.Context(), catalogueapp.CreateSizeBandCommand{
		Scope:     scope,
		ActorRole: role,
		Label:     body.Label,
		Sequence:  body.Sequence,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"size_band_id": id.String()})
}

func (handler Handler) listSizeBands(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	bands, err := handler.service.ListSizeBands(r.Context(), scope)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(bands))
	for _, b := range bands {
		out = append(out, map[string]any{"size_band_id": b.ID.String(), "label": b.Label, "sequence": b.Sequence})
	}
	writeJSON(w, http.StatusOK, map[string]any{"size_bands": out})
}

func (handler Handler) setPrice(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body struct {
		PriceMinor int64 `json:"price_minor"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.SetDesignPrice(r.Context(), catalogueapp.SetDesignPriceCommand{
		Scope:      scope,
		ActorRole:  role,
		DesignID:   common.ID(chi.URLParam(r, "id")),
		SizeBandID: common.ID(chi.URLParam(r, "bandId")),
		PriceMinor: body.PriceMinor,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) listPrices(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	prices, err := handler.service.ListDesignPrices(r.Context(), scope, common.ID(chi.URLParam(r, "id")))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"prices": toPrices(prices)})
}

// --- promotions ---

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

func (body promotionBody) toCommand(scope common.TenantScope, role business.UserRole, promotionID common.ID) catalogueapp.BusinessPromotionCommand {
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

// --- shared response shapes & helpers ---

type collectionResponse struct {
	CollectionID string `json:"collection_id"`
	Name         string `json:"name"`
	Theme        string `json:"theme"`
	Handle       string `json:"handle"`
	Status       string `json:"status"`
	Sequence     int    `json:"sequence"`
}

type designResponse struct {
	DesignID             string          `json:"design_id"`
	CollectionID         *string         `json:"collection_id"`
	Title                string          `json:"title"`
	Description          string          `json:"description"`
	Images               []string        `json:"images"`
	CustomisationAllowed bool            `json:"customisation_allowed"`
	DepositOverrideMinor *int64          `json:"deposit_override_minor"`
	Handle               string          `json:"handle"`
	Status               string          `json:"status"`
	Sequence             int             `json:"sequence"`
	Prices               []priceResponse `json:"prices"`
}

type priceResponse struct {
	SizeBandID string `json:"size_band_id"`
	Label      string `json:"label"`
	PriceMinor int64  `json:"price_minor"`
}

type promotionResponse struct {
	PromotionID           string  `json:"promotion_id"`
	BusinessID            string  `json:"business_id"`
	Code                  string  `json:"code"`
	Title                 string  `json:"title"`
	Description           string  `json:"description"`
	DiscountType          string  `json:"discount_type"`
	DiscountValue         int64   `json:"discount_value"`
	MaxDiscountMinor      *int64  `json:"max_discount_minor"`
	MinSpendMinor         int64   `json:"min_spend_minor"`
	UsageLimitGlobal      *int    `json:"usage_limit_global"`
	UsageLimitPerCustomer *int    `json:"usage_limit_per_customer"`
	FundingSource         string  `json:"funding_source"`
	Scope                 string  `json:"scope"`
	TargetCollectionID    *string `json:"target_collection_id"`
	TargetDesignID        *string `json:"target_design_id"`
	Status                string  `json:"status"`
	StartsAt              *string `json:"starts_at"`
	EndsAt                *string `json:"ends_at"`
	RedemptionCount       int     `json:"redemption_count"`
	DiscountRedeemedMinor int64   `json:"discount_redeemed_minor"`
	CreatedAt             string  `json:"created_at"`
	UpdatedAt             string  `json:"updated_at"`
}

func toSettingsBody(s ports.StoreSettings) settingsBody {
	return settingsBody{
		BespokeEnabled:       s.BespokeEnabled,
		MeasurementsEnabled:  s.MeasurementsEnabled,
		CustomisationEnabled: s.CustomisationEnabled,
		CollectionsEnabled:   s.CollectionsEnabled,
		DeliveryEnabled:      s.DeliveryEnabled,
		DispatchEnabled:      s.DispatchEnabled,
		BrandColor:           s.BrandColor,
	}
}

func toCollectionResponse(c catalogue.Collection) collectionResponse {
	return collectionResponse{
		CollectionID: c.ID.String(), Name: c.Name, Theme: c.Theme,
		Handle: c.Handle, Status: string(c.Status), Sequence: c.Sequence,
	}
}

func toDesignResponse(d catalogue.Design, prices []catalogue.BandPrice) designResponse {
	images := d.Images
	if images == nil {
		images = []string{}
	}
	resp := designResponse{
		DesignID: d.ID.String(), Title: d.Title, Description: d.Description,
		Images: images, CustomisationAllowed: d.CustomisationAllowed,
		DepositOverrideMinor: d.DepositOverrideMinor, Handle: d.Handle,
		Status: string(d.Status), Sequence: d.Sequence, Prices: toPrices(prices),
	}
	if d.CollectionID != nil {
		value := d.CollectionID.String()
		resp.CollectionID = &value
	}
	return resp
}

func toPrices(prices []catalogue.BandPrice) []priceResponse {
	out := make([]priceResponse, 0, len(prices))
	for _, p := range prices {
		out = append(out, priceResponse{SizeBandID: p.SizeBandID.String(), Label: p.Label, PriceMinor: p.PriceMinor})
	}
	return out
}

func toPromotionResponse(record ports.BusinessPromotionRecord) promotionResponse {
	response := promotionResponse{
		PromotionID:           record.PromotionID.String(),
		BusinessID:            record.BusinessID.String(),
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
		Status:                record.Status,
		RedemptionCount:       record.RedemptionCount,
		DiscountRedeemedMinor: record.DiscountRedeemedMinor,
		CreatedAt:             record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:             record.UpdatedAt.Format(time.RFC3339),
	}
	if record.TargetCollectionID != nil {
		value := record.TargetCollectionID.String()
		response.TargetCollectionID = &value
	}
	if record.TargetDesignID != nil {
		value := record.TargetDesignID.String()
		response.TargetDesignID = &value
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

func parseOptionalTime(value string) *time.Time {
	if value == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil
	}
	return &parsed
}

func tenantScope(w http.ResponseWriter, r *http.Request) (common.TenantScope, bool) {
	scope, _, ok := tenantPrincipal(w, r)
	return scope, ok
}

func tenantPrincipal(w http.ResponseWriter, r *http.Request) (common.TenantScope, business.UserRole, bool) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return common.TenantScope{}, "", false
	}
	return principal.TenantScope(), principal.Role, true
}

func writeServiceError(w http.ResponseWriter, err error) {
	if errors.Is(err, authdomain.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if errors.Is(err, catalogueapp.ErrInvalidInput) {
		writeError(w, http.StatusBadRequest, "invalid_input")
		return
	}
	if errors.Is(err, ports.ErrPromotionCodeTaken) {
		writeError(w, http.StatusConflict, "promotion_code_taken")
		return
	}
	if errors.Is(err, ports.ErrPlanLimitExceeded) {
		writeError(w, http.StatusConflict, "plan_limit_exceeded")
		return
	}
	writeRepoError(w, err)
}

func writeRepoError(w http.ResponseWriter, err error) {
	if errors.Is(err, ports.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	writeError(w, http.StatusInternalServerError, "internal_error")
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
