package notifyapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Registering a device is what makes push possible: the mobile app asks the
// operating system for permission, is handed a token by Expo, and gives that
// token to us. Nothing is pushed to a device that has not done this, which is
// what makes push opt-in per person rather than per business.

// ErrInvalidPushToken is returned when the token is not one Expo could have
// issued. Rejecting it here rather than storing it means the outbox is never
// asked to deliver to an address that cannot exist.
var ErrInvalidPushToken = errors.New("push token is not an Expo push token")

// ErrInvalidPushPlatform is returned for a platform the schema will not accept.
// Caught here so a typo is a 400 rather than a constraint violation surfacing
// as a 500.
var ErrInvalidPushPlatform = errors.New("push platform must be ios, android or web")

const (
	// Expo has issued tokens under both spellings; accept either rather than
	// breaking registration if a client is built against an older SDK.
	//
	// These are the fixed PREFIX of a public token format, not a secret — gosec
	// matches on the word "Token" alone.
	expoTokenPrefixCurrent = "ExponentPushToken[" //nolint:gosec // a public format prefix, not a credential
	expoTokenPrefixShort   = "ExpoPushToken["     //nolint:gosec // a public format prefix, not a credential

	// Long enough for "Ama's iPhone 15 Pro Max", short enough that the column
	// cannot be used as free storage.
	maxPushDeviceNameLength = 120
)

// RegisterDevice records the caller's device so it can receive this business's
// notifications. Idempotent by design: the app re-registers on every launch,
// because Expo can hand it a different token at any time and a token it no
// longer holds must not keep receiving orders.
func (s Service) RegisterDevice(
	ctx context.Context,
	scope common.TenantScope,
	userID common.ID,
	token string,
	platform string,
	deviceName string,
) (ports.PushDeviceRecord, error) {
	if s.devices == nil || scope.IsZero() || userID.IsZero() {
		return ports.PushDeviceRecord{}, ErrInvalidPushToken
	}
	token = strings.TrimSpace(token)
	if !validExpoPushToken(token) {
		return ports.PushDeviceRecord{}, ErrInvalidPushToken
	}
	platform = strings.ToLower(strings.TrimSpace(platform))
	if !validPushPlatform(platform) {
		return ports.PushDeviceRecord{}, ErrInvalidPushPlatform
	}

	deviceName = strings.TrimSpace(deviceName)
	if len([]rune(deviceName)) > maxPushDeviceNameLength {
		deviceName = string([]rune(deviceName)[:maxPushDeviceNameLength])
	}

	return s.devices.RegisterPushDevice(ctx, scope, ports.RegisterPushDeviceInput{
		UserID:     userID,
		Token:      token,
		Platform:   platform,
		DeviceName: deviceName,
		Now:        time.Now().UTC(),
	})
}

// UnregisterDevice stops a device receiving anything further — the app calls it
// on sign-out, so a shared phone stops showing one operator's orders to the
// next person who uses it.
func (s Service) UnregisterDevice(ctx context.Context, scope common.TenantScope, token string) error {
	if s.devices == nil || scope.IsZero() {
		return nil
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil
	}
	return s.devices.UnregisterPushDevice(ctx, scope, token)
}

// ListDevices returns the caller's own registered devices.
func (s Service) ListDevices(
	ctx context.Context,
	scope common.TenantScope,
	userID common.ID,
) ([]ports.PushDeviceRecord, error) {
	if s.devices == nil || scope.IsZero() || userID.IsZero() {
		return nil, nil
	}
	return s.devices.ListPushDevices(ctx, scope, userID)
}

// validExpoPushToken checks the shape Expo guarantees — a known prefix and a
// closing bracket — without asserting anything about the opaque middle, which
// is Expo's to change.
func validExpoPushToken(token string) bool {
	if !strings.HasSuffix(token, "]") {
		return false
	}
	for _, prefix := range []string{expoTokenPrefixCurrent, expoTokenPrefixShort} {
		if strings.HasPrefix(token, prefix) && len(token) > len(prefix)+1 {
			return true
		}
	}
	return false
}

// validPushPlatform mirrors the push_device_tokens CHECK constraint. Empty is
// allowed: the platform is a label for the settings list, not something
// delivery depends on.
func validPushPlatform(platform string) bool {
	switch platform {
	case "", "ios", "android", "web":
		return true
	default:
		return false
	}
}
