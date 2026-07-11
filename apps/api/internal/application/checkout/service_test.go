package checkoutapp

import (
	"context"
	"errors"
	"testing"
	"time"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

const testBusinessID = common.ID("biz-1")

func newTestService(orders ports.OrderRepository, payments Payments) Service {
	return NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:   orders,
		Payments: payments,
		IDs:      &seqIDs{ids: []common.ID{"order-1", "customer-1"}},
	})
}

func placeCommand() PlaceStandardOrderCommand {
	return PlaceStandardOrderCommand{
		StoreHandle: "shop", DesignHandle: "design", SizeBandID: "band-1",
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
	}
}

// A charge that cannot be raised must not leave the just-created draft order
// behind: it is compensated so checkout stays all-or-nothing (finding 4).
func TestPlaceStandardOrderDiscardsDraftWhenChargeFails(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{err: errors.New("provider down")}
	svc := newTestService(orders, payments)

	if _, err := svc.PlaceStandardOrder(context.Background(), placeCommand()); err == nil {
		t.Fatal("expected the charge failure to propagate")
	}
	if !orders.discardCalled {
		t.Fatal("expected the draft order to be discarded after the charge failed")
	}
	if orders.discardOrder != "order-1" || orders.discardCustomer != "customer-1" {
		t.Fatalf("discarded the wrong rows: order=%q customer=%q", orders.discardOrder, orders.discardCustomer)
	}
}

func TestPlaceStandardOrderKeepsOrderWhenChargeSucceeds(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := newTestService(orders, payments)

	res, err := svc.PlaceStandardOrder(context.Background(), placeCommand())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if orders.discardCalled {
		t.Fatal("a successfully charged order must never be discarded")
	}
	if res.OrderID != "order-1" || res.Reference != "xt_ref" || res.AmountMinor != 50000 {
		t.Fatalf("unexpected result: %+v", res)
	}
	if orders.created.OrderID != "order-1" || orders.created.CustomerID != "customer-1" || orders.created.BusinessID != testBusinessID {
		t.Fatalf("unexpected draft order ids: %+v", orders.created)
	}
	if orders.created.CustomerName != "Ama" ||
		orders.created.CustomerEmail != "ama@example.com" ||
		orders.created.CustomerPhone != "+233 24 000 0000" ||
		orders.created.AgreedTotalMinor != 50000 {
		t.Fatalf("unexpected draft order details: %+v", orders.created)
	}
	if payments.command.OrderID == nil || *payments.command.OrderID != "order-1" {
		t.Fatalf("expected charge to be tied to the draft order, got %+v", payments.command.OrderID)
	}
	if payments.command.Purpose != money.PaymentPurposeStandardFull || payments.command.AmountMinor != 50000 {
		t.Fatalf("unexpected charge command: %+v", payments.command)
	}
	if payments.command.Method != money.PaymentMethodMomo {
		t.Fatalf("expected momo to be the default method, got %q", payments.command.Method)
	}
}

// A made-to-wear cart raises ONE combined charge for the group total, anchored
// on the first order with the cart purpose, and records every line as its own
// draft order sharing one checkout group and customer.
func TestPlaceCartOrderChargesGroupTotalAndCreatesEveryLine(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:   orders,
		Payments: payments,
		IDs:      &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-a", "order-b"}},
	})

	res, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1"},
			{DesignHandle: "design", SizeBandID: "band-1"},
		},
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if orders.discardGroupCalled {
		t.Fatal("a successfully charged cart must never be discarded")
	}
	if res.GroupID != "group-1" || res.OrderID != "order-a" || res.AmountMinor != 100000 || res.Reference != "xt_ref" {
		t.Fatalf("unexpected cart result: %+v", res)
	}
	if payments.command.Purpose != money.PaymentPurposeCartFull || payments.command.AmountMinor != 100000 {
		t.Fatalf("expected one combined cart charge for the total, got %+v", payments.command)
	}
	if payments.command.OrderID == nil || *payments.command.OrderID != "order-a" {
		t.Fatalf("expected the charge anchored on the first order, got %+v", payments.command.OrderID)
	}
	if payments.command.Method != money.PaymentMethodMomo {
		t.Fatalf("expected momo default method, got %q", payments.command.Method)
	}
	if len(orders.createdGroup) != 2 {
		t.Fatalf("expected two draft orders in the group, got %d", len(orders.createdGroup))
	}
	wantOrderIDs := map[common.ID]bool{"order-a": true, "order-b": true}
	for _, in := range orders.createdGroup {
		if in.CheckoutGroupID == nil || *in.CheckoutGroupID != "group-1" {
			t.Fatalf("expected every line in group-1, got %+v", in.CheckoutGroupID)
		}
		if in.CustomerID != "customer-1" || in.BusinessID != testBusinessID {
			t.Fatalf("unexpected line owner: %+v", in)
		}
		if in.AgreedTotalMinor != 50000 {
			t.Fatalf("expected each line settled by its own price, got %d", in.AgreedTotalMinor)
		}
		if !wantOrderIDs[in.OrderID] {
			t.Fatalf("unexpected order id in group: %q", in.OrderID)
		}
		delete(wantOrderIDs, in.OrderID)
	}
}

