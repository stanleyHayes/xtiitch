// Package aiadapter holds outbound adapters for AI features (embeddings, LLM).
package aiadapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math"
	"net/http"
	"strings"
	"time"
	"unicode"
)

// DevEmbedder is a deterministic, API-key-free embedder: a hashing bag-of-words
// vectoriser. It captures lexical similarity (designs sharing words score higher)
// so the search pipeline is fully testable locally; production swaps in a real
// semantic model (OpenAIEmbedder).
type DevEmbedder struct{ dim int }

func NewDevEmbedder() DevEmbedder { return DevEmbedder{dim: 512} }

func (e DevEmbedder) Model() string { return "dev-hashing-bow-512" }

func (e DevEmbedder) Embed(_ context.Context, texts []string) ([][]float32, error) {
	out := make([][]float32, len(texts))
	for i, t := range texts {
		out[i] = hashEmbed(t, e.dim)
	}
	return out, nil
}

func hashEmbed(text string, dim int) []float32 {
	v := make([]float32, dim)
	if dim <= 0 {
		return v
	}
	for _, tok := range tokenize(text) {
		h := fnv.New32a()
		_, _ = h.Write([]byte(tok))
		idx := h.Sum32() % uint32(dim) //nolint:gosec // dim validated above and bounded by embedding model config
		// A second hash bit decides the sign, reducing collision bias.
		sign := float32(1)
		if h.Sum32()&1 == 0 {
			sign = -1
		}
		v[idx] += sign
	}
	normalize(v)
	return v
}

func tokenize(text string) []string {
	fields := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if len(f) >= 2 {
			out = append(out, f)
		}
	}
	return out
}

func normalize(v []float32) {
	var sum float64
	for _, x := range v {
		sum += float64(x) * float64(x)
	}
	if sum == 0 {
		return
	}
	norm := float32(math.Sqrt(sum))
	for i := range v {
		v[i] /= norm
	}
}

// OpenAIEmbedder calls the OpenAI embeddings API. Used when OPENAI_API_KEY is set.
type OpenAIEmbedder struct {
	apiKey string
	model  string
	client *http.Client
}

func NewOpenAIEmbedder(apiKey, model string) OpenAIEmbedder {
	if strings.TrimSpace(model) == "" {
		model = "text-embedding-3-small"
	}
	return OpenAIEmbedder{
		apiKey: apiKey,
		model:  model,
		client: &http.Client{Timeout: 20 * time.Second},
	}
}

func (e OpenAIEmbedder) Model() string { return e.model }

func (e OpenAIEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	payload, err := json.Marshal(map[string]any{"model": e.model, "input": texts})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/embeddings", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai embeddings returned %d", resp.StatusCode)
	}

	var decoded struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, err
	}
	out := make([][]float32, 0, len(decoded.Data))
	for _, d := range decoded.Data {
		out = append(out, d.Embedding)
	}
	if len(out) != len(texts) {
		return nil, fmt.Errorf("openai returned %d embeddings for %d inputs", len(out), len(texts))
	}
	return out, nil
}
