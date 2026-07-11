package checkoutapp

import (
	"context"
	"errors"
	"testing"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

func TestPlaceCustomOrderSelfMeasureRaisesDepositAndStoresMeasurements(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1", "meas-1"})

	cmd := customCommand("self_measure")
	cmd.Measurements = map[string]string{"field-1": "40", "field-2": "32"}

	res, err := svc.PlaceCustomOrder(context.Background(), cmd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OrderID != "order-1" || res.AmountMinor != 15000 || res.Reference != "xt_ref" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if orders.customCreated.SizeMode != "self_measure" || orders.customCreated.MeasurementID != "meas-1" {
		t.Fatalf("unexpected custom order input: %+v", orders.customCreated)
	}
	if len(orders.customCreated.Measurements) != 2 {
		t.Fatalf("expected measurements to be passed through, got %+v", orders.customCreated.Measurements)
	}
	if payments.command.Purpose != money.PaymentPurposeDeposit || payments.command.AmountMinor != 15000 {
		t.Fatalf("expected a 15000 deposit charge, got %+v", payments.command)
	}
	if payments.command.OrderID == nil || *payments.command.OrderID != "order-1" {
		t.Fatalf("expected the deposit tied to the order, got %+v", payments.command.OrderID)
	}
}

func TestPlaceCustomOrderHomeVisitRaisesDepositWithoutMeasurements(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref"}}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	res, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.AmountMinor != 15000 || !payments.called {
		t.Fatalf("expected a deposit charge, got %+v / called=%v", res, payments.called)
	}
	if orders.customCreated.SizeMode != "home_visit" || orders.customCreated.MeasurementID != "" || orders.customCreated.Measurements != nil {
		t.Fatalf("home_visit must not capture measurements at checkout: %+v", orders.customCreated)
	}
}

func TestPlaceCustomOrderAppliesPromotionToDeposit(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref"}}
	promotions := &fakePromotions{
		redemption: ports.PromotionRedemption{
			PromotionID:   "promotion-1",
			DiscountMinor: 3000,
			FundingSource: "split",
		},
	}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{store: customStore(), design: customDesign()},
		Businesses: fakeCharge{ctx: verifiedCharge()},
		Orders:     orders,
		Payments:   payments,
		Promotions: promotions,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1", "redemption-1"}},
	})

	cmd := customCommand("home_visit")
	cmd.PromoCode = "DEPOSIT3"
	res, err := svc.PlaceCustomOrder(context.Background(), cmd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.AmountMinor != 12000 || res.DiscountMinor != 3000 {
		t.Fatalf("expected discounted deposit, got %+v", res)
	}
	if promotions.reserve.SubtotalMinor != 15000 || promotions.reserve.Code != "DEPOSIT3" {
		t.Fatalf("unexpected promotion reservation: %+v", promotions.reserve)
	}
	if payments.command.CommissionMinorOverride == nil || *payments.command.CommissionMinorOverride != 360 {
		t.Fatalf("split-funded promo should recompute commission on payable deposit, got %+v", payments.command.CommissionMinorOverride)
	}
}

