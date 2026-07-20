package email

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func TestResendSenderPostsEmailPayload(t *testing.T) {
	t.Parallel()

	var authHeader string
	var payload map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		if r.URL.Path != "/emails" {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	sender := newResendSender("secret", "Xtiitch <hello@xtiitch.com>", server.URL, server.Client())
	err := sender.Send(context.Background(), ports.EmailMessage{
		To:      "ama@example.com",
		Subject: "Welcome",
		Body:    "Open the dashboard.",
	})
	if err != nil {
		t.Fatalf("send email: %v", err)
	}
	if authHeader != "Bearer secret" {
		t.Fatalf("unexpected auth header %q", authHeader)
	}
	if payload["from"] != "Xtiitch <hello@xtiitch.com>" || payload["subject"] != "Welcome" || payload["text"] != "Open the dashboard." {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	to, ok := payload["to"].([]any)
	if !ok || len(to) != 1 || to[0] != "ama@example.com" {
		t.Fatalf("unexpected recipient payload: %+v", payload["to"])
	}
	if _, hasAttachments := payload["attachments"]; hasAttachments {
		t.Fatalf("a bodyless-attachment email must not send an attachments field: %+v", payload)
	}
}

// §14.1 scheduled reports email the generated FILE. The port carries raw
// bytes; the adapter must base64-encode them into Resend's attachments array
// with the filename and content type intact (round-trip verified by decoding).
func TestResendSenderPostsAttachmentsBase64(t *testing.T) {
	t.Parallel()

	var payload map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	content := []byte("ref,amount\nref_1,120.50\n")
	sender := newResendSender("secret", "Xtiitch <reports@xtiitch.com>", server.URL, server.Client())
	err := sender.Send(context.Background(), ports.EmailMessage{
		To:      "owner@example.com",
		Subject: "Xtiitch financial report — 2026-07-19",
		Body:    "Your scheduled report is attached.",
		Attachments: []ports.EmailAttachment{{
			Filename:    "xtiitch-financial-2026-07-19.csv",
			ContentType: "text/csv",
			Content:     content,
		}},
	})
	if err != nil {
		t.Fatalf("send email with attachment: %v", err)
	}

	attachments, ok := payload["attachments"].([]any)
	if !ok || len(attachments) != 1 {
		t.Fatalf("expected one attachment in the payload: %+v", payload)
	}
	attachment, ok := attachments[0].(map[string]any)
	if !ok {
		t.Fatalf("unexpected attachment shape: %+v", attachments[0])
	}
	if attachment["filename"] != "xtiitch-financial-2026-07-19.csv" ||
		attachment["content_type"] != "text/csv" {
		t.Fatalf("unexpected attachment metadata: %+v", attachment)
	}
	encoded, ok := attachment["content"].(string)
	if !ok {
		t.Fatalf("attachment content must be a base64 string: %+v", attachment)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("attachment content is not valid base64: %v", err)
	}
	if string(decoded) != string(content) {
		t.Fatalf("attachment round-trip mismatch: got %q want %q", decoded, content)
	}
}

func TestResendSenderRejectsUnusableAttachment(t *testing.T) {
	t.Parallel()

	sender := newResendSender("secret", "Xtiitch <reports@xtiitch.com>", resendAPIURL, nil)
	err := sender.Send(context.Background(), ports.EmailMessage{
		To:          "owner@example.com",
		Subject:     "Report",
		Body:        "Attached.",
		Attachments: []ports.EmailAttachment{{Filename: "", Content: []byte("x")}},
	})
	if err == nil {
		t.Fatal("an attachment without a filename must be rejected")
	}
}
