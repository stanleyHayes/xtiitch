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
	// template capture
	tmplName string
	tmplLang string
	tmplCode string
	tmplN    int
}

func (r *recordingSender) SendText(_ context.Context, to, body string) error {
	r.to = to
	r.body = body
	r.n++
	return nil
}

func (r *recordingSender) SendAuthTemplate(_ context.Context, to, name, lang, code string) error {
	r.to = to
	r.tmplName = name
	r.tmplLang = lang
	r.tmplCode = code
	r.tmplN++
	return nil
}

func TestWhatsAppOTPDeliverySendsCode(t *testing.T) {
	sender := &recordingSender{}
	// No template configured → free-form text fallback.
	delivery := NewWhatsAppOTPDelivery(sender, "", "")

	if err := delivery.SendOTP(context.Background(), "233244000111", "123456"); err != nil {
		t.Fatalf("SendOTP: %v", err)
	}
	if sender.n != 1 {
		t.Fatalf("expected one text message sent, got %d", sender.n)
	}
	if sender.tmplN != 0 {
		t.Fatalf("expected no template send without a configured template, got %d", sender.tmplN)
	}
	if sender.to != "233244000111" {
		t.Fatalf("expected message to the customer's phone, got %q", sender.to)
	}
	if !strings.Contains(sender.body, "123456") {
		t.Fatalf("expected the code in the message, got %q", sender.body)
	}
}

func TestWhatsAppOTPDeliveryUsesTemplateWhenConfigured(t *testing.T) {
	sender := &recordingSender{}
	delivery := NewWhatsAppOTPDelivery(sender, "xtiitch_auth_code", "en_US")

	if err := delivery.SendOTP(context.Background(), "233244000111", "654321"); err != nil {
		t.Fatalf("SendOTP: %v", err)
	}
	if sender.tmplN != 1 {
		t.Fatalf("expected one template send, got %d", sender.tmplN)
	}
	if sender.n != 0 {
		t.Fatalf("expected no free-form text when a template is configured, got %d", sender.n)
	}
	if sender.tmplName != "xtiitch_auth_code" || sender.tmplLang != "en_US" {
		t.Fatalf("unexpected template/lang: %q/%q", sender.tmplName, sender.tmplLang)
	}
	if sender.tmplCode != "654321" {
		t.Fatalf("expected the code passed to the template, got %q", sender.tmplCode)
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
