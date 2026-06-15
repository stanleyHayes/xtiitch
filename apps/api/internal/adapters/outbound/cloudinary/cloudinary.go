// Package cloudinary signs direct browser-to-Cloudinary image uploads. The
// signature algorithm is Cloudinary's documented one (SHA-1 over the sorted
// upload parameters concatenated with the API secret). SHA-1 is mandated by the
// provider's API here, not chosen for security.
package cloudinary

import (
	"context"
	"crypto/sha1" //nolint:gosec // Cloudinary upload signatures require SHA-1.
	"encoding/hex"
	"errors"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var ErrInvalidCloudinaryURL = errors.New("invalid cloudinary url")

type Client struct {
	cloudName string
	apiKey    string
	apiSecret string
	now       func() time.Time
}

// NewClientFromURL parses a CLOUDINARY_URL of the form
// cloudinary://<api_key>:<api_secret>@<cloud_name>.
func NewClientFromURL(rawURL string) (Client, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return Client{}, err
	}
	if parsed.Scheme != "cloudinary" || parsed.User == nil || parsed.Host == "" {
		return Client{}, ErrInvalidCloudinaryURL
	}
	secret, ok := parsed.User.Password()
	if !ok || parsed.User.Username() == "" {
		return Client{}, ErrInvalidCloudinaryURL
	}

	return Client{
		cloudName: parsed.Host,
		apiKey:    parsed.User.Username(),
		apiSecret: secret,
		now:       time.Now,
	}, nil
}

func (c Client) SignUpload(_ context.Context, _ common.TenantScope, folder string) (ports.SignedUpload, error) {
	timestamp := c.now().Unix()
	params := map[string]string{"timestamp": strconv.FormatInt(timestamp, 10)}
	if folder != "" {
		params["folder"] = folder
	}

	return ports.SignedUpload{
		Signature: signParams(params, c.apiSecret),
		Timestamp: timestamp,
		CloudName: c.cloudName,
		APIKey:    c.apiKey,
		Folder:    folder,
	}, nil
}

// signParams builds Cloudinary's signature: parameters sorted by key, joined as
// key=value with &, concatenated with the API secret, then SHA-1 hex.
func signParams(params map[string]string, secret string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for index, key := range keys {
		if index > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(params[key])
	}
	builder.WriteString(secret)

	sum := sha1.Sum([]byte(builder.String())) //nolint:gosec // provider requirement
	return hex.EncodeToString(sum[:])
}
