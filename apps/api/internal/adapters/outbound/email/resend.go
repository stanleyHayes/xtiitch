package email

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
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

//nolint:gocognit,gocyclo // provider validation, request lifecycle, and bounded error decoding belong to one send operation
func (sender ResendSender) Send(ctx context.Context, message ports.EmailMessage) error {
	to := strings.TrimSpace(message.To)
	subject := strings.TrimSpace(message.Subject)
	body := strings.TrimSpace(message.Body)
	if sender.apiKey == "" || sender.from == "" || to == "" || subject == "" || body == "" {
		return errors.New("email sender is not configured")
	}

	// Every automated message carries a working Reply-To that reaches a human:
	// money mail sets billing@ on the message, everything else defaults to the
	// operational support@ inbox. Sending stays isolated on the noreply@ `from`.
	replyTo := strings.TrimSpace(message.ReplyTo)
	if replyTo == "" {
		replyTo = notification.ReplyToOperational
	}
	payload := map[string]any{
		"from":     sender.from,
		"to":       []string{to},
		"subject":  subject,
		"text":     body,
		"reply_to": replyTo,
	}
	if len(message.Attachments) > 0 {
		// Resend takes attachments as base64 content beside the filename (and an
		// optional content type); the port carries raw bytes so callers never
		// double-encode.
		attachments := make([]map[string]any, 0, len(message.Attachments))
		for _, attachment := range message.Attachments {
			filename := strings.TrimSpace(attachment.Filename)
			if filename == "" || len(attachment.Content) == 0 {
				return errors.New("email attachment needs a filename and content")
			}
			entry := map[string]any{
				"filename": filename,
				"content":  base64.StdEncoding.EncodeToString(attachment.Content),
			}
			if contentType := strings.TrimSpace(attachment.ContentType); contentType != "" {
				entry["content_type"] = contentType
			}
			attachments = append(attachments, entry)
		}
		payload["attachments"] = attachments
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, sender.baseURL+"/emails", bytes.NewReader(encoded))
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
