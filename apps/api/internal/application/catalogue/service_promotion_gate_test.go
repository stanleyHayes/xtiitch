package catalogueapp

// §13.4: "Free-plan stores cannot run promotions. That feature is not activated
// for them — it is for paid users only." The promotion write-paths are gated on
// the plan's promotions entitlement; listing and archiving deliberately are not
// (a downgraded store must still see and switch off what it ran).

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func promotionTestCommand() BusinessPromotionCommand {
	maxDiscount := int64(10000)
	return BusinessPromotionCommand{
		Scope:            common.TenantScope{BusinessID: "business-1"},
		ActorRole:        business.UserRoleOwner,
		Code:             "SALE10",
		Title:            "Sale",
		DiscountType:     "percentage",
		DiscountValue:    1000,
		MaxDiscountMinor: &maxDiscount,
		ScopeName:        "store",
		Status:           "active",
	}
}

func newPromotionService(repo *fakePromotionRepo, profile ports.StoreProfile) Service {
	return NewService(Dependencies{
		Promotions: repo,
		Settings:   &fakeStoreSettingsRepo{profile: profile},
		IDs:        &sequenceIDs{ids: []common.ID{"promotion-1"}},
	})
}

func TestPromotionCreateRejectedWithoutEntitlement(t *testing.T) {
	t.Parallel()

	// A Free-plan store: every entitlement off.
	repo := &fakePromotionRepo{}
	service := newPromotionService(repo, ports.StoreProfile{
		Entitlements: map[string]bool{},
	})

	_, err := service.CreateBusinessPromotion(context.Background(), promotionTestCommand())
	if !errors.Is(err, ErrPromotionsNotEntitled) {
		t.Fatalf("expected a Free store to be refused, got %v", err)
	}
	if repo.created {
		t.Fatal("a rejected promotion must never reach the repository")
	}

	// The same gate covers edits of existing promotions.
	update := promotionTestCommand()
	update.PromotionID = "promotion-1"
	_, err = service.UpdateBusinessPromotion(context.Background(), update)
	if !errors.Is(err, ErrPromotionsNotEntitled) {
		t.Fatalf("expected promotion update to be refused, got %v", err)
	}
	if repo.updated {
		t.Fatal("a rejected promotion update must never reach the repository")
	}
}

func TestPromotionCreateAllowedWithEntitlement(t *testing.T) {
	t.Parallel()

	// A paid plan (Starter and up): promotions on.
	repo := &fakePromotionRepo{}
	service := newPromotionService(repo, ports.StoreProfile{
		Entitlements: map[string]bool{business.FeaturePromotions: true},
	})

	record, err := service.CreateBusinessPromotion(context.Background(), promotionTestCommand())
	if err != nil {
		t.Fatalf("expected a Starter store to create a promotion, got %v", err)
	}
	if !repo.created || record.PromotionID != "promotion-1" {
		t.Fatalf("expected the repository write, got record=%+v created=%v", record, repo.created)
	}
}

func TestPromotionCreateRequiresActivation(t *testing.T) {
	t.Parallel()

	// A paid-plan store that has never paid: entitled on paper, gated by §13.2.
	repo := &fakePromotionRepo{}
	service := newPromotionService(repo, ports.StoreProfile{
		Entitlements:       map[string]bool{business.FeaturePromotions: true},
		ActivationRequired: true,
	})

	_, err := service.CreateBusinessPromotion(context.Background(), promotionTestCommand())
	if !errors.Is(err, ErrActivationRequired) {
		t.Fatalf("expected an unactivated paid store to hit the activation gate, got %v", err)
	}
	if repo.created {
		t.Fatal("an unactivated store must never reach the repository")
	}
}

func TestPromotionArchiveNeverEntitlementGated(t *testing.T) {
	t.Parallel()

	// A store that downgraded to Free keeps the ability to switch a promotion off.
	repo := &fakePromotionRepo{}
	service := newPromotionService(repo, ports.StoreProfile{
		Entitlements: map[string]bool{},
	})

	_, err := service.ArchiveBusinessPromotion(context.Background(), BusinessPromotionActionCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		PromotionID: "promotion-1",
	})
	if err != nil {
		t.Fatalf("archiving must stay open after a downgrade, got %v", err)
	}
	if !repo.archived {
		t.Fatal("expected the archive to reach the repository")
	}
}
