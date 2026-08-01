package paymentsapp

import (
	"context"
	"fmt"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// Tells the store owner by email that an order landed.
//
// She already gets an SMS, enqueued into the outbox during settlement. Email is
// the second channel because the SMS only reaches owners with a phone on file,
// and a phone alert is easy to miss while working. Email cannot ride the outbox:
// the worker claims rows without filtering on channel, so an 'email' row would
// be picked up by a process with no email transport and retried until its
// attempts ran out.
//
// Idempotency is settled before this runs — the settlement transaction claimed
// each alert by stamping owner_email_sent_at — so a redelivered webhook arrives
// here with nothing to send.
func (s Service) sendOwnerOrderEmails(ctx context.Context, alerts []ports.OwnerOrderEmail) {
	if s.emails == nil || len(alerts) == 0 {
		return
	}
	for _, alert := range alerts {
		if strings.TrimSpace(alert.OwnerEmail) == "" {
			continue
		}
		// Failures are swallowed on purpose. This runs after a payment has
		// settled; a Resend outage must not turn a successful charge into a
		// failed webhook that Paystack then retries.
		_ = s.emails.Send(ctx, ports.EmailMessage{
			To:      alert.OwnerEmail,
			Subject: ownerOrderSubject(alert),
			Body:    s.ownerOrderBody(alert),
			ReplyTo: notification.ReplyToOperational,
		})
	}
}

func ownerOrderSubject(alert ports.OwnerOrderEmail) string {
	if alert.DesignTitle != "" {
		return "New order: " + alert.DesignTitle
	}
	return "You have a new order on Xtiitch"
}

func (s Service) ownerOrderBody(alert ports.OwnerOrderEmail) string {
	var body strings.Builder
	greeting := "Hi"
	if alert.OwnerName != "" {
		greeting += " " + alert.OwnerName
	}
	body.WriteString(greeting + ",\n\nAn order has just been paid for on your Xtiitch store.\n\n")

	if alert.DesignTitle != "" {
		body.WriteString("Piece: " + alert.DesignTitle + "\n")
	}
	if alert.CustomerName != "" {
		body.WriteString("Customer: " + alert.CustomerName + "\n")
	}
	if alert.AmountMinor > 0 {
		// Minor units are pesewas; the owner thinks in cedis.
		fmt.Fprintf(&body, "Amount: GHS %.2f\n", float64(alert.AmountMinor)/100)
	}

	if s.dashboardURL != "" {
		body.WriteString("\nOpen it here:\n" + s.dashboardURL + "/dashboard/orders\n")
	}
	body.WriteString(
		"\nThe customer is waiting on you to confirm and start the work. " +
			"You also received this as a text message.\n",
	)
	return body.String()
}