// A bulk cart threads ONE amount per design to the charge (excluding delivery),
// so the platform commission is charged and capped per design and summed, not
// capped once on the whole cart total (Pricing Book §3 / P0.6a).
func TestPlaceCartOrderChargesCommissionPerDesignLine(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				// GHS 2,000/design: on the Free plan (3%) each design's raw fee is
				// 6000, over the GHS 50 (5000) cap, so the per-design cap must bite
				// three separate times rather than once on the 600000 total.
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 200000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1", CommissionBps: 300,
		}},
		Orders:   orders,
		Payments: payments,
		IDs:      &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-a", "order-b", "order-c"}},
	})

	res, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1"},
			{DesignHandle: "design", SizeBandID: "band-1"},
			{DesignHandle: "design", SizeBandID: "band-1"},
		},
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.AmountMinor != 600000 || payments.command.AmountMinor != 600000 {
		t.Fatalf("expected the whole cart total charged, got result=%d charge=%d", res.AmountMinor, payments.command.AmountMinor)
	}
	// One commission line per design; the payments service caps each at GHS 50 and
	// sums them (proved in the payments package). The delivery fee (none here) is
	// never a design line.
	want := []int64{200000, 200000, 200000}
	if len(payments.command.LineAmountsMinor) != len(want) {
		t.Fatalf("expected one commission line per design, got %+v", payments.command.LineAmountsMinor)
	}
	for i, amt := range want {
		if payments.command.LineAmountsMinor[i] != amt {
			t.Fatalf("expected per-design line %d = %d, got %d", i, amt, payments.command.LineAmountsMinor[i])
		}
	}
	if payments.command.CommissionMinorOverride != nil {
		t.Fatalf("a plain cart must not force a commission override, got %v", payments.command.CommissionMinorOverride)
	}
}

func TestPlaceCartOrderCreatesMixedReadyMadeAndBespokeGroup(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	deposit := int64(22000)
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: customStore(),
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID, DepositOverrideMinor: &deposit},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: verifiedCharge()},
		Orders:     orders,
		Payments:   payments,
		IDs:        &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-ready", "order-custom", "measurement-1"}},
	})

	res, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1", Kind: CartLineMadeToWear},
			{
				DesignHandle: "design",
				Kind:         CartLineBespoke,
				SizeMode:     order.SizeModeSelfMeasure,
				Measurements: map[string]string{"field-1": " 40 ", "field-2": "32"},
			},
		},
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.GroupID != "group-1" || res.OrderID != "order-ready" || res.AmountMinor != 72000 {
		t.Fatalf("unexpected mixed cart result: %+v", res)
	}
	if payments.command.Purpose != money.PaymentPurposeCartFull || payments.command.AmountMinor != 72000 {
		t.Fatalf("expected one combined cart payment, got %+v", payments.command)
	}
	if payments.command.OrderID == nil || *payments.command.OrderID != "order-ready" {
		t.Fatalf("expected charge anchored on first cart order, got %+v", payments.command.OrderID)
	}
	if len(orders.createdGroup) != 1 {
		t.Fatalf("expected one ready-made draft, got %d", len(orders.createdGroup))
	}
	standard := orders.createdGroup[0]
	if standard.OrderID != "order-ready" || standard.CheckoutGroupID == nil || *standard.CheckoutGroupID != "group-1" {
		t.Fatalf("ready-made line did not join the cart group: %+v", standard)
	}
	if standard.AgreedTotalMinor != 50000 || standard.CustomerID != "customer-1" {
		t.Fatalf("unexpected ready-made draft: %+v", standard)
	}
	if len(orders.customGroup) != 1 {
		t.Fatalf("expected one bespoke draft, got %d", len(orders.customGroup))
	}
	custom := orders.customGroup[0]
	if custom.OrderID != "order-custom" || custom.CheckoutGroupID == nil || *custom.CheckoutGroupID != "group-1" {
		t.Fatalf("bespoke line did not join the cart group: %+v", custom)
	}
	if custom.AgreedTotalMinor == nil || *custom.AgreedTotalMinor != deposit || custom.CustomerID != "customer-1" {
		t.Fatalf("bespoke draft must carry its deposit as agreed total, got %+v", custom)
	}
	if custom.SizeMode != string(order.SizeModeSelfMeasure) || custom.MeasurementID != "measurement-1" || custom.Measurements["field-1"] != "40" {
		t.Fatalf("bespoke measurements were not recorded cleanly: %+v", custom)
	}
}

func TestPlaceCartOrderChargesBespokeOnlyDepositCart(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{store: customStore(), design: customDesign()},
		Businesses: fakeCharge{ctx: verifiedCharge()},
		Orders:     orders,
		Payments:   payments,
		IDs:        &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-custom", "measurement-1"}},
	})

	res, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{{
			DesignHandle: "design",
			Kind:         CartLineBespoke,
			SizeMode:     order.SizeModeSelfMeasure,
			Measurements: map[string]string{"field-1": "40"},
		}},
		CustomerName: "Ama", CustomerEmail: "ama@example.com",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(orders.createdGroup) != 0 || len(orders.customGroup) != 1 {
		t.Fatalf("expected only a custom draft, standard=%d custom=%d", len(orders.createdGroup), len(orders.customGroup))
	}
	if res.OrderID != "order-custom" || res.AmountMinor != 15000 {
		t.Fatalf("unexpected bespoke cart result: %+v", res)
	}
	if payments.command.Purpose != money.PaymentPurposeCartFull || payments.command.AmountMinor != 15000 {
		t.Fatalf("expected one cart payment for the deposit, got %+v", payments.command)
	}
	if orders.customGroup[0].AgreedTotalMinor == nil || *orders.customGroup[0].AgreedTotalMinor != 15000 {
		t.Fatalf("bespoke cart line must settle against the deposit, got %+v", orders.customGroup[0])
	}
}

