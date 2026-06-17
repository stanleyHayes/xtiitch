package adminauthhttp

import (
	"context"
	"net/http"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Principal struct {
	AdminUserID common.ID
	Role        admindomain.Role
}

type principalContextKey struct{}

func ContextWithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalContextKey{}, principal)
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	return principal, ok
}

type Authenticator struct {
	verifier ports.AdminTokenVerifier
}

func NewAuthenticator(verifier ports.AdminTokenVerifier) Authenticator {
	return Authenticator{verifier: verifier}
}

func (a Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "missing_token")
			return
		}

		verified, err := a.verifier.VerifyAdminAccessToken(r.Context(), token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid_token")
			return
		}

		principal := Principal{
			AdminUserID: verified.Subject,
			Role:        verified.Role,
		}
		next.ServeHTTP(w, r.WithContext(ContextWithPrincipal(r.Context(), principal)))
	})
}

func bearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}

	token := strings.TrimSpace(header[len(prefix):])
	if token == "" {
		return "", false
	}

	return token, true
}
