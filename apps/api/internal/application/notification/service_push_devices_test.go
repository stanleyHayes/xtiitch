package notifyapp

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type stubPushDevices struct {
	registered    ports.RegisterPushDeviceInput
	registerHit   int
	unregistered  string
	unregisterHit int
}

func (s *stubPushDevices) RegisterPushDevice(
	_ context.Context, _ common.TenantScope, input ports.RegisterPushDeviceInput,
) (ports.PushDeviceRecord, error) {
	s.registered = input
	s.registerHit++
	return ports.PushDeviceRecord{Token: input.Token, Platform: input.Platform, DeviceName: input.DeviceName}, nil
}

func (s *stubPushDevices) UnregisterPushDevice(_ context.Context, _ common.TenantScope, token string) error {
	s.unregistered = token
	s.unregisterHit++
	return nil
}

func (s *stubPushDevices) ListPushDevices(
	_ context.Context, _ common.TenantScope, _ common.ID,
) ([]ports.PushDeviceRecord, error) {
	return nil, nil
}

func pushTestService(devices ports.PushDeviceRepository) Service {
	return NewService(Dependencies{Devices: devices})
}

var (
	pushScope  = common.TenantScope{BusinessID: common.ID("11111111-1111-1111-1111-111111111111")}
	pushUserID = common.ID("22222222-2222-2222-2222-222222222222")
)

// A token that could not have come from Expo must never reach the outbox: the
// message would be queued against an address that cannot exist and then burn
// its retries before dying.
func TestRegisterDeviceRejectsTokensExpoCouldNotHaveIssued(t *testing.T) {
	for _, token := range []string{
		"", "   ", "not-a-token", "ExponentPushToken", "ExponentPushToken[",
		"ExponentPushToken[]", "fcm:abc123", "<script>alert(1)</script>",
	} {
		devices := &stubPushDevices{}
		_, err := pushTestService(devices).RegisterDevice(
			context.Background(), pushScope, pushUserID, token, "ios", "phone")
		if !errors.Is(err, ErrInvalidPushToken) {
			t.Fatalf("token %q must be refused, got %v", token, err)
		}
		if devices.registerHit != 0 {
			t.Fatalf("token %q must not reach the repository", token)
		}
	}
}

func TestRegisterDeviceAcceptsBothExpoTokenSpellings(t *testing.T) {
	for _, token := range []string{
		"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
		"ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
	} {
		devices := &stubPushDevices{}
		if _, err := pushTestService(devices).RegisterDevice(
			context.Background(), pushScope, pushUserID, token, "android", "Pixel"); err != nil {
			t.Fatalf("token %q must be accepted: %v", token, err)
		}
		if devices.registered.Token != token {
			t.Fatalf("expected %q to reach the repository, got %q", token, devices.registered.Token)
		}
	}
}

// The platform column is a CHECK constraint; catching a bad value here is the
// difference between a 400 and a 500.
func TestRegisterDeviceRejectsAPlatformTheSchemaWouldRefuse(t *testing.T) {
	devices := &stubPushDevices{}
	_, err := pushTestService(devices).RegisterDevice(
		context.Background(), pushScope, pushUserID,
		"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "windows-phone", "")
	if !errors.Is(err, ErrInvalidPushPlatform) {
		t.Fatalf("expected ErrInvalidPushPlatform, got %v", err)
	}
	if devices.registerHit != 0 {
		t.Fatal("an invalid platform must not reach the repository")
	}
}

func TestRegisterDeviceNormalisesPlatformAndAllowsItToBeOmitted(t *testing.T) {
	devices := &stubPushDevices{}
	if _, err := pushTestService(devices).RegisterDevice(
		context.Background(), pushScope, pushUserID,
		"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "  IOS  ", "  Ama's iPhone  "); err != nil {
		t.Fatalf("register: %v", err)
	}
	if devices.registered.Platform != "ios" {
		t.Fatalf("platform must be normalised, got %q", devices.registered.Platform)
	}
	if devices.registered.DeviceName != "Ama's iPhone" {
		t.Fatalf("device name must be trimmed, got %q", devices.registered.DeviceName)
	}
	if devices.registered.Now.IsZero() || time.Since(devices.registered.Now) > time.Minute {
		t.Fatalf("registration must be stamped with now, got %v", devices.registered.Now)
	}

	devices = &stubPushDevices{}
	if _, err := pushTestService(devices).RegisterDevice(
		context.Background(), pushScope, pushUserID,
		"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "", ""); err != nil {
		t.Fatalf("an omitted platform must be allowed: %v", err)
	}
}

// The column has no length limit of its own, so the service is what stops a
// client using it as free storage.
func TestRegisterDeviceCapsTheDeviceLabel(t *testing.T) {
	devices := &stubPushDevices{}
	if _, err := pushTestService(devices).RegisterDevice(
		context.Background(), pushScope, pushUserID,
		"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "ios",
		strings.Repeat("é", 500)); err != nil {
		t.Fatalf("register: %v", err)
	}
	if got := len([]rune(devices.registered.DeviceName)); got != maxPushDeviceNameLength {
		t.Fatalf("expected the label capped at %d runes, got %d", maxPushDeviceNameLength, got)
	}
}

// Signing out must never fail — a blocked sign-out is worse than a stale token.
func TestUnregisterDeviceIsForgiving(t *testing.T) {
	devices := &stubPushDevices{}
	service := pushTestService(devices)

	if err := service.UnregisterDevice(context.Background(), pushScope, "   "); err != nil {
		t.Fatalf("a blank token must not error: %v", err)
	}
	if devices.unregisterHit != 0 {
		t.Fatal("a blank token must not reach the repository")
	}

	if err := service.UnregisterDevice(context.Background(), pushScope,
		"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"); err != nil {
		t.Fatalf("unregister: %v", err)
	}
	if devices.unregistered != "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" {
		t.Fatalf("unexpected token forwarded: %q", devices.unregistered)
	}
}

// The repository is optional in the service, so every entry point has to
// tolerate its absence rather than panicking.
func TestPushDeviceMethodsTolerateAMissingRepository(t *testing.T) {
	service := NewService(Dependencies{})
	if _, err := service.RegisterDevice(context.Background(), pushScope, pushUserID,
		"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "ios", ""); !errors.Is(err, ErrInvalidPushToken) {
		t.Fatalf("expected a refusal without a repository, got %v", err)
	}
	if err := service.UnregisterDevice(context.Background(), pushScope, "x"); err != nil {
		t.Fatalf("unregister without a repository must be a no-op, got %v", err)
	}
	if devices, err := service.ListDevices(context.Background(), pushScope, pushUserID); err != nil || devices != nil {
		t.Fatalf("list without a repository must be empty, got %v %v", devices, err)
	}
}
