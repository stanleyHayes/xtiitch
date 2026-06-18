package growthapp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var (
	ErrInvalidInput        = errors.New("invalid growth input")
	ErrAffiliateNotFound   = errors.New("affiliate not found")
	ErrSponsoredAdNotFound = errors.New("sponsored ad not found")
	ErrReferralNotFound    = errors.New("referral code not found")
	affiliateCodePattern   = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$`)
	uuidPattern            = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

type Service struct {
	affiliates ports.AffiliateClickRepository
	sponsored  ports.SponsoredPlacementRepository
	referrals  ports.ReferralRepository
	ids        ports.IDGenerator
}

type Dependencies struct {
	Affiliates ports.AffiliateClickRepository
	Sponsored  ports.SponsoredPlacementRepository
	Referrals  ports.ReferralRepository
	IDs        ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{
		affiliates: deps.Affiliates,
		sponsored:  deps.Sponsored,
		referrals:  deps.Referrals,
		ids:        deps.IDs,
	}
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

type ListSponsoredPlacementsCommand struct {
	Limit int
}

func (s Service) ListSponsoredPlacements(
	ctx context.Context,
	cmd ListSponsoredPlacementsCommand,
) ([]ports.SponsoredPlacementRecord, error) {
	if s.sponsored == nil {
		return nil, ErrInvalidInput
	}
	limit := cmd.Limit
	if limit <= 0 {
		limit = 6
	}
	if limit > 12 {
		limit = 12
	}
	return s.sponsored.ListActiveSponsoredPlacements(ctx, ports.ListActiveSponsoredPlacementsInput{
		Limit: limit,
	})
}

type RecordSponsoredAdEventCommand struct {
	CampaignID  string
	EventType   string
	VisitorID   string
	PageURL     string
	ReferrerURL string
	UserAgent   string
	IPAddress   string
}

func (s Service) RecordSponsoredAdEvent(
	ctx context.Context,
	cmd RecordSponsoredAdEventCommand,
) (ports.SponsoredAdEventRecord, error) {
	if s.sponsored == nil || s.ids == nil {
		return ports.SponsoredAdEventRecord{}, ErrInvalidInput
	}
	campaignID := common.ID(strings.TrimSpace(cmd.CampaignID))
	if campaignID.IsZero() || !uuidPattern.MatchString(campaignID.String()) {
		return ports.SponsoredAdEventRecord{}, ErrInvalidInput
	}
	eventType := normalizeEventType(cmd.EventType)
	if eventType == "" {
		return ports.SponsoredAdEventRecord{}, ErrInvalidInput
	}
	visitorID := limitText(cmd.VisitorID, 120)
	ipHash := hashIPAddress("xtiitch-sponsored-event:", cmd.IPAddress)
	if visitorID == "" && ipHash == "" {
		return ports.SponsoredAdEventRecord{}, ErrInvalidInput
	}
	if visitorID == "" {
		visitorID = "ip:" + ipHash[:32]
	}

	record, err := s.sponsored.RecordSponsoredAdEvent(ctx, ports.RecordSponsoredAdEventInput{
		EventID:     s.ids.NewID(),
		CampaignID:  campaignID,
		EventType:   eventType,
		VisitorID:   visitorID,
		PageURL:     limitText(cmd.PageURL, 512),
		ReferrerURL: limitText(cmd.ReferrerURL, 512),
		UserAgent:   limitText(cmd.UserAgent, 512),
		IPHash:      ipHash,
	})
	if errors.Is(err, ports.ErrNotFound) {
		return ports.SponsoredAdEventRecord{}, ErrSponsoredAdNotFound
	}
	if err != nil {
		return ports.SponsoredAdEventRecord{}, err
	}
	return record, nil
}

type ResolveReferralCodeCommand struct {
	Code string
}

func (s Service) ResolveReferralCode(
	ctx context.Context,
	cmd ResolveReferralCodeCommand,
) (ports.ReferralCodeRecord, error) {
	if s.referrals == nil {
		return ports.ReferralCodeRecord{}, ErrInvalidInput
	}
	code := strings.ToUpper(strings.TrimSpace(cmd.Code))
	if !affiliateCodePattern.MatchString(code) {
		return ports.ReferralCodeRecord{}, ErrInvalidInput
	}
	record, err := s.referrals.ResolveReferralCode(ctx, ports.ResolveReferralCodeInput{
		Code: code,
	})
	if errors.Is(err, ports.ErrNotFound) {
		return ports.ReferralCodeRecord{}, ErrReferralNotFound
	}
	if err != nil {
		return ports.ReferralCodeRecord{}, err
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

func hashIPAddress(parts ...string) string {
	salt := "xtiitch-affiliate-click:"
	ipAddress := ""
	if len(parts) == 1 {
		ipAddress = parts[0]
	} else if len(parts) >= 2 {
		salt = parts[0]
		ipAddress = parts[1]
	}
	trimmed := strings.TrimSpace(ipAddress)
	if trimmed == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(salt + strings.ToLower(trimmed)))
	return hex.EncodeToString(sum[:])
}

func normalizeEventType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "impression":
		return "impression"
	case "click":
		return "click"
	default:
		return ""
	}
}
