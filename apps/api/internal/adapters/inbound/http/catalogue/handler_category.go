package cataloguehttp

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	catalogueapp "github.com/xcreativs/xtiitch/apps/api/internal/application/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

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

func (handler Handler) updateCollection(w http.ResponseWriter, r *http.Request) {
	scope, role, ok := tenantPrincipal(w, r)
	if !ok {
		return
	}
	var body createCollectionBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.UpdateCollection(r.Context(), catalogueapp.UpdateCollectionCommand{
		Scope:        scope,
		ActorRole:    role,
		CollectionID: common.ID(chi.URLParam(r, "id")),
		Name:         body.Name,
		Theme:        body.Theme,
		Sequence:     body.Sequence,
	}); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
