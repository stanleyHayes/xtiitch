// Package whatsappadapter sends outbound WhatsApp Cloud API messages from the
// API (the inbound bot's replies). The worker has its own TS sender for order
// lifecycle notifications; this is the synchronous reply path for conversations.
package whatsappadapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// CloudSender posts text replies to the WhatsApp Cloud API.
type CloudSender struct {
	phoneNumberID string
	accessToken   string
	graphVersion  string
	client        *http.Client
}

func NewCloudSender(phoneNumberID, accessToken, graphVersion string) CloudSender {
	if strings.TrimSpace(graphVersion) == "" {
		graphVersion = "v21.0"
	}
	return CloudSender{
		phoneNumberID: phoneNumberID,
		accessToken:   accessToken,
		graphVersion:  graphVersion,
		client:        &http.Client{Timeout: 10 * time.Second},
	}
}

func (s CloudSender) SendText(ctx context.Context, toWaID, body string) error {
	return s.postMessage(ctx, toWaID, map[string]any{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                toWaID,
		"type":              "text",
		"text":              map[string]any{"preview_url": false, "body": body},
	})
}

// SendAuthTemplate delivers a one-time code via an approved WhatsApp
// AUTHENTICATION template. Unlike free-form text, a template can be sent
// business-initiated (outside the 24h customer-service window), which is required
// for cold sign-up/verification codes. The code is passed as the single body
// parameter; for a COPY_CODE template Meta populates the copy-code button from it.
func (s CloudSender) SendAuthTemplate(ctx context.Context, toWaID, templateName, languageCode, code string) error {
	if strings.TrimSpace(languageCode) == "" {
		languageCode = "en_US"
	}
	return s.postMessage(ctx, toWaID, map[string]any{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                toWaID,
		"type":              "template",
		"template": map[string]any{
			"name":     templateName,
			"language": map[string]any{"code": languageCode},
			"components": []any{
				map[string]any{
					"type":       "body",
					"parameters": []any{map[string]any{"type": "text", "text": code}},
				},
			},
		},
	})
}

// postMessage marshals and POSTs a Cloud API message payload, returning an error
// that includes Meta's response body on a non-2xx so the real reason (e.g. 133010
// unregistered, 131047 re-engagement, 132xxx template issue, 190 bad token) is
// visible in logs instead of a bare status code.
func (s CloudSender) postMessage(ctx context.Context, toWaID string, message map[string]any) error {
	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}
	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", s.graphVersion, s.phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.accessToken)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf(
			"whatsapp cloud send to %s returned %d: %s",
			toWaID,
			resp.StatusCode,
			strings.TrimSpace(string(body)),
		)
	}
	return nil
}

// LoggingSender logs the reply instead of calling Meta. Used in dev when the
// Cloud API credentials are not configured, so the conversation engine is fully
// exercisable locally (mirrors the LoggingOTPDelivery dev pattern).
type LoggingSender struct {
	logger *slog.Logger
}

func NewLoggingSender(logger *slog.Logger) LoggingSender {
	return LoggingSender{logger: logger}
}

func (s LoggingSender) SendText(_ context.Context, toWaID, body string) error {
	s.logger.Info("whatsapp bot reply (dev log)", "to", toWaID, "body", body)
	return nil
}
