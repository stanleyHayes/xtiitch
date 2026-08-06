package authapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestSubscriptionCheckoutContinuesWhenAffiliateReservationFails(t *testing.T) {
	t.Parallel()

	businesses := affiliateFailureSubscriptionRepository()
	payments := &fakeSubscriptionPayments{}
	attribution := &fakePlanAffiliateAttribution{reserveErr: errors.New("affiliate database unavailable")}
	service := newSubscriptionTestService(businesses, payments)
	service.planAffiliates = attribution
	service.ids = &sequenceIDs{ids: []common.ID{"reservation-1"}}

	link, err := service.InitializeSubscriptionAuthorization(
		context.Background(),
		InitializeSubscriptionAuthorizationCommand{
			Scope:          common.TenantScope{BusinessID: "business-1"},
			CallbackURL:    "https://example.com/callback",
			BillingCadence: "yearly",
		},
	)
	if err != nil {
		t.Fatalf("affiliate reservation failures must not block checkout: %v", err)
	}
	if link.RedirectURL == "" || payments.initInput.Reference != link.Reference {
		t.Fatalf("expected Paystack checkout to proceed, link=%+v payment=%+v", link, payments.initInput)
	}
}

func TestSubscriptionActivationContinuesWhenAffiliateFinalizationFails(t *testing.T) {
	t.Parallel()

	businesses := affiliateFailureSubscriptionRepository()
	payments := &fakeSubscriptionPayments{}
	attribution := &fakePlanAffiliateAttribution{finalizeErr: errors.New("affiliate database unavailable")}
	service := newSubscriptionTestService(businesses, payments)
	service.planAffiliates = attribution
	service.ids = &sequenceIDs{ids: []common.ID{"reservation-1", "conversion-1"}}

	link, err := service.InitializeSubscriptionAuthorization(
		context.Background(),
		InitializeSubscriptionAuthorizationCommand{
			Scope:          common.TenantScope{BusinessID: "business-1"},
			CallbackURL:    "https://example.com/callback",
			BillingCadence: "yearly",
		},
	)
	if err != nil {
		t.Fatalf("initialize: %v", err)
	}
	result, err := service.VerifySubscriptionAuthorization(
		context.Background(),
		VerifySubscriptionAuthorizationCommand{
			Scope:     common.TenantScope{BusinessID: "business-1"},
			Reference: link.Reference,
		},
	)
	if err != nil {
		t.Fatalf("affiliate finalization failures must not invalidate a paid subscription: %v", err)
	}
	if result.Status != "active" {
		t.Fatalf("expected paid subscription activation to succeed, got %+v", result)
	}
}

func affiliateFailureSubscriptionRepository() *fakeBusinessIdentityRepository {
	return &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:   "sub-1",
			BusinessID:       "business-1",
			OwnerEmail:       "owner@example.com",
			MonthlyFeeMinor:  9900,
			Status:           "trialing",
			BillingCadence:   "yearly",
			YearlyFirstMinor: 89100,
		},
	}
}
