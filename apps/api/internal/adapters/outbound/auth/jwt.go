package authadapter

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

var ErrMissingJWTSigningKey = errors.New("jwt signing key is required")

type JWTIssuer struct {
	signingKey []byte
	issuer     string
	audience   string
}

func NewJWTIssuer(signingKey string, issuer string, audience string) (JWTIssuer, error) {
	if signingKey == "" {
		return JWTIssuer{}, ErrMissingJWTSigningKey
	}

	return JWTIssuer{
		signingKey: []byte(signingKey),
		issuer:     issuer,
		audience:   audience,
	}, nil
}

func (issuer JWTIssuer) IssueAccessToken(_ context.Context, input ports.AccessTokenInput) (string, error) {
	claims := jwt.MapClaims{
		"aud":         issuer.audience,
		"business_id": input.BusinessID.String(),
		"exp":         input.ExpiresAt.Unix(),
		"iat":         input.IssuedAt.Unix(),
		"iss":         issuer.issuer,
		"role":        string(input.Role),
		"sub":         input.Subject.String(),
		"typ":         "access",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = "default"

	return token.SignedString(issuer.signingKey)
}

func AccessTokenTTL(now time.Time) time.Time {
	return now.Add(15 * time.Minute)
}