func TestPlaceCartOrderRejectsBespokeLineWithoutMeasurements(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{store: customStore(), design: customDesign()},
		Businesses: fakeCharge{ctx: verifiedCharge()},
		Orders:     orders,
		Payments:   payments,
		IDs:        &seqIDs{},
	})

	_, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{{
			DesignHandle: "design",
			Kind:         CartLineBespoke,
			SizeMode:     order.SizeModeSelfMeasure,
		}},
		CustomerName: "Ama", CustomerEmail: "ama@example.com",
	})
	if !errors.Is(err, ErrInvalidMeasurements) {
		t.Fatalf("expected ErrInvalidMeasurements, got %v", err)
	}
	if payments.called || len(orders.createdGroup) != 0 || len(orders.customGroup) != 0 {
		t.Fatal("invalid bespoke cart line must create nothing and charge nothing")
	}
}

// A delivery cart adds the chosen zone's fee to the combined charge and folds it
// into the anchor order's total (so the group confirmation settles it exactly),
// while recording the delivery snapshot on the anchor only.
func TestPlaceCartOrderAddsDeliveryFeeToAnchor(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	zones := &fakeDeliveryZones{zone: ports.DeliveryZone{ID: "zone-1", Name: "Accra Central", FeeMinor: 2500, Active: true}}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{
				BusinessID:            testBusinessID,
				OnlineOrderingEnabled: true,
				Settings:              ports.StoreSettings{DeliveryEnabled: true},
			},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:        orders,
		Payments:      payments,
		DeliveryZones: zones,
		IDs:           &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-a", "order-b"}},
	})

	res, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1"},
			{DesignHandle: "design", SizeBandID: "band-1"},
		},
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
		DeliveryZoneID:  "zone-1",
		DeliveryAddress: "12 Oxford St, Osu",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 50000 + 50000 garment + 2500 delivery.
	if res.AmountMinor != 102500 || payments.command.AmountMinor != 102500 {
		t.Fatalf("expected charge of garment + delivery fee, got result=%d charge=%d", res.AmountMinor, payments.command.AmountMinor)
	}
	// The per-design commission lines are the two garment prices only; the delivery
	// fee is never a design line (Xtiitch's fee is on design sales, not delivery).
	if len(payments.command.LineAmountsMinor) != 2 ||
		payments.command.LineAmountsMinor[0] != 50000 || payments.command.LineAmountsMinor[1] != 50000 {
		t.Fatalf("expected per-design lines [50000 50000] excluding delivery, got %+v", payments.command.LineAmountsMinor)
	}
	if len(orders.createdGroup) != 2 {
		t.Fatalf("expected two orders, got %d", len(orders.createdGroup))
	}
	anchor := orders.createdGroup[0]
	if anchor.AgreedTotalMinor != 52500 || anchor.DeliveryFeeMinor != 2500 || anchor.DeliveryMethod != "delivery" {
		t.Fatalf("anchor must carry the fee folded into its total + the snapshot, got %+v", anchor)
	}
	if anchor.DeliveryAddress != "12 Oxford St, Osu" || anchor.DeliveryZoneID == nil || *anchor.DeliveryZoneID != "zone-1" {
		t.Fatalf("anchor delivery snapshot wrong: %+v", anchor)
	}
	// Siblings carry the delivery method + address (so each piece segments as a
	// delivery when fulfilled) but NOT the fee/zone — the cart pays one fee, on the
	// anchor — and their agreed_total is just their own garment price.
	sibling := orders.createdGroup[1]
	if sibling.AgreedTotalMinor != 50000 || sibling.DeliveryFeeMinor != 0 || sibling.DeliveryZoneID != nil {
		t.Fatalf("sibling must carry no fee/zone and its own garment total, got %+v", sibling)
	}
	if sibling.DeliveryMethod != "delivery" || sibling.DeliveryAddress != "12 Oxford St, Osu" {
		t.Fatalf("sibling must carry the delivery method + address for segmentation, got %+v", sibling)
	}
}

// Delivery is refused when the store has delivery turned off, even if a zone id
// is supplied.
func TestPlaceCartOrderRejectsDeliveryWhenDisabled(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref"}}
	zones := &fakeDeliveryZones{zone: ports.DeliveryZone{ID: "zone-1", FeeMinor: 2500, Active: true}}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{
				BusinessID:            testBusinessID,
				OnlineOrderingEnabled: true,
				Settings:              ports.StoreSettings{DeliveryEnabled: false},
			},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:        orders,
		Payments:      payments,
		DeliveryZones: zones,
		IDs:           &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-a"}},
	})

	_, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle:     "shop",
		Lines:           []CartLineCommand{{DesignHandle: "design", SizeBandID: "band-1"}},
		CustomerName:    "Ama",
		CustomerEmail:   "ama@example.com",
		DeliveryZoneID:  "zone-1",
		DeliveryAddress: "12 Oxford St",
	})
	if !errors.Is(err, ErrDeliveryUnavailable) {
		t.Fatalf("expected ErrDeliveryUnavailable, got %v", err)
	}
	if len(orders.createdGroup) != 0 {
		t.Fatal("no orders should be created when delivery is refused")
	}
}

