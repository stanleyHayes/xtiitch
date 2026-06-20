package authadapter

import (
	"context"
	"strings"
	"testing"
)

type recordingSender struct {
	to   string
	body string
	n    int
}

func (r *recordingSender) SendText(_ context.Context, to, body string) error {
	r.to = to
	r.body = body
	r.n++
	return nil
}

func TestWhatsAppOTPDeliverySendsCode(t *testing.T) {
	sender := &recordingSender{}
	delivery := NewWhatsAppOTPDelivery(sender)

	if err := delivery.SendOTP(context.Background(), "233244000111", "123456"); err != nil {
		t.Fatalf("SendOTP: %v", err)
	}
	if sender.n != 1 {
		t.Fatalf("expected one message sent, got %d", sender.n)
	}
	if sender.to != "233244000111" {
		t.Fatalf("expected message to the customer's phone, got %q", sender.to)
	}
	if !strings.Contains(sender.body, "123456") {
		t.Fatalf("expected the code in the message, got %q", sender.body)
	}
}

func TestOTPGeneratorMintsSixDigits(t *testing.T) {
	gen := NewCustomerOTPGenerator()
	code, err := gen.NewCode()
	if err != nil {
		t.Fatalf("NewCode: %v", err)
	}
	if len(code) != 6 {
		t.Fatalf("expected a 6-digit code, got %q", code)
	}
	for _, r := range code {
		if r < '0' || r > '9' {
			t.Fatalf("expected digits only, got %q", code)
		}
	}
	if gen.HashCode("123456") == "123456" {
		t.Fatal("HashCode should not return the raw code")
	}
}