func TestPlaceCustomOrderComeToShopConfirmsWithoutPayment(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	res, err := svc.PlaceCustomOrder(context.Background(), customCommand("come_to_shop"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payments.called {
		t.Fatal("come_to_shop must raise no payment")
	}
	if res.OrderID != "order-1" || res.AmountMinor != 0 || res.Reference != "" || res.AuthorizationURL != "" {
		t.Fatalf("unexpected come_to_shop result: %+v", res)
	}
	if orders.customConfirmed.OrderID != "order-1" || orders.customConfirmed.SizeMode != "come_to_shop" {
		t.Fatalf("unexpected confirmed order input: %+v", orders.customConfirmed)
	}
}

func TestPlaceCustomOrderDepositPrecedenceUsesDesignOverride(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref"}}
	design := customDesign()
	override := int64(20000)
	design.Design.DepositOverrideMinor = &override
	svc := customService(orders, payments, customStore(), design, verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	res, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.AmountMinor != 20000 || payments.command.AmountMinor != 20000 {
		t.Fatalf("design override must win over store default, got %d", res.AmountMinor)
	}
}

func TestPlaceCustomOrderDiscardsDraftWhenDepositChargeFails(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{err: errors.New("provider down")}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1"})

	if _, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit")); err == nil {
		t.Fatal("expected the charge failure to propagate")
	}
	if !orders.customDiscardCalled || orders.customDiscardOrder != "order-1" {
		t.Fatalf("expected the custom draft to be discarded, got called=%v order=%q", orders.customDiscardCalled, orders.customDiscardOrder)
	}
}

func TestPlaceCustomOrderMapsUnknownMeasurementField(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{createCustomErr: ports.ErrUnknownMeasurementField}
	payments := &fakePayments{}
	svc := customService(orders, payments, customStore(), customDesign(), verifiedCharge(),
		[]common.ID{"order-1", "customer-1", "meas-1"})

	cmd := customCommand("self_measure")
	cmd.Measurements = map[string]string{"not-a-field": "40"}

	if _, err := svc.PlaceCustomOrder(context.Background(), cmd); !errors.Is(err, ErrInvalidMeasurements) {
		t.Fatalf("expected invalid measurements, got %v", err)
	}
	if payments.called {
		t.Fatal("a rejected measurement must stop before any charge")
	}
}

func TestPlaceCustomOrderRejectsInvalidRoutesAndGates(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		mode     string
		store    ports.Storefront
		measures map[string]string
		want     error
	}{
		{"band is not a custom route", "band", customStore(), nil, ErrInvalidSizeMode},
		{"unknown mode", "nonsense", customStore(), nil, ErrInvalidSizeMode},
		{"online ordering off", "home_visit", ports.Storefront{BusinessID: testBusinessID, Settings: ports.StoreSettings{BespokeEnabled: true, MeasurementsEnabled: true}}, nil, ErrOnlineOrderingOff},
		{"bespoke disabled", "home_visit", ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true, Settings: ports.StoreSettings{BespokeEnabled: false}}, nil, ErrBespokeDisabled},
		{"measurements disabled", "self_measure", ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true, Settings: ports.StoreSettings{BespokeEnabled: true, MeasurementsEnabled: false}}, map[string]string{"f": "1"}, ErrMeasurementsDisabled},
		{"self_measure without measurements", "self_measure", customStore(), nil, ErrInvalidMeasurements},
		{"self_measure with a blank value", "self_measure", customStore(), map[string]string{"field-1": "   "}, ErrInvalidMeasurements},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			orders := &fakeOrders{}
			payments := &fakePayments{}
			svc := customService(orders, payments, tc.store, customDesign(), verifiedCharge(),
				[]common.ID{"order-1", "customer-1", "meas-1"})
			cmd := customCommand(tc.mode)
			cmd.Measurements = tc.measures
			if _, err := svc.PlaceCustomOrder(context.Background(), cmd); !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
			if payments.called || orders.customCreated.OrderID != "" || orders.customConfirmed.OrderID != "" {
				t.Fatal("a rejected custom order must create nothing and charge nothing")
			}
		})
	}
}

func TestPlaceCustomOrderRejectsUnverifiedForDepositRoute(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := customService(orders, payments, customStore(), customDesign(),
		ports.BusinessChargeContext{BusinessID: testBusinessID, Verified: false},
		[]common.ID{"order-1", "customer-1"})

	if _, err := svc.PlaceCustomOrder(context.Background(), customCommand("home_visit")); !errors.Is(err, ErrNotVerified) {
		t.Fatalf("expected unverified rejection, got %v", err)
	}
	if orders.customCreated.OrderID != "" || payments.called {
		t.Fatal("unverified deposit route must create nothing and charge nothing")
	}
}
