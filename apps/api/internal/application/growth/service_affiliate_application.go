package growthapp

import (
	"context"
	"errors"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

var (
	ErrAffiliateCodeTaken  = errors.New("affiliate code already exists")
	ErrAffiliateEmailTaken = errors.New("affiliate email already exists")
)

type AffiliateCodeAvailability struct {
	Code      string
	Available bool
	Reason    string
}

func (s Service) CheckAffiliateCodeAvailability(
	ctx context.Context,
	raw string,
) (AffiliateCodeAvailability, error) {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if !affiliateCodePattern.MatchString(code) {
		return AffiliateCodeAvailability{Code: code, Reason: "invalid"}, nil
	}
	if s.applications == nil {
		return AffiliateCodeAvailability{}, ErrInvalidInput
	}
	exists, err := s.applications.AffiliateCodeExists(ctx, code)
	if err != nil {
		return AffiliateCodeAvailability{}, err
	}
	if exists {
		return AffiliateCodeAvailability{Code: code, Reason: "taken"}, nil
	}
	return AffiliateCodeAvailability{Code: code, Available: true}, nil
}

type SubmitAffiliateApplicationCommand struct {
	ApplicantType     string
	DisplayName       string
	ContactName       string
	Email             string
	Phone             string
	WebsiteURL        string
	RequestedCode     string
	AudienceSummary   string
	PromotionChannels []string
	Consent           bool
	UserAgent         string
	IPAddress         string
}

func (s Service) SubmitAffiliateApplication(
	ctx context.Context,
	cmd SubmitAffiliateApplicationCommand,
) (ports.AffiliateApplicationRecord, error) {
	if s.applications == nil || s.ids == nil || s.refreshTokens == nil || s.clock == nil || !cmd.Consent {
		return ports.AffiliateApplicationRecord{}, ErrInvalidInput
	}

	input, err := normalizeAffiliateApplication(cmd)
	if err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}
	input.ApplicationID = s.ids.NewID()
	input.AffiliateID = s.ids.NewID()
	input.AffiliateAccountID = s.ids.NewID()
	input.ActivationTokenID = s.ids.NewID()
	activationToken, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}
	input.ActivationTokenHash = s.refreshTokens.HashRefreshToken(activationToken)
	input.ConsentAt = s.clock.Now().UTC()
	input.ActivationTokenExpiresAt = input.ConsentAt.Add(48 * time.Hour)
	input.IPHash = hashIPAddress("xtiitch-affiliate-application:", cmd.IPAddress)
	input.UserAgent = limitText(cmd.UserAgent, 512)

	record, err := s.applications.SubmitAffiliateApplication(ctx, input)
	if errors.Is(err, ports.ErrAffiliateCodeTaken) {
		return ports.AffiliateApplicationRecord{}, ErrAffiliateCodeTaken
	}
	if errors.Is(err, ports.ErrAffiliateEmailTaken) {
		return ports.AffiliateApplicationRecord{}, ErrAffiliateEmailTaken
	}
	if err != nil {
		return ports.AffiliateApplicationRecord{}, err
	}
	s.sendAffiliateWelcomeEmail(ctx, record, activationToken)
	return record, nil
}

func (s Service) sendAffiliateWelcomeEmail(
	ctx context.Context,
	record ports.AffiliateApplicationRecord,
	activationToken string,
) {
	if s.emails == nil || record.Email == "" {
		return
	}
	_ = s.emails.Send(ctx, ports.EmailMessage{
		To:      record.Email,
		Subject: "Activate your Xtiitch Partner account",
		Body: "Hi " + record.DisplayName + ",\n\nYour Partner code " +
			record.RequestedCode + " is ready. Set your password and open your dashboard within 48 hours:\n" +
			"https://partners.xtiitch.com/activate?token=" + url.QueryEscape(activationToken),
		ReplyTo: notification.ReplyToOperational,
	})
}

func normalizeAffiliateApplication(
	cmd SubmitAffiliateApplicationCommand,
) (ports.SubmitAffiliateApplicationInput, error) {
	applicantType := strings.ToLower(strings.TrimSpace(cmd.ApplicantType))
	if applicantType == "" {
		applicantType = "person"
	}
	if applicantType != "person" && applicantType != "business" && applicantType != "agency" {
		return ports.SubmitAffiliateApplicationInput{}, ErrInvalidInput
	}

	displayName := limitText(cmd.DisplayName, 120)
	contactName := limitText(cmd.ContactName, 120)
	email, err := normalizeApplicationEmail(cmd.Email)
	phone := limitText(cmd.Phone, 40)
	if displayName == "" || contactName == "" || phone == "" || err != nil {
		return ports.SubmitAffiliateApplicationInput{}, ErrInvalidInput
	}

	code := strings.ToUpper(strings.TrimSpace(cmd.RequestedCode))
	if !affiliateCodePattern.MatchString(code) {
		return ports.SubmitAffiliateApplicationInput{}, ErrInvalidInput
	}

	websiteURL, err := normalizeApplicationURL(cmd.WebsiteURL)
	if err != nil {
		return ports.SubmitAffiliateApplicationInput{}, ErrInvalidInput
	}
	channels, err := normalizePromotionChannels(cmd.PromotionChannels)
	if err != nil {
		return ports.SubmitAffiliateApplicationInput{}, ErrInvalidInput
	}

	return ports.SubmitAffiliateApplicationInput{
		ApplicantType:     applicantType,
		DisplayName:       displayName,
		ContactName:       contactName,
		Email:             email,
		Phone:             phone,
		WebsiteURL:        websiteURL,
		RequestedCode:     code,
		AudienceSummary:   limitText(cmd.AudienceSummary, 1000),
		PromotionChannels: channels,
	}, nil
}

func normalizeApplicationEmail(value string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(normalized)
	if err != nil || address.Address != normalized || len(normalized) > 254 {
		return "", ErrInvalidInput
	}
	return normalized, nil
}

func normalizeApplicationURL(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return "", ErrInvalidInput
	}
	return limitText(parsed.String(), 512), nil
}

func normalizePromotionChannels(values []string) ([]string, error) {
	allowed := map[string]bool{
		"blog": true, "email": true, "facebook": true, "instagram": true,
		"other": true, "tiktok": true, "whatsapp": true, "youtube": true,
	}
	seen := make(map[string]bool, len(values))
	channels := make([]string, 0, len(values))
	for _, value := range values {
		channel := strings.ToLower(strings.TrimSpace(value))
		if !allowed[channel] {
			return nil, ErrInvalidInput
		}
		if !seen[channel] {
			seen[channel] = true
			channels = append(channels, channel)
		}
	}
	if len(channels) == 0 || len(channels) > 8 {
		return nil, ErrInvalidInput
	}
	return channels, nil
}
