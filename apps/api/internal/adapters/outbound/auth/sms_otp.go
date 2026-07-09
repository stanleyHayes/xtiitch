package authadapter

import (
	"context"
	"fmt"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// SMSOTPDelivery sends the one-time code over SMS. It implements
// ports.CustomerOTPDelivery so it can replace WhatsAppOTPDelivery for both
// customer and store-owner auth when OTP_CHANNEL=sms (the platform default). The
// phone is already normalised to E.164 digits by the auth services.
type SMSOTPDelivery struct {
	sender ports.SMSSender
}

func NewSMSOTPDelivery(sender ports.SMSSender) SMSOTPDelivery {
	return SMSOTPDelivery{sender: sender}
}

func (d SMSOTPDelivery) SendOTP(ctx context.Context, phone string, code string) error {
	message := fmt.Sprintf(
		"Your Xtiitch code is %s. It expires in 5 minutes — don't share it with anyone.",
		code,
	)
	return d.sender.SendSMS(ctx, phone, message)
}
