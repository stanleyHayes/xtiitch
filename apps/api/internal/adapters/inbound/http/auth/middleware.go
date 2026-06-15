package authhttp

import (
	"context"
	"net/http"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Principal is the authenticated caller, derived server-side from a verified
// access token. Its tenant scope is the token's business, never a client claim.
type Principal struct {
	BusinessID common.ID
	UserID     common.ID
	Role       business.UserRole
}

func (p Principal) TenantScope() common.TenantScope {
	return common.TenantScope{BusinessID: p.BusinessID}
}

type principalContextKey struct{}

func ContextWithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalContextKey{}, principal)
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalContextKey{}).(Principal)
	return principal, ok
}

// Authenticator verifies bearer access tokens and attaches the derived
// principal to the request context. Requests without a valid token are refused.
type Authenticator struct {
	verifier ports.TokenVerifier
}

func NewAuthenticator(verifier ports.TokenVerifier) Authenticator {
	return Authenticator{verifier: verifier}
}

func (a Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "missing_token")
			return
		}

		verified, err := a.verifier.VerifyAccessToken(r.Context(), token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid_token")
			return
		}

		principal := Principal{
			BusinessID: verified.BusinessID,
			UserID:     verified.Subject,
			Role:       verified.Role,
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
