package mediahttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	mediaapp "github.com/xcreativs/xtiitch/apps/api/internal/application/media"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

func TestSignDesignUploadPassesPrincipalRole(t *testing.T) {
	t.Parallel()

	service := &fakeMediaService{signed: ports.SignedUpload{Signature: "sig", Folder: "xtiitch/designs/business-1"}}
	router := newMediaRouter(service, fakeVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "owner-1",
		BusinessID: "business-1",
		Role:       business.UserRoleOwner,
	}})
	request := httptest.NewRequest(http.MethodPost, "/media/design-upload-signature", nil)
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, response.Code, response.Body.String())
	}
	if service.command.Scope.BusinessID != "business-1" || service.command.ActorRole != business.UserRoleOwner {
		t.Fatalf("unexpected media command: %+v", service.command)
	}
}

func TestSignDesignUploadMapsForbidden(t *testing.T) {
	t.Parallel()

	service := &fakeMediaService{err: authdomain.ErrForbidden}
	router := newMediaRouter(service, fakeVerifier{verified: ports.VerifiedAccessToken{
		Subject:    "staff-1",
		BusinessID: "business-1",
		Role:       business.UserRoleStaff,
	}})
	request := httptest.NewRequest(http.MethodPost, "/media/design-upload-signature", nil)
	request.Header.Set("Authorization", "Bearer access-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusForbidden, response.Code, response.Body.String())
	}
}

func newMediaRouter(service *fakeMediaService, verifier ports.TokenVerifier) http.Handler {
	router := chi.NewRouter()
	NewHandler(service, authhttp.NewAuthenticator(verifier)).Register(router)
	return router
}

type fakeMediaService struct {
	command mediaapp.SignDesignUploadCommand
	signed  ports.SignedUpload
	err     error
}

func (service *fakeMediaService) SignDesignUpload(_ context.Context, command mediaapp.SignDesignUploadCommand) (ports.SignedUpload, error) {
	service.command = command
	if service.err != nil {
		return ports.SignedUpload{}, service.err
	}
	return service.signed, nil
}

type fakeVerifier struct {
	verified ports.VerifiedAccessToken
	err      error
}

func (verifier fakeVerifier) VerifyAccessToken(_ context.Context, _ string) (ports.VerifiedAccessToken, error) {
	if verifier.err != nil {
		return ports.VerifiedAccessToken{}, verifier.err
	}
	return verifier.verified, nil
}