// A combined charge that cannot be raised must roll the whole group back so the
// cart checkout stays all-or-nothing.
func TestPlaceCartOrderDiscardsGroupWhenChargeFails(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{err: errors.New("provider down")}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:   orders,
		Payments: payments,
		IDs:      &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-a", "order-b"}},
	})

	if _, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1"},
			{DesignHandle: "design", SizeBandID: "band-1"},
		},
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
	}); err == nil {
		t.Fatal("expected the charge failure to propagate")
	}
	if !orders.discardGroupCalled {
		t.Fatal("expected the draft group to be discarded after the charge failed")
	}
	if orders.discardGroupID != "group-1" || orders.discardGroupCustomer != "customer-1" {
		t.Fatalf("discarded the wrong group: group=%q customer=%q", orders.discardGroupID, orders.discardGroupCustomer)
	}
}

func TestPlaceStandardOrderReservesAffiliateAttribution(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	affiliates := &fakeAffiliates{}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:     orders,
		Payments:   payments,
		Affiliates: affiliates,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1", "reservation-1"}},
	})

	cmd := placeCommand()
	cmd.AffiliateCode = " sewingpro "
	cmd.AffiliateClickID = "click-1"
	cmd.AffiliateVisitorID = "visitor-1"
	res, err := svc.PlaceStandardOrder(context.Background(), cmd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OrderID != "order-1" || res.AmountMinor != 50000 {
		t.Fatalf("unexpected result: %+v", res)
	}
	if !affiliates.reserveCalled {
		t.Fatal("expected affiliate attribution to be reserved")
	}
	if affiliates.reserve.ReservationID != "reservation-1" ||
		affiliates.reserve.BusinessID != testBusinessID ||
		affiliates.reserve.OrderID != "order-1" ||
		affiliates.reserve.Code != "SEWINGPRO" ||
		affiliates.reserve.ClickID != "click-1" ||
		affiliates.reserve.VisitorID != "visitor-1" ||
		affiliates.reserve.GrossMinor != 50000 {
		t.Fatalf("unexpected affiliate reservation: %+v", affiliates.reserve)
	}
}

func TestPlaceStandardOrderIgnoresUnavailableAffiliateAttribution(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	affiliates := &fakeAffiliates{err: ports.ErrNotFound}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:     orders,
		Payments:   payments,
		Affiliates: affiliates,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1", "reservation-1"}},
	})

	cmd := placeCommand()
	cmd.AffiliateCode = "missing"
	res, err := svc.PlaceStandardOrder(context.Background(), cmd)
	if err != nil {
		t.Fatalf("affiliate misses must not block checkout: %v", err)
	}
	if res.Reference != "xt_ref" || !payments.called {
		t.Fatalf("expected checkout to continue, result=%+v paymentCalled=%v", res, payments.called)
	}
	if !affiliates.reserveCalled {
		t.Fatal("expected the affiliate repository to be consulted")
	}
}

func TestPlaceStandardOrderReservesReferralAttribution(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	referrals := &fakeReferrals{}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:    orders,
		Payments:  payments,
		Referrals: referrals,
		IDs:       &seqIDs{ids: []common.ID{"order-1", "customer-1", "referral-1"}},
	})

	cmd := placeCommand()
	cmd.ReferralCode = " amafriend "
	res, err := svc.PlaceStandardOrder(context.Background(), cmd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OrderID != "order-1" || res.AmountMinor != 50000 {
		t.Fatalf("unexpected result: %+v", res)
	}
	if !referrals.reserveCalled {
		t.Fatal("expected referral attribution to be reserved")
	}
	if referrals.reserve.ReferralID != "referral-1" ||
		referrals.reserve.BusinessID != testBusinessID ||
		referrals.reserve.OrderID != "order-1" ||
		referrals.reserve.RefereeCustomerID != "customer-1" ||
		referrals.reserve.RefereeEmail != "ama@example.com" ||
		referrals.reserve.RefereePhone != "+233 24 000 0000" ||
		referrals.reserve.Code != "AMAFRIEND" ||
		referrals.reserve.GrossMinor != 50000 {
		t.Fatalf("unexpected referral reservation: %+v", referrals.reserve)
	}
}

func TestPlaceStandardOrderAppliesPromotionAndKeepsBusinessFundedCommission(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	promotions := &fakePromotions{
		redemption: ports.PromotionRedemption{
			PromotionID:   "promotion-1",
			DiscountMinor: 5000,
			FundingSource: "business",
		},
	}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1", CommissionBps: 300,
		}},
		Orders:     orders,
		Payments:   payments,
		Promotions: promotions,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1", "redemption-1"}},
	})

	cmd := placeCommand()
	cmd.PromoCode = " welcome10 "
	res, err := svc.PlaceStandardOrder(context.Background(), cmd)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.AmountMinor != 45000 || res.DiscountMinor != 5000 {
		t.Fatalf("expected discounted charge, got %+v", res)
	}
	if promotions.reserve.Code != "WELCOME10" ||
		promotions.reserve.SubtotalMinor != 50000 ||
		promotions.reserve.OrderID != "order-1" ||
		promotions.reserve.CustomerID != "customer-1" ||
		promotions.reserve.CustomerEmail != "ama@example.com" ||
		promotions.reserve.CustomerPhone != "+233 24 000 0000" {
		t.Fatalf("unexpected promotion reservation: %+v", promotions.reserve)
	}
	if !orders.draftTotalSet || orders.draftTotal != 45000 {
		t.Fatalf("expected draft order total to be lowered, got set=%v total=%d", orders.draftTotalSet, orders.draftTotal)
	}
	if payments.command.AmountMinor != 45000 {
		t.Fatalf("expected discounted payment amount, got %+v", payments.command)
	}
	if payments.command.CommissionMinorOverride == nil || *payments.command.CommissionMinorOverride != 1500 {
		t.Fatalf("business-funded promo should preserve original commission, got %+v", payments.command.CommissionMinorOverride)
	}
}

