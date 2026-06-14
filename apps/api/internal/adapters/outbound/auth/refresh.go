package authadapter

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

type RefreshTokenIssuer struct{}

func NewRefreshTokenIssuer() RefreshTokenIssuer {
	return RefreshTokenIssuer{}
}

func (RefreshTokenIssuer) NewRefreshToken() (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(token), nil
}

func (RefreshTokenIssuer) HashRefreshToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
