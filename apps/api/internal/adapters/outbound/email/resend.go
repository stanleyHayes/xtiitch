package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

const resendAPIURL = "https://api.resend.com"

type ResendSender struct {
	apiKey  string
	from    string
	baseURL string
	client  *http.Client
}

func NewResendSender(apiKey string, from string) ports.EmailSender {
	sender := newResendSender(apiKey, from, resendAPIURL, http.DefaultClient)
	if sender.apiKey == "" || sender.from == "" {
		return nil
	}
	return sender
}

func newResendSender(apiKey string, from string, baseURL string, client *http.Client) ResendSender {
	if client == nil {
		client = http.DefaultClient
	}
	return ResendSender{
		apiKey:  strings.TrimSpace(apiKey),
		from:    strings.TrimSpace(from),
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		client:  client,
	}
}

func (sender ResendSender) Send(ctx context.Context, message ports.EmailMessage) error {
	to := strings.TrimSpace(message.To)
	subject := strings.TrimSpace(message.Subject)
	body := strings.TrimSpace(message.Body)
	if sender.apiKey == "" || sender.from == "" || to == "" || subject == "" || body == "" {
		return errors.New("email sender is not configured")
	}

	payload, err := json.Marshal(map[string]any{
		"from":    sender.from,
		"to":      []string{to},
		"subject": subject,
		"text":    body,
	})
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, sender.baseURL+"/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+sender.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := sender.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
		return nil
	}
	responseBody, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
	return fmt.Errorf("resend email failed: status=%d body=%s", response.StatusCode, strings.TrimSpace(string(responseBody)))
}
