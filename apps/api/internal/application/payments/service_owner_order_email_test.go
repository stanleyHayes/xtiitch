package paymentsapp

import (
	"context"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type recordingEmailer struct{ sent []ports.EmailMessage }

func (r *recordingEmailer) Send(_ context.Context, message ports.EmailMessage) error {
	r.sent = append(r.sent, message)
	return nil
}

type failingEmailer struct{ calls int }

func (f *failingEmailer) Send(_ context.Context, _ ports.EmailMessage) error {
	f.calls++
	return context.DeadlineExceeded
}

func alert() ports.OwnerOrderEmail {
	return ports.OwnerOrderEmail{
		OwnerEmail:   "owner@studio.test",
		OwnerName:    "Ama",
		CustomerName: "Kofi",
		DesignTitle:  "Kente wrap",
		AmountMinor:  25000,
	}
}

func TestOwnerOrderEmailCarriesWhatSheNeedsToAct(t *testing.T) {
	emailer := &recordingEmailer{}
	service := Service{emails: emailer, dashboardURL: "https://business.xtiitch.com"}

	service.sendOwnerOrderEmails(context.Background(), []ports.OwnerOrderEmail{alert()})

	if len(emailer.sent) != 1 {
		t.Fatalf("expected exactly one email, got %d", len(emailer.sent))
	}
	message := emailer.sent[0]
	if message.To != "owner@studio.test" {
		t.Fatalf("addressed to %q", message.To)
	}
	if !strings.Contains(message.Subject, "Kente wrap") {
		t.Fatalf("subject should name the piece so it is recognisable in an inbox: %q", message.Subject)
	}
	for _, want := range []string{"Kente wrap", "Kofi", "GHS 250.00", "/dashboard/orders"} {
		if !strings.Contains(message.Body, want) {
			t.Fatalf("body missing %q:\n%s", want, message.Body)
		}
	}
}

// Minor units are pesewas. Reporting 25000 as "GHS 25000" would tell an owner
// she had made a hundred times the money.
func TestOwnerOrderEmailFormatsMinorUnitsAsCedis(t *testing.T) {
	emailer := &recordingEmailer{}
	service := Service{emails: emailer}
	item := alert()
	item.AmountMinor = 5
	service.sendOwnerOrderEmails(context.Background(), []ports.OwnerOrderEmail{item})
	if !strings.Contains(emailer.sent[0].Body, "GHS 0.05") {
		t.Fatalf("5 pesewas should read as GHS 0.05:\n%s", emailer.sent[0].Body)
	}
}

// This runs after a payment has settled. A mail-provider outage must not turn a
// successful charge into a failed webhook that Paystack then retries.
func TestOwnerOrderEmailFailureNeverPropagates(t *testing.T) {
	emailer := &failingEmailer{}
	service := Service{emails: emailer}
	service.sendOwnerOrderEmails(context.Background(), []ports.OwnerOrderEmail{alert()})
	if emailer.calls != 1 {
		t.Fatalf("expected one attempt, got %d", emailer.calls)
	}
}

func TestOwnerOrderEmailSkipsWhenThereIsNothingToSend(t *testing.T) {
	emailer := &recordingEmailer{}
	service := Service{emails: emailer}

	service.sendOwnerOrderEmails(context.Background(), nil)

	noAddress := alert()
	noAddress.OwnerEmail = "  "
	service.sendOwnerOrderEmails(context.Background(), []ports.OwnerOrderEmail{noAddress})

	if len(emailer.sent) != 0 {
		t.Fatalf("expected no email, got %d", len(emailer.sent))
	}
}

// A nil sender is how this degrades when Resend is not configured: the owner
// still gets the SMS, and nothing panics.
func TestOwnerOrderEmailWithoutASenderIsSafe(t *testing.T) {
	service := Service{}
	service.sendOwnerOrderEmails(context.Background(), []ports.OwnerOrderEmail{alert()})
}

// The link is omitted rather than emailed broken when no dashboard URL is set.
func TestOwnerOrderEmailOmitsLinkWhenNoDashboardConfigured(t *testing.T) {
	emailer := &recordingEmailer{}
	service := Service{emails: emailer}
	service.sendOwnerOrderEmails(context.Background(), []ports.OwnerOrderEmail{alert()})
	if strings.Contains(emailer.sent[0].Body, "Open it here") {
		t.Fatalf("should not offer a link with no origin configured:\n%s", emailer.sent[0].Body)
	}
}
