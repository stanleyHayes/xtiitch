package aiadapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// Vocabularies the heuristic parser scans for. Kept deliberately small and
// fashion-/Ghana-specific; the Claude parser handles the long tail. Lowercase.
var (
	knownColors = []string{
		"black", "white", "red", "blue", "navy", "green", "yellow", "gold", "golden",
		"orange", "purple", "pink", "brown", "beige", "cream", "grey", "gray", "silver",
		"maroon", "wine", "burgundy", "teal", "turquoise", "ivory", "kente",
	}
	knownCategories = []string{
		"dress", "gown", "kaftan", "agbada", "kente", "suit", "blazer", "jacket",
		"shirt", "trouser", "trousers", "skirt", "jumpsuit", "set", "two-piece",
		"top", "blouse", "wrapper", "smock", "boubou", "ankara", "lace", "slit",
		"kaba", "shorts", "co-ord",
	}
	knownOccasions = []string{
		"wedding", "funeral", "party", "church", "festival", "beach", "office",
		"work", "casual", "traditional", "engagement", "graduation", "birthday",
		"corporate", "outdooring", "dinner", "cocktail", "everyday",
	}
)

// HeuristicQueryParser extracts intent with regex + keyword scans. Deterministic,
// dependency-free, and always available so AI search works locally with no key.
type HeuristicQueryParser struct{}

func NewHeuristicQueryParser() HeuristicQueryParser { return HeuristicQueryParser{} }

// priceCap matches "under 800", "below ghc 1,200", "less than 500 cedis", etc.
var priceCapPattern = regexp.MustCompile(
	`(?i)(?:under|below|less than|max|up to|at most|within|no more than)` +
		`\s*(?:gh[c₵]?|₵|cedis)?\s*([0-9][0-9,]*)`,
)

// priceFloor matches "over 500", "above 1000", "from 300", "at least 250".
var priceFloorPattern = regexp.MustCompile(
	`(?i)(?:over|above|from|at least|min|minimum|more than|starting at)` +
		`\s*(?:gh[c₵]?|₵|cedis)?\s*([0-9][0-9,]*)`,
)

func (HeuristicQueryParser) Parse(_ context.Context, query string) (ports.ParsedQuery, error) {
	lower := strings.ToLower(query)
	parsed := ports.ParsedQuery{
		Colors:     matchVocabulary(lower, knownColors),
		Categories: matchVocabulary(lower, knownCategories),
		Occasions:  matchVocabulary(lower, knownOccasions),
	}
	if m := priceCapPattern.FindStringSubmatch(lower); m != nil {
		parsed.PriceMaxMinor = parseCedisToMinor(m[1])
	}
	if m := priceFloorPattern.FindStringSubmatch(lower); m != nil {
		parsed.PriceMinMinor = parseCedisToMinor(m[1])
	}
	// Strip price phrases so the embedded text is about style, not budget.
	cleaned := priceCapPattern.ReplaceAllString(query, " ")
	cleaned = priceFloorPattern.ReplaceAllString(cleaned, " ")
	parsed.CleanedQuery = strings.Join(strings.Fields(cleaned), " ")
	if parsed.CleanedQuery == "" {
		parsed.CleanedQuery = strings.TrimSpace(query)
	}
	return parsed, nil
}

func matchVocabulary(text string, vocab []string) []string {
	var out []string
	seen := map[string]bool{}
	for _, term := range vocab {
		if seen[term] {
			continue
		}
		if strings.Contains(text, term) {
			out = append(out, term)
			seen[term] = true
		}
	}
	return out
}

func parseCedisToMinor(raw string) int64 {
	clean := strings.ReplaceAll(raw, ",", "")
	value, err := strconv.ParseInt(clean, 10, 64)
	if err != nil {
		return 0
	}
	return value * 100
}

// ClaudeQueryParser uses the Anthropic Messages API to extract structured intent.
// Used when ANTHROPIC_API_KEY is set; otherwise the heuristic parser is wired.
// It degrades to the heuristic result on any API/parse failure so search never
// hard-fails on the LLM hop.
type ClaudeQueryParser struct {
	apiKey   string
	model    string
	client   *http.Client
	fallback HeuristicQueryParser
}

func NewClaudeQueryParser(apiKey, model string) ClaudeQueryParser {
	if strings.TrimSpace(model) == "" {
		model = "claude-haiku-4-5-20251001"
	}
	return ClaudeQueryParser{
		apiKey:   apiKey,
		model:    model,
		client:   &http.Client{Timeout: 8 * time.Second},
		fallback: HeuristicQueryParser{},
	}
}

const claudeQuerySystemPrompt = `You convert a fashion shopper's natural-language request ` +
	`into a compact JSON filter for a Ghanaian fashion marketplace search.
Return ONLY a JSON object, no prose, with this exact shape:
		{"cleaned_query": string, "colors": string[], "categories": string[],` +
	`"occasions": string[], "price_min_cedis": number, "price_max_cedis": number}` +
	`
Rules:
- cleaned_query: the style description with any budget/price words removed.
- colors/categories/occasions: lowercase single words found or strongly implied; [] if none.
- price_*_cedis: whole cedis (not pesewas); 0 when unspecified.
Output the JSON object only.`

func (p ClaudeQueryParser) Parse(ctx context.Context, query string) (ports.ParsedQuery, error) {
	body, err := json.Marshal(map[string]any{
		"model":      p.model,
		"max_tokens": 400,
		"system":     claudeQuerySystemPrompt,
		"messages": []map[string]any{
			{"role": "user", "content": query},
		},
	})
	if err != nil {
		return p.fallback.Parse(ctx, query)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return p.fallback.Parse(ctx, query)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.client.Do(req)
	if err != nil {
		return p.fallback.Parse(ctx, query)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return p.fallback.Parse(ctx, query)
	}

	var decoded struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil || len(decoded.Content) == 0 {
		return p.fallback.Parse(ctx, query)
	}

	parsed, err := parseClaudeFilterJSON(decoded.Content[0].Text)
	if err != nil {
		return p.fallback.Parse(ctx, query)
	}
	if strings.TrimSpace(parsed.CleanedQuery) == "" {
		parsed.CleanedQuery = strings.TrimSpace(query)
	}
	return parsed, nil
}

// parseClaudeFilterJSON tolerates the model wrapping JSON in prose or fences by
// extracting the first {...} block.
func parseClaudeFilterJSON(text string) (ports.ParsedQuery, error) {
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start < 0 || end <= start {
		return ports.ParsedQuery{}, fmt.Errorf("no json object in model output")
	}
	var raw struct {
		CleanedQuery  string   `json:"cleaned_query"`
		Colors        []string `json:"colors"`
		Categories    []string `json:"categories"`
		Occasions     []string `json:"occasions"`
		PriceMinCedis float64  `json:"price_min_cedis"`
		PriceMaxCedis float64  `json:"price_max_cedis"`
	}
	if err := json.Unmarshal([]byte(text[start:end+1]), &raw); err != nil {
		return ports.ParsedQuery{}, err
	}
	return ports.ParsedQuery{
		CleanedQuery:  raw.CleanedQuery,
		Colors:        lowerAll(raw.Colors),
		Categories:    lowerAll(raw.Categories),
		Occasions:     lowerAll(raw.Occasions),
		PriceMinMinor: int64(raw.PriceMinCedis) * 100,
		PriceMaxMinor: int64(raw.PriceMaxCedis) * 100,
	}, nil
}

func lowerAll(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	out := make([]string, 0, len(values))
	for _, v := range values {
		if trimmed := strings.ToLower(strings.TrimSpace(v)); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
