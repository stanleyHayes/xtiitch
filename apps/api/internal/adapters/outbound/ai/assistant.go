package aiadapter

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// ClaudeAssistant rewrites/improves short business copy (design descriptions,
// customer messages, promo text) with Claude. It falls back to returning the
// input unchanged when no key is configured or the call fails, so the caller
// always gets usable text.
type ClaudeAssistant struct {
	apiKey string
	model  string
	client *http.Client
}

func NewClaudeAssistant(apiKey, model string) ClaudeAssistant {
	if strings.TrimSpace(model) == "" {
		model = "claude-haiku-4-5-20251001"
	}
	return ClaudeAssistant{
		apiKey: apiKey,
		model:  model,
		client: &http.Client{Timeout: 12 * time.Second},
	}
}

const assistSystemPrompt = `You are a writing assistant for a Ghanaian fashion business's storefront and customer messages. Rewrite the user's text to follow their instruction. Keep it natural, warm and professional, and concise. Never invent facts (prices, dates, materials, measurements) that are not in the text. Reply with ONLY the rewritten text — no preamble, no quotes, no markdown.`

func (a ClaudeAssistant) Assist(ctx context.Context, input ports.AssistInput) (string, error) {
	text := strings.TrimSpace(input.Text)
	if a.apiKey == "" || text == "" {
		return text, nil
	}

	prompt := assistInstruction(input.Instruction)
	if field := strings.TrimSpace(input.Field); field != "" {
		prompt += " (This text is a " + field + ".)"
	}
	prompt += "\n\nText:\n" + text

	body, err := json.Marshal(map[string]any{
		"model":      a.model,
		"max_tokens": 600,
		"system":     assistSystemPrompt,
		"messages": []map[string]any{
			{"role": "user", "content": prompt},
		},
	})
	if err != nil {
		return text, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return text, nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return text, nil
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return text, nil
	}

	var decoded struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil || len(decoded.Content) == 0 {
		return text, nil
	}
	if out := strings.TrimSpace(decoded.Content[0].Text); out != "" {
		return out, nil
	}
	return text, nil
}

func assistInstruction(kind string) string {
	switch strings.ToLower(strings.TrimSpace(kind)) {
	case "rewrite":
		return "Rewrite this text so it reads clearly and professionally."
	case "shorten":
		return "Make this text shorter and punchier while keeping the meaning."
	case "expand":
		return "Expand this text with a little more helpful, appealing detail — without inventing facts."
	case "friendly":
		return "Rewrite this text in a warm, friendly tone."
	case "fix":
		return "Fix the spelling, grammar and punctuation of this text without changing its meaning."
	default: // "improve"
		return "Improve this text: fix grammar, tighten the wording and make it more appealing."
	}
}
