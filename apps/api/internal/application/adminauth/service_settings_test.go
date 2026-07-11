package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestUpdatePlatformSettingsRequiresManageSettings(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	settings, err := service.UpdatePlatformSettings(context.Background(), UpdatePlatformSettingsCommand{
		ActorUserID:                  "owner-1",
		ActorRole:                    admindomain.RoleOwner,
		PlatformName:                 "  Xtiitch Console  ",
		SupportEmail:                 "SUPPORT@xtiitch.com",
		VerificationSLAHours:         36,
		PayoutReviewThresholdPesewas: 750000,
		MaintenanceMode:              true,
	})
	if err != nil {
		t.Fatalf("update platform settings: %v", err)
	}
	if users.updatedPlatformSettings.PlatformName != "Xtiitch Console" ||
		users.updatedPlatformSettings.SupportEmail != "support@xtiitch.com" ||
		users.updatedPlatformSettings.VerificationSLAHours != 36 ||
		users.updatedPlatformSettings.PayoutReviewThresholdPesewas != 750000 ||
		!users.updatedPlatformSettings.MaintenanceMode {
		t.Fatalf("expected normalized platform settings, got %+v", users.updatedPlatformSettings)
	}
	if settings.SupportEmail != "support@xtiitch.com" || !settings.MaintenanceMode {
		t.Fatalf("unexpected platform settings response: %+v", settings)
	}

	_, err = service.UpdatePlatformSettings(context.Background(), UpdatePlatformSettingsCommand{
		ActorUserID:                  "support-1",
		ActorRole:                    admindomain.RoleSupport,
		PlatformName:                 "Xtiitch",
		SupportEmail:                 "support@xtiitch.com",
		VerificationSLAHours:         24,
		PayoutReviewThresholdPesewas: 500000,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateMarketingFlagsPartialUpdateAndPermission(t *testing.T) {
	t.Parallel()

	users := &fakeAdminUsers{}
	service := newTestService(users, &fakeAdminSessions{}, time.Now(), []common.ID{"unused"})

	enabled := true
	settings, err := service.UpdateMarketingFlags(context.Background(), UpdateMarketingFlagsCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
		Pricing:     &enabled,
	})
	if err != nil {
		t.Fatalf("update marketing flags: %v", err)
	}
	// Only Pricing was provided; the other three pointers must stay nil so the repo
	// leaves them unchanged.
	if users.updatedMarketingFlags.Pricing == nil || !*users.updatedMarketingFlags.Pricing {
		t.Fatalf("expected pricing flag set true, got %+v", users.updatedMarketingFlags)
	}
	if users.updatedMarketingFlags.BrowseStore != nil ||
		users.updatedMarketingFlags.Discover != nil ||
		users.updatedMarketingFlags.CreateStore != nil {
		t.Fatalf("expected untouched flags to remain nil, got %+v", users.updatedMarketingFlags)
	}
	if !settings.MarketingFlags.Pricing {
		t.Fatalf("expected response to reflect pricing=true, got %+v", settings.MarketingFlags)
	}

	// Empty body (no flags) is rejected.
	if _, err := service.UpdateMarketingFlags(context.Background(), UpdateMarketingFlagsCommand{
		ActorUserID: "owner-1",
		ActorRole:   admindomain.RoleOwner,
	}); !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for empty update, got %v", err)
	}

	// Support role lacks manage_settings.
	if _, err := service.UpdateMarketingFlags(context.Background(), UpdateMarketingFlagsCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		Pricing:     &enabled,
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}
