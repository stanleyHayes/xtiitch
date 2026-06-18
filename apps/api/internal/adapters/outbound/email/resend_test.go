package email

import (
	"context"
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
}
