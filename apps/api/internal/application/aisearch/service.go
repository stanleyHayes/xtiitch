package aisearch

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

var (
	ErrEmptyQuery = errors.New("search query is empty")
	// ErrQuotaExhausted means the requester has used their monthly free AI searches.
	// The returned SearchResponse still carries the Quota so the caller can render
	// the upgrade prompt.
	ErrQuotaExhausted = errors.New("ai search quota exhausted")
)

const defaultSearchLimit = 12

// Monthly free allowances. Anonymous shoppers get a small taste; signed-in free
// customers get more; pro customers are unlimited. Tunable later via config.
const (
	anonFreeSearchesPerMonth     = 5
	customerFreeSearchesPerMonth = 25
)

// Tier names surfaced to the client.
const (
	tierAnonymous = "anonymous"
	tierFree      = "free"
	tierPro       = "pro"
)

// Requester identifies who is searching, for metering. CustomerID is set for a
// signed-in customer; Fingerprint is a salted, non-reversible hash of an
// anonymous client. Exactly one is used (CustomerID takes precedence).
type Requester struct {
	CustomerID  string
	Fingerprint string
}

// Quota describes a requester's AI-search entitlement and remaining allowance.
type Quota struct {
	Tier      string
	Limit     int // 0 means unlimited
	Used      int
	Remaining int
}

type Service struct {
	embedder ports.Embedder
	repo     ports.EmbeddingRepository
	parser   ports.QueryParser
	usage    ports.SearchUsageRepository
	clock    ports.Clock
}

type Dependencies struct {
	Embedder ports.Embedder
	Repo     ports.EmbeddingRepository
	Parser   ports.QueryParser
	Usage    ports.SearchUsageRepository
	Clock    ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{
		embedder: deps.Embedder,
		repo:     deps.Repo,
		parser:   deps.Parser,
		usage:    deps.Usage,
		clock:    deps.Clock,
	}
}

// Backfill embeds up to `batch` designs whose embedding is missing or stale, and
// reports how many were (re)embedded. Safe to run repeatedly.
func (s Service) Backfill(ctx context.Context, batch int) (int, error) {
	sources, err := s.repo.DesignsNeedingEmbedding(ctx, batch)
	if err != nil {
		return 0, err
	}
	if len(sources) == 0 {
		return 0, nil
	}

	texts := make([]string, len(sources))
	for i, src := range sources {
		texts[i] = src.Content
	}
	vectors, err := s.embedder.Embed(ctx, texts)
	if err != nil {
		return 0, err
	}
	if len(vectors) != len(sources) {
		return 0, errors.New("embedder returned a mismatched vector count")
	}

	model := s.embedder.Model()
	for i, src := range sources {
		if err := s.repo.UpsertEmbedding(ctx, ports.UpsertEmbeddingInput{
			DesignID:    src.DesignID,
			BusinessID:  src.BusinessID,
			ContentHash: src.ContentHash,
			Embedding:   vectors[i],
			Model:       model,
		}); err != nil {
			return i, err
		}
	}
	return len(sources), nil
}

type SearchResult struct {
	DesignTitle  string
	DesignHandle string
	Image        string
	PriceMinor   int64
	StoreName    string
	StoreHandle  string
	Score        float64
}

// SearchResponse is the ranked hits plus the structured intent the parser
// understood, so the UI can echo "showing red kente dresses under GHS 800".
type SearchResponse struct {
	Results       []SearchResult
	Interpreted   string
	Colors        []string
	Categories    []string
	Occasions     []string
	PriceMinMinor int64
	PriceMaxMinor int64
	Quota         Quota
}

// facetBoost is added per distinct structured-intent term (colour, category,
// occasion) found in a candidate's searchable text. Small relative to the [0,1]
// cosine score so semantics lead and lexical intent breaks ties / lifts exact
// matches.
const facetBoost = 0.04

