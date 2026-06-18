package mediaapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
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
func (s Service) SignDesignUpload(ctx context.Context, cmd SignDesignUploadCommand) (ports.SignedUpload, error) {
	if err := authorizeDesignUpload(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.SignedUpload{}, err
	}
	folder := strings.Join([]string{defaultFolderPrefix, cmd.Scope.BusinessID.String()}, "/")
	return s.store.SignUpload(ctx, cmd.Scope, folder)
}

type SignDesignUploadCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
}

func authorizeDesignUpload(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return authdomain.ErrInvalidInput
	}
	if role == business.UserRoleOwner || role == business.UserRoleAdmin {
		return nil
	}
	return authdomain.ErrForbidden
}
