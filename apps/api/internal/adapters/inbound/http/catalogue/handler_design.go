package cataloguehttp

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	catalogueapp "github.com/xcreativs/xtiitch/apps/api/internal/application/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// --- designs ---

type designBody struct {
	CollectionID         *string  `json:"collection_id"`
	Title                string   `json:"title"`
	Description          string   `json:"description"`
	Images               []string `json:"images"`
	CustomisationAllowed bool     `json:"customisation_allowed"`
	DepositOverrideMinor *int64   `json:"deposit_override_minor"`
	BespokeDisplayMinor  int64    `json:"bespoke_display_minor"`
	Sequence             int      `json:"sequence"`
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
		BespokeDisplayMinor:  body.BespokeDisplayMinor,
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

func (handler Handler) designAction(
	action func(catalogueapp.Service, context.Context, catalogueapp.DesignStatusCommand) error,
) http.HandlerFunc {
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

type sizeChartItemBody struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Unit  string `json:"unit"`
}

type sizeBandBody struct {
	Label    string              `json:"label"`
	Chart    []sizeChartItemBody `json:"chart"`
	Sequence int                 `json:"sequence"`
}

func toSizeChartItems(body []sizeChartItemBody) []catalogue.SizeChartItem {
	if len(body) == 0 {
		return nil
	}
	items := make([]catalogue.SizeChartItem, 0, len(body))
	for _, item := range body {
		items = append(items, catalogue.SizeChartItem{Name: item.Name, Value: item.Value, Unit: item.Unit})
	}
	return items
}

func toSizeChartBody(items []catalogue.SizeChartItem) []sizeChartItemBody {
	out := make([]sizeChartItemBody, 0, len(items))
	for _, item := range items {
		out = append(out, sizeChartItemBody{Name: item.Name, Value: item.Value, Unit: item.Unit})
	}
	return out
}

func (handler Handler) createSizeBand(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body sizeBandBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	id, err := handler.service.CreateSizeBand(r.Context(), catalogueapp.CreateSizeBandCommand{
		Scope:     scope,
		ActorRole: role,
		Label:     body.Label,
		Chart:     toSizeChartItems(body.Chart),
		Sequence:  body.Sequence,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"size_band_id": id.String()})
}

func (handler Handler) updateSizeBand(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body sizeBandBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.UpdateSizeBand(r.Context(), catalogueapp.UpdateSizeBandCommand{
		Scope:      scope,
		ActorRole:  role,
		SizeBandID: common.ID(chi.URLParam(r, "id")),
		Label:      body.Label,
		Chart:      toSizeChartItems(body.Chart),
		Sequence:   body.Sequence,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) deleteSizeBand(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	if err := handler.service.DeleteSizeBand(r.Context(), catalogueapp.DeleteSizeBandCommand{
		Scope:      scope,
		ActorRole:  role,
		SizeBandID: common.ID(chi.URLParam(r, "id")),
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
		out = append(out, map[string]any{
			"size_band_id": b.ID.String(),
			"label":        b.Label,
			"chart":        toSizeChartBody(b.Chart),
			"sequence":     b.Sequence,
		})
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

// --- per-design size-band overrides ---

// sizeBandOverrideBody is the PUT payload. Both fields are optional pointers so an
// absent key means "leave the master value in place": a nil label keeps the master
// label; a nil chart keeps the master chart (a present chart, even [], overrides).
type sizeBandOverrideBody struct {
	Label *string              `json:"label"`
	Chart *[]sizeChartItemBody `json:"chart"`
}

type sizeBandOverrideResponse struct {
	SizeBandID string              `json:"size_band_id"`
	Label      *string             `json:"label"`
	Chart      []sizeChartItemBody `json:"chart"`
	ChartSet   bool                `json:"chart_set"`
}

func (handler Handler) listSizeBandOverrides(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	overrides, err := handler.service.ListDesignSizeBandOverrides(r.Context(), scope, common.ID(chi.URLParam(r, "id")))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	out := make([]sizeBandOverrideResponse, 0, len(overrides))
	for _, o := range overrides {
		out = append(out, sizeBandOverrideResponse{
			SizeBandID: o.SizeBandID.String(),
			Label:      o.Label,
			Chart:      toSizeChartBody(o.Chart),
			ChartSet:   o.ChartSet,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"overrides": out})
}

func (handler Handler) setSizeBandOverride(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body sizeBandOverrideBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	cmd := catalogueapp.SetDesignSizeBandOverrideCommand{
		Scope:      scope,
		ActorRole:  role,
		DesignID:   common.ID(chi.URLParam(r, "id")),
		SizeBandID: common.ID(chi.URLParam(r, "bandId")),
		Label:      body.Label,
	}
	if body.Chart != nil {
		cmd.ChartSet = true
		cmd.Chart = toSizeChartItems(*body.Chart)
	}
	if err := handler.service.SetDesignSizeBandOverride(r.Context(), cmd); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) clearSizeBandOverride(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	if err := handler.service.DeleteDesignSizeBandOverride(r.Context(), catalogueapp.DeleteDesignSizeBandOverrideCommand{
		Scope:      scope,
		ActorRole:  role,
		DesignID:   common.ID(chi.URLParam(r, "id")),
		SizeBandID: common.ID(chi.URLParam(r, "bandId")),
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- design colour variations ---

type variationBody struct {
	Name      string   `json:"name"`
	Images    []string `json:"images"`
	IsDefault bool     `json:"is_default"`
	Sequence  int      `json:"sequence"`
}

type reorderVariationsBody struct {
	OrderedIDs []string `json:"ordered_ids"`
}

func (handler Handler) listVariations(w http.ResponseWriter, r *http.Request) {
	scope, ok := tenantScope(w, r)
	if !ok {
		return
	}
	variations, err := handler.service.ListDesignVariations(r.Context(), scope, common.ID(chi.URLParam(r, "id")))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"variations": toVariationResponses(variations)})
}

func (handler Handler) createVariation(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body variationBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	id, err := handler.service.CreateDesignVariation(r.Context(), catalogueapp.CreateDesignVariationCommand{
		Scope:     scope,
		ActorRole: role,
		DesignID:  common.ID(chi.URLParam(r, "id")),
		Name:      body.Name,
		Images:    body.Images,
		IsDefault: body.IsDefault,
		Sequence:  body.Sequence,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"variation_id": id.String()})
}

func (handler Handler) updateVariation(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body variationBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.UpdateDesignVariation(r.Context(), catalogueapp.UpdateDesignVariationCommand{
		Scope:       scope,
		ActorRole:   role,
		VariationID: common.ID(chi.URLParam(r, "variationId")),
		Name:        body.Name,
		Images:      body.Images,
		IsDefault:   body.IsDefault,
		Sequence:    body.Sequence,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) deleteVariation(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	if err := handler.service.DeleteDesignVariation(r.Context(), catalogueapp.DeleteDesignVariationCommand{
		Scope:       scope,
		ActorRole:   role,
		VariationID: common.ID(chi.URLParam(r, "variationId")),
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) reorderVariations(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body reorderVariationsBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	orderedIDs := make([]common.ID, 0, len(body.OrderedIDs))
	for _, id := range body.OrderedIDs {
		orderedIDs = append(orderedIDs, common.ID(id))
	}
	if err := handler.service.ReorderDesignVariations(r.Context(), catalogueapp.ReorderDesignVariationsCommand{
		Scope:      scope,
		ActorRole:  role,
		DesignID:   common.ID(chi.URLParam(r, "id")),
		OrderedIDs: orderedIDs,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