// Search parses the query into structured intent, embeds the style description,
// and ranks eligible designs by cosine similarity blended with intent matches.
// Hard price bounds are applied as filters; colours/categories/occasions as soft
// boosts. The parsed intent and the requester's quota are returned so callers can
// show what was understood and how many free searches remain.
//
// The freemium paywall is enforced first: when the requester is over their
// monthly free allowance, it returns ErrQuotaExhausted with the Quota populated
// and no results.
func (s Service) Search(ctx context.Context, query string, limit int, requester Requester) (SearchResponse, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return SearchResponse{}, ErrEmptyQuery
	}
	if limit <= 0 || limit > 50 {
		limit = defaultSearchLimit
	}

	quota, err := s.enforceQuota(ctx, requester)
	if err != nil {
		if errors.Is(err, ErrQuotaExhausted) {
			return SearchResponse{Quota: quota}, ErrQuotaExhausted
		}
		return SearchResponse{}, err
	}

	parsed, queryVec, err := s.parseAndEmbed(ctx, q)
	if err != nil {
		return SearchResponse{}, err
	}

	candidates, err := s.repo.SearchCandidates(ctx)
	if err != nil {
		return SearchResponse{}, err
	}

	facets := append(append(append([]string{}, parsed.Colors...), parsed.Categories...), parsed.Occasions...)

	results := make([]SearchResult, 0, len(candidates))
	for _, c := range candidates {
		if !withinPriceBounds(c.PriceMinor, parsed) {
			continue
		}
		score := cosine(queryVec, c.Embedding) + facetScore(c.Searchable, facets)
		if score <= 0 {
			continue
		}
		results = append(results, SearchResult{
			DesignTitle:  c.DesignTitle,
			DesignHandle: c.DesignHandle,
			Image:        c.Image,
			PriceMinor:   c.PriceMinor,
			StoreName:    c.StoreName,
			StoreHandle:  c.StoreHandle,
			Score:        score,
		})
	}

	sort.Slice(results, func(i, j int) bool { return results[i].Score > results[j].Score })
	if len(results) > limit {
		results = results[:limit]
	}
	return SearchResponse{
		Results:       results,
		Interpreted:   parsed.CleanedQuery,
		Colors:        parsed.Colors,
		Categories:    parsed.Categories,
		Occasions:     parsed.Occasions,
		PriceMinMinor: parsed.PriceMinMinor,
		PriceMaxMinor: parsed.PriceMaxMinor,
		Quota:         quota,
	}, nil
}

// enforceQuota meters the requester and returns their resulting quota. Pro
// customers are unlimited (no increment). Free/anonymous requesters are counted
// for the calendar month; once the new count exceeds the allowance it returns
// ErrQuotaExhausted with Remaining 0. When no usage repository is wired (e.g.
// tests), metering is skipped and an unlimited quota is returned.
func (s Service) enforceQuota(ctx context.Context, requester Requester) (Quota, error) {
	if s.usage == nil {
		return Quota{Tier: tierPro, Limit: 0}, nil
	}

	kind, subject, limit, tier := s.resolveTier(ctx, requester)
	if limit <= 0 { // pro / unlimited
		return Quota{Tier: tier, Limit: 0}, nil
	}
	if subject == "" {
		// No way to meter (anonymous client with no fingerprint): fail closed to
		// the free allowance shape but allow the search.
		return Quota{Tier: tier, Limit: limit, Used: 0, Remaining: limit}, nil
	}

	count, err := s.usage.IncrementUsage(ctx, kind, subject, s.monthStart())
	if err != nil {
		return Quota{}, err
	}
	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}
	quota := Quota{Tier: tier, Limit: limit, Used: count, Remaining: remaining}
	if count > limit {
		return quota, ErrQuotaExhausted
	}
	return quota, nil
}

// resolveTier maps a requester to (subjectKind, subjectID, monthlyLimit, tier).
func (s Service) resolveTier(ctx context.Context, requester Requester) (string, string, int, string) {
	if requester.CustomerID != "" {
		if pro, err := s.usage.CustomerIsPro(ctx, common.ID(requester.CustomerID)); err == nil && pro {
			return "customer", requester.CustomerID, 0, tierPro
		}
		return "customer", requester.CustomerID, customerFreeSearchesPerMonth, tierFree
	}
	return "anon", requester.Fingerprint, anonFreeSearchesPerMonth, tierAnonymous
}

func (s Service) monthStart() time.Time {
	now := time.Now().UTC()
	if s.clock != nil {
		now = s.clock.Now().UTC()
	}
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// parseAndEmbed extracts structured intent (best-effort; a parser failure falls
// back to the raw query) and embeds the style description for ranking.
func (s Service) parseAndEmbed(ctx context.Context, q string) (ports.ParsedQuery, []float32, error) {
	parsed := ports.ParsedQuery{CleanedQuery: q}
	if s.parser != nil {
		if p, err := s.parser.Parse(ctx, q); err == nil {
			parsed = p
		}
	}
	embedText := strings.TrimSpace(parsed.CleanedQuery)
	if embedText == "" {
		embedText = q
	}
	vectors, err := s.embedder.Embed(ctx, []string{embedText})
	if err != nil {
		return parsed, nil, err
	}
	if len(vectors) != 1 {
		return parsed, nil, errors.New("embedder returned no vector for the query")
	}
	return parsed, vectors[0], nil
}

// withinPriceBounds applies hard price filters, but only to priced designs —
// an unpriced (price 0) design is never excluded on budget.
func withinPriceBounds(priceMinor int64, parsed ports.ParsedQuery) bool {
	if priceMinor <= 0 {
		return true
	}
	if parsed.PriceMaxMinor > 0 && priceMinor > parsed.PriceMaxMinor {
		return false
	}
	if parsed.PriceMinMinor > 0 && priceMinor < parsed.PriceMinMinor {
		return false
	}
	return true
}

// facetScore lifts candidates whose text contains the parsed colours/categories/
// occasions, one facetBoost per distinct match.
func facetScore(searchable string, facets []string) float64 {
	matched := 0
	for _, facet := range facets {
		if facet != "" && strings.Contains(searchable, facet) {
			matched++
		}
	}
	return float64(matched) * facetBoost
}

func cosine(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}
