package ports

import (
	"context"
)

type EmailSender interface {
	Send(ctx context.Context, message EmailMessage) error
}
type EmailMessage struct {
	To      string
	Subject string
	Body    string
	// ReplyTo is the human inbox a recipient reaches if they hit reply. Money
	// mail (receipts, renewals, payouts) sets billing@; everything else may leave
	// it empty and the sender defaults it to the operational support@ inbox, so
	// every automated message carries a working Reply-To.
	ReplyTo string
	// Attachments carries files sent alongside the plain-text body (§14.1
	// scheduled reports email the generated CSV/PDF/... rather than only a
	// digest). Empty for every other mail.
	Attachments []EmailAttachment
}

// EmailAttachment is one file on an outbound email. Content holds the raw
// bytes; the provider adapter owns the wire encoding (Resend expects base64).
type EmailAttachment struct {
	Filename    string
	ContentType string
	Content     []byte
}
type PushSender interface {
	Send(ctx context.Context, message PushMessage) error
}
type PushMessage struct {
	To    string
	Title string
	Body  string
}
