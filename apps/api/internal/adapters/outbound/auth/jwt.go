package authadapter

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var (
	ErrMissingJWTSigningKey = errors.New("jwt signing key is required")
	ErrInvalidToken         = errors.New("invalid access token")
)

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

func (issuer JWTIssuer) VerifyAccessToken(_ context.Context, tokenString string) (ports.VerifiedAccessToken, error) {
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(*jwt.Token) (any, error) {
		return issuer.signingKey, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer.issuer),
		jwt.WithAudience(issuer.audience),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !token.Valid {
		return ports.VerifiedAccessToken{}, ErrInvalidToken
	}

	if tokenType, _ := claims["typ"].(string); tokenType != "access" {
		return ports.VerifiedAccessToken{}, ErrInvalidToken
	}

	subject, _ := claims["sub"].(string)
	businessID, _ := claims["business_id"].(string)
	role, _ := claims["role"].(string)
	if subject == "" || businessID == "" {
		return ports.VerifiedAccessToken{}, ErrInvalidToken
	}

	return ports.VerifiedAccessToken{
		Subject:    common.ID(subject),
		BusinessID: common.ID(businessID),
		Role:       business.UserRole(role),
	}, nil
}

func AccessTokenTTL(now time.Time) time.Time {
	return now.Add(15 * time.Minute)
}
