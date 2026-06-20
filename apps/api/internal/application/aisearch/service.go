package aisearch

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

var ErrEmptyQuery = errors.New("search query is empty")

const defaultSearchLimit = 12

type Service struct {
	embedder ports.Embedder
	repo     ports.EmbeddingRepository
}

type Dependencies struct {
	Embedder ports.Embedder
	Repo     ports.EmbeddingRepository
}

func NewService(deps Dependencies) Service {
	return Service{embedder: deps.Embedder, repo: deps.Repo}
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

// Search embeds the query and ranks eligible designs by cosine similarity.
func (s Service) Search(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, ErrEmptyQuery
	}
	if limit <= 0 || limit > 50 {
		limit = defaultSearchLimit
	}

	vectors, err := s.embedder.Embed(ctx, []string{q})
	if err != nil {
		return nil, err
	}
	if len(vectors) != 1 {
		return nil, errors.New("embedder returned no vector for the query")
	}
	queryVec := vectors[0]

	candidates, err := s.repo.SearchCandidates(ctx)
	if err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(candidates))
	for _, c := range candidates {
		score := cosine(queryVec, c.Embedding)
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
	return results, nil
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
