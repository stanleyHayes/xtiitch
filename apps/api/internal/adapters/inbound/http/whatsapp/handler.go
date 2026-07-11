// Package whatsapphttp is the inbound WhatsApp Cloud API webhook: Meta's GET
// subscription challenge and the POST message feed (signature-verified, deduped,
// dispatched to the conversation engine).
package whatsapphttp

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	whatsappbot "github.com/xcreativs/xtiitch/apps/api/internal/application/whatsappbot"
)

// maxWebhookBody caps the inbound payload we read for signature verification.
const maxWebhookBody = 1 << 20

type Service interface {
	HandleInbound(ctx context.Context, msg whatsappbot.InboundMessage) error
}

type Handler struct {
	service     Service
	verifyToken string
	appSecret   string
	logger      *slog.Logger
}

func NewHandler(service Service, verifyToken, appSecret string, logger *slog.Logger) Handler {
	return Handler{service: service, verifyToken: verifyToken, appSecret: appSecret, logger: logger}
}

func (handler Handler) Register(router chi.Router) {
	router.Get("/webhooks/whatsapp", handler.verify)
	router.Post("/webhooks/whatsapp", handler.receive)
}

// verify answers Meta's subscription handshake: echo hub.challenge when the mode
// and verify token match the configured token.
func (handler Handler) verify(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	mode := query.Get("hub.mode")
	token := query.Get("hub.verify_token")
	challenge := query.Get("hub.challenge")

	if handler.verifyToken == "" || mode != "subscribe" || token != handler.verifyToken {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	//nolint:gosec // webhook verification echo: Meta sends a random challenge that must be echoed verbatim
	_, _ = w.Write([]byte(challenge))
}

// receive verifies the payload signature, dispatches each message to the engine,
// and always acks 200 quickly (dedupe makes retries safe; a slow/erroring reply
// shouldn't make Meta hammer us).
func (handler Handler) receive(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxWebhookBody))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	if !handler.signatureValid(r, body) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	var payload metaWebhook
	if err := json.Unmarshal(body, &payload); err != nil {
		// Malformed body: ack so Meta doesn't retry a payload we can't parse.
		w.WriteHeader(http.StatusOK)
		return
	}

	for _, msg := range payload.messages() {
		if err := handler.service.HandleInbound(r.Context(), msg); err != nil {
			handler.logger.Error("whatsapp inbound handling failed", "wa_id", msg.WaID, "error", err)
		}
	}
	w.WriteHeader(http.StatusOK)
}

// signatureValid checks Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw body
// with the app secret). When no app secret is configured (dev), it accepts —
// production config validation requires the secret before going live.
func (handler Handler) signatureValid(r *http.Request, body []byte) bool {
	if handler.appSecret == "" {
		return true
	}
	header := r.Header.Get("X-Hub-Signature-256")
	const prefix = "sha256="
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	want := strings.TrimPrefix(header, prefix)

	mac := hmac.New(sha256.New, []byte(handler.appSecret))
	mac.Write(body)
	got := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(got), []byte(want))
}

// metaWebhook is the subset of the WhatsApp Cloud webhook envelope we consume.
type metaWebhook struct {
	Entry []struct {
		Changes []struct {
			Value struct {
				Contacts []struct {
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
					WaID string `json:"wa_id"`
				} `json:"contacts"`
				Messages []struct {
					From string `json:"from"`
					ID   string `json:"id"`
					Type string `json:"type"`
					Text struct {
						Body string `json:"body"`
					} `json:"text"`
					Interactive struct {
						Type        string `json:"type"`
						ButtonReply struct {
							ID    string `json:"id"`
							Title string `json:"title"`
						} `json:"button_reply"`
						ListReply struct {
							ID    string `json:"id"`
							Title string `json:"title"`
						} `json:"list_reply"`
					} `json:"interactive"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

// messages flattens the nested envelope into normalized InboundMessages,
// resolving the sender's profile name and lifting interactive replies to text.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (w metaWebhook) messages() []whatsappbot.InboundMessage {
	var out []whatsappbot.InboundMessage
	for _, entry := range w.Entry {
		for _, change := range entry.Changes {
			names := map[string]string{}
			for _, contact := range change.Value.Contacts {
				names[contact.WaID] = contact.Profile.Name
			}
			for _, m := range change.Value.Messages {
				text := m.Text.Body
				if m.Type == "interactive" {
					if m.Interactive.ButtonReply.ID != "" {
						text = m.Interactive.ButtonReply.Title
					} else if m.Interactive.ListReply.ID != "" {
						text = m.Interactive.ListReply.Title
					}
				}
				out = append(out, whatsappbot.InboundMessage{
					WaID:        m.From,
					MessageID:   m.ID,
					Type:        m.Type,
					Text:        text,
					ContactName: names[m.From],
				})
			}
		}
	}
	return out
}
