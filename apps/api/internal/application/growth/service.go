package growthapp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

var (
	ErrInvalidInput      = errors.New("invalid growth input")
	ErrAffiliateNotFound = errors.New("affiliate not found")
	affiliateCodePattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$`)
)

type Service struct {
	affiliates ports.AffiliateClickRepository
	ids        ports.IDGenerator
}

type Dependencies struct {
	Affiliates ports.AffiliateClickRepository
	IDs        ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{affiliates: deps.Affiliates, ids: deps.IDs}
}

type RecordAffiliateClickCommand struct {
	Code        string
	VisitorID   string
	LandingURL  string
	ReferrerURL string
	UserAgent   string
	IPAddress   string
}

func (s Service) RecordAffiliateClick(ctx context.Context, cmd RecordAffiliateClickCommand) (ports.AffiliateClickRecord, error) {
	if s.affiliates == nil || s.ids == nil {
		return ports.AffiliateClickRecord{}, ErrInvalidInput
	}

	code := strings.ToUpper(strings.TrimSpace(cmd.Code))
	if !affiliateCodePattern.MatchString(code) {
		return ports.AffiliateClickRecord{}, ErrInvalidInput
	}

	visitorID := limitText(cmd.VisitorID, 120)
	ipHash := hashIPAddress(cmd.IPAddress)
	if visitorID == "" && ipHash == "" {
		return ports.AffiliateClickRecord{}, ErrInvalidInput
	}

	record, err := s.affiliates.RecordAffiliateClick(ctx, ports.RecordAffiliateClickInput{
		ClickID:     s.ids.NewID(),
		Code:        code,
		VisitorID:   visitorID,
		LandingURL:  limitText(cmd.LandingURL, 512),
		ReferrerURL: limitText(cmd.ReferrerURL, 512),
		UserAgent:   limitText(cmd.UserAgent, 512),
		IPHash:      ipHash,
	})
	if errors.Is(err, ports.ErrNotFound) {
		return ports.AffiliateClickRecord{}, ErrAffiliateNotFound
	}
	if err != nil {
		return ports.AffiliateClickRecord{}, err
	}
	return record, nil
}

func limitText(value string, maxLength int) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= maxLength {
		return trimmed
	}
	return trimmed[:maxLength]
}

func hashIPAddress(ipAddress string) string {
	trimmed := strings.TrimSpace(ipAddress)
	if trimmed == "" {
		return ""
	}
	sum := sha256.Sum256([]byte("xtiitch-affiliate-click:" + strings.ToLower(trimmed)))
	return hex.EncodeToString(sum[:])
}
