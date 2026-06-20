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

// WhatsAppOTPDelivery sends the one-time code over the WhatsApp Cloud API. Used
// in production when WhatsApp credentials are configured; bootstrap falls back to
// LoggingOTPDelivery otherwise. The phone is already normalised to the WhatsApp
// id form (233XXXXXXXXX) by the customer-auth service.
type WhatsAppOTPDelivery struct {
	sender ports.WhatsAppSender
}

func NewWhatsAppOTPDelivery(sender ports.WhatsAppSender) WhatsAppOTPDelivery {
	return WhatsAppOTPDelivery{sender: sender}
}

func (d WhatsAppOTPDelivery) SendOTP(ctx context.Context, phone string, code string) error {
	body := fmt.Sprintf(
		"Your Xtiitch code is %s. It expires in 5 minutes — don't share it with anyone.",
		code,
	)
	return d.sender.SendText(ctx, phone, body)
}