func TestPlaceStandardOrderVoidsPromotionWhenChargeFails(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{err: errors.New("provider down")}
	promotions := &fakePromotions{
		redemption: ports.PromotionRedemption{
			PromotionID:   "promotion-1",
			DiscountMinor: 5000,
			FundingSource: "split",
		},
	}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1", CommissionBps: 300,
		}},
		Orders:     orders,
		Payments:   payments,
		Promotions: promotions,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1", "redemption-1"}},
	})

	cmd := placeCommand()
	cmd.PromoCode = "PROMO"
	if _, err := svc.PlaceStandardOrder(context.Background(), cmd); err == nil {
		t.Fatal("expected charge failure")
	}
	if !promotions.voidCalled || promotions.voidOrder != "order-1" {
		t.Fatalf("expected pending promotion to be voided, got %+v", promotions)
	}
	if !orders.discardCalled {
		t.Fatal("expected failed charge to discard the draft order")
	}
}

func TestPlaceStandardOrderRejectsPlatformFundedDiscountAboveCommission(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	promotions := &fakePromotions{
		redemption: ports.PromotionRedemption{
			PromotionID:   "promotion-1",
			DiscountMinor: 5000,
			FundingSource: "platform",
		},
	}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1", CommissionBps: 300,
		}},
		Orders:     orders,
		Payments:   payments,
		Promotions: promotions,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1", "redemption-1"}},
	})

	cmd := placeCommand()
	cmd.PromoCode = "BIGPLATFORM"
	if _, err := svc.PlaceStandardOrder(context.Background(), cmd); !errors.Is(err, ErrPromotionUnavailable) {
		t.Fatalf("expected unavailable promotion, got %v", err)
	}
	if payments.called {
		t.Fatal("must not raise a payment for an over-funded platform promotion")
	}
	if !promotions.voidCalled || !orders.discardCalled {
		t.Fatalf("expected reservation void + draft discard, got promo=%+v orders=%+v", promotions, orders)
	}
}

func TestPlaceStandardOrderRejectsInvalidPaymentMethod(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := newTestService(orders, payments)
	cmd := placeCommand()
	cmd.Method = money.PaymentMethod("cash")

	if _, err := svc.PlaceStandardOrder(context.Background(), cmd); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for unsupported method, got %v", err)
	}
	if orders.created.OrderID != "" || payments.called {
		t.Fatal("expected invalid method to stop before draft order or charge")
	}
}

func TestPlaceStandardOrderRejectsUnavailableBand(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := newTestService(orders, payments)
	cmd := placeCommand()
	cmd.SizeBandID = "missing-band"

	if _, err := svc.PlaceStandardOrder(context.Background(), cmd); !errors.Is(err, ErrBandUnavailable) {
		t.Fatalf("expected unavailable band, got %v", err)
	}
	if orders.created.OrderID != "" || payments.called {
		t.Fatal("expected unavailable band to stop before draft order or charge")
	}
}

func TestPlaceStandardOrderRejectsUnverifiedStore(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{BusinessID: testBusinessID, Verified: false}},
		Orders:     orders,
		Payments:   payments,
		IDs:        &seqIDs{ids: []common.ID{"order-1", "customer-1"}},
	})

	if _, err := svc.PlaceStandardOrder(context.Background(), placeCommand()); !errors.Is(err, ErrNotVerified) {
		t.Fatalf("expected unverified store rejection, got %v", err)
	}
	if orders.created.OrderID != "" || payments.called {
		t.Fatal("expected unverified store to stop before draft order or charge")
	}
}

func customStore() ports.Storefront {
	return ports.Storefront{
		BusinessID:            testBusinessID,
		DefaultDepositMinor:   15000,
		OnlineOrderingEnabled: true,
		Settings:              ports.StoreSettings{BespokeEnabled: true, MeasurementsEnabled: true},
	}
}

func customDesign() ports.StorefrontDesign {
	return ports.StorefrontDesign{Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID}}
}

