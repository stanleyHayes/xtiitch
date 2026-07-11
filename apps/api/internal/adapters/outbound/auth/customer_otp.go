package authadapter

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"math/big"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// CustomerOTPGenerator mints and hashes 6-digit one-time codes for customer
// phone verification.
type CustomerOTPGenerator struct{}

func NewCustomerOTPGenerator() CustomerOTPGenerator { return CustomerOTPGenerator{} }

func (CustomerOTPGenerator) NewCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func (CustomerOTPGenerator) HashCode(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

// LoggingOTPDelivery logs the code instead of sending it — for local dev and
// tests. Production swaps in a real WhatsApp/SMS delivery.
type LoggingOTPDelivery struct{ logger *slog.Logger }

func NewLoggingOTPDelivery(logger *slog.Logger) LoggingOTPDelivery {
	return LoggingOTPDelivery{logger: logger}
}

func (d LoggingOTPDelivery) SendOTP(_ context.Context, phone string, code string) error {
	if d.logger != nil {
		d.logger.Info("customer OTP (dev delivery)", "phone", phone, "code", code)
	}
	return nil
}

// authTemplateSender is the optional capability to deliver a code via an approved
// WhatsApp AUTHENTICATION template (CloudSender implements it). Free-form text is
// dropped by Meta for business-initiated messages outside the 24h window, so a
// cold OTP only delivers via a template.
type authTemplateSender interface {
	SendAuthTemplate(ctx context.Context, toWaID, templateName, languageCode, code string) error
}

// WhatsAppOTPDelivery sends the one-time code over the WhatsApp Cloud API. Used
// in production when WhatsApp credentials are configured; bootstrap falls back to
// LoggingOTPDelivery otherwise. The phone is already normalised to the WhatsApp
// id form (233XXXXXXXXX) by the customer-auth service. When a template name is
// configured and the sender supports templates, the code is delivered via the
// approved AUTHENTICATION template (required for cold, business-initiated OTPs);
// otherwise it falls back to a free-form text (only delivered inside a 24h session).
type WhatsAppOTPDelivery struct {
	sender       ports.WhatsAppSender
	templateName string
	languageCode string
}

func NewWhatsAppOTPDelivery(sender ports.WhatsAppSender, templateName, languageCode string) WhatsAppOTPDelivery {
	return WhatsAppOTPDelivery{
		sender:       sender,
		templateName: strings.TrimSpace(templateName),
		languageCode: strings.TrimSpace(languageCode),
	}
}

func (d WhatsAppOTPDelivery) SendOTP(ctx context.Context, phone string, code string) error {
	if d.templateName != "" {
		if ts, ok := d.sender.(authTemplateSender); ok {
			return ts.SendAuthTemplate(ctx, phone, d.templateName, d.languageCode, code)
		}
	}
	body := fmt.Sprintf(
		"Your Xtiitch code is %s. It expires in 5 minutes — don't share it with anyone.",
		code,
	)
	return d.sender.SendText(ctx, phone, body)
}

// EmailOTPDelivery emails the one-time code via the configured email sender
// (Resend). When no sender is configured (empty key) it falls back to logging
// the code, so email sign-in is exercisable locally with no provider key —
// exactly like LoggingOTPDelivery does for WhatsApp.
type EmailOTPDelivery struct {
	sender ports.EmailSender
	logger *slog.Logger
}

func NewEmailOTPDelivery(sender ports.EmailSender, logger *slog.Logger) EmailOTPDelivery {
	return EmailOTPDelivery{sender: sender, logger: logger}
}

func (d EmailOTPDelivery) SendEmailOTP(ctx context.Context, email string, code string) error {
	if d.sender == nil {
		// Dev fallback: no email provider configured. Log the code so a local
		// tester can read it from the API output.
		if d.logger != nil {
			d.logger.Info("customer email OTP (dev)", "email", email, "code", code)
		}
		return nil
	}
	body := fmt.Sprintf(
		"Your Xtiitch sign-in code is:\n\n    %s\n\n"+
			"It expires in 5 minutes. If you didn't request this, you can ignore this email.\n\n"+
			"Thanks,\nXtiitch",
		code,
	)
	return d.sender.Send(ctx, ports.EmailMessage{
		To:      email,
		Subject: "Your Xtiitch sign-in code",
		Body:    body,
	})
}
