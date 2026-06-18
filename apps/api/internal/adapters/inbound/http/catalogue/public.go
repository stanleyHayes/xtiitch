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
