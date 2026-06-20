package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Embedder turns text into vectors for semantic search. Implemented by a hosted
// model (e.g. OpenAI) in production, and a deterministic dev embedder locally.
type Embedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
	Model() string
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
// render a search hit.
type EmbeddingCandidate struct {
	DesignID     common.ID
	DesignTitle  string
	DesignHandle string
	Image        string
	PriceMinor   int64
	StoreName    string
	StoreHandle  string
	Embedding    []float32
}
