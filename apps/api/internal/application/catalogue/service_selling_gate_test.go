package catalogueapp

// Sell-side verification gate (verification gates SELLING, never paying): until
// the owner verifies their business (Ghana Card) AND sets up payout details,
// they cannot upload or edit designs. The gate mirrors the exact pair checkout
// enforces (verification_status 'verified' + a provisioned settlement
// subaccount) and is additional to — never a replacement for — the payment
// activation gate.

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func sellingGateCases() []struct {
	name               string
	verificationStatus string
	payoutReady        bool
	blocked            bool
} {
	return []struct {
		name               string
		verificationStatus string
		payoutReady        bool
		blocked            bool
	}{
		{name: "unverified with payouts is blocked", verificationStatus: "unverified", payoutReady: true, blocked: true},
		{name: "pending verification with payouts is blocked", verificationStatus: "pending", payoutReady: true, blocked: true},
		{name: "verified without payouts is blocked", verificationStatus: "verified", payoutReady: false, blocked: true},
		{name: "verified with payouts is allowed", verificationStatus: "verified", payoutReady: true, blocked: false},
	}
}

func TestCreateDesignVerificationGate(t *testing.T) {
	t.Parallel()
	for _, tc := range sellingGateCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeCatalogueRepo{}
			service := newServiceWithSettings(repo, &fakeStoreSettingsRepo{
				profile: sellingReadyProfileWith(tc.verificationStatus, tc.payoutReady),
			})

			_, err := service.CreateDesign(context.Background(), DesignCommand{
				Scope:     common.TenantScope{BusinessID: "business-1"},
				ActorRole: business.UserRoleOwner,
				Title:     "Kente Wrap Dress",
			})

			if tc.blocked {
				if !errors.Is(err, ErrVerificationRequired) {
					t.Fatalf("expected verification required, got %v", err)
				}
				if repo.created {
					t.Fatal("must not create a design before verification + payout setup")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !repo.created {
				t.Fatal("expected the design to be created for a verified, payout-ready store")
			}
		})
	}
}

func TestUpdateDesignVerificationGate(t *testing.T) {
	t.Parallel()
	for _, tc := range sellingGateCases() {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeCatalogueRepo{}
			service := newServiceWithSettings(repo, &fakeStoreSettingsRepo{
				profile: sellingReadyProfileWith(tc.verificationStatus, tc.payoutReady),
			})

			err := service.UpdateDesign(context.Background(), DesignCommand{
				Scope:     common.TenantScope{BusinessID: "business-1"},
				ActorRole: business.UserRoleOwner,
				DesignID:  "design-1",
				Title:     "Kente Wrap Dress",
			})

			if tc.blocked {
				if !errors.Is(err, ErrVerificationRequired) {
					t.Fatalf("expected verification required, got %v", err)
				}
				if repo.design.Title != "" {
					t.Fatal("must not update a design before verification + payout setup")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if repo.design.Title != "Kente Wrap Dress" {
				t.Fatalf("expected the design update to go through, got %+v", repo.design)
			}
		})
	}
}

// The activation gate still runs FIRST: an unactivated paid plan hits
// ErrActivationRequired, never ErrVerificationRequired (payment-gating of
// writes is separate and stays).
func TestCreateDesignActivationGatePrecedesVerificationGate(t *testing.T) {
	t.Parallel()

	repo := &fakeCatalogueRepo{}
	profile := sellingReadyProfile()
	profile.ActivationRequired = true
	service := newServiceWithSettings(repo, &fakeStoreSettingsRepo{profile: profile})

	_, err := service.CreateDesign(context.Background(), DesignCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		Title:     "Kente Wrap Dress",
	})
	if !errors.Is(err, ErrActivationRequired) {
		t.Fatalf("expected activation required, got %v", err)
	}
}

func sellingReadyProfileWith(verificationStatus string, payoutReady bool) ports.StoreProfile {
	profile := sellingReadyProfile()
	profile.VerificationStatus = verificationStatus
	profile.PayoutReady = payoutReady
	return profile
}
