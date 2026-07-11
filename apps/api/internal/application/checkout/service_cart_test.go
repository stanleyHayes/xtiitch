package checkoutapp

import (
	"context"
	"errors"
	"testing"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
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
	if custom.SizeMode != string(order.SizeModeSelfMeasure) ||
		custom.MeasurementID != "measurement-1" ||
		custom.Measurements["field-1"] != "40" {
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
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
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