func verifiedCharge() ports.BusinessChargeContext {
	return ports.BusinessChargeContext{BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1", CommissionBps: 300}
}

func customService(orders ports.OrderRepository, payments Payments, store ports.Storefront, design ports.StorefrontDesign, charge ports.BusinessChargeContext, ids []common.ID) Service {
	return NewService(Dependencies{
		Storefront: fakeStorefront{store: store, design: design},
		Businesses: fakeCharge{ctx: charge},
		Orders:     orders,
		Payments:   payments,
		IDs:        &seqIDs{ids: ids},
	})
}

func customCommand(mode string) PlaceCustomOrderCommand {
	return PlaceCustomOrderCommand{
		StoreHandle:   "shop",
		DesignHandle:  "design",
		SizeMode:      mode,
		CustomerName:  "Ama",
		CustomerEmail: "ama@example.com",
	}
}

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

type fakeBookings struct {
	held          ports.HoldSlotInput
	holdErr       error
	discardCalled bool
}

func (f *fakeBookings) HoldSlot(_ context.Context, _ common.TenantScope, input ports.HoldSlotInput) error {
	f.held = input
	return f.holdErr
}

func (f *fakeBookings) DiscardHeldBooking(_ context.Context, _ common.TenantScope, _, _, _ common.ID) error {
	f.discardCalled = true
	return nil
}

func (f *fakeBookings) ListBookings(_ context.Context, _ common.TenantScope) ([]ports.BookingSummary, error) {
	return nil, nil
}

func (f *fakeBookings) CancelBooking(_ context.Context, _ common.TenantScope, _ common.ID) error {
	return nil
}

func (f *fakeBookings) RescheduleBooking(_ context.Context, _ common.TenantScope, _ ports.RescheduleBookingInput) error {
	return nil
}

type fakeAvailability struct {
	slot booking.Slot
	err  error
}

func (f fakeAvailability) ResolveOpenSlot(_ context.Context, _ common.TenantScope, _ time.Time) (booking.Slot, error) {
	return f.slot, f.err
}

func bookingService(orders ports.OrderRepository, bookings ports.BookingRepository, availability Availability, payments Payments, ids []common.ID) Service {
	return NewService(Dependencies{
		Storefront:   fakeStorefront{store: customStore(), design: customDesign()},
		Businesses:   fakeCharge{ctx: verifiedCharge()},
		Orders:       orders,
		Bookings:     bookings,
		Availability: availability,
		Payments:     payments,
		IDs:          &seqIDs{ids: ids},
	})
}

func bookingCommand() PlaceHomeVisitBookingCommand {
	return PlaceHomeVisitBookingCommand{
		StoreHandle:   "shop",
		DesignHandle:  "design",
		CustomerName:  "Ama",
		CustomerEmail: "ama@example.com",
		SlotStart:     time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC),
	}
}

func bookingSlot() booking.Slot {
	return booking.Slot{
		Start: time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC),
		End:   time.Date(2026, 7, 1, 11, 0, 0, 0, time.UTC),
	}
}

