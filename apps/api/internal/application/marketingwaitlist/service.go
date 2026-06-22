// Package marketingwaitlist captures leads from the public marketing site,
// storing every submission and (best-effort) emailing the team.
package marketingwaitlist

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// ErrInvalidInput is returned when a required field is missing or malformed. The
// public handler maps it to a 400; everything else is opaque.
var ErrInvalidInput = errors.New("invalid waitlist submission")

const (
	maxNameLen     = 200
	maxBusinessLen = 200
	maxPhoneLen    = 40
	maxEmailLen    = 320
	maxCityLen     = 120
	maxMessageLen  = 2000
	maxSourceLen   = 120
	maxUserAgent   = 1000
	defaultLimit   = 500
)

type Service struct {
	repo    ports.MarketingWaitlistRepository
	emails  ports.EmailSender
	ids     ports.IDGenerator
	emailTo string
	logger  *slog.Logger
}

type Dependencies struct {
	Repo ports.MarketingWaitlistRepository
	// Emails is nil when Resend is not configured; the email step is then skipped.
	Emails ports.EmailSender
	IDs    ports.IDGenerator
	// EmailTo is MARKETING_WAITLIST_EMAIL_TO; empty disables the team email.
	EmailTo string
	Logger  *slog.Logger
}

func NewService(deps Dependencies) Service {
	return Service{
		repo:    deps.Repo,
		emails:  deps.Emails,
		ids:     deps.IDs,
		emailTo: strings.TrimSpace(deps.EmailTo),
		logger:  deps.Logger,
	}
}

// SubmitCommand is one public waitlist submission. Source and UserAgent are
// captured server-side for attribution.
type SubmitCommand struct {
	Name      string
	Business  string
	Phone     string
	Email     string
	City      string
	Message   string
	Source    string
	UserAgent string
}

// Submit validates a lead, stores it, and (best-effort) emails the team. A send
// failure never fails the request once the row is stored. The stored record is
// returned, but the public handler discards it and always answers 202.
func (s Service) Submit(ctx context.Context, cmd SubmitCommand) (ports.WaitlistLeadRecord, error) {
	input, err := normalizeSubmission(cmd)
	if err != nil {
		return ports.WaitlistLeadRecord{}, err
	}
	input.LeadID = s.ids.NewID()

	lead, err := s.repo.CreateWaitlistLead(ctx, input)
	if err != nil {
		return ports.WaitlistLeadRecord{}, err
	}

	s.notifyTeam(ctx, lead)

	return lead, nil
}

// notifyTeam emails the configured address, best-effort. Missing config (no
// sender or no recipient) is a silent no-op; a send error is logged, not
// returned, so the lead is never lost to a flaky email provider.
func (s Service) notifyTeam(ctx context.Context, lead ports.WaitlistLeadRecord) {
	if s.emails == nil || s.emailTo == "" {
		return
	}

	var b strings.Builder
	fmt.Fprintf(&b, "A new lead joined the Xtiitch waitlist.\n\n")
	fmt.Fprintf(&b, "Name:     %s\n", lead.Name)
	fmt.Fprintf(&b, "Business: %s\n", lead.Business)
	fmt.Fprintf(&b, "Phone:    %s\n", lead.Phone)
	if lead.Email != "" {
		fmt.Fprintf(&b, "Email:    %s\n", lead.Email)
	}
	if lead.City != "" {
		fmt.Fprintf(&b, "City:     %s\n", lead.City)
	}
	if lead.Source != "" {
		fmt.Fprintf(&b, "Source:   %s\n", lead.Source)
	}
	if lead.Message != "" {
		fmt.Fprintf(&b, "\nMessage:\n%s\n", lead.Message)
	}

	if err := s.emails.Send(ctx, ports.EmailMessage{
		To:      s.emailTo,
		Subject: "New Xtiitch waitlist lead",
		Body:    b.String(),
	}); err != nil && s.logger != nil {
		s.logger.Warn("waitlist lead email failed", "error", err, "lead_id", lead.LeadID.String())
	}
}

// ListLeads returns the most recent leads, newest first, capped at a reasonable
// limit. It is invoked only behind the admin authenticator; an out-of-range
// limit is clamped.
func (s Service) ListLeads(ctx context.Context, limit int) ([]ports.WaitlistLeadRecord, error) {
	if limit <= 0 || limit > defaultLimit {
		limit = defaultLimit
	}
	return s.repo.ListWaitlistLeads(ctx, limit)
}

func normalizeSubmission(cmd SubmitCommand) (ports.CreateWaitlistLeadInput, error) {
	name := strings.TrimSpace(cmd.Name)
	business := strings.TrimSpace(cmd.Business)
	phone := strings.TrimSpace(cmd.Phone)

	if name == "" || len(name) > maxNameLen {
		return ports.CreateWaitlistLeadInput{}, ErrInvalidInput
	}
	if business == "" || len(business) > maxBusinessLen {
		return ports.CreateWaitlistLeadInput{}, ErrInvalidInput
	}
	if phone == "" || len(phone) > maxPhoneLen {
		return ports.CreateWaitlistLeadInput{}, ErrInvalidInput
	}

	email := strings.TrimSpace(cmd.Email)
	if email != "" {
		normalized, err := normalizeOptionalEmail(email)
		if err != nil {
			return ports.CreateWaitlistLeadInput{}, err
		}
		email = normalized
	}

	city := strings.TrimSpace(cmd.City)
	message := strings.TrimSpace(cmd.Message)
	source := strings.TrimSpace(cmd.Source)
	userAgent := strings.TrimSpace(cmd.UserAgent)
	if len(city) > maxCityLen ||
		len(message) > maxMessageLen ||
		len(source) > maxSourceLen ||
		len(email) > maxEmailLen {
		return ports.CreateWaitlistLeadInput{}, ErrInvalidInput
	}
	if len(userAgent) > maxUserAgent {
		userAgent = userAgent[:maxUserAgent]
	}

	return ports.CreateWaitlistLeadInput{
		Name:      name,
		Business:  business,
		Phone:     phone,
		Email:     email,
		City:      city,
		Message:   message,
		Source:    source,
		UserAgent: userAgent,
	}, nil
}

// normalizeOptionalEmail validates a basic x@y.z shape, mirroring the customer
// auth email normalisation so the same addresses are accepted across the app.
func normalizeOptionalEmail(raw string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(raw))
	if err != nil {
		return "", ErrInvalidInput
	}
	address := strings.ToLower(parsed.Address)
	at := strings.LastIndex(address, "@")
	if at < 1 || !strings.Contains(address[at+1:], ".") {
		return "", ErrInvalidInput
	}
	return address, nil
}
