package mediaapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestSignDesignUploadRequiresOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	store := &fakeMediaStore{}
	service := NewService(store)
	scope := common.TenantScope{BusinessID: "business-1"}

	signed, err := service.SignDesignUpload(context.Background(), SignDesignUploadCommand{
		Scope:     scope,
		ActorRole: business.UserRoleAdmin,
	})
	if err != nil {
		t.Fatalf("sign design upload: %v", err)
	}
	if signed.Folder != "xtiitch/designs/business-1" || store.folder != signed.Folder {
		t.Fatalf("expected scoped design folder, got signed=%q store=%q", signed.Folder, store.folder)
	}

	store.called = false
	_, err = service.SignDesignUpload(context.Background(), SignDesignUploadCommand{
		Scope:     scope,
		ActorRole: business.UserRoleStaff,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff upload signing to be forbidden, got %v", err)
	}
	if store.called {
		t.Fatal("expected staff upload signing to stop before provider signing")
	}
}

type fakeMediaStore struct {
	called bool
	folder string
}

func (store *fakeMediaStore) SignUpload(_ context.Context, _ common.TenantScope, folder string) (ports.SignedUpload, error) {
	store.called = true
	store.folder = folder
	return ports.SignedUpload{Signature: "sig", Folder: folder}, nil
}