func TestPlaceHomeVisitBookingHoldsSlotAndChargesDeposit(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_bk", AuthorizationURL: "https://pay"}}
	svc := bookingService(orders, bookings, fakeAvailability{slot: bookingSlot()}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	res, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OrderID != "order-1" || res.BookingID != "booking-1" || res.AmountMinor != 15000 || res.Reference != "xt_bk" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if orders.customCreated.SizeMode != "home_visit" {
		t.Fatalf("expected a home_visit order, got %+v", orders.customCreated)
	}
	if bookings.held.BookingID != "booking-1" || !bookings.held.SlotStart.Equal(bookingSlot().Start) {
		t.Fatalf("unexpected hold: %+v", bookings.held)
	}
	if payments.command.Purpose != money.PaymentPurposeBookingDeposit || payments.command.AmountMinor != 15000 {
		t.Fatalf("unexpected charge: %+v", payments.command)
	}
	if payments.command.BookingID == nil || *payments.command.BookingID != "booking-1" {
		t.Fatalf("expected the deposit tied to the booking, got %+v", payments.command.BookingID)
	}
}

func TestPlaceHomeVisitBookingDiscardsWhenSlotTaken(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{holdErr: ports.ErrSlotTaken}
	payments := &fakePayments{}
	svc := bookingService(orders, bookings, fakeAvailability{slot: bookingSlot()}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	if _, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand()); !errors.Is(err, ports.ErrSlotTaken) {
		t.Fatalf("expected slot taken, got %v", err)
	}
	if !bookings.discardCalled {
		t.Fatal("expected the draft order to be discarded when the slot was taken")
	}
	if payments.called {
		t.Fatal("no charge should be raised when the slot was taken")
	}
}

func TestPlaceHomeVisitBookingDiscardsOnChargeFailure(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{}
	payments := &fakePayments{err: errors.New("provider down")}
	svc := bookingService(orders, bookings, fakeAvailability{slot: bookingSlot()}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	if _, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand()); err == nil {
		t.Fatal("expected the charge failure to propagate")
	}
	if !bookings.discardCalled {
		t.Fatal("expected the held booking + draft order to be compensated on a charge failure")
	}
}

func TestPlaceHomeVisitBookingPropagatesNoAvailability(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	bookings := &fakeBookings{}
	payments := &fakePayments{}
	svc := bookingService(orders, bookings, fakeAvailability{err: ports.ErrNoAvailability}, payments, []common.ID{"order-1", "customer-1", "booking-1"})

	if _, err := svc.PlaceHomeVisitBooking(context.Background(), bookingCommand()); !errors.Is(err, ports.ErrNoAvailability) {
		t.Fatalf("expected no availability, got %v", err)
	}
	if orders.customCreated.OrderID != "" || bookings.held.BookingID != "" || payments.called {
		t.Fatal("no order, booking, or charge should be created when there is no open slot")
	}
}

type fakeStorefront struct {
	store  ports.Storefront
	design ports.StorefrontDesign
}

func (f fakeStorefront) ResolveStore(context.Context, string) (ports.Storefront, error) {
	return f.store, nil
}

func (f fakeStorefront) ListActiveDesigns(context.Context, common.ID) ([]ports.StorefrontDesign, error) {
	return nil, nil
}

func (f fakeStorefront) GetActiveDesignByHandle(context.Context, string) (ports.StorefrontDesign, error) {
	return f.design, nil
}

func (f fakeStorefront) ListActiveCollections(context.Context, common.ID) ([]catalogue.Collection, error) {
	return nil, nil
}

func (f fakeStorefront) GetActiveCollectionByHandle(context.Context, string) (ports.StorefrontCollection, error) {
	return ports.StorefrontCollection{}, nil
}

func (f fakeStorefront) ListPublicShops(context.Context) ([]ports.PublicShop, error) {
	return nil, nil
}

func (f fakeStorefront) SearchActiveDesigns(context.Context, common.ID, string) ([]ports.StorefrontDesign, error) {
	return nil, nil
}

type fakeCharge struct {
	ctx ports.BusinessChargeContext
}

func (f fakeCharge) GetChargeContext(context.Context, common.TenantScope) (ports.BusinessChargeContext, error) {
	return f.ctx, nil
}

func (f fakeCharge) ProvisionSubaccount(context.Context, common.ID, string, string) error {
	return nil
}

type fakeOrders struct {
	created              ports.CreateOnlineOrderInput
	createdGroup         []ports.CreateOnlineOrderInput
	createGroupErr       error
	discardGroupCalled   bool
	discardGroupID       common.ID
	discardGroupCustomer common.ID
	discardCalled        bool
	discardOrder         common.ID
	discardCustomer      common.ID
	draftTotalSet        bool
	draftTotalOrder      common.ID
	draftTotal           int64
	customCreated        ports.CreateCustomOrderInput
	customGroup          []ports.CreateCustomOrderInput
	createCustomErr      error
	customConfirmed      ports.CreateCustomOrderConfirmedInput
	customDiscardCalled  bool
	customDiscardOrder   common.ID
}

func (f *fakeOrders) CreateWalkInOrder(context.Context, common.TenantScope, ports.CreateWalkInOrderInput) error {
	return nil
}

func (f *fakeOrders) CreateOnlineOrder(_ context.Context, _ common.TenantScope, input ports.CreateOnlineOrderInput) error {
	f.created = input
	return nil
}

// fakeDeliveryZones is a minimal DeliveryZoneRepository for checkout tests: it
// resolves one configured zone by id.
type fakeDeliveryZones struct {
	zone     ports.DeliveryZone
	getErr   error
	getCalls int
}

func (f *fakeDeliveryZones) ListDeliveryZones(_ context.Context, _ common.TenantScope) ([]ports.DeliveryZone, error) {
	return []ports.DeliveryZone{f.zone}, nil
}

func (f *fakeDeliveryZones) ListActiveDeliveryZones(_ context.Context, _ common.TenantScope) ([]ports.DeliveryZone, error) {
	return []ports.DeliveryZone{f.zone}, nil
}

func (f *fakeDeliveryZones) CreateDeliveryZone(_ context.Context, _ common.TenantScope, _ ports.CreateDeliveryZoneInput) error {
	return nil
}

func (f *fakeDeliveryZones) UpdateDeliveryZone(_ context.Context, _ common.TenantScope, _ ports.UpdateDeliveryZoneInput) error {
	return nil
}

func (f *fakeDeliveryZones) DeleteDeliveryZone(_ context.Context, _ common.TenantScope, _ common.ID) error {
	return nil
}

func (f *fakeDeliveryZones) GetDeliveryZone(_ context.Context, _ common.TenantScope, zoneID common.ID) (ports.DeliveryZone, error) {
	f.getCalls++
	if f.getErr != nil {
		return ports.DeliveryZone{}, f.getErr
	}
	if f.zone.ID != zoneID {
		return ports.DeliveryZone{}, ports.ErrNotFound
	}
	return f.zone, nil
}

func (f *fakeOrders) CreateOnlineOrderGroup(_ context.Context, _ common.TenantScope, inputs []ports.CreateOnlineOrderInput) error {
	if f.createGroupErr != nil {
		return f.createGroupErr
	}
	f.createdGroup = inputs
	return nil
}

func (f *fakeOrders) DiscardDraftOrderGroup(_ context.Context, _ common.TenantScope, groupID, customerID common.ID) error {
	f.discardGroupCalled = true
	f.discardGroupID = groupID
	f.discardGroupCustomer = customerID
	return nil
}

func (f *fakeOrders) FindCustomerIDByPhone(_ context.Context, _ string) (common.ID, bool, error) {
	return "", false, nil
}

func (f *fakeOrders) ResolveOrCreateCustomerByPhone(_ context.Context, _ string, newID common.ID) (common.ID, bool, error) {
	return newID, true, nil
}

func (f *fakeOrders) DiscardDraftOrder(_ context.Context, _ common.TenantScope, orderID, customerID common.ID) error {
	f.discardCalled = true
	f.discardOrder = orderID
	f.discardCustomer = customerID
	return nil
}

func (f *fakeOrders) SetDraftOrderAgreedTotal(_ context.Context, _ common.TenantScope, orderID common.ID, agreedTotalMinor int64) error {
	f.draftTotalSet = true
	f.draftTotalOrder = orderID
	f.draftTotal = agreedTotalMinor
	return nil
}

func (f *fakeOrders) CreateCustomOrder(_ context.Context, _ common.TenantScope, input ports.CreateCustomOrderInput) error {
	if f.createCustomErr != nil {
		return f.createCustomErr
	}
	f.customCreated = input
	f.customGroup = append(f.customGroup, input)
	return nil
}

func (f *fakeOrders) CreateCustomOrderConfirmed(_ context.Context, _ common.TenantScope, input ports.CreateCustomOrderConfirmedInput) error {
	f.customConfirmed = input
	return nil
}

func (f *fakeOrders) DiscardCustomDraftOrder(_ context.Context, _ common.TenantScope, orderID, customerID common.ID) error {
	f.customDiscardCalled = true
	f.customDiscardOrder = orderID
	return nil
}

func (f *fakeOrders) ListOrders(context.Context, common.TenantScope) ([]ports.OrderSummary, error) {
	return nil, nil
}

func (f *fakeOrders) ListStageTemplates(context.Context, common.TenantScope) ([]ports.StageTemplate, error) {
	return nil, nil
}

func (f *fakeOrders) AdvanceStage(context.Context, common.TenantScope, common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

func (f *fakeOrders) GetTracking(context.Context, common.ID) (order.Tracking, error) {
	return order.Tracking{}, nil
}

func (f *fakeOrders) SetAgreedTotal(context.Context, common.TenantScope, common.ID, int64) error {
	return nil
}

func (f *fakeOrders) GetOrderBilling(context.Context, common.TenantScope, common.ID) (ports.OrderBilling, error) {
	return ports.OrderBilling{}, nil
}

type fakePayments struct {
	result             paymentsapp.ChargeResult
	err                error
	called             bool
	command            paymentsapp.InitiateChargeCommand
	marketplaceCommand paymentsapp.InitiateMarketplaceChargeCommand
	marketplaceCalled  bool
}

func (f *fakePayments) InitiateCharge(_ context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error) {
	f.called = true
	f.command = command
	return f.result, f.err
}

func (f *fakePayments) InitiateMarketplaceCharge(_ context.Context, command paymentsapp.InitiateMarketplaceChargeCommand) (paymentsapp.ChargeResult, error) {
	f.marketplaceCalled = true
	f.marketplaceCommand = command
	return f.result, f.err
}

type fakePromotions struct {
	redemption ports.PromotionRedemption
	err        error
	reserve    ports.ReservePromotionInput
	voidCalled bool
	voidOrder  common.ID
}

func (f *fakePromotions) ListBusinessPromotions(context.Context, common.TenantScope) ([]ports.BusinessPromotionRecord, error) {
	return nil, nil
}

func (f *fakePromotions) CreateBusinessPromotion(context.Context, common.TenantScope, ports.BusinessPromotionInput) (ports.BusinessPromotionRecord, error) {
	return ports.BusinessPromotionRecord{}, nil
}

func (f *fakePromotions) UpdateBusinessPromotion(context.Context, common.TenantScope, ports.BusinessPromotionInput) (ports.BusinessPromotionRecord, error) {
	return ports.BusinessPromotionRecord{}, nil
}

func (f *fakePromotions) ArchiveBusinessPromotion(context.Context, common.TenantScope, common.ID) (ports.BusinessPromotionRecord, error) {
	return ports.BusinessPromotionRecord{}, nil
}

func (f *fakePromotions) ReservePromotion(_ context.Context, _ common.TenantScope, input ports.ReservePromotionInput) (ports.PromotionRedemption, error) {
	f.reserve = input
	if f.err != nil {
		return ports.PromotionRedemption{}, f.err
	}
	redemption := f.redemption
	redemption.RedemptionID = input.RedemptionID
	redemption.BusinessID = input.BusinessID
	redemption.OrderID = input.OrderID
	redemption.CustomerID = input.CustomerID
	redemption.SubtotalMinor = input.SubtotalMinor
	return redemption, nil
}

func (f *fakePromotions) VoidPendingPromotionRedemptions(_ context.Context, _ common.TenantScope, orderID common.ID) error {
	f.voidCalled = true
	f.voidOrder = orderID
	return nil
}

type fakeAffiliates struct {
	reserveCalled bool
	reserve       ports.ReserveAffiliateAttributionInput
	err           error
}

func (f *fakeAffiliates) RecordAffiliateClick(context.Context, ports.RecordAffiliateClickInput) (ports.AffiliateClickRecord, error) {
	return ports.AffiliateClickRecord{}, nil
}

func (f *fakeAffiliates) ReserveAffiliateAttribution(_ context.Context, _ common.TenantScope, input ports.ReserveAffiliateAttributionInput) (ports.AffiliateAttributionReservation, error) {
	f.reserveCalled = true
	f.reserve = input
	if f.err != nil {
		return ports.AffiliateAttributionReservation{}, f.err
	}
	return ports.AffiliateAttributionReservation{
		ReservationID:   input.ReservationID,
		AffiliateID:     "affiliate-1",
		BusinessID:      input.BusinessID,
		OrderID:         input.OrderID,
		GrossMinor:      input.GrossMinor,
		CommissionMinor: 5000,
	}, nil
}

type fakeReferrals struct {
	reserveCalled bool
	reserve       ports.ReserveReferralAttributionInput
	err           error
}

func (f *fakeReferrals) ResolveReferralCode(context.Context, ports.ResolveReferralCodeInput) (ports.ReferralCodeRecord, error) {
	return ports.ReferralCodeRecord{}, nil
}

func (f *fakeReferrals) ReserveReferralAttribution(_ context.Context, _ common.TenantScope, input ports.ReserveReferralAttributionInput) (ports.ReferralAttributionReservation, error) {
	f.reserveCalled = true
	f.reserve = input
	if f.err != nil {
		return ports.ReferralAttributionReservation{}, f.err
	}
	return ports.ReferralAttributionReservation{
		ReferralID:          input.ReferralID,
		ReferralProgrammeID: "programme-1",
		ReferralCodeID:      "code-1",
		BusinessID:          input.BusinessID,
		OrderID:             input.OrderID,
		RefereeCustomerID:   input.RefereeCustomerID,
		GrossMinor:          input.GrossMinor,
		Status:              "pending",
	}, nil
}

type seqIDs struct {
	ids []common.ID
}

func (s *seqIDs) NewID() common.ID {
	id := s.ids[0]
	s.ids = s.ids[1:]
	return id
}
