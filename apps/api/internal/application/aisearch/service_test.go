package aisearch

import (
	"context"
	"testing"
	"time"

	aiadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/ai"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// stubRepo serves a fixed candidate set and records backfill calls. The dev
// embedder is deterministic, so we can assert on ranking without a database.
type stubRepo struct {
	sources    []ports.DesignEmbeddingSource
	candidates []ports.EmbeddingCandidate
	upserts    []ports.UpsertEmbeddingInput
}

func (r *stubRepo) DesignsNeedingEmbedding(_ context.Context, _ int, _ string) ([]ports.DesignEmbeddingSource, error) {
	return r.sources, nil
}

func (r *stubRepo) UpsertEmbedding(_ context.Context, input ports.UpsertEmbeddingInput) error {
	r.upserts = append(r.upserts, input)
	return nil
}

func (r *stubRepo) SearchCandidates(_ context.Context) ([]ports.EmbeddingCandidate, error) {
	return r.candidates, nil
}

// stubUsage meters in memory. proCustomers names customers treated as unlimited.
type stubUsage struct {
	counts       map[string]int
	proCustomers map[string]bool
}

func newStubUsage() *stubUsage {
	return &stubUsage{counts: map[string]int{}, proCustomers: map[string]bool{}}
}

func (u *stubUsage) IncrementUsage(_ context.Context, kind, id string, _ time.Time) (int, error) {
	key := kind + ":" + id
	u.counts[key]++
	return u.counts[key], nil
}

func (u *stubUsage) CustomerIsPro(_ context.Context, customerID common.ID) (bool, error) {
	return u.proCustomers[customerID.String()], nil
}

func embed(t *testing.T, embedder ports.Embedder, text string) []float32 {
	t.Helper()
	vectors, err := embedder.Embed(context.Background(), []string{text})
	if err != nil {
		t.Fatalf("embed %q: %v", text, err)
	}
	return vectors[0]
}

func TestSearchRanksLexicallyRelevantDesignsFirst(t *testing.T) {
	embedder := aiadapter.NewDevEmbedder()
	candidates := []ports.EmbeddingCandidate{
		{
			DesignID:    common.ID("1"),
			DesignTitle: "Kente Wrap Dress",
			StoreName:   "Demo Atelier",
			Embedding:   embed(t, embedder, "kente wrap dress wedding red"),
		},
		{
			DesignID:    common.ID("2"),
			DesignTitle: "Leather Biker Jacket",
			StoreName:   "Demo Atelier",
			Embedding:   embed(t, embedder, "leather biker jacket black"),
		},
	}
	service := NewService(Dependencies{
		Embedder: embedder,
		Repo:     &stubRepo{candidates: candidates},
		Parser:   aiadapter.NewHeuristicQueryParser(),
	})

	response, err := service.Search(context.Background(), "red kente dress for a wedding", 10, Requester{})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	results := response.Results
	if len(results) == 0 {
		t.Fatal("expected at least one result")
	}
	if results[0].DesignTitle != "Kente Wrap Dress" {
		t.Fatalf("expected kente dress first, got %q", results[0].DesignTitle)
	}
	for i := 1; i < len(results); i++ {
		if results[i-1].Score < results[i].Score {
			t.Fatalf("results not sorted by score descending: %v < %v", results[i-1].Score, results[i].Score)
		}
	}
}

func TestSearchAppliesParsedPriceCap(t *testing.T) {
	embedder := aiadapter.NewDevEmbedder()
	candidates := []ports.EmbeddingCandidate{
		{DesignID: common.ID("1"), DesignTitle: "Budget Kente Dress", PriceMinor: 40000, Searchable: "kente dress", Embedding: embed(t, embedder, "kente dress")},
		{DesignID: common.ID("2"), DesignTitle: "Luxury Kente Dress", PriceMinor: 150000, Searchable: "kente dress", Embedding: embed(t, embedder, "kente dress")},
	}
	service := NewService(Dependencies{
		Embedder: embedder,
		Repo:     &stubRepo{candidates: candidates},
		Parser:   aiadapter.NewHeuristicQueryParser(),
	})

	response, err := service.Search(context.Background(), "kente dress under 800", 10, Requester{})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if response.PriceMaxMinor != 80000 {
		t.Fatalf("expected parsed cap 80000, got %d", response.PriceMaxMinor)
	}
	for _, r := range response.Results {
		if r.DesignTitle == "Luxury Kente Dress" {
			t.Fatalf("design over the GHS 800 cap should be filtered out")
		}
	}
}

func TestSearchRejectsEmptyQuery(t *testing.T) {
	service := NewService(Dependencies{Embedder: aiadapter.NewDevEmbedder(), Repo: &stubRepo{}})
	if _, err := service.Search(context.Background(), "   ", 10, Requester{}); err != ErrEmptyQuery {
		t.Fatalf("expected ErrEmptyQuery, got %v", err)
	}
}

func TestSearchEnforcesAnonymousQuota(t *testing.T) {
	embedder := aiadapter.NewDevEmbedder()
	repo := &stubRepo{candidates: []ports.EmbeddingCandidate{
		{DesignID: common.ID("1"), DesignTitle: "Kente Dress", Searchable: "kente dress", Embedding: embed(t, embedder, "kente dress")},
	}}
	service := NewService(Dependencies{
		Embedder: embedder,
		Repo:     repo,
		Parser:   aiadapter.NewHeuristicQueryParser(),
		Usage:    newStubUsage(),
	})
	req := Requester{Fingerprint: "anon-abc"}

	// The first anonFreeSearchesPerMonth searches succeed; the next is blocked.
	for i := 0; i < anonFreeSearchesPerMonth; i++ {
		resp, err := service.Search(context.Background(), "kente dress", 10, req)
		if err != nil {
			t.Fatalf("search %d unexpectedly blocked: %v", i+1, err)
		}
		if resp.Quota.Tier != tierAnonymous {
			t.Fatalf("expected anonymous tier, got %q", resp.Quota.Tier)
		}
	}
	resp, err := service.Search(context.Background(), "kente dress", 10, req)
	if err != ErrQuotaExhausted {
		t.Fatalf("expected ErrQuotaExhausted, got %v", err)
	}
	if resp.Quota.Remaining != 0 {
		t.Fatalf("expected 0 remaining, got %d", resp.Quota.Remaining)
	}
	if len(resp.Results) != 0 {
		t.Fatalf("expected no results when over quota, got %d", len(resp.Results))
	}
}

func TestSearchProCustomerIsUnlimited(t *testing.T) {
	embedder := aiadapter.NewDevEmbedder()
	repo := &stubRepo{candidates: []ports.EmbeddingCandidate{
		{DesignID: common.ID("1"), DesignTitle: "Kente Dress", Searchable: "kente dress", Embedding: embed(t, embedder, "kente dress")},
	}}
	usage := newStubUsage()
	usage.proCustomers["cust-1"] = true
	service := NewService(Dependencies{
		Embedder: embedder,
		Repo:     repo,
		Parser:   aiadapter.NewHeuristicQueryParser(),
		Usage:    usage,
	})
	req := Requester{CustomerID: "cust-1"}

	for i := 0; i < customerFreeSearchesPerMonth+5; i++ {
		resp, err := service.Search(context.Background(), "kente dress", 10, req)
		if err != nil {
			t.Fatalf("pro search %d blocked: %v", i+1, err)
		}
		if resp.Quota.Tier != tierPro || resp.Quota.Limit != 0 {
			t.Fatalf("expected unlimited pro quota, got %+v", resp.Quota)
		}
	}
}

func TestBackfillEmbedsEachSource(t *testing.T) {
	repo := &stubRepo{sources: []ports.DesignEmbeddingSource{
		{DesignID: common.ID("1"), BusinessID: common.ID("b1"), Content: "kente dress", ContentHash: "h1"},
		{DesignID: common.ID("2"), BusinessID: common.ID("b2"), Content: "ankara skirt", ContentHash: "h2"},
	}}
	service := NewService(Dependencies{Embedder: aiadapter.NewDevEmbedder(), Repo: repo})

	count, err := service.Backfill(context.Background(), 100)
	if err != nil {
		t.Fatalf("Backfill: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 embedded, got %d", count)
	}
	if len(repo.upserts) != 2 {
		t.Fatalf("expected 2 upserts, got %d", len(repo.upserts))
	}
	if repo.upserts[0].Model != embedder().Model() {
		t.Fatalf("unexpected model %q", repo.upserts[0].Model)
	}
	for _, up := range repo.upserts {
		if len(up.Embedding) == 0 {
			t.Fatalf("upsert %s has empty embedding", up.DesignID)
		}
	}
}

func embedder() ports.Embedder { return aiadapter.NewDevEmbedder() }
