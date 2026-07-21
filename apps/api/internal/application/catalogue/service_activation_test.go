package catalogueapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// activationCases exercise the paid-plan activation gate. A paid plan that has
// not paid (ActivationRequired true — a fresh 'trialing' signup OR a grandfathered
// 'active' account with no billing) is blocked; an activated business (free plan,
// or a paid plan that has paid) proceeds. The zero value is false, so an unset
// profile fails open (allowed).
var activationCases = []struct {
	name               string
	activationRequired bool
	blocked            bool
}{
	{name: "activation required (paid, never paid) is blocked", activationRequired: true, blocked: true},
	{name: "activated (free, or paid+billed) is allowed", activationRequired: false, blocked: false},
}

func TestCreateDesignActivationGate(t *testing.T) {
	t.Parallel()
	for _, tc := range activationCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeCatalogueRepo{}
			profile := sellingReadyProfile()
			profile.ActivationRequired = tc.activationRequired
			service := newServiceWithSettings(repo, &fakeStoreSettingsRepo{
				profile: profile,
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
			profile := sellingReadyProfile()
			profile.ActivationRequired = tc.activationRequired
			service := newServiceWithSettings(repo, &fakeStoreSettingsRepo{
				profile: profile,
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
				profile: ports.StoreProfile{ActivationRequired: tc.activationRequired},
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
