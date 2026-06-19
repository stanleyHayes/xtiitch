package cataloguehttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type storeSummary struct {
	Name                string                    `json:"name"`
	Handle              string                    `json:"handle"`
	BrandColor          string                    `json:"brand_color"`
	DefaultDepositMinor int64                     `json:"default_deposit_minor"`
	MeasurementFields   []measurementFieldSummary `json:"measurement_fields"`
	Settings            settingsBody              `json:"settings"`
	WaitlistEnabled     bool                      `json:"waitlist_enabled"`
}

type measurementFieldSummary struct {
	FieldID  string `json:"field_id"`
	Label    string `json:"label"`
	Unit     string `json:"unit"`
	Sequence int    `json:"sequence"`
}

func toStoreSummary(store ports.Storefront) storeSummary {
	return storeSummary{
		Name:                store.Name,
		Handle:              store.Handle,
		BrandColor:          store.BrandColor,
		DefaultDepositMinor: store.DefaultDepositMinor,
		MeasurementFields:   toMeasurementFieldSummaries(store.MeasurementFields),
		Settings:            toSettingsBody(store.Settings),
		WaitlistEnabled:     store.WaitlistEnabled,
	}
}

func toMeasurementFieldSummaries(fields []ports.MeasurementField) []measurementFieldSummary {
	out := make([]measurementFieldSummary, 0, len(fields))
	for _, field := range fields {
		out = append(out, measurementFieldSummary{
			FieldID: field.FieldID.String(), Label: field.Label, Unit: field.Unit, Sequence: field.Sequence,
		})
	}
	return out
}

func toStorefrontDesigns(designs []ports.StorefrontDesign) []designResponse {
	out := make([]designResponse, 0, len(designs))
	for _, d := range designs {
		out = append(out, toDesignResponse(d.Design, d.Prices))
	}
	return out
}

func (handler Handler) publicStore(w http.ResponseWriter, r *http.Request) {
	view, err := handler.service.LoadStorefront(r.Context(), chi.URLParam(r, "handle"))
	if err != nil {
		writeRepoError(w, err)
		return
	}

	collections := make([]collectionResponse, 0, len(view.Collections))
	for _, c := range view.Collections {
		collections = append(collections, toCollectionResponse(c))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"store":       toStoreSummary(view.Store),
		"collections": collections,
		"designs":     toStorefrontDesigns(view.Designs),
	})
}

func (handler Handler) publicSearch(w http.ResponseWriter, r *http.Request) {
	store, designs, err := handler.service.SearchStore(r.Context(), chi.URLParam(r, "handle"), r.URL.Query().Get("q"))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"store":   toStoreSummary(store),
		"designs": toStorefrontDesigns(designs),
	})
}

func (handler Handler) publicDesign(w http.ResponseWriter, r *http.Request) {
	design, err := handler.service.GetStoreDesign(r.Context(), chi.URLParam(r, "handle"))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicDesignResponse{
		designResponse: toDesignResponse(design.Design, design.Prices),
		Store:          toStoreSummary(design.Store),
	})
}

func (handler Handler) publicCollection(w http.ResponseWriter, r *http.Request) {
	collection, err := handler.service.GetStoreCollection(r.Context(), chi.URLParam(r, "handle"))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"collection": toCollectionResponse(collection.Collection),
		"designs":    toStorefrontDesigns(collection.Designs),
	})
}

type publicDesignResponse struct {
	designResponse
	Store storeSummary `json:"store"`
}

type publicShopDesignResponse struct {
	Title      string `json:"title"`
	Handle     string `json:"handle"`
	Image      string `json:"image"`
	PriceMinor int64  `json:"price_minor"`
}

type publicShopResponse struct {
	BusinessID  string                     `json:"business_id"`
	Name        string                     `json:"name"`
	Handle      string                     `json:"handle"`
	BrandColor  string                     `json:"brand_color"`
	DesignCount int                        `json:"design_count"`
	Designs     []publicShopDesignResponse `json:"designs"`
}

func toPublicShopResponse(shop ports.PublicShop) publicShopResponse {
	designs := make([]publicShopDesignResponse, 0, len(shop.Designs))
	for _, d := range shop.Designs {
		designs = append(designs, publicShopDesignResponse{
			Title: d.Title, Handle: d.Handle, Image: d.Image, PriceMinor: d.PriceMinor,
		})
	}
	return publicShopResponse{
		BusinessID:  shop.BusinessID.String(),
		Name:        shop.Name,
		Handle:      shop.Handle,
		BrandColor:  shop.BrandColor,
		DesignCount: shop.DesignCount,
		Designs:     designs,
	}
}

// publicShops serves the discovery directory of verified, active storefronts.
func (handler Handler) publicShops(w http.ResponseWriter, r *http.Request) {
	shops, err := handler.service.ListPublicShops(r.Context())
	if err != nil {
		writeRepoError(w, err)
		return
	}
	out := make([]publicShopResponse, 0, len(shops))
	for _, shop := range shops {
		out = append(out, toPublicShopResponse(shop))
	}
	writeJSON(w, http.StatusOK, map[string]any{"shops": out})
}
