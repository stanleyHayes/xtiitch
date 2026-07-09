package ports

import "context"

// SMSSender delivers a plain-text SMS to a phone number (Ghana E.164 digits, e.g.
// 233XXXXXXXXX). Implemented by the Arkesel adapter in production and a logging
// stub in dev. Used for auth OTPs and order notifications.
type SMSSender interface {
	SendSMS(ctx context.Context, to string, message string) error
}
