package cloudinary

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// DevMediaStore is used when no CLOUDINARY_URL is configured. It returns a
// deterministic, non-functional signature so the upload endpoint works in local
// development without a Cloudinary account; it must never be used in production.
type DevMediaStore struct{}

func NewDevMediaStore() DevMediaStore { return DevMediaStore{} }

func (DevMediaStore) SignUpload(_ context.Context, _ common.TenantScope, folder string) (ports.SignedUpload, error) {
	return ports.SignedUpload{
		Signature: "dev-unsigned",
		Timestamp: time.Now().Unix(),
		CloudName: "demo",
		APIKey:    "demo",
		Folder:    folder,
	}, nil
}
