package authadapter

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestJWTIssuerIssuesSignedAccessTokenWithTenantClaims(t *testing.T) {
	t.Parallel()

	issuer, err := NewJWTIssuer("test-secret", "xtiitch-api", "xtiitch-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}

	issuedAt := time.Date(2026, 6, 14, 20, 0, 0, 0, time.UTC)
	expiresAt := issuedAt.Add(15 * time.Minute)
	tokenString, err := issuer.IssueAccessToken(context.Background(), ports.AccessTokenInput{
		Subject:    common.ID("user-1"),
		BusinessID: common.ID("business-1"),
		Role:       business.UserRoleOwner,
		IssuedAt:   issuedAt,
		ExpiresAt:  expiresAt,
	})
	if err != nil {
		t.Fatalf("issue access token: %v", err)
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			t.Fatalf("unexpected signing method %s", token.Method.Alg())
		}

		return []byte("test-secret"), nil
	},
		jwt.WithAudience("xtiitch-clients"),
		jwt.WithIssuer("xtiitch-api"),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(func() time.Time {
			return issuedAt.Add(time.Minute)
		}),
	)
	if err != nil {
		t.Fatalf("parse signed token: %v", err)
	}
	if !token.Valid {
		t.Fatal("expected valid token")
	}
	if token.Header["kid"] != "default" {
		t.Fatalf("expected key id default, got %v", token.Header["kid"])
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatalf("expected map claims, got %T", token.Claims)
	}
	if claims["sub"] != "user-1" {
		t.Fatalf("unexpected subject claim %v", claims["sub"])
	}
	if claims["business_id"] != "business-1" {
		t.Fatalf("unexpected business claim %v", claims["business_id"])
	}
	if claims["role"] != "owner" {
		t.Fatalf("unexpected role claim %v", claims["role"])
	}
	if claims["typ"] != "access" {
		t.Fatalf("unexpected token type claim %v", claims["typ"])
	}
}

func TestNewJWTIssuerRequiresSigningKey(t *testing.T) {
	t.Parallel()

	_, err := NewJWTIssuer("", "xtiitch-api", "xtiitch-clients")
	if !errors.Is(err, ErrMissingJWTSigningKey) {
		t.Fatalf("expected missing signing key error, got %v", err)
	}
}

func issueTestToken(t *testing.T, issuer JWTIssuer, expiresAt time.Time) string {
	t.Helper()

	token, err := issuer.IssueAccessToken(context.Background(), ports.AccessTokenInput{
		Subject:    common.ID("user-1"),
		BusinessID: common.ID("business-1"),
		Role:       business.UserRoleOwner,
		IssuedAt:   expiresAt.Add(-15 * time.Minute),
		ExpiresAt:  expiresAt,
	})
	if err != nil {
		t.Fatalf("issue access token: %v", err)
	}

	return token
}

func TestVerifyAccessTokenAcceptsValidToken(t *testing.T) {
	t.Parallel()

	issuer, err := NewJWTIssuer("test-secret", "xtiitch-api", "xtiitch-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}

	token := issueTestToken(t, issuer, time.Now().Add(15*time.Minute))

	verified, err := issuer.VerifyAccessToken(context.Background(), token)
	if err != nil {
		t.Fatalf("verify access token: %v", err)
	}
	if verified.Subject != common.ID("user-1") {
		t.Fatalf("unexpected subject %q", verified.Subject)
	}
	if verified.BusinessID != common.ID("business-1") {
		t.Fatalf("unexpected business id %q", verified.BusinessID)
	}
	if verified.Role != business.UserRoleOwner {
		t.Fatalf("unexpected role %q", verified.Role)
	}
}

func TestVerifyAccessTokenRejectsExpiredToken(t *testing.T) {
	t.Parallel()

	issuer, err := NewJWTIssuer("test-secret", "xtiitch-api", "xtiitch-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}

	token := issueTestToken(t, issuer, time.Now().Add(-time.Minute))

	if _, err := issuer.VerifyAccessToken(context.Background(), token); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected invalid token for expired access token, got %v", err)
	}
}

func TestVerifyAccessTokenRejectsWrongSignature(t *testing.T) {
	t.Parallel()

	issuer, err := NewJWTIssuer("test-secret", "xtiitch-api", "xtiitch-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}
	attacker, err := NewJWTIssuer("other-secret", "xtiitch-api", "xtiitch-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}

	token := issueTestToken(t, issuer, time.Now().Add(15*time.Minute))

	if _, err := attacker.VerifyAccessToken(context.Background(), token); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected invalid token for wrong signing key, got %v", err)
	}
}

func TestVerifyAccessTokenRejectsWrongIssuerOrAudience(t *testing.T) {
	t.Parallel()

	issuer, err := NewJWTIssuer("test-secret", "xtiitch-api", "xtiitch-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}
	mismatch, err := NewJWTIssuer("test-secret", "other-api", "other-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}

	token := issueTestToken(t, issuer, time.Now().Add(15*time.Minute))

	if _, err := mismatch.VerifyAccessToken(context.Background(), token); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected invalid token for issuer/audience mismatch, got %v", err)
	}
}

func TestVerifyAccessTokenRejectsNonAccessType(t *testing.T) {
	t.Parallel()

	issuer, err := NewJWTIssuer("test-secret", "xtiitch-api", "xtiitch-clients")
	if err != nil {
		t.Fatalf("new jwt issuer: %v", err)
	}

	claims := jwt.MapClaims{
		"aud":         "xtiitch-clients",
		"business_id": "business-1",
		"exp":         time.Now().Add(time.Hour).Unix(),
		"iat":         time.Now().Unix(),
		"iss":         "xtiitch-api",
		"role":        "owner",
		"sub":         "user-1",
		"typ":         "refresh",
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := issuer.VerifyAccessToken(context.Background(), signed); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected invalid token for non-access type, got %v", err)
	}
}
