package catalogueapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// activationCases exercise the paid-plan activation gate. A 'trialing' paid plan
// (never paid its first invoice) is blocked; 'active' and an empty/unknown status
// (free plans, no subscription row) are activated and proceed.
var activationCases = []struct {
	name    string
	status  string
	blocked bool
}{
	{name: "trialing is blocked", status: "trialing", blocked: true},
	{name: "active is allowed", status: "active", blocked: false},
	{name: "empty status is allowed (fail-open)", status: "", blocked: false},
}

func TestCreateDesignActivationGate(t *testing.T) {
	t.Parallel()
	for _, tc := range activationCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeCatalogueRepo{}
			service := newServiceWithSettings(repo, &fakeStoreSettingsRepo{
				profile: ports.StoreProfile{SubscriptionStatus: tc.status},
			})

			_, err := service.CreateDesign(context.Background(), DesignCommand{
				Scope:     common.TenantScope{BusinessID: "business-1"},
				ActorRole: business.UserRoleOwner,
				Title:     "Kente Wrap Dress",
			})

			if tc.blocked {
				if !errors.Is(err, ErrActivationRequired) {
					t.Fatalf("expected activation required, got %v", err)
				}
				if repo.created {
					t.Fatal("must not create a design while activation is pending")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !repo.created {
				t.Fatal("expected the design to be created once activated")
			}
		})
	}
}

func TestUpdateDesignActivationGate(t *testing.T) {
	t.Parallel()
	for _, tc := range activationCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeCatalogueRepo{}
			service := newServiceWithSettings(repo, &fakeStoreSettingsRepo{
				profile: ports.StoreProfile{SubscriptionStatus: tc.status},
			})

			err := service.UpdateDesign(context.Background(), DesignCommand{
				Scope:     common.TenantScope{BusinessID: "business-1"},
				ActorRole: business.UserRoleOwner,
				DesignID:  "design-1",
				Title:     "Kente Wrap Dress",
			})

			if tc.blocked {
				if !errors.Is(err, ErrActivationRequired) {
					t.Fatalf("expected activation required, got %v", err)
				}
				if repo.design.Title != "" {
					t.Fatal("must not update a design while activation is pending")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if repo.design.Title != "Kente Wrap Dress" {
				t.Fatalf("expected the design to be updated once activated, got %+v", repo.design)
			}
		})
	}
}

func TestUpdateSettingsActivationGate(t *testing.T) {
	t.Parallel()
	for _, tc := range activationCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeCatalogueRepo{}
			settings := &fakeStoreSettingsRepo{
				profile: ports.StoreProfile{SubscriptionStatus: tc.status},
			}
			service := newServiceWithSettings(repo, settings)

			err := service.UpdateSettings(context.Background(), UpdateSettingsCommand{
				Scope:     common.TenantScope{BusinessID: "business-1"},
				ActorRole: business.UserRoleOwner,
				Settings:  ports.StoreSettings{},
			})

			if tc.blocked {
				if !errors.Is(err, ErrActivationRequired) {
					t.Fatalf("expected activation required, got %v", err)
				}
				if settings.updated != nil {
					t.Fatal("must not persist settings while activation is pending")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if settings.updated == nil {
				t.Fatal("expected settings to be persisted once activated")
			}
		})
	}
}
