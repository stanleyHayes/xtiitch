// Package smsadapter sends SMS via Arkesel's v2 API (https://sms.arkesel.com),
// used for auth OTPs and order notifications. A logging stub is used in dev / when
// no API key is configured, so the SMS paths are exercisable without a provider.
package smsadapter

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

const defaultArkeselEndpoint = "https://sms.arkesel.com/api/v2/sms/send"

// ArkeselSender posts SMS via Arkesel's v2 send endpoint.
type ArkeselSender struct {
	apiKey   string
	sender   string
	endpoint string
	client   *http.Client
}

func NewArkeselSender(apiKey, senderID, endpoint string) ArkeselSender {
	if strings.TrimSpace(endpoint) == "" {
		endpoint = defaultArkeselEndpoint
	}
	if strings.TrimSpace(senderID) == "" {
		senderID = "Xtiitch"
	}
	return ArkeselSender{
		apiKey:   apiKey,
		sender:   senderID,
		endpoint: endpoint,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (s ArkeselSender) SendSMS(ctx context.Context, to string, message string) error {
	payload, err := json.Marshal(map[string]any{
		"sender":     s.sender,
		"message":    message,
		"recipients": []string{normalizeRecipient(to)},
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("arkesel sms to %s returned %d: %s", to, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	// Arkesel returns HTTP 200 with a JSON `status` field even for logical
	// failures (bad sender id, insufficient credits, invalid recipient), so treat
	// any non-"success" status as an error and surface the body.
	var parsed struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(body, &parsed); err == nil && parsed.Status != "" && !strings.EqualFold(parsed.Status, "success") {
		return fmt.Errorf("arkesel sms to %s failed: %s", to, strings.TrimSpace(string(body)))
	}
	return nil
}

// normalizeRecipient coerces a Ghana number to E.164 digits (233XXXXXXXXX);
// unknown formats pass through as their bare digits.
func normalizeRecipient(raw string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(raw) {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	switch {
	case strings.HasPrefix(digits, "233") && len(digits) == 12:
		return digits
	case strings.HasPrefix(digits, "0") && len(digits) == 10:
		return "233" + digits[1:]
	case len(digits) == 9:
		return "233" + digits
	default:
		return digits
	}
}

// LoggingSMSSender logs the message instead of calling Arkesel — dev / no key.
type LoggingSMSSender struct{ logger *slog.Logger }

func NewLoggingSMSSender(logger *slog.Logger) LoggingSMSSender {
	return LoggingSMSSender{logger: logger}
}

func (s LoggingSMSSender) SendSMS(_ context.Context, to string, message string) error {
	if s.logger != nil {
		s.logger.Info("sms (dev log)", "to", to, "message", message)
	}
	return nil
}
