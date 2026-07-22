package customerauth

import (
	"context"
	"errors"
	"testing"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

type fakePaymentInitiator struct {
	result        paymentsapp.ChargeResult
	err           error
	called        bool
	command       paymentsapp.InitiateChargeCommand
	verifyResult  paymentsapp.VerifyPaymentResult
	verifyErr     error
	verifyCalled  bool
	verifyCommand paymentsapp.VerifyPaymentCommand
}

func (f *fakePaymentInitiator) VerifyPayment(
	_ context.Context,
	command paymentsapp.VerifyPaymentCommand,
) (paymentsapp.VerifyPaymentResult, error) {
	f.verifyCalled = true
	f.verifyCommand = command
	return f.verifyResult, f.verifyErr
}

func (f *fakePaymentInitiator) InitiateCharge(
	_ context.Context,
	command paymentsapp.InitiateChargeCommand,
) (paymentsapp.ChargeResult, error) {
	f.called = true
	f.command = command
	return f.result, f.err
}

func newPaymentLinkService(repo *fakeRepo, payments *fakePaymentInitiator) Service {
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})
	service.payments = payments
	return service
}

// A draft order re-initiates a charge mirroring the original: same outstanding
// amount, same purpose, same store, momo by default — and the response carries
// the fresh authorization URL + reference.
func TestCreateOrderPaymentLinkRechargesDraftOrder(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{paymentContext: ports.CustomerOrderPaymentContext{
		OrderID:          "order-1",
		BusinessID:       "business-1",
		Status:           "draft",
		CustomerEmail:    "ama@example.com",
		OutstandingMinor: 25000,
		Purpose:          "standard_full",
	}}
	payments := &fakePaymentInitiator{result: paymentsapp.ChargeResult{
		AuthorizationURL: "https://pay/x",
		Reference:        "xt_ref-2",
	}}
	service := newPaymentLinkService(repo, payments)

	result, err := service.CreateOrderPaymentLink(context.Background(), "customer-1", "order-1", "https://store.xtiitch.com/orders")
	if err != nil {
		t.Fatalf("payment link: %v", err)
	}
	if result.AuthorizationURL != "https://pay/x" || result.Reference != "xt_ref-2" {
		t.Fatalf("unexpected result: %+v", result)
	}
	command := payments.command
	if !payments.called || command.Scope.BusinessID != "business-1" || command.AmountMinor != 25000 {
		t.Fatalf("unexpected charge command: %+v", command)
	}
	if command.Purpose != money.PaymentPurposeStandardFull || command.Method != money.PaymentMethodMomo {
		t.Fatalf("expected the original purpose mirrored with momo default, got %+v", command)
	}
	if command.CustomerEmail != "ama@example.com" || command.CallbackURL != "https://store.xtiitch.com/orders" {
		t.Fatalf("expected email + cleaned callback threaded, got %+v", command)
	}
}

// A cart basket re-charges as ONE combined cart_full charge with the original
// per-design commission bases, so the group settles exactly like the first
// attempt.
func TestCreateOrderPaymentLinkRechargesCartGroup(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{paymentContext: ports.CustomerOrderPaymentContext{
		OrderID:          "order-1",
		BusinessID:       "business-1",
		Status:           "draft",
		CustomerEmail:    "ama@example.com",
		OutstandingMinor: 60000,
		Purpose:          "cart_full",
		LineAmountsMinor: []int64{25000, 35000},
	}}
	payments := &fakePaymentInitiator{}
	service := newPaymentLinkService(repo, payments)

	if _, err := service.CreateOrderPaymentLink(context.Background(), "customer-1", "order-1", ""); err != nil {
		t.Fatalf("payment link: %v", err)
	}
	if payments.command.Purpose != money.PaymentPurposeCartFull {
		t.Fatalf("expected cart_full, got %q", payments.command.Purpose)
	}
	if len(payments.command.LineAmountsMinor) != 2 || payments.command.AmountMinor != 60000 {
		t.Fatalf("expected the per-design bases and group total, got %+v", payments.command)
	}
}

// A confirmed or cancelled order cannot be paid again — 409 territory, and no
// charge is raised.
func TestCreateOrderPaymentLinkRejectsNonDraftOrder(t *testing.T) {
	t.Parallel()

	for _, status := range []string{"confirmed", "fulfilled", "cancelled"} {
		repo := &fakeRepo{paymentContext: ports.CustomerOrderPaymentContext{
			OrderID: "order-1", BusinessID: "business-1", Status: status, OutstandingMinor: 25000,
		}}
		payments := &fakePaymentInitiator{}
		service := newPaymentLinkService(repo, payments)

		_, err := service.CreateOrderPaymentLink(context.Background(), "customer-1", "order-1", "")
		if !errors.Is(err, ErrOrderNotPayable) {
			t.Fatalf("status %q: expected not payable, got %v", status, err)
		}
		if payments.called {
			t.Fatalf("status %q: no charge may be raised", status)
		}
	}
}

func TestCreateOrderPaymentLinkVerifiesLatestAttemptBeforeRetry(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name       string
		status     string
		wantErr    error
		wantCharge bool
	}{
		{name: "provider still pending", status: "pending", wantErr: ErrOrderPaymentPending},
		{name: "provider succeeded", status: "succeeded", wantErr: ErrOrderNotPayable},
		{name: "provider confirms failure", status: "failed", wantCharge: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeRepo{paymentContext: ports.CustomerOrderPaymentContext{
				OrderID:              "order-1",
				BusinessID:           "business-1",
				Status:               "draft",
				CustomerEmail:        "ama@example.com",
				OutstandingMinor:     25000,
				Purpose:              "standard_full",
				LastPaymentReference: "xt_old",
				LastPaymentStatus:    "initiated",
			}}
			payments := &fakePaymentInitiator{
				verifyResult: paymentsapp.VerifyPaymentResult{Status: tc.status},
				result:       paymentsapp.ChargeResult{AuthorizationURL: "https://pay/new"},
			}
			service := newPaymentLinkService(repo, payments)

			_, err := service.CreateOrderPaymentLink(context.Background(), "customer-1", "order-1", "")
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error = %v, want %v", err, tc.wantErr)
			}
			if !payments.verifyCalled || payments.verifyCommand.ProviderReference != "xt_old" {
				t.Fatalf("latest attempt was not verified: %+v", payments.verifyCommand)
			}
			if payments.called != tc.wantCharge {
				t.Fatalf("charge called = %v, want %v", payments.called, tc.wantCharge)
			}
		})
	}
}

// Another customer's order (or a missing one) is a plain not-found, and a bad
// callback URL is rejected exactly like checkout rejects it.
func TestCreateOrderPaymentLinkGuardsOwnershipAndCallback(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{paymentContextErr: ports.ErrNotFound}
	service := newPaymentLinkService(repo, &fakePaymentInitiator{})
	if _, err := service.CreateOrderPaymentLink(context.Background(), "customer-1", "order-9", ""); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}

	repo = &fakeRepo{paymentContext: ports.CustomerOrderPaymentContext{
		OrderID: "order-1", BusinessID: "business-1", Status: "draft", OutstandingMinor: 25000,
	}}
	payments := &fakePaymentInitiator{}
	service = newPaymentLinkService(repo, payments)
	if _, err := service.CreateOrderPaymentLink(context.Background(), "customer-1", "order-1", "javascript:alert(1)"); err == nil {
		t.Fatal("expected a non-https callback to be rejected")
	}
	if payments.called {
		t.Fatal("a rejected callback must stop before the charge")
	}
}
