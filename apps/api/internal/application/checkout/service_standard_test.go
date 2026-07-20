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
)

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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
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

// §5.3.4 regression: a phone the repository refuses to canonicalize must fail
// the checkout as ErrInvalidInput (400 invalid_order) — before any draft order
// or charge — instead of silently minting a second, anonymous identity for the
// same person.
func TestPlaceStandardOrderRejectsUncanonicalizablePhone(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{resolveErr: common.ErrInvalidPhone}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := newTestService(orders, payments)

	cmd := placeCommand()
	cmd.CustomerPhone = "not-a-phone"
	if _, err := svc.PlaceStandardOrder(context.Background(), cmd); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for an unusable phone, got %v", err)
	}
	if orders.created.OrderID != "" || payments.called {
		t.Fatal("expected the invalid phone to stop checkout before draft order or charge")
	}
}

// A TRANSIENT resolve failure (not an invalid phone) keeps the historical
// best-effort behaviour: checkout proceeds with a fresh anonymous identity
// rather than failing an otherwise good order.
func TestPlaceStandardOrderFallsBackWhenResolveFailsTransiently(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{resolveErr: errors.New("connection reset")}
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
		IDs:      &seqIDs{ids: []common.ID{"order-1", "customer-1", "customer-fallback"}},
	})

	res, err := svc.PlaceStandardOrder(context.Background(), placeCommand())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OrderID != "order-1" || orders.created.CustomerID != "customer-fallback" {
		t.Fatalf("expected the fallback identity on the draft, got res=%+v created=%+v", res, orders.created)
	}
}
