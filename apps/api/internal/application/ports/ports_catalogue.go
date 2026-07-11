package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// MediaStore signs a direct, browser-to-provider image upload. The client
// uploads the file straight to the provider with the returned signature, then
// stores only the resulting URL on a design — image bytes never pass through
// Xtiitch.
type MediaStore interface {
	SignUpload(ctx context.Context, scope common.TenantScope, folder string) (SignedUpload, error)
}
type SignedUpload struct {
	Signature string
	Timestamp int64
	CloudName string
	APIKey    string
	Folder    string
}
