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
}
type PushSender interface {
	Send(ctx context.Context, message PushMessage) error
}
type PushMessage struct {
	To    string
	Title string
	Body  string
}
