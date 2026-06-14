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
