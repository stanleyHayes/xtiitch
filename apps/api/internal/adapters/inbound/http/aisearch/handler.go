package aisearchhttp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	aisearchapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aisearch"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type Service interface {
	Search(ctx context.Context, query string, limit int, requester aisearchapp.Requester) (aisearchapp.SearchResponse, error)
}

// CustomerVerifier resolves an optional customer bearer token so signed-in
// shoppers are metered by identity and get the larger free allowance.
type CustomerVerifier interface {
	VerifyCustomerAccessToken(ctx context.Context, token string) (ports.VerifiedCustomerToken, error)
}

type Handler struct {
	service  Service
	verifier CustomerVerifier
	// salt makes anonymous client fingerprints non-reversible; reusing the JWT
	// signing key is fine since the hash is one-way and never leaves the server.
	salt string
}

func NewHandler(service Service, verifier CustomerVerifier, salt string) Handler {
	return Handler{service: service, verifier: verifier, salt: salt}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/public/ai-search", handler.search)
}

type searchRequest struct {
	Query string `json:"query"`
	Limit int    `json:"limit"`
}

type searchHit struct {
	DesignTitle  string  `json:"design_title"`
	DesignHandle string  `json:"design_handle"`
	Image        string  `json:"image"`
	PriceMinor   int64   `json:"price_minor"`
	StoreName    string  `json:"store_name"`
	StoreHandle  string  `json:"store_handle"`
	Score        float64 `json:"score"`
}

func (handler Handler) search(w http.ResponseWriter, r *http.Request) {
	var request searchRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	requester := handler.resolveRequester(r)
	response, err := handler.service.Search(r.Context(), request.Query, request.Limit, requester)
	if err != nil {
		switch {
		case errors.Is(err, aisearchapp.ErrEmptyQuery):
			writeError(w, http.StatusBadRequest, "empty_query")
		case errors.Is(err, aisearchapp.ErrQuotaExhausted):
			// 402: the shopper has spent their free searches; the body carries the
			// quota so the UI can show the upgrade prompt.
			writeJSON(w, http.StatusPaymentRequired, map[string]any{
				"error": "search_quota_exhausted",
				"quota": quotaPayload(response.Quota),
			})
		default:
			writeError(w, http.StatusInternalServerError, "internal_error")
		}
		return
	}

	hits := make([]searchHit, 0, len(response.Results))
	for _, res := range response.Results {
		hits = append(hits, searchHit{
			DesignTitle:  res.DesignTitle,
			DesignHandle: res.DesignHandle,
			Image:        res.Image,
			PriceMinor:   res.PriceMinor,
			StoreName:    res.StoreName,
			StoreHandle:  res.StoreHandle,
			Score:        res.Score,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"results": hits,
		"understood": map[string]any{
			"interpreted":     response.Interpreted,
			"colors":          emptyIfNil(response.Colors),
			"categories":      emptyIfNil(response.Categories),
			"occasions":       emptyIfNil(response.Occasions),
			"price_min_minor": response.PriceMinMinor,
			"price_max_minor": response.PriceMaxMinor,
		},
		"quota": quotaPayload(response.Quota),
	})
}

// resolveRequester prefers a valid customer token; otherwise it meters the
// anonymous client by a salted hash of its IP (no raw IP is stored).
func (handler Handler) resolveRequester(r *http.Request) aisearchapp.Requester {
	if token, ok := bearerToken(r); ok && handler.verifier != nil {
		if verified, err := handler.verifier.VerifyCustomerAccessToken(r.Context(), token); err == nil {
			return aisearchapp.Requester{CustomerID: verified.CustomerID.String()}
		}
	}
	return aisearchapp.Requester{Fingerprint: handler.fingerprint(r)}
}

func (handler Handler) fingerprint(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if host == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(handler.salt + "|" + host))
	return hex.EncodeToString(sum[:])
}

func quotaPayload(q aisearchapp.Quota) map[string]any {
	return map[string]any{
		"tier":      q.Tier,
		"limit":     q.Limit,
		"used":      q.Used,
		"remaining": q.Remaining,
		"unlimited": q.Limit == 0,
	}
}

func emptyIfNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func bearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	return token, token != ""
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
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
