package authadapter

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
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

func (issuer JWTIssuer) IssueAdminAccessToken(_ context.Context, input ports.AdminAccessTokenInput) (string, error) {
	claims := jwt.MapClaims{
		"aud":   issuer.audience,
		"exp":   input.ExpiresAt.Unix(),
		"iat":   input.IssuedAt.Unix(),
		"iss":   issuer.issuer,
		"role":  string(input.Role),
		"scope": "admin",
		"sub":   input.Subject.String(),
		"typ":   "admin_access",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = "default"

	return token.SignedString(issuer.signingKey)
}

// IssueMFAChallengeToken mints a short-lived token that stands in for "password
// verified, second factor still pending". It is not an access token: it carries
// typ "mfa_challenge" and grants nothing on its own — only the MFA verify
// endpoint accepts it, in exchange for a full session.
func (issuer JWTIssuer) IssueMFAChallengeToken(_ context.Context, input ports.MFAChallengeInput) (string, error) {
	claims := jwt.MapClaims{
		"aud":         issuer.audience,
		"business_id": input.BusinessID.String(),
		"exp":         input.ExpiresAt.Unix(),
		"iat":         input.IssuedAt.Unix(),
		"iss":         issuer.issuer,
		"role":        string(input.Role),
		"sub":         input.Subject.String(),
		"typ":         "mfa_challenge",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = "default"

	return token.SignedString(issuer.signingKey)
}

// VerifyMFAChallengeToken validates a pending-second-factor token and returns the
// principal it stands for. It rejects anything that is not a fresh, well-formed
// mfa_challenge token.
func (issuer JWTIssuer) VerifyMFAChallengeToken(_ context.Context, tokenString string) (ports.VerifiedAccessToken, error) {
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

	if tokenType, _ := claims["typ"].(string); tokenType != "mfa_challenge" {
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

func (issuer JWTIssuer) VerifyAdminAccessToken(_ context.Context, tokenString string) (ports.VerifiedAdminAccessToken, error) {
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
		return ports.VerifiedAdminAccessToken{}, ErrInvalidToken
	}

	if tokenType, _ := claims["typ"].(string); tokenType != "admin_access" {
		return ports.VerifiedAdminAccessToken{}, ErrInvalidToken
	}
	if scope, _ := claims["scope"].(string); scope != "admin" {
		return ports.VerifiedAdminAccessToken{}, ErrInvalidToken
	}

	subject, _ := claims["sub"].(string)
	roleValue, _ := claims["role"].(string)
	role := admindomain.Role(roleValue)
	if subject == "" || !role.Valid() {
		return ports.VerifiedAdminAccessToken{}, ErrInvalidToken
	}

	return ports.VerifiedAdminAccessToken{
		Subject: common.ID(subject),
		Role:    role,
	}, nil
}

func AccessTokenTTL(now time.Time) time.Time {
	return now.Add(15 * time.Minute)
}
