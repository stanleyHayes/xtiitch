package cataloguehttp

import (
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
	router.Post("/public/stores/{handle}/designs/{design_handle}/waitlist", handler.joinWaitlist)

	// Dashboard — owner-scoped catalogue management.
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)

		protected.Get("/businesses/me", handler.getProfile)
		protected.Get("/store-settings", handler.getSettings)
		protected.Patch("/store-settings", handler.updateSettings)

		protected.Get("/waitlist-entries", handler.listWaitlist)
		protected.Patch("/waitlist-entries/{id}", handler.updateWaitlistStatus)

		protected.Post("/collections", handler.createCollection)
		protected.Get("/collections", handler.listCollections)
		protected.Patch("/collections/{id}", handler.updateCollection)
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

		protected.Get("/designs/{id}/size-band-overrides", handler.listSizeBandOverrides)
		protected.Put("/designs/{id}/size-bands/{bandId}/override", handler.setSizeBandOverride)
		protected.Delete("/designs/{id}/size-bands/{bandId}/override", handler.clearSizeBandOverride)

		protected.Get("/designs/{id}/variations", handler.listVariations)
		protected.Post("/designs/{id}/variations", handler.createVariation)
		protected.Post("/designs/{id}/variations/reorder", handler.reorderVariations)
		protected.Patch("/designs/{id}/variations/{variationId}", handler.updateVariation)
		protected.Delete("/designs/{id}/variations/{variationId}", handler.deleteVariation)

		protected.Post("/size-bands", handler.createSizeBand)
		protected.Get("/size-bands", handler.listSizeBands)
		protected.Patch("/size-bands/{id}", handler.updateSizeBand)
		protected.Delete("/size-bands/{id}", handler.deleteSizeBand)

		protected.Get("/promotions", handler.listPromotions)
		protected.Post("/promotions", handler.createPromotion)
		protected.Patch("/promotions/{id}", handler.updatePromotion)
		protected.Post("/promotions/{id}/archive", handler.archivePromotion)
	})
}

// --- shared response shapes & helpers ---

type settingsBody struct {
	BespokeEnabled       bool   `json:"bespoke_enabled"`
	MeasurementsEnabled  bool   `json:"measurements_enabled"`
	CustomisationEnabled bool   `json:"customisation_enabled"`
	CollectionsEnabled   bool   `json:"collections_enabled"`
	DeliveryEnabled      bool   `json:"delivery_enabled"`
	DispatchEnabled      bool   `json:"dispatch_enabled"`
	BrandColor           string `json:"brand_color"`
	LogoURL              string `json:"logo_url"`
	BannerURL            string `json:"banner_url"`
	LayoutVariant        string `json:"layout_variant"`
	// The three fee pass-down tick boxes (§4.4).
	FeePassXtiitchFee  bool `json:"fee_pass_xtiitch_fee"`
	FeePassTax         bool `json:"fee_pass_tax"`
	FeePassPaystackFee bool `json:"fee_pass_paystack_fee"`
}

type collectionResponse struct {
	CollectionID string `json:"collection_id"`
	Name         string `json:"name"`
	Theme        string `json:"theme"`
	Handle       string `json:"handle"`
	Status       string `json:"status"`
	Sequence     int    `json:"sequence"`
}

type designResponse struct {
	DesignID             string              `json:"design_id"`
	CollectionID         *string             `json:"collection_id"`
	Title                string              `json:"title"`
	Description          string              `json:"description"`
	Images               []string            `json:"images"`
	CustomisationAllowed bool                `json:"customisation_allowed"`
	DepositOverrideMinor *int64              `json:"deposit_override_minor"`
	BespokeDisplayMinor  int64               `json:"bespoke_display_minor"`
	Handle               string              `json:"handle"`
	Status               string              `json:"status"`
	Sequence             int                 `json:"sequence"`
	Prices               []priceResponse     `json:"prices"`
	Variations           []variationResponse `json:"variations"`
}

type variationResponse struct {
	VariationID string   `json:"variation_id"`
	Name        string   `json:"name"`
	Images      []string `json:"images"`
	IsDefault   bool     `json:"is_default"`
	Sequence    int      `json:"sequence"`
}

type priceResponse struct {
	SizeBandID string              `json:"size_band_id"`
	Label      string              `json:"label"`
	PriceMinor int64               `json:"price_minor"`
	Chart      []sizeChartItemBody `json:"chart"`
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
		LogoURL:              s.LogoURL,
		BannerURL:            s.BannerURL,
		LayoutVariant:        s.LayoutVariant,
		FeePassXtiitchFee:    s.FeePassXtiitchFee,
		FeePassTax:           s.FeePassTax,
		FeePassPaystackFee:   s.FeePassPaystackFee,
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
		DepositOverrideMinor: d.DepositOverrideMinor, BespokeDisplayMinor: d.BespokeDisplayMinor,
		Handle: d.Handle, Status: string(d.Status), Sequence: d.Sequence, Prices: toPrices(prices),
		Variations: toVariationResponses(d.Variations),
	}
	if d.CollectionID != nil {
		value := d.CollectionID.String()
		resp.CollectionID = &value
	}
	return resp
}

func toVariationResponses(variations []catalogue.DesignVariation) []variationResponse {
	out := make([]variationResponse, 0, len(variations))
	for _, v := range variations {
		images := v.Images
		if images == nil {
			images = []string{}
		}
		out = append(out, variationResponse{
			VariationID: v.ID.String(),
			Name:        v.Name,
			Images:      images,
			IsDefault:   v.IsDefault,
			Sequence:    v.Sequence,
		})
	}
	return out
}

func toPrices(prices []catalogue.BandPrice) []priceResponse {
	out := make([]priceResponse, 0, len(prices))
	for _, p := range prices {
		out = append(out, priceResponse{
			SizeBandID: p.SizeBandID.String(),
			Label:      p.Label,
			PriceMinor: p.PriceMinor,
			Chart:      toSizeChartBody(p.Chart),
		})
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
	if errors.Is(err, catalogueapp.ErrActivationRequired) {
		writeError(w, http.StatusPaymentRequired, "activation_required")
		return
	}
	if errors.Is(err, catalogueapp.ErrPromotionsNotEntitled) {
		writeError(w, http.StatusForbidden, "promotions_not_entitled")
		return
	}
	if errors.Is(err, catalogueapp.ErrPricingModeConflict) {
		writeError(w, http.StatusConflict, "pricing_mode_conflict")
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
	if errors.Is(err, ports.ErrSequenceTaken) {
		writeError(w, http.StatusConflict, "sequence_taken")
		return
	}
	if errors.Is(err, ports.ErrImageLimitExceeded) {
		writeError(w, http.StatusConflict, "image_limit_exceeded")
		return
	}
	if errors.Is(err, ports.ErrVariationLimitReached) {
		writeError(w, http.StatusConflict, "variation_limit_reached")
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
