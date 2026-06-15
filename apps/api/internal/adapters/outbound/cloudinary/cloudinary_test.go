package cloudinary

import (
	"context"
	"crypto/sha1" //nolint:gosec // matches the production signature algorithm
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestSignParamsMatchesCloudinaryAlgorithm(t *testing.T) {
	t.Parallel()

	params := map[string]string{"timestamp": "1700000000", "folder": "xtiitch/designs/b1"}
	secret := "the-secret"

	// Cloudinary: parameters sorted by key, joined as key=value with &, then the
	// secret appended, then SHA-1 hex. "folder" sorts before "timestamp".
	expectedRaw := "folder=xtiitch/designs/b1&timestamp=1700000000" + secret
	sum := sha1.Sum([]byte(expectedRaw)) //nolint:gosec // test parity
	expected := hex.EncodeToString(sum[:])

	if got := signParams(params, secret); got != expected {
		t.Fatalf("signParams = %q, want %q", got, expected)
	}
}

func TestSignUploadReturnsScopedPayload(t *testing.T) {
	t.Parallel()

	fixed := time.Date(2026, 6, 15, 9, 0, 0, 0, time.UTC)
	client := Client{cloudName: "demo-cloud", apiKey: "key123", apiSecret: "sec", now: func() time.Time { return fixed }}

	signed, err := client.SignUpload(context.Background(), common.TenantScope{BusinessID: "b1"}, "xtiitch/designs/b1")
	if err != nil {
		t.Fatalf("sign upload: %v", err)
	}
	if signed.CloudName != "demo-cloud" || signed.APIKey != "key123" {
		t.Fatalf("unexpected provider identity: %+v", signed)
	}
	if signed.Timestamp != fixed.Unix() || signed.Folder != "xtiitch/designs/b1" {
		t.Fatalf("unexpected payload: %+v", signed)
	}
	if signed.Signature == "" {
		t.Fatal("expected a signature")
	}
}

func TestNewClientFromURL(t *testing.T) {
	t.Parallel()

	client, err := NewClientFromURL("cloudinary://key123:sec456@demo-cloud")
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	if client.cloudName != "demo-cloud" || client.apiKey != "key123" || client.apiSecret != "sec456" {
		t.Fatalf("unexpected parse: %+v", client)
	}

	if _, err := NewClientFromURL("https://nope"); !errors.Is(err, ErrInvalidCloudinaryURL) {
		t.Fatalf("expected invalid url error, got %v", err)
	}
}
