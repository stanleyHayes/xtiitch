package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Embedder turns text into vectors for semantic search. Implemented by a hosted
// model (e.g. OpenAI) in production, and a deterministic dev embedder locally.
type Embedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
	Model() string
}

// QueryParser turns a shopper's free text ("flowy red dress for a beach
// wedding under 800 cedis") into structured intent that the ranker blends with
// vector similarity. Implemented by Claude in production, and a deterministic
// heuristic parser locally (no key required).
type QueryParser interface {
	Parse(ctx context.Context, query string) (ParsedQuery, error)
}

// ParsedQuery is the structured intent extracted from a natural-language query.
// Zero values mean "not specified" (e.g. PriceMaxMinor == 0 imposes no cap).
type ParsedQuery struct {
	CleanedQuery  string
	Colors        []string
	Categories    []string
	Occasions     []string
	PriceMinMinor int64
	PriceMaxMinor int64
}

// EmbeddingRepository stores design embeddings and serves the candidate set for
// a marketplace semantic search.
type EmbeddingRepository interface {
	// DesignsNeedingEmbedding returns active designs whose embedding is missing or
	// stale (content_hash changed), for the ingest/backfill pipeline.
	DesignsNeedingEmbedding(ctx context.Context, limit int) ([]DesignEmbeddingSource, error)
	UpsertEmbedding(ctx context.Context, input UpsertEmbeddingInput) error
	// SearchCandidates returns embedding rows for active designs in eligible
	// (verified, online-ordering) shops, enriched for display. Cross-tenant
	// (marketplace); ranking by cosine happens in the application layer.
	SearchCandidates(ctx context.Context) ([]EmbeddingCandidate, error)
}

// SearchUsageRepository meters AI search for the freemium paywall. Usage is
// global (no tenant), keyed by an opaque subject and a calendar month.
type SearchUsageRepository interface {
	// IncrementUsage atomically bumps and returns the subject's new count for the
	// month. The first call in a month creates the row at 1.
	IncrementUsage(ctx context.Context, subjectKind, subjectID string, periodMonth time.Time) (int, error)
	// CustomerIsPro reports whether a signed-in customer has the unlimited
	// (ai_search_pro) entitlement.
	CustomerIsPro(ctx context.Context, customerID common.ID) (bool, error)
}

// DesignEmbeddingSource is the text + identity needed to embed one design.
type DesignEmbeddingSource struct {
	DesignID    common.ID
	BusinessID  common.ID
	Content     string
	ContentHash string
}

type UpsertEmbeddingInput struct {
	DesignID    common.ID
	BusinessID  common.ID
	ContentHash string
	Embedding   []float32
	Model       string
}

// EmbeddingCandidate is one design's stored embedding plus the fields needed to
// render a search hit. Searchable is a lowercased text blob (title, description,
// collection) the ranker scans for structured-intent matches.
type EmbeddingCandidate struct {
	DesignID     common.ID
	DesignTitle  string
	DesignHandle string
	Image        string
	PriceMinor   int64
	StoreName    string
	StoreHandle  string
	Searchable   string
	Embedding    []float32
}
