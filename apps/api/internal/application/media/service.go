package mediaapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// defaultFolderPrefix namespaces every business's uploads under its own folder
// so media is organised per tenant on the provider side.
const defaultFolderPrefix = "xtiitch/designs"

type Service struct {
	store ports.MediaStore
}

func NewService(store ports.MediaStore) Service {
	return Service{store: store}
}

// SignDesignUpload returns a signed payload for a direct browser upload of a
// design image, scoped to the calling business's folder.
func (s Service) SignDesignUpload(ctx context.Context, scope common.TenantScope) (ports.SignedUpload, error) {
	folder := strings.Join([]string{defaultFolderPrefix, scope.BusinessID.String()}, "/")
	return s.store.SignUpload(ctx, scope, folder)
}
